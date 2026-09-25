/**
 * Erros amigáveis. As funções do banco levantam códigos curtos
 * (ex.: 'quiz_not_passed'); aqui eles viram mensagens para o jogador.
 * O erro técnico original vai para o registro (logger.ts), nunca para a tela.
 */
import { logger } from './logger';
const MESSAGES: Record<string, string> = {
  not_authenticated: 'Sua sessão expirou. Entre novamente para continuar.',
  forbidden: 'Você não possui permissão para realizar esta ação.',
  not_found: 'Não encontramos o que você procurava. Atualize a página e tente de novo.',
  lesson_not_completed: 'Conclua a aula antes de continuar.',
  lesson_locked: 'Este conteúdo ainda está bloqueado. Conclua o conteúdo anterior para liberá-lo.',
  lesson_not_finished: 'Chegue até a última parte da aula para concluí-la.',
  lesson_not_found: 'Este conteúdo não existe ou não está mais disponível.',
  load_lesson: 'Não conseguimos carregar este conteúdo.',
  load_quiz: 'Não conseguimos carregar esta pergunta.',
  save_progress: 'Não foi possível salvar seu progresso. Vamos tentar de novo na próxima parte.',
  quiz_not_passed: 'Seja aprovado no quiz para liberar este desafio.',
  attempts_exhausted: 'Você já usou todas as tentativas deste quiz.',
  attempt_closed: 'Esta tentativa já foi encerrada. Comece o quiz de novo.',
  already_answered: 'Esta pergunta já foi respondida.',
  quiz_incomplete: 'Responda todas as perguntas antes de ver o resultado.',
  challenge_not_active: 'Este desafio não está mais em andamento.',
  challenge_expired: 'O prazo deste desafio terminou. Aceite o desafio novamente para recomeçar.',
  challenge_already_completed: 'Este desafio já foi concluído.',
  evidence_required: 'Envie a foto da realização antes de concluir o desafio.',
  evidence_already_sent: 'A realização deste desafio já foi registrada.',
  photo_required: 'Escolha uma foto para registrar a realização.',
  invalid_date: 'Confira a data: ela não pode estar no futuro nem antes do aceite do desafio.',
  invalid_evidence_path: 'Não foi possível enviar a evidência. Tente novamente.',
  evidence_file_missing: 'Não foi possível enviar a evidência. Tente novamente.',
  upload_failed: 'Não foi possível enviar a evidência. Tente novamente.',
  followup_not_due: 'Este acompanhamento ainda não está disponível.',
  followup_already_done: 'Este acompanhamento já foi registrado.',
  username_taken: 'Esse nome de usuário já está em uso. Escolha outro.',
  username_invalid: 'Use de 3 a 24 letras minúsculas, números ou _ no nome de usuário.',
  display_name_invalid: 'Informe um nome com até 40 caracteres.',
  image_invalid: 'Escolha um arquivo de imagem (JPG, PNG ou WebP).',
  image_too_large: 'A imagem é muito grande. Escolha uma foto de até 10 MB.',
  observation_required: 'Escreva uma observação para registrar esta etapa.',
  previous_steps_pending: 'Conclua as etapas anteriores do checklist primeiro.',
  step_already_completed: 'Esta etapa já foi registrada.',
  steps_pending: 'Ainda faltam etapas obrigatórias do checklist.',
  followups_pending: 'Ainda faltam acompanhamentos obrigatórios.',
  event_not_verified: 'Não foi possível confirmar esta ação. Atualize a página e tente novamente.',
  invalid_event: 'Ação inválida.',
  invalid_step: 'Esta etapa não pertence a este desafio.',
  network: 'Sem conexão com o servidor. Verifique sua internet e tente de novo.',
  invalid_credentials: 'E-mail ou senha incorretos.',
  email_not_confirmed: 'Confirme seu e-mail antes de entrar (confira sua caixa de entrada).',
  user_exists: 'Já existe uma conta com esse e-mail.',
  weak_password: 'A senha precisa ter pelo menos 6 caracteres.',
  rate_limited: 'Muitas tentativas seguidas. Aguarde um pouco e tente de novo.',
  load_progress: 'Não foi possível carregar seu progresso.',
  load_content: 'Não foi possível carregar os conteúdos.',
  deletion_not_confirmed: 'Confirme a exclusão da conta antes de continuar.',
  delete_account_failed: 'Não foi possível excluir a conta agora. Nada foi apagado do seu progresso; tente novamente.',
  cannot_change_own_role: 'Você não pode alterar o seu próprio papel.',
  invalid_input: 'Dados inválidos. Confira e tente novamente.',
  reset_link_invalid: 'Este link de recuperação é inválido ou expirou. Peça um novo.',
  passwords_differ: 'As senhas não são iguais.',
  unknown: 'Não foi possível concluir esta ação. Tente novamente.',
};

export class AppError extends Error {
  readonly code: string;

  constructor(code: string, cause?: unknown) {
    super(MESSAGES[code] ?? MESSAGES.unknown, { cause });
    this.code = code;
    this.name = 'AppError';
  }
}

interface ErrorLike {
  message?: string;
  code?: string;
  status?: number;
  details?: string;
}

function classify(err: ErrorLike): string | null {
  const message = err.message ?? '';
  const code = err.code ?? '';

  // Códigos levantados pelas funções do banco (raise exception 'codigo').
  if (MESSAGES[message]) return message;

  // Postgres / PostgREST
  if (code === '42501' || /permission denied|row-level security/i.test(message)) return 'forbidden';
  if (code === '23505' && /username/i.test(message + (err.details ?? ''))) return 'username_taken';
  if (code === '23514' && /username/i.test(message)) return 'username_invalid';
  if (code === '23514' && /display_name/i.test(message)) return 'display_name_invalid';

  // Supabase Auth
  // Supabase: "Invalid login credentials"; Neon Auth (Better Auth): "Invalid email or password"
  if (/invalid login credentials|invalid email or password/i.test(message)) return 'invalid_credentials';
  if (/email not confirmed/i.test(message)) return 'email_not_confirmed';
  if (/already registered|already been registered|user already exists/i.test(message) || code === 'user_already_exists' || code === 'USER_ALREADY_EXISTS') return 'user_exists';
  if (code === 'weak_password' || /password should be at least/i.test(message)) return 'weak_password';
  if (err.status === 429 || /rate limit/i.test(message)) return 'rate_limited';
  if (/jwt expired|invalid jwt|not_authenticated/i.test(message)) return 'not_authenticated';

  // Rede
  if (/failed to fetch|networkerror|load failed/i.test(message)) return 'network';
  return null;
}

/** Avisado quando o servidor diz que a sessão não vale mais (o app volta para "Entrar"). */
export const SESSION_EXPIRED_EVENT = 'eco-quest:session-expired';

/**
 * Converte qualquer erro em AppError. O detalhe técnico vai para o registro
 * (logger); a tela mostra só a mensagem amigável. Erros esperados (regras do
 * jogo, validação) não são enviados ao monitoramento — só os inesperados.
 */
export function toAppError(err: unknown, fallback = 'unknown'): AppError {
  if (err instanceof AppError) return err;
  const code = err && typeof err === 'object' ? classify(err as ErrorLike) : null;
  if (code === 'not_authenticated' && typeof window !== 'undefined') {
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  }
  if (code === null || code === fallback) logger.error(fallback, err, {}, code ?? fallback);
  else logger.warn(fallback, err, {}, code);
  return new AppError(code ?? fallback, err);
}
