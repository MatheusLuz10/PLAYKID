-- =====================================================================
-- 22 · Níveis e conquistas (Etapa 6)
-- =====================================================================
-- ARQUIVO GERADO por "npm run content:sql" a partir de content/gamification.json.
-- Não edite à mão. Idempotente: pode ser executado de novo depois de editar o JSON.

-- Níveis: a faixa de cada um vai do seu xp_required até o do próximo − 1.
-- Afasta os valores antigos antes do upsert para não esbarrar nos índices únicos.
update public.levels set level_number = level_number + 100000, xp_required = xp_required + 100000000;
insert into public.levels (id, level_number, name, xp_required, description, icon) values
  ('50000000-0000-4000-8000-000000000001', 1, 'Explorador', 0, 'Começando a descobrir o mundo natural.', '🌱'),
  ('50000000-0000-4000-8000-000000000002', 2, 'Aprendiz da Natureza', 100, 'Já entende como a natureza funciona.', '🌿'),
  ('50000000-0000-4000-8000-000000000003', 3, 'Observador', 250, 'Percebe os detalhes do ambiente ao redor.', '🔎'),
  ('50000000-0000-4000-8000-000000000004', 4, 'Cuidador', 450, 'Transforma conhecimento em cuidado real.', '🪴'),
  ('50000000-0000-4000-8000-000000000005', 5, 'Protetor', 700, 'Protege o que aprendeu a valorizar.', '🛡️'),
  ('50000000-0000-4000-8000-000000000006', 6, 'Guardião das Plantas', 1000, 'Cuida das plantas com constância.', '🌳'),
  ('50000000-0000-4000-8000-000000000007', 7, 'Guardião da Água', 1350, 'Sabe que cada gota importa.', '💧'),
  ('50000000-0000-4000-8000-000000000008', 8, 'Guardião dos Recursos', 1750, 'Usa os recursos do planeta com consciência.', '♻️'),
  ('50000000-0000-4000-8000-000000000009', 9, 'Amigo da Biodiversidade', 2200, 'Protege a vida em todas as suas formas.', '🐝'),
  ('50000000-0000-4000-8000-000000000010', 10, 'Guardião da Natureza', 2700, 'Uma referência em cuidar da natureza.', '🏞️'),
  ('50000000-0000-4000-8000-000000000011', 11, 'Protetor dos Ecossistemas', 3250, 'Entende como tudo está conectado.', '🌾'),
  ('50000000-0000-4000-8000-000000000012', 12, 'Agente Ambiental', 3850, 'Age e inspira quem está por perto.', '🧭'),
  ('50000000-0000-4000-8000-000000000013', 13, 'Defensor da Vida', 4500, 'Defende os seres vivos e seus lares.', '🦋'),
  ('50000000-0000-4000-8000-000000000014', 14, 'Guardião do Planeta', 5200, 'Pensa no planeta em cada escolha.', '🌍'),
  ('50000000-0000-4000-8000-000000000015', 15, 'Mestre da Sustentabilidade', 5950, 'Domina hábitos sustentáveis no dia a dia.', '🌞'),
  ('50000000-0000-4000-8000-000000000016', 16, 'Embaixador Ambiental', 6750, 'Leva a causa ambiental para a comunidade.', '🤝'),
  ('50000000-0000-4000-8000-000000000017', 17, 'Guardião dos Ecossistemas', 7600, 'Cuida de ecossistemas inteiros.', '🌲'),
  ('50000000-0000-4000-8000-000000000018', 18, 'Protetor da Biodiversidade', 8500, 'Um aliado de todas as espécies.', '🦜'),
  ('50000000-0000-4000-8000-000000000019', 19, 'Guardião do Futuro', 9450, 'Planta hoje o que o futuro vai colher.', '🌅'),
  ('50000000-0000-4000-8000-000000000020', 20, 'Lenda ECO', 10450, 'Uma lenda da jornada ECO QUEST.', '🏆')
on conflict (id) do update set
  level_number = excluded.level_number, name = excluded.name, xp_required = excluded.xp_required,
  description = excluded.description, icon = excluded.icon;
