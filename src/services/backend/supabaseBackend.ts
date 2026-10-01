import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError, toAppError } from '../errors';
import { prepareEvidenceImage } from '../imageService';
import { supabaseEvidenceFiles, workerEvidenceFiles, type EvidenceFiles } from '../evidenceFiles';
import { EVIDENCE_BUCKET, isNeonConfigured } from '../supabaseClient';
import { normalizeSearch } from '../../logic/learning';
import {
  buildCatalog,
  mapAchievementUnlocks,
  mapLessonDetail,
  mapLessonProgress,
  mapAnswerFeedback,
  mapAttemptRecord,
  mapQuestions,
  mapQuizResult,
  mapPlayerState,
  mapXpTransaction,
  type AchievementRow,
  type CategoryRow,
  type ChallengeRow,
  type LessonRow,
  type LessonSectionRow,
  type LevelRow,
  type QuestionRow,
  type QuizRow,
  type WorldAreaRow,
  type WorldItemRow,
  type WorldStageRow,
} from './mappers';
import type {
  AdminContentKind,
  AdminContentRow,
  AdminDashboard,
  AdminLog,
  AdminUser,
  ClientLogEntry,
  EvidenceInput,
  GameBackend,
  PlaceStateDTO,
  VisitablePlayerDTO,
  VisitDTO,
} from './types';

/**
 * Dados reais no Supabase.
 * - Leitura de conteúdo: selects com colunas explícitas (o gabarito nunca é pedido).
 * - Toda escrita do jogo: funções RPC do banco, que validam as regras.
 * - Estado do jogador: uma única chamada (get_player_state).
 */
export class SupabaseBackend implements GameBackend {
  readonly mode = 'supabase' as const;

  /** Fotos: Supabase Storage ou, no Neon, a API do Worker (mesmas regras). */
  private readonly files: EvidenceFiles;
  /** No Neon a conta do login vira perfil do jogo na primeira entrada (ensure_account). */
  private accountReady: Promise<void> | null = null;

  constructor(private readonly sb: SupabaseClient) {
    this.files = isNeonConfigured
      ? workerEvidenceFiles(async () => (await this.sb.auth.getSession()).data.session?.access_token ?? null)
      : supabaseEvidenceFiles(sb, EVIDENCE_BUCKET);
  }

  private ensureAccount(): Promise<void> {
    if (!isNeonConfigured) return Promise.resolve();
    // (rpc() já tenta de novo quando o banco ainda não reconhece o token)
    this.accountReady ??= this.rpc<void>('ensure_account').catch((err) => {
      this.accountReady = null;
      throw err;
    });
    return this.accountReady;
  }

  private async rpc<T = any>(fn: string, args?: Record<string, unknown>): Promise<T> {
    // Neon: logo depois de a computação acordar, o banco às vezes ainda não reconhece o
    // token (auth.uid() nulo) mesmo com a sessão válida. Tenta de novo antes de desistir;
    // só a última falha vira erro (e encerra a sessão, se for mesmo falta de login).
    for (let n = 0; ; n++) {
      const { data, error } = await this.sb.rpc(fn, args);
      if (!error) return data as T;
      const retry = isNeonConfigured && n < 4 && /not_authenticated/i.test(error.message);
      if (!retry) throw toAppError(error);
      await new Promise((r) => setTimeout(r, 350 * (n + 1)));
    }
  }

  private async userId(): Promise<string> {
    const { data } = await this.sb.auth.getSession();
    const id = data.session?.user.id;
    if (!id) throw new AppError('not_authenticated');
    return id;
  }

  async loadCatalog() {
    const sb = this.sb;
    const results = await Promise.all([
      sb.from('categories')
        .select('id, name, slug, description, icon, image_url, color, topics, order_index')
        .eq('active', true),
      // Só o resumo das aulas (cards/filtros); as seções vêm sob demanda em loadLessonDetail.
      sb.from('lessons')
        .select(
          'id, category_id, topic, title, slug, description, difficulty, estimated_minutes, xp_reward, order_index, ' +
            'prerequisite_lesson_id, active, lesson_sections (count)',
        ),
      // Só o resumo dos quizzes; as perguntas vêm sob demanda (loadQuizQuestions).
      sb.from('quizzes')
        .select('id, lesson_id, title, description, passing_score, xp_reward, improvement_xp_reward, attempts_allowed, active, quiz_questions (count)'),
      sb.from('challenges')
        .select(
          'id, category_id, lesson_id, icon, title, slug, description, instructions, safety_notes, difficulty, ' +
            'deadline_days, xp_reward, start_xp_reward, active, requires_evidence, requires_follow_up, why_it_matters, materials, evidence_instructions, duration_label, ' +
            'challenge_steps (id, title, description, step_type, order_index, required, xp_reward, day_offset, early_window_days, evidence_kind, deadline_offset_days, active)',
        ),
      sb.from('achievements')
        .select('id, name, slug, description, icon, category, xp_reward, requirement_type, requirement_value, requirement_count, order_index, active'),
      sb.from('levels').select('level_number, name, xp_required, description, icon'),
      sb.from('world_items')
        .select(
          'id, code, name, icon, description, meaning, area, category_id, item_type, rarity, milestone, ' +
            'unlock_type, unlock_reference, min_level, sort_order, metadata, unlock_title, unlock_message, active',
        ),
      sb.from('world_areas').select('code, name, icon, description, sort_order'),
      sb.from('world_stages').select('stage_number, name, icon, description, status, min_items, min_challenges, min_categories'),
    ]);

    const failed = results.find((r) => r.error);
    if (failed?.error) throw toAppError(failed.error, 'load_content');

    const [categories, lessons, quizzes, challenges, achievements, levels, worldItems, worldAreas, worldStages] = results.map((r) => r.data);
    return buildCatalog({
      categories: categories as unknown as CategoryRow[],
      lessons: lessons as unknown as LessonRow[],
      quizzes: quizzes as unknown as QuizRow[],
      challenges: challenges as unknown as ChallengeRow[],
      achievements: achievements as unknown as AchievementRow[],
      levels: levels as unknown as LevelRow[],
      worldItems: worldItems as unknown as WorldItemRow[],
      worldAreas: worldAreas as unknown as WorldAreaRow[],
      worldStages: worldStages as unknown as WorldStageRow[],
    });
  }

  async loadPlayer() {
    await this.ensureAccount();
    const state = await this.rpc('get_player_state');
    if (!state?.profile) throw new AppError('load_progress');
    return mapPlayerState(state);
  }

  async updateProfile(input: { displayName: string; username: string; avatar: string; avatarUrl: string | null }) {
    const userId = await this.userId();
    const { error } = await this.sb
      .from('profiles')
      .update({
        display_name: input.displayName.trim(),
        username: input.username.trim().toLowerCase(),
        avatar_emoji: input.avatar,
        avatar_url: input.avatarUrl,
      })
      .eq('user_id', userId);
    if (error) throw toAppError(error);
  }

  async loadLessonDetail(lessonId: string) {
    const [lesson, sections, related] = await Promise.all([
      this.sb.from('lessons').select('id, summary_points').eq('id', lessonId).eq('active', true).maybeSingle(),
      this.sb
        .from('lesson_sections')
        .select('id, section_type, icon, title, content, image_url, image_alt, video_url, blocks, order_index')
        .eq('lesson_id', lessonId)
        .order('order_index'),
      this.sb.from('lesson_related').select('related_lesson_id, order_index').eq('lesson_id', lessonId).order('order_index'),
    ]);
    const failed = [lesson, sections, related].find((r) => r.error);
    if (failed?.error) throw toAppError(failed.error, 'load_lesson');
    if (!lesson.data) throw new AppError('lesson_not_found');
    return mapLessonDetail(
      lessonId,
      (sections.data ?? []) as LessonSectionRow[],
      lesson.data.summary_points,
      (related.data ?? []).map((r) => r.related_lesson_id as string),
    );
  }

  async searchLessons(query: string) {
    // Mesmo tratamento da coluna gerada search_text: minúsculas e sem acentos.
    const term = normalizeSearch(query).replace(/[%_\*(),]/g, ' ').trim();
    if (term.length < 2) return [];
    const { data, error } = await this.sb
      .from('lessons')
      .select('id')
      .eq('active', true)
      .ilike('search_text', `%${term}%`)
      .order('order_index')
      .limit(30);
    if (error) throw toAppError(error);
    return (data ?? []).map((r) => r.id as string);
  }

  async trackLessonProgress(lessonId: string, sectionIndex: number) {
    const r = await this.rpc('track_lesson_progress', { p_lesson_id: lessonId, p_section_index: sectionIndex });
    return mapLessonProgress({ ...r, lesson_id: lessonId });
  }