delete from public.levels where id not in ('50000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000003', '50000000-0000-4000-8000-000000000004', '50000000-0000-4000-8000-000000000005', '50000000-0000-4000-8000-000000000006', '50000000-0000-4000-8000-000000000007', '50000000-0000-4000-8000-000000000008', '50000000-0000-4000-8000-000000000009', '50000000-0000-4000-8000-000000000010', '50000000-0000-4000-8000-000000000011', '50000000-0000-4000-8000-000000000012', '50000000-0000-4000-8000-000000000013', '50000000-0000-4000-8000-000000000014', '50000000-0000-4000-8000-000000000015', '50000000-0000-4000-8000-000000000016', '50000000-0000-4000-8000-000000000017', '50000000-0000-4000-8000-000000000018', '50000000-0000-4000-8000-000000000019', '50000000-0000-4000-8000-000000000020');

-- Conquistas: as que saírem do JSON ficam inativas (quem já tem, continua tendo).
insert into public.achievements (id, name, slug, description, icon, category, requirement_type, requirement_value,
  requirement_count, xp_reward, order_index, active) values
  ('60000000-0000-4000-8000-000000000001', 'Primeiro Aprendizado', 'primeiro-aprendizado', 'Conclua sua primeira lição.', '📚', 'knowledge', 'lessons_completed', '', 1, 10, 1, true),
  ('60000000-0000-4000-8000-000000000002', 'Primeiro Conhecimento', 'primeiro-conhecimento', 'Seja aprovado no seu primeiro quiz.', '🧠', 'knowledge', 'quizzes_passed', '', 1, 10, 2, true),
  ('60000000-0000-4000-8000-000000000007', 'Curioso', 'curioso', 'Conclua 5 lições.', '📚', 'knowledge', 'lessons_completed', '', 5, 30, 3, true),
  ('60000000-0000-4000-8000-000000000008', 'Estudante da Natureza', 'estudante-da-natureza', 'Conclua 10 lições.', '🧠', 'knowledge', 'lessons_completed', '', 10, 50, 4, true),
  ('60000000-0000-4000-8000-000000000006', 'Aprendiz Dedicado', 'aprendiz-dedicado', 'Conclua 5 quizzes.', '🏆', 'knowledge', 'quizzes_passed', '', 5, 50, 5, true),
  ('60000000-0000-4000-8000-000000000004', 'Primeiro Passo', 'primeiro-passo', 'Conclua sua primeira ação ambiental.', '🌱', 'first_actions', 'challenges_completed', '', 1, 50, 6, true),
  ('60000000-0000-4000-8000-000000000003', 'Primeira Árvore', 'primeira-arvore', 'Conclua o desafio de plantar uma árvore.', '🌳', 'nature', 'challenge_completed', 'plante-uma-arvore', 1, 50, 7, true),
  ('60000000-0000-4000-8000-000000000009', 'Primeira Flor', 'primeira-flor', 'Conclua o desafio de cultivar uma flor.', '🌼', 'nature', 'challenge_completed', 'cultive-uma-flor', 1, 30, 8, true),
  ('60000000-0000-4000-8000-000000000010', 'Pequeno Jardineiro', 'pequeno-jardineiro', 'Conclua 3 desafios relacionados à Natureza.', '🌱', 'nature', 'category_challenges_completed', 'natureza', 3, 50, 9, true),
  ('60000000-0000-4000-8000-000000000011', 'Guardião das Plantas', 'guardiao-das-plantas', 'Conclua 5 ações relacionadas à Natureza (desafios concluídos e acompanhamentos realizados).', '🌳', 'nature', 'category_actions_completed', 'natureza', 5, 80, 10, true),
  ('60000000-0000-4000-8000-000000000012', 'Amigo da Água', 'amigo-da-agua', 'Conclua 3 desafios relacionados à Água.', '💧', 'water', 'category_challenges_completed', 'agua', 3, 50, 11, true),
  ('60000000-0000-4000-8000-000000000013', 'Consumo Consciente', 'consumo-consciente', 'Conclua 3 desafios relacionados a Resíduos ou Consumo.', '♻️', 'waste', 'category_challenges_completed', 'residuos,energia', 3, 50, 12, true),
  ('60000000-0000-4000-8000-000000000014', 'Amigo dos Polinizadores', 'amigo-dos-polinizadores', 'Conclua um desafio relacionado à Biodiversidade.', '🐝', 'biodiversity', 'category_challenges_completed', 'biodiversidade', 1, 30, 13, true),
  ('60000000-0000-4000-8000-000000000015', 'Ação em Comunidade', 'acao-em-comunidade', 'Conclua uma ação da categoria Comunidade.', '🤝', 'community', 'category_challenges_completed', 'comunidade', 1, 30, 14, true),
  ('60000000-0000-4000-8000-000000000016', 'Explorador ECO', 'explorador-eco', 'Explore pelo menos 4 categorias ambientais (conclua uma lição ou um desafio em cada).', '🌎', 'special', 'categories_explored', '', 4, 50, 15, true),
  ('60000000-0000-4000-8000-000000000005', 'Primeiro Ciclo Completo', 'primeiro-ciclo-completo', 'Aprenda, aja e veja o seu mundo evoluir pela primeira vez.', '🌎', 'special', 'cycles_completed', '', 1, 30, 16, true),
  ('60000000-0000-4000-8000-000000000017', 'Em Evolução', 'em-evolucao', 'Alcance o nível 5.', '🔥', 'special', 'level_reached', '', 5, 0, 17, true),
  ('60000000-0000-4000-8000-000000000018', 'Guardião do Planeta', 'guardiao-do-planeta', 'Alcance o nível 10.', '🌎', 'special', 'level_reached', '', 10, 0, 18, true)