  async setFavorite(lessonId: string, favorite: boolean) {
    if (favorite) {
      const { error } = await this.sb.from('user_lesson_favorites').insert({ lesson_id: lessonId });
      // Já favoritada (ex.: em outro dispositivo): o resultado desejado já existe.
      if (error && error.code !== '23505') throw toAppError(error);
    } else {
      const { error } = await this.sb.from('user_lesson_favorites').delete().eq('lesson_id', lessonId);
      if (error) throw toAppError(error);
    }
  }

  async completeLesson(lessonId: string) {
    const r = await this.rpc('complete_lesson', { p_lesson_id: lessonId });
    return { xpAwarded: r.xp_awarded, achievements: mapAchievementUnlocks(r.achievements) };
  }

  async loadQuizQuestions(quizId: string) {
    // Colunas públicas apenas: is_correct e explicações nunca são pedidos.
    const { data, error } = await this.sb
      .from('quiz_questions')
      .select('id, question, topic, question_type, order_index, points, quiz_options (id, option_text, order_index)')
      .eq('quiz_id', quizId)
      .eq('active', true)
      .order('order_index');
    if (error) throw toAppError(error, 'load_quiz');
    return mapQuestions((data ?? []) as unknown as QuestionRow[]);
  }

  async getActiveQuizAttempt(quizId: string) {
    const r = await this.rpc('get_active_quiz_attempt', { p_quiz_id: quizId });
    if (!r) return null;
    return {
      attemptId: r.attempt_id,
      attemptNumber: r.attempt_number,
      answers: (r.answers ?? []).map((a: any) => mapAnswerFeedback(a)),
    };
  }

  async listQuizAttempts(quizId?: string) {
    let query = this.sb
      .from('quiz_attempts')
      .select('id, quiz_id, attempt_number, status, score, correct_answers, total_questions, passed, started_at, completed_at')
      .order('started_at', { ascending: false })
      .limit(100);
    if (quizId) query = query.eq('quiz_id', quizId);
    const { data, error } = await query;
    if (error) throw toAppError(error);
    return (data ?? []).map(mapAttemptRecord);
  }

  async startQuizAttempt(quizId: string) {
    const r = await this.rpc('start_quiz_attempt', { p_quiz_id: quizId });
    return { attemptId: r.attempt_id as string, attemptNumber: r.attempt_number as number };
  }

  async answerQuestion(attemptId: string, questionId: string, optionId: string) {
    const r = await this.rpc('answer_quiz_question', {
      p_attempt_id: attemptId,
      p_question_id: questionId,
      p_option_id: optionId,
    });
    return mapAnswerFeedback(r, { questionId, optionId });
  }

  async finishQuizAttempt(attemptId: string) {
    return mapQuizResult(await this.rpc('finish_quiz_attempt', { p_attempt_id: attemptId }));
  }

  async acceptChallenge(challengeId: string) {
    await this.rpc('accept_challenge', { p_challenge_id: challengeId });
  }

  /**
   * Envia foto + miniatura para users/{uid}/challenges/{challengeId}/ e devolve os caminhos e metadados.
   * O registro no banco só acontece depois (RPC), que confere se o arquivo realmente existe:
   * um upload interrompido nunca vira evidência.
   */
  private async uploadPhoto(challengeId: string, file: File | null) {
    if (!file) return { filePath: null, thumbnailPath: null, fileName: null, mimeType: null, fileSize: null };
    const { image, thumbnail } = await prepareEvidenceImage(file);
    const userId = await this.userId();
    const base = `users/${userId}/challenges/${challengeId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    const filePath = `${base}.jpg`;
    const thumbnailPath = `${base}-thumb.jpg`;
    const [a, b] = await Promise.allSettled([
      this.files.upload(filePath, image, 'image/jpeg'),
      this.files.upload(thumbnailPath, thumbnail, 'image/jpeg'),
    ]);
    if (a.status === 'rejected' || b.status === 'rejected') {
      await this.removeFiles([a.status === 'rejected' ? null : filePath, b.status === 'rejected' ? null : thumbnailPath]);
      const reason = a.status === 'rejected' ? a.reason : (b as PromiseRejectedResult).reason;
      throw toAppError(reason, 'upload_failed');
    }
    return { filePath, thumbnailPath, fileName: file.name.slice(0, 200), mimeType: 'image/jpeg', fileSize: image.size };
  }

  /** Remove arquivos que não viraram evidência (a política do Storage só permite esses). */
  private async removeFiles(paths: (string | null)[]) {
    const list = paths.filter((x): x is string => Boolean(x));
    if (!list.length) return;
    await this.files.remove(list);
  }

  /** Chama a RPC e, se o servidor recusar, apaga as fotos que acabaram de subir. */
  private async rpcWithUpload<T = any>(
    fn: string,
    args: Record<string, unknown>,
    up: { filePath: string | null; thumbnailPath: string | null },
  ): Promise<T> {
    try {
      return await this.rpc<T>(fn, args);
    } catch (err) {
      await this.removeFiles([up.filePath, up.thumbnailPath]);
      throw err;
    }
  }

  async completeChallengeStep(userChallengeId: string, challengeId: string, stepId: string, input: EvidenceInput) {
    const up = await this.uploadPhoto(challengeId, input.file);
    const r = await this.rpcWithUpload('complete_challenge_step', {
      p_user_challenge_id: userChallengeId,
      p_step_id: stepId,
      p_file_path: up.filePath,
      p_thumbnail_path: up.thumbnailPath,
      p_file_name: up.fileName,
      p_mime_type: up.mimeType,
      p_file_size: up.fileSize,
      p_observation: input.description,
      p_captured_at: input.capturedAt,
    }, up);
    return { status: r.status, progressPercentage: r.progress_percentage, xpAwarded: r.xp_awarded };
  }

  async completeFollowup(followupId: string, challengeId: string, input: EvidenceInput) {
    const up = await this.uploadPhoto(challengeId, input.file);
    const r = await this.rpcWithUpload('complete_followup', {
      p_followup_id: followupId,
      p_file_path: up.filePath,
      p_thumbnail_path: up.thumbnailPath,
      p_file_name: up.fileName,
      p_mime_type: up.mimeType,
      p_file_size: up.fileSize,
      p_observation: input.description,
    }, up);
    return {
      xpAwarded: r.xp_awarded,
      pendingFollowups: r.pending_followups,
      achievements: mapAchievementUnlocks(r.achievements),
    };
  }

  async completeChallenge(userChallengeId: string) {
    const r = await this.rpc('complete_challenge', { p_user_challenge_id: userChallengeId });
    return {
      alreadyCompleted: Boolean(r.already_completed),
      xpAwarded: r.xp_awarded,
      achievements: mapAchievementUnlocks(r.achievements),
      worldItems: (r.world_items ?? []).map((w: any) => ({ id: w.id, code: w.code, name: w.name, icon: w.icon })),
    };
  }

  async cancelChallenge(userChallengeId: string) {
    await this.rpc('cancel_challenge', { p_user_challenge_id: userChallengeId });
  }

  async revealWorldItems() {
    const r = await this.rpc('reveal_world_items');
    return { revealed: r.revealed ?? [], achievements: mapAchievementUnlocks(r.achievements) };
  }

  async listXpHistory(page: number, pageSize: number) {
    const from = page * pageSize;
    // Pede um item a mais para saber se existe próxima página.
    const { data, error } = await this.sb
      .from('xp_transactions')
      .select('id, amount, xp_type, source_type, description, created_at')
      .order('created_at', { ascending: false })
      .range(from, from + pageSize);
    if (error) throw toAppError(error);
    const rows = data ?? [];
    return { items: rows.slice(0, pageSize).map(mapXpTransaction), hasMore: rows.length > pageSize };
  }

  async loadPlace(): Promise<PlaceStateDTO> {
    const r = await this.rpc('get_place_state');
    return {
      items: (r.items ?? []).map((i: any) => ({
        itemId: i.place_item_id,
        unlockedAt: i.unlocked_at,
        sourceType: i.source_type,
        sourceId: i.source_id,
        challengeId: i.challenge_id,
        evidenceId: i.evidence_id,
        originNote: i.origin_note,
        revealed: Boolean(i.revealed),
        state: i.state,
      })),
      progress: {
        stage: r.progress?.stage ?? 1,
        progress: Number(r.progress?.progress ?? 0),
        itemsUnlocked: r.progress?.items_unlocked ?? 0,
        itemsTotal: r.progress?.items_total ?? 0,
        categories: r.progress?.categories ?? 0,
        byCategory: r.progress?.by_category ?? {},
      },
    };
  }

  async revealPlaceItems() {
    await this.rpc('reveal_place_items');
  }

  async listVisitablePlayers(search?: string): Promise<VisitablePlayerDTO[]> {
    const rows = (await this.rpc('list_visitable_players', { p_search: search?.trim() || null })) ?? [];
    return rows.map((p: any) => ({ username: p.username, displayName: p.display_name ?? null, avatar: p.avatar ?? '🦊', level: p.level ?? 1 }));
  }

  async visitPlayer(username: string): Promise<VisitDTO> {
    const r = await this.rpc('visit_player', { p_username: username });
    return {
      player: {
        username: r.player.username,
        displayName: r.player.display_name ?? null,
        avatar: r.player.avatar ?? '🦊',
        level: r.player.level ?? 1,
        isMe: Boolean(r.player.is_me),
      },
      world: {
        name: r.world?.name ?? 'Meu Primeiro Ecossistema',
        stage: r.world?.stage ?? 1,
        progress: Number(r.world?.progress ?? 0),
        itemIds: r.world?.item_ids ?? [],
      },
      place: { itemIds: r.place?.item_ids ?? [] },
    };
  }

  async deleteAccount() {
    await this.rpc('request_account_deletion');
    // Fotos primeiro (users/{id}/challenges/…); depois a conta e todos os dados.
    await this.files.removeAll(await this.userId());
    await this.rpc('delete_my_account');
    // A sessão deixou de valer: limpa só neste dispositivo.
    await this.sb.auth.signOut({ scope: 'local' }).catch(() => {});
  }

  async logError(entry: ClientLogEntry) {
    try {
      await this.sb.rpc('log_client_error', {
        p_operation: entry.operation,
        p_code: entry.code,
        p_message: entry.message,
        p_context: entry.context,
      });
    } catch {
      // o registro de erros nunca pode quebrar o app
    }
  }

  async adminDashboard(): Promise<AdminDashboard> {
    const d = await this.rpc('admin_dashboard');
    return {
      users: d.users,
      usersWithProfile: d.users_with_profile,
      activeUsers30d: d.active_users_30d,
      lessonsCompleted: d.lessons_completed,
      quizzesTaken: d.quizzes_taken,
      quizzesPassed: d.quizzes_passed,
      challengesStarted: d.challenges_started,
      challengesCompleted: d.challenges_completed,
      evidenceSent: d.evidence_sent,
      xpDistributed: Number(d.xp_distributed),
      worldItemsUnlocked: d.world_items_unlocked,
      errors24h: d.errors_24h,
      content: d.content,
    };
  }

  async adminListUsers(search: string, page: number, pageSize: number) {
    const r = await this.rpc('admin_list_users', { p_search: search || null, p_limit: pageSize, p_offset: page * pageSize });
    const items: AdminUser[] = (r.items ?? []).map((u: any) => ({
      userId: u.user_id,
      displayName: u.display_name,
      username: u.username,
      email: u.email,
      role: u.role,
      level: u.level,
      totalXp: u.total_xp,
      challengesCompleted: u.challenges_completed,
      createdAt: u.created_at,
      lastActivity: u.last_activity,
      status: u.status,
    }));
    return { total: r.total, items };
  }

  async adminListContent(kind: AdminContentKind): Promise<AdminContentRow[]> {
    const r = await this.rpc('admin_list_content', { p_kind: kind });
    return (r ?? []).map((c: any) => ({
      id: c.id,
      title: c.title,
      active: c.active,
      group: c.group,
      xpReward: c.xp_reward,
      usage: c.usage,
    }));
  }

  async adminSetContentActive(kind: AdminContentKind, id: string, active: boolean) {
    await this.rpc('admin_set_content_active', { p_kind: kind, p_id: id, p_active: active });
  }

  async adminSetRole(userId: string, role: 'user' | 'admin') {
    await this.rpc('admin_set_role', { p_user_id: userId, p_role: role });
  }

  async adminListLogs(limit: number): Promise<AdminLog[]> {
    const r = await this.rpc('admin_list_logs', { p_limit: limit });
    return (r ?? []).map((l: any) => ({
      id: l.id,
      level: l.level,
      operation: l.operation,
      code: l.code,
      message: l.message,
      createdAt: l.created_at,
    }));
  }

  async getEvidenceImageUrl(path: string) {
    return this.files.signedUrl(path);
  }
}