on conflict (id) do update set
  name = excluded.name, slug = excluded.slug, description = excluded.description, icon = excluded.icon,
  category = excluded.category, requirement_type = excluded.requirement_type,
  requirement_value = excluded.requirement_value, requirement_count = excluded.requirement_count,
  xp_reward = excluded.xp_reward, order_index = excluded.order_index, active = true;
update public.achievements set active = false where id not in ('60000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000002', '60000000-0000-4000-8000-000000000007', '60000000-0000-4000-8000-000000000008', '60000000-0000-4000-8000-000000000006', '60000000-0000-4000-8000-000000000004', '60000000-0000-4000-8000-000000000003', '60000000-0000-4000-8000-000000000009', '60000000-0000-4000-8000-000000000010', '60000000-0000-4000-8000-000000000011', '60000000-0000-4000-8000-000000000012', '60000000-0000-4000-8000-000000000013', '60000000-0000-4000-8000-000000000014', '60000000-0000-4000-8000-000000000015', '60000000-0000-4000-8000-000000000016', '60000000-0000-4000-8000-000000000005', '60000000-0000-4000-8000-000000000017', '60000000-0000-4000-8000-000000000018');

-- XP por iniciar cada desafio (content/challenges.json → start_xp_reward).
update public.challenges set start_xp_reward = 5 where id = '40000000-0000-4000-8000-000000000001';
update public.challenges set start_xp_reward = 5 where id = '40000000-0000-4000-8000-000000000002';
update public.challenges set start_xp_reward = 5 where id = '40000000-0000-4000-8000-000000000003';
update public.challenges set start_xp_reward = 5 where id = '40000000-0000-4000-8000-000000000004';
update public.challenges set start_xp_reward = 5 where id = '40000000-0000-4000-8000-000000000005';
update public.challenges set start_xp_reward = 5 where id = '40000000-0000-4000-8000-000000000006';
update public.challenges set start_xp_reward = 5 where id = '40000000-0000-4000-8000-000000000007';
update public.challenges set start_xp_reward = 5 where id = '40000000-0000-4000-8000-000000000008';
update public.challenges set start_xp_reward = 3 where id = '40000000-0000-4000-8000-000000000009';
update public.challenges set start_xp_reward = 3 where id = '40000000-0000-4000-8000-000000000010';
update public.challenges set start_xp_reward = 3 where id = '40000000-0000-4000-8000-000000000011';
update public.challenges set start_xp_reward = 3 where id = '40000000-0000-4000-8000-000000000012';
update public.challenges set start_xp_reward = 3 where id = '40000000-0000-4000-8000-000000000013';
update public.challenges set start_xp_reward = 3 where id = '40000000-0000-4000-8000-000000000014';
update public.challenges set start_xp_reward = 3 where id = '40000000-0000-4000-8000-000000000015';
update public.challenges set start_xp_reward = 3 where id = '40000000-0000-4000-8000-000000000016';
update public.challenges set start_xp_reward = 3 where id = '40000000-0000-4000-8000-000000000017';
update public.challenges set start_xp_reward = 3 where id = '40000000-0000-4000-8000-000000000018';
update public.challenges set start_xp_reward = 3 where id = '40000000-0000-4000-8000-000000000019';

-- Nível guardado no perfil segue a nova tabela de níveis.
update public.profiles set level = public.level_for_xp(total_xp);
