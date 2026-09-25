-- =====================================================================
-- 20 · Desafios ecológicos (Etapa 5)
-- =====================================================================
-- ARQUIVO GERADO por "npm run content:sql" a partir de content/challenges.json.
-- Não edite à mão. Idempotente: atualiza desafios e etapas existentes (mantendo
-- os IDs e o progresso dos jogadores); etapas removidas ficam inativas.

-- Plante uma árvore
insert into public.challenges (id, category_id, lesson_id, icon, title, slug, description, instructions, safety_notes,
  difficulty, deadline_days, xp_reward, active, requires_evidence, requires_follow_up,
  why_it_matters, materials, evidence_instructions, duration_label)
values ('40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '🌳', 'Plante uma árvore', 'plante-uma-arvore',
  'Plante uma árvore adequada ao ambiente disponível e acompanhe o desenvolvimento dela por seis meses.', 'Um lugar com sol, espaço para a árvore adulta e longe de fios, canos e muros.
Prefira uma espécie nativa da sua região. Peça orientação em um viveiro.
Cave uma cova um pouco maior que o torrão da muda e solte a terra.
Posicione a muda sem enterrar o caule, cubra com terra, firme, regue e prenda ao tutor.
Tire uma foto da muda plantada.
Informe a data do plantio, a espécie e o local.', 'Crianças devem plantar com a ajuda de um adulto.
Não plante em áreas de preservação ou em terrenos alheios sem permissão.
Em calçadas e praças, consulte a prefeitura antes.',
  'medio', 15, 100, true, true, true,
  'Árvores oferecem sombra, abrigo e alimento para muitas espécies, protegem o solo e ajudam a água da chuva a infiltrar. Uma muda bem escolhida e bem cuidada pode viver por muitos anos.', 'Uma muda de espécie nativa da sua região
Um local com espaço para raízes e copa
Pá ou ferramenta para cavar
Água para regar
Uma estaca (tutor) e barbante
Luvas', 'Envie uma foto da muda plantada e informe a data, a espécie e o local. Nos acompanhamentos, envie uma nova foto mostrando como a árvore está.', '1 dia + acompanhamentos (30, 90 e 180 dias)')
on conflict (id) do update set
  category_id = excluded.category_id, lesson_id = excluded.lesson_id, icon = excluded.icon, title = excluded.title,
  slug = excluded.slug, description = excluded.description, instructions = excluded.instructions,
  safety_notes = excluded.safety_notes, difficulty = excluded.difficulty, deadline_days = excluded.deadline_days,
  xp_reward = excluded.xp_reward, active = true, requires_evidence = excluded.requires_evidence,
  requires_follow_up = excluded.requires_follow_up, why_it_matters = excluded.why_it_matters,
  materials = excluded.materials, evidence_instructions = excluded.evidence_instructions,
  duration_label = excluded.duration_label;

update public.challenge_steps s set order_index = x.base - x.rn
from (select id, row_number() over (order by order_index, id) as rn,
        (select least(min(order_index), 0) - 1000 from public.challenge_steps where challenge_id = '40000000-0000-4000-8000-000000000001') as base
      from public.challenge_steps where challenge_id = '40000000-0000-4000-8000-000000000001') x
where s.id = x.id;
update public.challenge_steps set active = false where challenge_id = '40000000-0000-4000-8000-000000000001' and id not in ('41000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000008', '41000000-0000-4000-8000-000000000009', '41000000-0000-4000-8000-000000000002', '41000000-0000-4000-8000-000000000003', '41000000-0000-4000-8000-000000000010', '41000000-0000-4000-8000-000000000005', '41000000-0000-4000-8000-000000000006', '41000000-0000-4000-8000-000000000007');
insert into public.challenge_steps (id, challenge_id, title, description, step_type, order_index, required, xp_reward,
  day_offset, early_window_days, evidence_kind, deadline_offset_days, active) values
  ('41000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 'Escolher o local', 'Um lugar com sol, espaço para a árvore adulta e longe de fios, canos e muros.', 'action', 1, true, 0, null, 2, 'none', null, true),
  ('41000000-0000-4000-8000-000000000008', '40000000-0000-4000-8000-000000000001', 'Escolher a espécie', 'Prefira uma espécie nativa da sua região. Peça orientação em um viveiro.', 'action', 2, true, 0, null, 2, 'none', null, true),
  ('41000000-0000-4000-8000-000000000009', '40000000-0000-4000-8000-000000000001', 'Preparar o solo', 'Cave uma cova um pouco maior que o torrão da muda e solte a terra.', 'action', 3, true, 0, null, 2, 'none', null, true),
  ('41000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000001', 'Plantar a muda', 'Posicione a muda sem enterrar o caule, cubra com terra, firme, regue e prenda ao tutor.', 'action', 4, true, 0, null, 2, 'none', null, true),
  ('41000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000001', 'Registrar fotografia', 'Tire uma foto da muda plantada.', 'evidence', 5, true, 5, null, 2, 'photo', null, true),
  ('41000000-0000-4000-8000-000000000010', '40000000-0000-4000-8000-000000000001', 'Registrar informações', 'Informe a data do plantio, a espécie e o local.', 'evidence', 6, true, 5, null, 2, 'text', null, true),
  ('41000000-0000-4000-8000-000000000005', '40000000-0000-4000-8000-000000000001', 'Primeiro acompanhamento', 'A muda sobreviveu? Envie uma foto de como ela está depois de um mês.', 'follow_up', 7, true, 20, 30, 2, 'photo', null, true),
  ('41000000-0000-4000-8000-000000000006', '40000000-0000-4000-8000-000000000001', 'Segundo acompanhamento', 'Três meses de cuidado! Registre o crescimento.', 'follow_up', 8, true, 20, 90, 2, 'photo', null, true),
  ('41000000-0000-4000-8000-000000000007', '40000000-0000-4000-8000-000000000001', 'Acompanhamento final', 'Seis meses! Registre como a árvore se desenvolveu.', 'follow_up', 9, true, 20, 180, 2, 'photo', null, true)
on conflict (id) do update set
  challenge_id = excluded.challenge_id, title = excluded.title, description = excluded.description,
  step_type = excluded.step_type, order_index = excluded.order_index, required = excluded.required,
  xp_reward = excluded.xp_reward, day_offset = excluded.day_offset, early_window_days = excluded.early_window_days,
  evidence_kind = excluded.evidence_kind, deadline_offset_days = excluded.deadline_offset_days, active = true;

-- Cultive uma flor
insert into public.challenges (id, category_id, lesson_id, icon, title, slug, description, instructions, safety_notes,
  difficulty, deadline_days, xp_reward, active, requires_evidence, requires_follow_up,
  why_it_matters, materials, evidence_instructions, duration_label)
values ('40000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', '🌸', 'Cultive uma flor', 'cultive-uma-flor',
  'Cultive uma flor, cuide dela e observe o desenvolvimento durante um mês.', 'Escolha uma flor adequada ao clima e à luz que você tem disponível.
Use um vaso com furos ou um canteiro com terra fofa.
Plante as sementes ou a muda na profundidade indicada e regue.
Tire uma foto do que você plantou.
Conte qual flor você escolheu e onde ela ficou.', 'Prefira espécies adequadas ao seu clima.
Evite regar demais: o solo encharcado prejudica as raízes.',
  'facil', 10, 100, true, true, true,
  'Flores alimentam abelhas, borboletas e outros polinizadores. Cuidar de uma planta desde o início ensina na prática o que ela precisa para crescer.', 'Sementes ou muda de uma flor
Vaso com furos ou um canteiro
Terra com matéria orgânica
Água', 'Envie uma foto da flor plantada e, depois de um mês, uma nova foto mostrando o desenvolvimento.', '1 dia + acompanhamento de 30 dias')
on conflict (id) do update set
  category_id = excluded.category_id, lesson_id = excluded.lesson_id, icon = excluded.icon, title = excluded.title,
  slug = excluded.slug, description = excluded.description, instructions = excluded.instructions,
  safety_notes = excluded.safety_notes, difficulty = excluded.difficulty, deadline_days = excluded.deadline_days,
  xp_reward = excluded.xp_reward, active = true, requires_evidence = excluded.requires_evidence,
  requires_follow_up = excluded.requires_follow_up, why_it_matters = excluded.why_it_matters,
  materials = excluded.materials, evidence_instructions = excluded.evidence_instructions,
  duration_label = excluded.duration_label;

update public.challenge_steps s set order_index = x.base - x.rn
from (select id, row_number() over (order by order_index, id) as rn,
        (select least(min(order_index), 0) - 1000 from public.challenge_steps where challenge_id = '40000000-0000-4000-8000-000000000002') as base
      from public.challenge_steps where challenge_id = '40000000-0000-4000-8000-000000000002') x
where s.id = x.id;
update public.challenge_steps set active = false where challenge_id = '40000000-0000-4000-8000-000000000002' and id not in ('41000000-0000-4000-8000-002000000001', '41000000-0000-4000-8000-002000000002', '41000000-0000-4000-8000-002000000003', '41000000-0000-4000-8000-002000000004', '41000000-0000-4000-8000-002000000005', '41000000-0000-4000-8000-002000000006');
insert into public.challenge_steps (id, challenge_id, title, description, step_type, order_index, required, xp_reward,
  day_offset, early_window_days, evidence_kind, deadline_offset_days, active) values
  ('41000000-0000-4000-8000-002000000001', '40000000-0000-4000-8000-000000000002', 'Escolher a espécie', 'Escolha uma flor adequada ao clima e à luz que você tem disponível.', 'action', 1, true, 0, null, 2, 'none', null, true),
  ('41000000-0000-4000-8000-002000000002', '40000000-0000-4000-8000-000000000002', 'Preparar o recipiente ou o solo', 'Use um vaso com furos ou um canteiro com terra fofa.', 'action', 2, true, 0, null, 2, 'none', null, true),
  ('41000000-0000-4000-8000-002000000003', '40000000-0000-4000-8000-000000000002', 'Plantar', 'Plante as sementes ou a muda na profundidade indicada e regue.', 'action', 3, true, 0, null, 2, 'none', null, true),
  ('41000000-0000-4000-8000-002000000004', '40000000-0000-4000-8000-000000000002', 'Fotografar', 'Tire uma foto do que você plantou.', 'evidence', 4, true, 5, null, 2, 'photo', null, true),
  ('41000000-0000-4000-8000-002000000005', '40000000-0000-4000-8000-000000000002', 'Registrar observações', 'Conte qual flor você escolheu e onde ela ficou.', 'evidence', 5, true, 5, null, 2, 'text', null, true),
  ('41000000-0000-4000-8000-002000000006', '40000000-0000-4000-8000-000000000002', 'Acompanhamento de 30 dias', 'Como a flor se desenvolveu? Envie uma nova foto.', 'follow_up', 6, true, 20, 30, 2, 'photo', null, true)
on conflict (id) do update set
  challenge_id = excluded.challenge_id, title = excluded.title, description = excluded.description,
  step_type = excluded.step_type, order_index = excluded.order_index, required = excluded.required,
  xp_reward = excluded.xp_reward, day_offset = excluded.day_offset, early_window_days = excluded.early_window_days,
  evidence_kind = excluded.evidence_kind, deadline_offset_days = excluded.deadline_offset_days, active = true;

-- Crie uma pequena horta
insert into public.challenges (id, category_id, lesson_id, icon, title, slug, description, instructions, safety_notes,
  difficulty, deadline_days, xp_reward, active, requires_evidence, requires_follow_up,
  why_it_matters, materials, evidence_instructions, duration_label)
values ('40000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000003', '🥬', 'Crie uma pequena horta', 'crie-uma-pequena-horta',
  'Crie uma pequena área para cultivar alimentos, como temperos ou hortaliças, e registre a evolução.', 'Um lugar com sol e água por perto.
Use terra fofa e com matéria orgânica.
Comece com plantas fáceis, como cebolinha, alface e manjericão.
Plante e regue.
Envie uma foto da horta pronta.', 'Escolha um lugar com algumas horas de sol direto.
Crianças devem usar ferramentas com a ajuda de um adulto.',
  'medio', 14, 100, true, true, true,
  'Uma horta aproxima você da origem dos alimentos, reaproveita restos orgânicos como adubo e pode atrair polinizadores.', 'Vasos, caixotes ou um canteiro
Terra com matéria orgânica
Mudas ou sementes (cebolinha, alface, manjericão…)
Água', 'Envie uma foto da horta pronta e, três semanas depois, uma foto mostrando a evolução.', '2 dias + acompanhamento de 21 dias')
on conflict (id) do update set
  category_id = excluded.category_id, lesson_id = excluded.lesson_id, icon = excluded.icon, title = excluded.title,
  slug = excluded.slug, description = excluded.description, instructions = excluded.instructions,
  safety_notes = excluded.safety_notes, difficulty = excluded.difficulty, deadline_days = excluded.deadline_days,
  xp_reward = excluded.xp_reward, active = true, requires_evidence = excluded.requires_evidence,
  requires_follow_up = excluded.requires_follow_up, why_it_matters = excluded.why_it_matters,
  materials = excluded.materials, evidence_instructions = excluded.evidence_instructions,
  duration_label = excluded.duration_label;

update public.challenge_steps s set order_index = x.base - x.rn
from (select id, row_number() over (order by order_index, id) as rn,
        (select least(min(order_index), 0) - 1000 from public.challenge_steps where challenge_id = '40000000-0000-4000-8000-000000000003') as base
      from public.challenge_steps where challenge_id = '40000000-0000-4000-8000-000000000003') x
where s.id = x.id;
update public.challenge_steps set active = false where challenge_id = '40000000-0000-4000-8000-000000000003' and id not in ('41000000-0000-4000-8000-003000000001', '41000000-0000-4000-8000-003000000002', '41000000-0000-4000-8000-003000000003', '41000000-0000-4000-8000-003000000004', '41000000-0000-4000-8000-003000000005', '41000000-0000-4000-8000-003000000006');
insert into public.challenge_steps (id, challenge_id, title, description, step_type, order_index, required, xp_reward,
  day_offset, early_window_days, evidence_kind, deadline_offset_days, active) values
  ('41000000-0000-4000-8000-003000000001', '40000000-0000-4000-8000-000000000003', 'Escolher o espaço', 'Um lugar com sol e água por perto.', 'action', 1, true, 0, null, 2, 'none', null, true),
  ('41000000-0000-4000-8000-003000000002', '40000000-0000-4000-8000-000000000003', 'Preparar recipiente ou solo', 'Use terra fofa e com matéria orgânica.', 'action', 2, true, 0, null, 2, 'none', null, true),
  ('41000000-0000-4000-8000-003000000003', '40000000-0000-4000-8000-000000000003', 'Escolher as plantas', 'Comece com plantas fáceis, como cebolinha, alface e manjericão.', 'action', 3, true, 0, null, 2, 'none', null, true),
  ('41000000-0000-4000-8000-003000000004', '40000000-0000-4000-8000-000000000003', 'Plantar', 'Plante e regue.', 'action', 4, true, 0, null, 2, 'none', null, true),
  ('41000000-0000-4000-8000-003000000005', '40000000-0000-4000-8000-000000000003', 'Registrar a horta', 'Envie uma foto da horta pronta.', 'evidence', 5, true, 5, null, 2, 'photo', null, true),
  ('41000000-0000-4000-8000-003000000006', '40000000-0000-4000-8000-000000000003', 'Registrar evolução', 'Três semanas depois: como estão as plantas?', 'follow_up', 6, true, 20, 21, 2, 'photo', null, true)
on conflict (id) do update set
  challenge_id = excluded.challenge_id, title = excluded.title, description = excluded.description,
  step_type = excluded.step_type, order_index = excluded.order_index, required = excluded.required,
  xp_reward = excluded.xp_reward, day_offset = excluded.day_offset, early_window_days = excluded.early_window_days,
  evidence_kind = excluded.evidence_kind, deadline_offset_days = excluded.deadline_offset_days, active = true;

-- Reduza o desperdício de água
insert into public.challenges (id, category_id, lesson_id, icon, title, slug, description, instructions, safety_notes,
  difficulty, deadline_days, xp_reward, active, requires_evidence, requires_follow_up,
  why_it_matters, materials, evidence_instructions, duration_label)
values ('40000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000004', '💧', 'Reduza o desperdício de água', 'reduza-o-desperdicio-de-agua',
  'Identifique desperdícios de água em casa, aplique medidas de economia e avalie o resultado depois de alguns dias.', 'Observe torneiras, chuveiro, descarga, mangueira e vazamentos. Anote o que encontrou.
Escolha pelo menos duas medidas de economia para aplicar.
Coloque as medidas em prática e fotografe uma delas.
Conte quais medidas você aplicou e quem participou.', 'Vazamentos devem ser consertados por um adulto ou profissional.',
  'facil', 7, 100, true, true, true,
  'A água doce disponível é uma pequena parte da água do planeta, e tratá-la e bombeá-la até as casas usa energia. Pequenas mudanças de hábito evitam desperdício todos os dias.', 'Papel e caneta (ou o celular) para anotar
Atenção aos hábitos da casa', 'Descreva os desperdícios encontrados e as medidas aplicadas. Envie uma foto de uma das medidas (opcional na avaliação).', '1 dia + avaliação após 5 dias')
on conflict (id) do update set
  category_id = excluded.category_id, lesson_id = excluded.lesson_id, icon = excluded.icon, title = excluded.title,
  slug = excluded.slug, description = excluded.description, instructions = excluded.instructions,
  safety_notes = excluded.safety_notes, difficulty = excluded.difficulty, deadline_days = excluded.deadline_days,
  xp_reward = excluded.xp_reward, active = true, requires_evidence = excluded.requires_evidence,
  requires_follow_up = excluded.requires_follow_up, why_it_matters = excluded.why_it_matters,
  materials = excluded.materials, evidence_instructions = excluded.evidence_instructions,
  duration_label = excluded.duration_label;

update public.challenge_steps s set order_index = x.base - x.rn
from (select id, row_number() over (order by order_index, id) as rn,
        (select least(min(order_index), 0) - 1000 from public.challenge_steps where challenge_id = '40000000-0000-4000-8000-000000000004') as base
      from public.challenge_steps where challenge_id = '40000000-0000-4000-8000-000000000004') x
where s.id = x.id;
update public.challenge_steps set active = false where challenge_id = '40000000-0000-4000-8000-000000000004' and id not in ('41000000-0000-4000-8000-004000000001', '41000000-0000-4000-8000-004000000002', '41000000-0000-4000-8000-004000000003', '41000000-0000-4000-8000-004000000004', '41000000-0000-4000-8000-004000000005');
insert into public.challenge_steps (id, challenge_id, title, description, step_type, order_index, required, xp_reward,
  day_offset, early_window_days, evidence_kind, deadline_offset_days, active) values
  ('41000000-0000-4000-8000-004000000001', '40000000-0000-4000-8000-000000000004', 'Identificar desperdícios', 'Observe torneiras, chuveiro, descarga, mangueira e vazamentos. Anote o que encontrou.', 'evidence', 1, true, 5, null, 2, 'text', null, true),
  ('41000000-0000-4000-8000-004000000002', '40000000-0000-4000-8000-000000000004', 'Escolher medidas', 'Escolha pelo menos duas medidas de economia para aplicar.', 'action', 2, true, 0, null, 2, 'none', null, true),
  ('41000000-0000-4000-8000-004000000003', '40000000-0000-4000-8000-000000000004', 'Aplicar as medidas', 'Coloque as medidas em prática e fotografe uma delas.', 'evidence', 3, true, 5, null, 2, 'photo', null, true),
  ('41000000-0000-4000-8000-004000000004', '40000000-0000-4000-8000-000000000004', 'Registrar ações', 'Conte quais medidas você aplicou e quem participou.', 'evidence', 4, true, 5, null, 2, 'text', null, true),
  ('41000000-0000-4000-8000-004000000005', '40000000-0000-4000-8000-000000000004', 'Avaliação após alguns dias', 'As medidas continuaram? O que funcionou melhor?', 'follow_up', 5, true, 20, 5, 0, 'text', null, true)
on conflict (id) do update set
  challenge_id = excluded.challenge_id, title = excluded.title, description = excluded.description,
  step_type = excluded.step_type, order_index = excluded.order_index, required = excluded.required,
  xp_reward = excluded.xp_reward, day_offset = excluded.day_offset, early_window_days = excluded.early_window_days,
  evidence_kind = excluded.evidence_kind, deadline_offset_days = excluded.deadline_offset_days, active = true;

-- Separe seus resíduos por 7 dias
insert into public.challenges (id, category_id, lesson_id, icon, title, slug, description, instructions, safety_notes,
  difficulty, deadline_days, xp_reward, active, requires_evidence, requires_follow_up,
  why_it_matters, materials, evidence_instructions, duration_label)
values ('40000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000006', '♻️', 'Separe seus resíduos por 7 dias', 'separe-seus-residuos-por-7-dias',
  'Durante 7 dias, separe recicláveis, orgânicos e rejeitos e registre diariamente o que observou.', 'Prepare recipientes para recicláveis, orgânicos e rejeitos.
Tire uma foto dos recipientes prontos.', 'Não manipule vidro quebrado ou objetos cortantes com as mãos.
Lave e seque as embalagens antes de separá-las.',
  'medio', 3, 100, true, true, true,
  'Separar os resíduos permite que os recicláveis voltem à indústria como matéria-prima e mostra, na prática, quanto lixo produzimos — o primeiro passo para reduzir.', 'Dois ou três recipientes para separar os resíduos
Etiquetas ou identificação das cores da coleta seletiva', 'Envie uma foto dos recipientes de separação e, a cada dia, uma observação sobre recicláveis, orgânicos, rejeitos e ações de redução ou reutilização.', '7 dias com registro diário')
on conflict (id) do update set
  category_id = excluded.category_id, lesson_id = excluded.lesson_id, icon = excluded.icon, title = excluded.title,
  slug = excluded.slug, description = excluded.description, instructions = excluded.instructions,
  safety_notes = excluded.safety_notes, difficulty = excluded.difficulty, deadline_days = excluded.deadline_days,
  xp_reward = excluded.xp_reward, active = true, requires_evidence = excluded.requires_evidence,
  requires_follow_up = excluded.requires_follow_up, why_it_matters = excluded.why_it_matters,
  materials = excluded.materials, evidence_instructions = excluded.evidence_instructions,
  duration_label = excluded.duration_label;

update public.challenge_steps s set order_index = x.base - x.rn
from (select id, row_number() over (order by order_index, id) as rn,
        (select least(min(order_index), 0) - 1000 from public.challenge_steps where challenge_id = '40000000-0000-4000-8000-000000000005') as base
      from public.challenge_steps where challenge_id = '40000000-0000-4000-8000-000000000005') x
where s.id = x.id;
update public.challenge_steps set active = false where challenge_id = '40000000-0000-4000-8000-000000000005' and id not in ('41000000-0000-4000-8000-005000000001', '41000000-0000-4000-8000-005000000002', '41000000-0000-4000-8000-005000000003', '41000000-0000-4000-8000-005000000004', '41000000-0000-4000-8000-005000000005', '41000000-0000-4000-8000-005000000006', '41000000-0000-4000-8000-005000000007', '41000000-0000-4000-8000-005000000008', '41000000-0000-4000-8000-005000000009');
insert into public.challenge_steps (id, challenge_id, title, description, step_type, order_index, required, xp_reward,
  day_offset, early_window_days, evidence_kind, deadline_offset_days, active) values
  ('41000000-0000-4000-8000-005000000001', '40000000-0000-4000-8000-000000000005', 'Organizar a separação', 'Prepare recipientes para recicláveis, orgânicos e rejeitos.', 'action', 1, true, 0, null, 2, 'none', null, true),
  ('41000000-0000-4000-8000-005000000002', '40000000-0000-4000-8000-000000000005', 'Fotografar a separação', 'Tire uma foto dos recipientes prontos.', 'evidence', 2, true, 5, null, 2, 'photo', null, true),
  ('41000000-0000-4000-8000-005000000003', '40000000-0000-4000-8000-000000000005', 'Registro do dia 1', 'O que você separou hoje? Houve alguma ação de redução ou reutilização?', 'follow_up', 3, true, 5, 1, 0, 'text', null, true),
  ('41000000-0000-4000-8000-005000000004', '40000000-0000-4000-8000-000000000005', 'Registro do dia 2', 'O que você separou hoje?', 'follow_up', 4, true, 5, 2, 0, 'text', null, true),
  ('41000000-0000-4000-8000-005000000005', '40000000-0000-4000-8000-000000000005', 'Registro do dia 3', 'O que você separou hoje?', 'follow_up', 5, true, 5, 3, 0, 'text', null, true),
  ('41000000-0000-4000-8000-005000000006', '40000000-0000-4000-8000-000000000005', 'Registro do dia 4', 'O que você separou hoje?', 'follow_up', 6, true, 5, 4, 0, 'text', null, true),
  ('41000000-0000-4000-8000-005000000007', '40000000-0000-4000-8000-000000000005', 'Registro do dia 5', 'O que você separou hoje?', 'follow_up', 7, true, 5, 5, 0, 'text', null, true),
  ('41000000-0000-4000-8000-005000000008', '40000000-0000-4000-8000-000000000005', 'Registro do dia 6', 'O que você separou hoje?', 'follow_up', 8, true, 5, 6, 0, 'text', null, true),
  ('41000000-0000-4000-8000-005000000009', '40000000-0000-4000-8000-000000000005', 'Registro do dia 7', 'Último dia! O que mudou na sua forma de descartar?', 'follow_up', 9, true, 5, 7, 0, 'text', null, true)
on conflict (id) do update set
  challenge_id = excluded.challenge_id, title = excluded.title, description = excluded.description,
  step_type = excluded.step_type, order_index = excluded.order_index, required = excluded.required,
  xp_reward = excluded.xp_reward, day_offset = excluded.day_offset, early_window_days = excluded.early_window_days,
  evidence_kind = excluded.evidence_kind, deadline_offset_days = excluded.deadline_offset_days, active = true;

-- Semana do consumo consciente
insert into public.challenges (id, category_id, lesson_id, icon, title, slug, description, instructions, safety_notes,
  difficulty, deadline_days, xp_reward, active, requires_evidence, requires_follow_up,
  why_it_matters, materials, evidence_instructions, duration_label)
values ('40000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000008', '⚡', 'Semana do consumo consciente', 'semana-do-consumo-consciente',
  'Durante 7 dias, observe seus hábitos de consumo de energia e reduza desperdícios.', 'Observe luzes acesas, aparelhos em standby, banhos longos e a geladeira. Anote o que encontrou.
Escolha pelo menos duas metas para a semana (ex.: apagar luzes, tirar carregadores da tomada).', 'Não mexa em instalações elétricas: peça ajuda a um adulto.',
  'facil', 3, 100, true, true, true,
  'Toda forma de gerar eletricidade causa algum impacto. Perceber onde a energia é desperdiçada é o caminho mais simples para consumir menos.', 'Atenção aos aparelhos e hábitos da casa
Papel e caneta (ou o celular) para anotar', 'Registre os hábitos observados, as metas escolhidas e, a cada dia, uma observação sobre o que você fez.', '7 dias com registro diário')
on conflict (id) do update set
  category_id = excluded.category_id, lesson_id = excluded.lesson_id, icon = excluded.icon, title = excluded.title,
  slug = excluded.slug, description = excluded.description, instructions = excluded.instructions,
  safety_notes = excluded.safety_notes, difficulty = excluded.difficulty, deadline_days = excluded.deadline_days,
  xp_reward = excluded.xp_reward, active = true, requires_evidence = excluded.requires_evidence,
  requires_follow_up = excluded.requires_follow_up, why_it_matters = excluded.why_it_matters,
  materials = excluded.materials, evidence_instructions = excluded.evidence_instructions,
  duration_label = excluded.duration_label;

update public.challenge_steps s set order_index = x.base - x.rn
from (select id, row_number() over (order by order_index, id) as rn,
        (select least(min(order_index), 0) - 1000 from public.challenge_steps where challenge_id = '40000000-0000-4000-8000-000000000006') as base
      from public.challenge_steps where challenge_id = '40000000-0000-4000-8000-000000000006') x
where s.id = x.id;
update public.challenge_steps set active = false where challenge_id = '40000000-0000-4000-8000-000000000006' and id not in ('41000000-0000-4000-8000-006000000001', '41000000-0000-4000-8000-006000000002', '41000000-0000-4000-8000-006000000003', '41000000-0000-4000-8000-006000000004', '41000000-0000-4000-8000-006000000005', '41000000-0000-4000-8000-006000000006', '41000000-0000-4000-8000-006000000007', '41000000-0000-4000-8000-006000000008', '41000000-0000-4000-8000-006000000009');
insert into public.challenge_steps (id, challenge_id, title, description, step_type, order_index, required, xp_reward,
  day_offset, early_window_days, evidence_kind, deadline_offset_days, active) values
  ('41000000-0000-4000-8000-006000000001', '40000000-0000-4000-8000-000000000006', 'Identificar hábitos', 'Observe luzes acesas, aparelhos em standby, banhos longos e a geladeira. Anote o que encontrou.', 'evidence', 1, true, 5, null, 2, 'text', null, true),
  ('41000000-0000-4000-8000-006000000002', '40000000-0000-4000-8000-000000000006', 'Escolher metas', 'Escolha pelo menos duas metas para a semana (ex.: apagar luzes, tirar carregadores da tomada).', 'evidence', 2, true, 5, null, 2, 'text', null, true),
  ('41000000-0000-4000-8000-006000000003', '40000000-0000-4000-8000-000000000006', 'Registro do dia 1', 'Como foi o dia? Você cumpriu suas metas?', 'follow_up', 3, true, 5, 1, 0, 'text', null, true),
  ('41000000-0000-4000-8000-006000000004', '40000000-0000-4000-8000-000000000006', 'Registro do dia 2', 'Como foi o dia?', 'follow_up', 4, true, 5, 2, 0, 'text', null, true),
  ('41000000-0000-4000-8000-006000000005', '40000000-0000-4000-8000-000000000006', 'Registro do dia 3', 'Como foi o dia?', 'follow_up', 5, true, 5, 3, 0, 'text', null, true),
  ('41000000-0000-4000-8000-006000000006', '40000000-0000-4000-8000-000000000006', 'Registro do dia 4', 'Como foi o dia?', 'follow_up', 6, true, 5, 4, 0, 'text', null, true),
  ('41000000-0000-4000-8000-006000000007', '40000000-0000-4000-8000-000000000006', 'Registro do dia 5', 'Como foi o dia?', 'follow_up', 7, true, 5, 5, 0, 'text', null, true),
  ('41000000-0000-4000-8000-006000000008', '40000000-0000-4000-8000-000000000006', 'Registro do dia 6', 'Como foi o dia?', 'follow_up', 8, true, 5, 6, 0, 'text', null, true),
  ('41000000-0000-4000-8000-006000000009', '40000000-0000-4000-8000-000000000006', 'Registro do dia 7', 'Último dia! Quais hábitos você pretende manter?', 'follow_up', 9, true, 5, 7, 0, 'text', null, true)
on conflict (id) do update set
  challenge_id = excluded.challenge_id, title = excluded.title, description = excluded.description,
  step_type = excluded.step_type, order_index = excluded.order_index, required = excluded.required,
  xp_reward = excluded.xp_reward, day_offset = excluded.day_offset, early_window_days = excluded.early_window_days,
  evidence_kind = excluded.evidence_kind, deadline_offset_days = excluded.deadline_offset_days, active = true;

-- Crie um espaço para polinizadores
insert into public.challenges (id, category_id, lesson_id, icon, title, slug, description, instructions, safety_notes,
  difficulty, deadline_days, xp_reward, active, requires_evidence, requires_follow_up,
  why_it_matters, materials, evidence_instructions, duration_label)
values ('40000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000011', '🐝', 'Crie um espaço para polinizadores', 'crie-um-espaco-para-polinizadores',
  'Crie um pequeno espaço com plantas floríferas que possam favorecer abelhas, borboletas e outros polinizadores.', 'Um lugar com sol, protegido de vento forte.
Prefira flores variadas, de preferência nativas, que floresçam em épocas diferentes.
Plante e regue.
Tire uma foto do espaço pronto.', 'Não use agrotóxicos no espaço.
Observe os insetos de longe e sem tocar neles.
Troque a água do pratinho com frequência para não acumular mosquitos.',
  'medio', 14, 100, true, true, true,
  'Polinizadores dependem de flores para se alimentar, e muitas plantas — inclusive alimentos — dependem deles. Mesmo um vaso com flores variadas ajuda.', 'Vasos ou um canteiro
Mudas ou sementes de flores variadas (de preferência nativas)
Terra e água
Um pratinho raso com pedrinhas e água (opcional)', 'Registre o local, as plantas escolhidas e uma foto do espaço. Depois de um mês, conte o que observou e envie uma nova foto.', '2 dias + acompanhamento de 30 dias')
on conflict (id) do update set
  category_id = excluded.category_id, lesson_id = excluded.lesson_id, icon = excluded.icon, title = excluded.title,
  slug = excluded.slug, description = excluded.description, instructions = excluded.instructions,
  safety_notes = excluded.safety_notes, difficulty = excluded.difficulty, deadline_days = excluded.deadline_days,
  xp_reward = excluded.xp_reward, active = true, requires_evidence = excluded.requires_evidence,
  requires_follow_up = excluded.requires_follow_up, why_it_matters = excluded.why_it_matters,
  materials = excluded.materials, evidence_instructions = excluded.evidence_instructions,
  duration_label = excluded.duration_label;

update public.challenge_steps s set order_index = x.base - x.rn
from (select id, row_number() over (order by order_index, id) as rn,
        (select least(min(order_index), 0) - 1000 from public.challenge_steps where challenge_id = '40000000-0000-4000-8000-000000000007') as base
      from public.challenge_steps where challenge_id = '40000000-0000-4000-8000-000000000007') x
where s.id = x.id;
update public.challenge_steps set active = false where challenge_id = '40000000-0000-4000-8000-000000000007' and id not in ('41000000-0000-4000-8000-007000000001', '41000000-0000-4000-8000-007000000002', '41000000-0000-4000-8000-007000000003', '41000000-0000-4000-8000-007000000004', '41000000-0000-4000-8000-007000000005');
insert into public.challenge_steps (id, challenge_id, title, description, step_type, order_index, required, xp_reward,
  day_offset, early_window_days, evidence_kind, deadline_offset_days, active) values
  ('41000000-0000-4000-8000-007000000001', '40000000-0000-4000-8000-000000000007', 'Escolher o local', 'Um lugar com sol, protegido de vento forte.', 'evidence', 1, true, 5, null, 2, 'text', null, true),
  ('41000000-0000-4000-8000-007000000002', '40000000-0000-4000-8000-000000000007', 'Escolher as plantas', 'Prefira flores variadas, de preferência nativas, que floresçam em épocas diferentes.', 'evidence', 2, true, 5, null, 2, 'text', null, true),
  ('41000000-0000-4000-8000-007000000003', '40000000-0000-4000-8000-000000000007', 'Plantar', 'Plante e regue.', 'action', 3, true, 0, null, 2, 'none', null, true),
  ('41000000-0000-4000-8000-007000000004', '40000000-0000-4000-8000-000000000007', 'Fotografar o espaço', 'Tire uma foto do espaço pronto.', 'evidence', 4, true, 5, null, 2, 'photo', null, true),
  ('41000000-0000-4000-8000-007000000005', '40000000-0000-4000-8000-000000000007', 'Registrar evolução', 'Depois de um mês: as plantas floresceram? Algum polinizador apareceu?', 'follow_up', 5, true, 20, 30, 2, 'photo', null, true)
on conflict (id) do update set
  challenge_id = excluded.challenge_id, title = excluded.title, description = excluded.description,
  step_type = excluded.step_type, order_index = excluded.order_index, required = excluded.required,
  xp_reward = excluded.xp_reward, day_offset = excluded.day_offset, early_window_days = excluded.early_window_days,
  evidence_kind = excluded.evidence_kind, deadline_offset_days = excluded.deadline_offset_days, active = true;

-- Participe de uma ação ambiental
insert into public.challenges (id, category_id, lesson_id, icon, title, slug, description, instructions, safety_notes,
  difficulty, deadline_days, xp_reward, active, requires_evidence, requires_follow_up,
  why_it_matters, materials, evidence_instructions, duration_label)
values ('40000000-0000-4000-8000-000000000008', '10000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000012', '🤝', 'Participe de uma ação ambiental', 'participe-de-uma-acao-ambiental',
  'Participe de uma ação ambiental real na sua comunidade: limpeza, plantio coletivo, horta comunitária, ação educativa ou recuperação de área.', 'Procure uma ação na escola, no bairro, em associações ou em projetos ambientais.
Participe da ação e tire uma foto.
Conte o que foi feito, onde e com quem.', 'Crianças sempre acompanhadas de adultos.
Use luvas e nunca recolha objetos cortantes com as mãos.',
  'medio', 30, 100, true, true, false,
  'Ações coletivas transformam lugares que ninguém cuidaria sozinho — e fortalecem a comunidade.', 'Luvas
Roupas adequadas e protetor solar
Água para beber', 'Envie uma foto da ação e descreva o que foi feito, onde e com quem.', '1 dia')
on conflict (id) do update set
  category_id = excluded.category_id, lesson_id = excluded.lesson_id, icon = excluded.icon, title = excluded.title,
  slug = excluded.slug, description = excluded.description, instructions = excluded.instructions,
  safety_notes = excluded.safety_notes, difficulty = excluded.difficulty, deadline_days = excluded.deadline_days,
  xp_reward = excluded.xp_reward, active = true, requires_evidence = excluded.requires_evidence,
  requires_follow_up = excluded.requires_follow_up, why_it_matters = excluded.why_it_matters,
  materials = excluded.materials, evidence_instructions = excluded.evidence_instructions,
  duration_label = excluded.duration_label;

update public.challenge_steps s set order_index = x.base - x.rn
from (select id, row_number() over (order by order_index, id) as rn,
        (select least(min(order_index), 0) - 1000 from public.challenge_steps where challenge_id = '40000000-0000-4000-8000-000000000008') as base
      from public.challenge_steps where challenge_id = '40000000-0000-4000-8000-000000000008') x
where s.id = x.id;
update public.challenge_steps set active = false where challenge_id = '40000000-0000-4000-8000-000000000008' and id not in ('41000000-0000-4000-8000-008000000001', '41000000-0000-4000-8000-008000000002', '41000000-0000-4000-8000-008000000003');
insert into public.challenge_steps (id, challenge_id, title, description, step_type, order_index, required, xp_reward,
  day_offset, early_window_days, evidence_kind, deadline_offset_days, active) values
  ('41000000-0000-4000-8000-008000000001', '40000000-0000-4000-8000-000000000008', 'Encontrar uma ação', 'Procure uma ação na escola, no bairro, em associações ou em projetos ambientais.', 'action', 1, true, 0, null, 2, 'none', null, true),
  ('41000000-0000-4000-8000-008000000002', '40000000-0000-4000-8000-000000000008', 'Participar', 'Participe da ação e tire uma foto.', 'evidence', 2, true, 5, null, 2, 'photo', null, true),
  ('41000000-0000-4000-8000-008000000003', '40000000-0000-4000-8000-000000000008', 'Descrever a ação', 'Conte o que foi feito, onde e com quem.', 'evidence', 3, true, 5, null, 2, 'text', null, true)
on conflict (id) do update set
  challenge_id = excluded.challenge_id, title = excluded.title, description = excluded.description,
  step_type = excluded.step_type, order_index = excluded.order_index, required = excluded.required,
  xp_reward = excluded.xp_reward, day_offset = excluded.day_offset, early_window_days = excluded.early_window_days,
  evidence_kind = excluded.evidence_kind, deadline_offset_days = excluded.deadline_offset_days, active = true;

-- Dobre suas roupas
insert into public.challenges (id, category_id, lesson_id, icon, title, slug, description, instructions, safety_notes,
  difficulty, deadline_days, xp_reward, active, requires_evidence, requires_follow_up,
  why_it_matters, materials, evidence_instructions, duration_label)
values ('40000000-0000-4000-8000-000000000009', '10000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000012', '👕', 'Dobre suas roupas', 'dobre-suas-roupas',
  'Dobre e guarde suas roupas limpas para ajudar a manter a casa organizada.', 'Junte as roupas limpas que precisam ser dobradas.
Dobre cada peça com cuidado.
Conte quais roupas você dobrou e onde guardou.', 'Peça ajuda a um adulto para alcançar lugares altos.',
  'facil', 3, 35, true, true, false,
  'Cuidar das próprias coisas ajuda a dividir as tarefas de casa e evita que as roupas fiquem amassadas ou se percam.', 'Roupas limpas
Uma gaveta, prateleira ou armário', 'Conte quais roupas você dobrou e onde guardou.', '1 dia')
on conflict (id) do update set
  category_id = excluded.category_id, lesson_id = excluded.lesson_id, icon = excluded.icon, title = excluded.title,
  slug = excluded.slug, description = excluded.description, instructions = excluded.instructions,
  safety_notes = excluded.safety_notes, difficulty = excluded.difficulty, deadline_days = excluded.deadline_days,
  xp_reward = excluded.xp_reward, active = true, requires_evidence = excluded.requires_evidence,
  requires_follow_up = excluded.requires_follow_up, why_it_matters = excluded.why_it_matters,
  materials = excluded.materials, evidence_instructions = excluded.evidence_instructions,
  duration_label = excluded.duration_label;

update public.challenge_steps s set order_index = x.base - x.rn
from (select id, row_number() over (order by order_index, id) as rn,
        (select least(min(order_index), 0) - 1000 from public.challenge_steps where challenge_id = '40000000-0000-4000-8000-000000000009') as base
      from public.challenge_steps where challenge_id = '40000000-0000-4000-8000-000000000009') x
where s.id = x.id;
update public.challenge_steps set active = false where challenge_id = '40000000-0000-4000-8000-000000000009' and id not in ('41000000-0000-4000-8000-009000000001', '41000000-0000-4000-8000-009000000002', '41000000-0000-4000-8000-009000000003');
insert into public.challenge_steps (id, challenge_id, title, description, step_type, order_index, required, xp_reward,
  day_offset, early_window_days, evidence_kind, deadline_offset_days, active) values
  ('41000000-0000-4000-8000-009000000001', '40000000-0000-4000-8000-000000000009', 'Separar as roupas', 'Junte as roupas limpas que precisam ser dobradas.', 'action', 1, true, 0, null, 2, 'none', null, true),
  ('41000000-0000-4000-8000-009000000002', '40000000-0000-4000-8000-000000000009', 'Dobrar as roupas', 'Dobre cada peça com cuidado.', 'action', 2, true, 0, null, 2, 'none', null, true),
  ('41000000-0000-4000-8000-009000000003', '40000000-0000-4000-8000-000000000009', 'Registrar a tarefa', 'Conte quais roupas você dobrou e onde guardou.', 'evidence', 3, true, 5, null, 2, 'text', null, true)
on conflict (id) do update set
  challenge_id = excluded.challenge_id, title = excluded.title, description = excluded.description,
  step_type = excluded.step_type, order_index = excluded.order_index, required = excluded.required,
  xp_reward = excluded.xp_reward, day_offset = excluded.day_offset, early_window_days = excluded.early_window_days,
  evidence_kind = excluded.evidence_kind, deadline_offset_days = excluded.deadline_offset_days, active = true;

-- Arrume sua cama
insert into public.challenges (id, category_id, lesson_id, icon, title, slug, description, instructions, safety_notes,
  difficulty, deadline_days, xp_reward, active, requires_evidence, requires_follow_up,
  why_it_matters, materials, evidence_instructions, duration_label)
values ('40000000-0000-4000-8000-000000000010', '10000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000012', '🛏️', 'Arrume sua cama', 'arrume-sua-cama',
  'Ao acordar, deixe sua cama organizada para começar o dia cuidando do seu espaço.', 'Estique o lençol sobre o colchão.
Dobre ou estique o cobertor e coloque o travesseiro no lugar.
Conte como ficou sua cama depois de arrumada.', 'Peça ajuda a um adulto se precisar subir ou alcançar uma cama alta.',
  'facil', 2, 30, true, true, false,
  'Pequenas responsabilidades diárias deixam o ambiente mais agradável e mostram como cada pessoa pode colaborar em casa.', 'Lençol
Cobertor
Travesseiro', 'Conte como você arrumou sua cama.', '1 dia')
on conflict (id) do update set
  category_id = excluded.category_id, lesson_id = excluded.lesson_id, icon = excluded.icon, title = excluded.title,
  slug = excluded.slug, description = excluded.description, instructions = excluded.instructions,
  safety_notes = excluded.safety_notes, difficulty = excluded.difficulty, deadline_days = excluded.deadline_days,
  xp_reward = excluded.xp_reward, active = true, requires_evidence = excluded.requires_evidence,
  requires_follow_up = excluded.requires_follow_up, why_it_matters = excluded.why_it_matters,
  materials = excluded.materials, evidence_instructions = excluded.evidence_instructions,
  duration_label = excluded.duration_label;

update public.challenge_steps s set order_index = x.base - x.rn
from (select id, row_number() over (order by order_index, id) as rn,
        (select least(min(order_index), 0) - 1000 from public.challenge_steps where challenge_id = '40000000-0000-4000-8000-000000000010') as base
      from public.challenge_steps where challenge_id = '40000000-0000-4000-8000-000000000010') x
where s.id = x.id;
update public.challenge_steps set active = false where challenge_id = '40000000-0000-4000-8000-000000000010' and id not in ('41000000-0000-4000-8000-010000000001', '41000000-0000-4000-8000-010000000002', '41000000-0000-4000-8000-010000000003');
insert into public.challenge_steps (id, challenge_id, title, description, step_type, order_index, required, xp_reward,
  day_offset, early_window_days, evidence_kind, deadline_offset_days, active) values
  ('41000000-0000-4000-8000-010000000001', '40000000-0000-4000-8000-000000000010', 'Organizar o lençol', 'Estique o lençol sobre o colchão.', 'action', 1, true, 0, null, 2, 'none', null, true),
  ('41000000-0000-4000-8000-010000000002', '40000000-0000-4000-8000-000000000010', 'Arrumar cobertor e travesseiro', 'Dobre ou estique o cobertor e coloque o travesseiro no lugar.', 'action', 2, true, 0, null, 2, 'none', null, true),
  ('41000000-0000-4000-8000-010000000003', '40000000-0000-4000-8000-000000000010', 'Registrar a tarefa', 'Conte como ficou sua cama depois de arrumada.', 'evidence', 3, true, 5, null, 2, 'text', null, true)
on conflict (id) do update set
  challenge_id = excluded.challenge_id, title = excluded.title, description = excluded.description,
  step_type = excluded.step_type, order_index = excluded.order_index, required = excluded.required,
  xp_reward = excluded.xp_reward, day_offset = excluded.day_offset, early_window_days = excluded.early_window_days,
  evidence_kind = excluded.evidence_kind, deadline_offset_days = excluded.deadline_offset_days, active = true;

-- Varra um cômodo da casa
insert into public.challenges (id, category_id, lesson_id, icon, title, slug, description, instructions, safety_notes,
  difficulty, deadline_days, xp_reward, active, requires_evidence, requires_follow_up,
  why_it_matters, materials, evidence_instructions, duration_label)
values ('40000000-0000-4000-8000-000000000011', '10000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000012', '🧹', 'Varra um cômodo da casa', 'varra-um-comodo-da-casa',
  'Ajude a limpar um cômodo varrendo o chão com atenção e cuidado.', 'Combine com um adulto qual cômodo você pode varrer.
Passe a vassoura devagar, juntando a sujeira em um canto.
Use a pá e descarte a sujeira no lugar combinado.
Conte qual cômodo você varreu e o que encontrou.', 'Peça ajuda a um adulto e não use produtos de limpeza sem autorização.
Não recolha objetos cortantes ou desconhecidos com as mãos.',
  'facil', 3, 40, true, true, false,
  'Manter os espaços limpos é uma forma concreta de cuidar do lugar onde todos vivem.', 'Vassoura
Pá de lixo
Saco de lixo', 'Conte qual cômodo você varreu e o que encontrou no chão.', '1 dia')
on conflict (id) do update set
  category_id = excluded.category_id, lesson_id = excluded.lesson_id, icon = excluded.icon, title = excluded.title,
  slug = excluded.slug, description = excluded.description, instructions = excluded.instructions,
  safety_notes = excluded.safety_notes, difficulty = excluded.difficulty, deadline_days = excluded.deadline_days,
  xp_reward = excluded.xp_reward, active = true, requires_evidence = excluded.requires_evidence,
  requires_follow_up = excluded.requires_follow_up, why_it_matters = excluded.why_it_matters,
  materials = excluded.materials, evidence_instructions = excluded.evidence_instructions,
  duration_label = excluded.duration_label;

update public.challenge_steps s set order_index = x.base - x.rn
from (select id, row_number() over (order by order_index, id) as rn,
        (select least(min(order_index), 0) - 1000 from public.challenge_steps where challenge_id = '40000000-0000-4000-8000-000000000011') as base
      from public.challenge_steps where challenge_id = '40000000-0000-4000-8000-000000000011') x
where s.id = x.id;
update public.challenge_steps set active = false where challenge_id = '40000000-0000-4000-8000-000000000011' and id not in ('41000000-0000-4000-8000-011000000001', '41000000-0000-4000-8000-011000000002', '41000000-0000-4000-8000-011000000003', '41000000-0000-4000-8000-011000000004');
insert into public.challenge_steps (id, challenge_id, title, description, step_type, order_index, required, xp_reward,
  day_offset, early_window_days, evidence_kind, deadline_offset_days, active) values
  ('41000000-0000-4000-8000-011000000001', '40000000-0000-4000-8000-000000000011', 'Escolher o cômodo', 'Combine com um adulto qual cômodo você pode varrer.', 'action', 1, true, 0, null, 2, 'none', null, true),
  ('41000000-0000-4000-8000-011000000002', '40000000-0000-4000-8000-000000000011', 'Varrer o chão', 'Passe a vassoura devagar, juntando a sujeira em um canto.', 'action', 2, true, 0, null, 2, 'none', null, true),
  ('41000000-0000-4000-8000-011000000003', '40000000-0000-4000-8000-000000000011', 'Guardar a sujeira', 'Use a pá e descarte a sujeira no lugar combinado.', 'action', 3, true, 0, null, 2, 'none', null, true),
  ('41000000-0000-4000-8000-011000000004', '40000000-0000-4000-8000-000000000011', 'Registrar a tarefa', 'Conte qual cômodo você varreu e o que encontrou.', 'evidence', 4, true, 5, null, 2, 'text', null, true)
on conflict (id) do update set
  challenge_id = excluded.challenge_id, title = excluded.title, description = excluded.description,
  step_type = excluded.step_type, order_index = excluded.order_index, required = excluded.required,
  xp_reward = excluded.xp_reward, day_offset = excluded.day_offset, early_window_days = excluded.early_window_days,
  evidence_kind = excluded.evidence_kind, deadline_offset_days = excluded.deadline_offset_days, active = true;

-- Organize seus brinquedos
insert into public.challenges (id, category_id, lesson_id, icon, title, slug, description, instructions, safety_notes,
  difficulty, deadline_days, xp_reward, active, requires_evidence, requires_follow_up,
  why_it_matters, materials, evidence_instructions, duration_label)
values ('40000000-0000-4000-8000-000000000012', '10000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000012', '🧸', 'Organize seus brinquedos', 'organize-seus-brinquedos',
  'Separe, guarde e deixe seus brinquedos prontos para a próxima brincadeira.', 'Junte os brinquedos espalhados e separe os que são parecidos.
Coloque cada grupo na caixa, no cesto ou na prateleira combinada.
Conte como você organizou seus brinquedos.', 'Peça ajuda a um adulto para guardar objetos pesados ou em lugares altos.',
  'facil', 3, 35, true, true, false,
  'Organizar e cuidar dos brinquedos ajuda a conservá-los e facilita encontrar o que você precisa sem comprar outro.', 'Brinquedos
Caixas, cestos ou prateleiras', 'Conte como você separou e guardou seus brinquedos.', '1 dia')
on conflict (id) do update set
  category_id = excluded.category_id, lesson_id = excluded.lesson_id, icon = excluded.icon, title = excluded.title,
  slug = excluded.slug, description = excluded.description, instructions = excluded.instructions,
  safety_notes = excluded.safety_notes, difficulty = excluded.difficulty, deadline_days = excluded.deadline_days,
  xp_reward = excluded.xp_reward, active = true, requires_evidence = excluded.requires_evidence,
  requires_follow_up = excluded.requires_follow_up, why_it_matters = excluded.why_it_matters,
  materials = excluded.materials, evidence_instructions = excluded.evidence_instructions,
  duration_label = excluded.duration_label;

update public.challenge_steps s set order_index = x.base - x.rn
from (select id, row_number() over (order by order_index, id) as rn,
        (select least(min(order_index), 0) - 1000 from public.challenge_steps where challenge_id = '40000000-0000-4000-8000-000000000012') as base
      from public.challenge_steps where challenge_id = '40000000-0000-4000-8000-000000000012') x
where s.id = x.id;
update public.challenge_steps set active = false where challenge_id = '40000000-0000-4000-8000-000000000012' and id not in ('41000000-0000-4000-8000-012000000001', '41000000-0000-4000-8000-012000000002', '41000000-0000-4000-8000-012000000003');
insert into public.challenge_steps (id, challenge_id, title, description, step_type, order_index, required, xp_reward,
  day_offset, early_window_days, evidence_kind, deadline_offset_days, active) values
  ('41000000-0000-4000-8000-012000000001', '40000000-0000-4000-8000-000000000012', 'Separar os brinquedos', 'Junte os brinquedos espalhados e separe os que são parecidos.', 'action', 1, true, 0, null, 2, 'none', null, true),
  ('41000000-0000-4000-8000-012000000002', '40000000-0000-4000-8000-000000000012', 'Guardar cada grupo', 'Coloque cada grupo na caixa, no cesto ou na prateleira combinada.', 'action', 2, true, 0, null, 2, 'none', null, true),
  ('41000000-0000-4000-8000-012000000003', '40000000-0000-4000-8000-000000000012', 'Registrar a tarefa', 'Conte como você organizou seus brinquedos.', 'evidence', 3, true, 5, null, 2, 'text', null, true)
on conflict (id) do update set
  challenge_id = excluded.challenge_id, title = excluded.title, description = excluded.description,
  step_type = excluded.step_type, order_index = excluded.order_index, required = excluded.required,
  xp_reward = excluded.xp_reward, day_offset = excluded.day_offset, early_window_days = excluded.early_window_days,
  evidence_kind = excluded.evidence_kind, deadline_offset_days = excluded.deadline_offset_days, active = true;

-- Ajude a lavar a louça
insert into public.challenges (id, category_id, lesson_id, icon, title, slug, description, instructions, safety_notes,
  difficulty, deadline_days, xp_reward, active, requires_evidence, requires_follow_up,
  why_it_matters, materials, evidence_instructions, duration_label)
values ('40000000-0000-4000-8000-000000000013', '10000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000012', '🍽️', 'Ajude a lavar a louça', 'ajude-a-lavar-a-louca',
  'Ajude a deixar a louça limpa e a cozinha organizada depois de uma refeição.', 'Com um adulto, separe apenas os itens que você pode lavar.
Use pouca água e detergente, sempre seguindo a orientação do adulto.
Coloque os itens no escorredor ou no local combinado.
Conte como você ajudou e como evitou gastar água sem necessidade.', 'Faça a tarefa com um adulto.
Não mexa com facas, copos quebrados, água quente ou produtos sem autorização.',
  'medio', 3, 45, true, true, false,
  'Colaborar com as tarefas da casa economiza água quando fazemos tudo com atenção e divide o cuidado entre todos.', 'Esponja
Detergente
Escorredor de louça', 'Conte como você ajudou e como evitou gastar água sem necessidade.', '1 dia')
on conflict (id) do update set
  category_id = excluded.category_id, lesson_id = excluded.lesson_id, icon = excluded.icon, title = excluded.title,
  slug = excluded.slug, description = excluded.description, instructions = excluded.instructions,
  safety_notes = excluded.safety_notes, difficulty = excluded.difficulty, deadline_days = excluded.deadline_days,
  xp_reward = excluded.xp_reward, active = true, requires_evidence = excluded.requires_evidence,
  requires_follow_up = excluded.requires_follow_up, why_it_matters = excluded.why_it_matters,
  materials = excluded.materials, evidence_instructions = excluded.evidence_instructions,
  duration_label = excluded.duration_label;

update public.challenge_steps s set order_index = x.base - x.rn
from (select id, row_number() over (order by order_index, id) as rn,
        (select least(min(order_index), 0) - 1000 from public.challenge_steps where challenge_id = '40000000-0000-4000-8000-000000000013') as base
      from public.challenge_steps where challenge_id = '40000000-0000-4000-8000-000000000013') x
where s.id = x.id;
update public.challenge_steps set active = false where challenge_id = '40000000-0000-4000-8000-000000000013' and id not in ('41000000-0000-4000-8000-013000000001', '41000000-0000-4000-8000-013000000002', '41000000-0000-4000-8000-013000000003', '41000000-0000-4000-8000-013000000004');
insert into public.challenge_steps (id, challenge_id, title, description, step_type, order_index, required, xp_reward,
  day_offset, early_window_days, evidence_kind, deadline_offset_days, active) values
  ('41000000-0000-4000-8000-013000000001', '40000000-0000-4000-8000-000000000013', 'Separar a louça segura', 'Com um adulto, separe apenas os itens que você pode lavar.', 'action', 1, true, 0, null, 2, 'none', null, true),
  ('41000000-0000-4000-8000-013000000002', '40000000-0000-4000-8000-000000000013', 'Lavar e enxaguar', 'Use pouca água e detergente, sempre seguindo a orientação do adulto.', 'action', 2, true, 0, null, 2, 'none', null, true),
  ('41000000-0000-4000-8000-013000000003', '40000000-0000-4000-8000-000000000013', 'Guardar a louça', 'Coloque os itens no escorredor ou no local combinado.', 'action', 3, true, 0, null, 2, 'none', null, true),
  ('41000000-0000-4000-8000-013000000004', '40000000-0000-4000-8000-000000000013', 'Registrar a tarefa', 'Conte como você ajudou e como evitou gastar água sem necessidade.', 'evidence', 4, true, 5, null, 2, 'text', null, true)
on conflict (id) do update set
  challenge_id = excluded.challenge_id, title = excluded.title, description = excluded.description,
  step_type = excluded.step_type, order_index = excluded.order_index, required = excluded.required,
  xp_reward = excluded.xp_reward, day_offset = excluded.day_offset, early_window_days = excluded.early_window_days,
  evidence_kind = excluded.evidence_kind, deadline_offset_days = excluded.deadline_offset_days, active = true;

-- Leia por 15 minutos
insert into public.challenges (id, category_id, lesson_id, icon, title, slug, description, instructions, safety_notes,
  difficulty, deadline_days, xp_reward, active, requires_evidence, requires_follow_up,
  why_it_matters, materials, evidence_instructions, duration_label)
values ('40000000-0000-4000-8000-000000000014', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '📖', 'Leia por 15 minutos', 'leia-por-15-minutos',
  'Escolha um livro, leia por quinze minutos e registre uma ideia que descobriu.', 'Escolha um livro ou texto que desperte sua curiosidade.
Leia por pelo menos quinze minutos, em um lugar confortável.
Conte o título e uma ideia ou personagem de que você gostou.', null,
  'facil', 3, 35, true, true, false,
  'A leitura aumenta a imaginação, amplia o vocabulário e ajuda você a conhecer novos pontos de vista.', 'Um livro adequado para sua idade
Um lugar confortável', 'Conte o título do livro e uma ideia ou personagem de que você gostou.', '15 minutos')
on conflict (id) do update set
  category_id = excluded.category_id, lesson_id = excluded.lesson_id, icon = excluded.icon, title = excluded.title,
  slug = excluded.slug, description = excluded.description, instructions = excluded.instructions,
  safety_notes = excluded.safety_notes, difficulty = excluded.difficulty, deadline_days = excluded.deadline_days,
  xp_reward = excluded.xp_reward, active = true, requires_evidence = excluded.requires_evidence,
  requires_follow_up = excluded.requires_follow_up, why_it_matters = excluded.why_it_matters,
  materials = excluded.materials, evidence_instructions = excluded.evidence_instructions,
  duration_label = excluded.duration_label;

update public.challenge_steps s set order_index = x.base - x.rn
from (select id, row_number() over (order by order_index, id) as rn,
        (select least(min(order_index), 0) - 1000 from public.challenge_steps where challenge_id = '40000000-0000-4000-8000-000000000014') as base
      from public.challenge_steps where challenge_id = '40000000-0000-4000-8000-000000000014') x
where s.id = x.id;
update public.challenge_steps set active = false where challenge_id = '40000000-0000-4000-8000-000000000014' and id not in ('41000000-0000-4000-8000-014000000001', '41000000-0000-4000-8000-014000000002', '41000000-0000-4000-8000-014000000003');
insert into public.challenge_steps (id, challenge_id, title, description, step_type, order_index, required, xp_reward,
  day_offset, early_window_days, evidence_kind, deadline_offset_days, active) values
  ('41000000-0000-4000-8000-014000000001', '40000000-0000-4000-8000-000000000014', 'Escolher a leitura', 'Escolha um livro ou texto que desperte sua curiosidade.', 'action', 1, true, 0, null, 2, 'none', null, true),
  ('41000000-0000-4000-8000-014000000002', '40000000-0000-4000-8000-000000000014', 'Ler com atenção', 'Leia por pelo menos quinze minutos, em um lugar confortável.', 'action', 2, true, 0, null, 2, 'none', null, true),
  ('41000000-0000-4000-8000-014000000003', '40000000-0000-4000-8000-000000000014', 'Registrar o que aprendeu', 'Conte o título e uma ideia ou personagem de que você gostou.', 'evidence', 3, true, 5, null, 2, 'text', null, true)
on conflict (id) do update set
  challenge_id = excluded.challenge_id, title = excluded.title, description = excluded.description,
  step_type = excluded.step_type, order_index = excluded.order_index, required = excluded.required,
  xp_reward = excluded.xp_reward, day_offset = excluded.day_offset, early_window_days = excluded.early_window_days,
  evidence_kind = excluded.evidence_kind, deadline_offset_days = excluded.deadline_offset_days, active = true;

-- Analise uma paisagem
insert into public.challenges (id, category_id, lesson_id, icon, title, slug, description, instructions, safety_notes,
  difficulty, deadline_days, xp_reward, active, requires_evidence, requires_follow_up,
  why_it_matters, materials, evidence_instructions, duration_label)
values ('40000000-0000-4000-8000-000000000015', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '🔍', 'Analise uma paisagem', 'analise-uma-paisagem',
  'Observe uma paisagem por alguns minutos e descubra os elementos naturais e construídos que fazem parte dela.', 'Escolha uma janela, praça ou outro lugar onde possa observar com segurança.
Passe alguns minutos percebendo plantas, animais, água, pessoas e construções.
Descreva três coisas que viu, o que era natural e o que poderia melhorar.', 'Observe sempre acompanhado por um adulto e sem entrar em locais perigosos.
Não se aproxime de ruas, animais desconhecidos ou terrenos particulares.',
  'facil', 3, 40, true, true, false,
  'Observar com atenção ajuda a perceber relações entre plantas, animais, água, pessoas e construções.', 'Uma janela, praça ou lugar seguro para observar
Papel e lápis, se quiser desenhar', 'Descreva três coisas que viu, o que era natural e o que poderia melhorar naquele lugar.', '10 minutos')
on conflict (id) do update set
  category_id = excluded.category_id, lesson_id = excluded.lesson_id, icon = excluded.icon, title = excluded.title,
  slug = excluded.slug, description = excluded.description, instructions = excluded.instructions,
  safety_notes = excluded.safety_notes, difficulty = excluded.difficulty, deadline_days = excluded.deadline_days,
  xp_reward = excluded.xp_reward, active = true, requires_evidence = excluded.requires_evidence,
  requires_follow_up = excluded.requires_follow_up, why_it_matters = excluded.why_it_matters,
  materials = excluded.materials, evidence_instructions = excluded.evidence_instructions,
  duration_label = excluded.duration_label;

update public.challenge_steps s set order_index = x.base - x.rn
from (select id, row_number() over (order by order_index, id) as rn,
        (select least(min(order_index), 0) - 1000 from public.challenge_steps where challenge_id = '40000000-0000-4000-8000-000000000015') as base
      from public.challenge_steps where challenge_id = '40000000-0000-4000-8000-000000000015') x
where s.id = x.id;
update public.challenge_steps set active = false where challenge_id = '40000000-0000-4000-8000-000000000015' and id not in ('41000000-0000-4000-8000-015000000001', '41000000-0000-4000-8000-015000000002', '41000000-0000-4000-8000-015000000003');
insert into public.challenge_steps (id, challenge_id, title, description, step_type, order_index, required, xp_reward,
  day_offset, early_window_days, evidence_kind, deadline_offset_days, active) values
  ('41000000-0000-4000-8000-015000000001', '40000000-0000-4000-8000-000000000015', 'Escolher um lugar seguro', 'Escolha uma janela, praça ou outro lugar onde possa observar com segurança.', 'action', 1, true, 0, null, 2, 'none', null, true),
  ('41000000-0000-4000-8000-015000000002', '40000000-0000-4000-8000-000000000015', 'Observar a paisagem', 'Passe alguns minutos percebendo plantas, animais, água, pessoas e construções.', 'action', 2, true, 0, null, 2, 'none', null, true),
  ('41000000-0000-4000-8000-015000000003', '40000000-0000-4000-8000-000000000015', 'Registrar suas descobertas', 'Descreva três coisas que viu, o que era natural e o que poderia melhorar.', 'evidence', 3, true, 5, null, 2, 'text', null, true)
on conflict (id) do update set
  challenge_id = excluded.challenge_id, title = excluded.title, description = excluded.description,
  step_type = excluded.step_type, order_index = excluded.order_index, required = excluded.required,
  xp_reward = excluded.xp_reward, day_offset = excluded.day_offset, early_window_days = excluded.early_window_days,
  evidence_kind = excluded.evidence_kind, deadline_offset_days = excluded.deadline_offset_days, active = true;

-- Escreva no seu diário
insert into public.challenges (id, category_id, lesson_id, icon, title, slug, description, instructions, safety_notes,
  difficulty, deadline_days, xp_reward, active, requires_evidence, requires_follow_up,
  why_it_matters, materials, evidence_instructions, duration_label)
values ('40000000-0000-4000-8000-000000000016', '10000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000012', '✍️', 'Escreva no seu diário', 'escreva-no-diario',
  'Escreva sobre algo que você sentiu, aprendeu ou gostaria de melhorar hoje.', 'Pense em algo que sentiu, aprendeu ou gostaria de melhorar.
Escreva livremente por alguns minutos, sem se preocupar em escrever perfeito.
Compartilhe uma frase sobre o tema, sem incluir informações pessoais.', 'Não compartilhe endereço, telefone, senhas ou informações pessoais.',
  'facil', 3, 35, true, true, false,
  'Colocar pensamentos no papel ajuda a reconhecer sentimentos, organizar ideias e perceber seu próprio crescimento.', 'Caderno ou diário
Lápis ou caneta', 'Compartilhe apenas o que se sentir confortável: escreva uma frase sobre o tema escolhido.', '10 minutos')
on conflict (id) do update set
  category_id = excluded.category_id, lesson_id = excluded.lesson_id, icon = excluded.icon, title = excluded.title,
  slug = excluded.slug, description = excluded.description, instructions = excluded.instructions,
  safety_notes = excluded.safety_notes, difficulty = excluded.difficulty, deadline_days = excluded.deadline_days,
  xp_reward = excluded.xp_reward, active = true, requires_evidence = excluded.requires_evidence,
  requires_follow_up = excluded.requires_follow_up, why_it_matters = excluded.why_it_matters,
  materials = excluded.materials, evidence_instructions = excluded.evidence_instructions,
  duration_label = excluded.duration_label;

update public.challenge_steps s set order_index = x.base - x.rn
from (select id, row_number() over (order by order_index, id) as rn,
        (select least(min(order_index), 0) - 1000 from public.challenge_steps where challenge_id = '40000000-0000-4000-8000-000000000016') as base
      from public.challenge_steps where challenge_id = '40000000-0000-4000-8000-000000000016') x
where s.id = x.id;
update public.challenge_steps set active = false where challenge_id = '40000000-0000-4000-8000-000000000016' and id not in ('41000000-0000-4000-8000-016000000001', '41000000-0000-4000-8000-016000000002', '41000000-0000-4000-8000-016000000003');
insert into public.challenge_steps (id, challenge_id, title, description, step_type, order_index, required, xp_reward,
  day_offset, early_window_days, evidence_kind, deadline_offset_days, active) values
  ('41000000-0000-4000-8000-016000000001', '40000000-0000-4000-8000-000000000016', 'Escolher um tema', 'Pense em algo que sentiu, aprendeu ou gostaria de melhorar.', 'action', 1, true, 0, null, 2, 'none', null, true),
  ('41000000-0000-4000-8000-016000000002', '40000000-0000-4000-8000-000000000016', 'Escrever no diário', 'Escreva livremente por alguns minutos, sem se preocupar em escrever perfeito.', 'action', 2, true, 0, null, 2, 'none', null, true),
  ('41000000-0000-4000-8000-016000000003', '40000000-0000-4000-8000-000000000016', 'Registrar a reflexão', 'Compartilhe uma frase sobre o tema, sem incluir informações pessoais.', 'evidence', 3, true, 5, null, 2, 'text', null, true)
on conflict (id) do update set
  challenge_id = excluded.challenge_id, title = excluded.title, description = excluded.description,
  step_type = excluded.step_type, order_index = excluded.order_index, required = excluded.required,
  xp_reward = excluded.xp_reward, day_offset = excluded.day_offset, early_window_days = excluded.early_window_days,
  evidence_kind = excluded.evidence_kind, deadline_offset_days = excluded.deadline_offset_days, active = true;

-- Pratique atenção por cinco minutos
insert into public.challenges (id, category_id, lesson_id, icon, title, slug, description, instructions, safety_notes,
  difficulty, deadline_days, xp_reward, active, requires_evidence, requires_follow_up,
  why_it_matters, materials, evidence_instructions, duration_label)
values ('40000000-0000-4000-8000-000000000017', '10000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000012', '🧘', 'Pratique atenção por cinco minutos', 'pratique-atencao-por-cinco-minutos',
  'Pare por alguns minutos, respire com calma e perceba os sons e sensações ao seu redor.', 'Sente-se em um lugar confortável e seguro.
Respire com calma e perceba os sons, as sensações e os pensamentos sem julgá-los.
Conte um som, uma sensação ou um pensamento que percebeu.', 'Faça sentado ou em uma posição confortável e pare se sentir desconforto.
Esta atividade não substitui a ajuda de um adulto ou profissional quando você precisar.',
  'facil', 3, 35, true, true, false,
  'A atenção ajuda a desacelerar, perceber como você está e agir com mais cuidado consigo e com as outras pessoas.', 'Um lugar tranquilo
Cinco minutos', 'Conte o que percebeu durante a prática: um som, uma sensação ou um pensamento.', '5 minutos')
on conflict (id) do update set
  category_id = excluded.category_id, lesson_id = excluded.lesson_id, icon = excluded.icon, title = excluded.title,
  slug = excluded.slug, description = excluded.description, instructions = excluded.instructions,
  safety_notes = excluded.safety_notes, difficulty = excluded.difficulty, deadline_days = excluded.deadline_days,
  xp_reward = excluded.xp_reward, active = true, requires_evidence = excluded.requires_evidence,
  requires_follow_up = excluded.requires_follow_up, why_it_matters = excluded.why_it_matters,
  materials = excluded.materials, evidence_instructions = excluded.evidence_instructions,
  duration_label = excluded.duration_label;

update public.challenge_steps s set order_index = x.base - x.rn
from (select id, row_number() over (order by order_index, id) as rn,
        (select least(min(order_index), 0) - 1000 from public.challenge_steps where challenge_id = '40000000-0000-4000-8000-000000000017') as base
      from public.challenge_steps where challenge_id = '40000000-0000-4000-8000-000000000017') x
where s.id = x.id;
update public.challenge_steps set active = false where challenge_id = '40000000-0000-4000-8000-000000000017' and id not in ('41000000-0000-4000-8000-017000000001', '41000000-0000-4000-8000-017000000002', '41000000-0000-4000-8000-017000000003');
insert into public.challenge_steps (id, challenge_id, title, description, step_type, order_index, required, xp_reward,
  day_offset, early_window_days, evidence_kind, deadline_offset_days, active) values
  ('41000000-0000-4000-8000-017000000001', '40000000-0000-4000-8000-000000000017', 'Encontrar um lugar tranquilo', 'Sente-se em um lugar confortável e seguro.', 'action', 1, true, 0, null, 2, 'none', null, true),
  ('41000000-0000-4000-8000-017000000002', '40000000-0000-4000-8000-000000000017', 'Respirar e observar', 'Respire com calma e perceba os sons, as sensações e os pensamentos sem julgá-los.', 'action', 2, true, 0, null, 2, 'none', null, true),
  ('41000000-0000-4000-8000-017000000003', '40000000-0000-4000-8000-000000000017', 'Registrar o momento', 'Conte um som, uma sensação ou um pensamento que percebeu.', 'evidence', 3, true, 5, null, 2, 'text', null, true)
on conflict (id) do update set
  challenge_id = excluded.challenge_id, title = excluded.title, description = excluded.description,
  step_type = excluded.step_type, order_index = excluded.order_index, required = excluded.required,
  xp_reward = excluded.xp_reward, day_offset = excluded.day_offset, early_window_days = excluded.early_window_days,
  evidence_kind = excluded.evidence_kind, deadline_offset_days = excluded.deadline_offset_days, active = true;

-- Conheça a vaca e os derivados do leite
insert into public.challenges (id, category_id, lesson_id, icon, title, slug, description, instructions, safety_notes,
  difficulty, deadline_days, xp_reward, active, requires_evidence, requires_follow_up,
  why_it_matters, materials, evidence_instructions, duration_label)
values ('40000000-0000-4000-8000-000000000018', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000013', '🐄', 'Conheça a vaca e os derivados do leite', 'conheca-a-vaca-e-os-derivados-do-leite',
  'Observe uma imagem, vídeo educativo ou visita autorizada e descubra como o leite vira outros alimentos.', 'Use um livro, imagem ou vídeo educativo; uma visita só pode acontecer com autorização e acompanhamento de um adulto.
Descubra o que a vaca precisa para viver bem e como o leite pode virar outros alimentos.
Desenhe uma vaca ou escreva uma coisa que aprendeu.
Conte uma coisa que aprendeu sobre a vaca e cite dois derivados do leite.', 'Crianças devem observar animais somente com um adulto responsável.
Não toque, alimente ou entre em cercados sem autorização.',
  'facil', 7, 45, true, true, false,
  'Entender a origem dos alimentos ajuda a respeitar os animais, valorizar o trabalho das pessoas e evitar desperdícios.', 'Um livro, imagem ou vídeo educativo
Papel e lápis para desenhar', 'Conte uma coisa que aprendeu sobre a vaca e cite dois derivados do leite.', '20 minutos')
on conflict (id) do update set
  category_id = excluded.category_id, lesson_id = excluded.lesson_id, icon = excluded.icon, title = excluded.title,
  slug = excluded.slug, description = excluded.description, instructions = excluded.instructions,
  safety_notes = excluded.safety_notes, difficulty = excluded.difficulty, deadline_days = excluded.deadline_days,
  xp_reward = excluded.xp_reward, active = true, requires_evidence = excluded.requires_evidence,
  requires_follow_up = excluded.requires_follow_up, why_it_matters = excluded.why_it_matters,
  materials = excluded.materials, evidence_instructions = excluded.evidence_instructions,
  duration_label = excluded.duration_label;

update public.challenge_steps s set order_index = x.base - x.rn
from (select id, row_number() over (order by order_index, id) as rn,
        (select least(min(order_index), 0) - 1000 from public.challenge_steps where challenge_id = '40000000-0000-4000-8000-000000000018') as base
      from public.challenge_steps where challenge_id = '40000000-0000-4000-8000-000000000018') x
where s.id = x.id;
update public.challenge_steps set active = false where challenge_id = '40000000-0000-4000-8000-000000000018' and id not in ('41000000-0000-4000-8000-018000000001', '41000000-0000-4000-8000-018000000002', '41000000-0000-4000-8000-018000000003', '41000000-0000-4000-8000-018000000004');
insert into public.challenge_steps (id, challenge_id, title, description, step_type, order_index, required, xp_reward,
  day_offset, early_window_days, evidence_kind, deadline_offset_days, active) values
  ('41000000-0000-4000-8000-018000000001', '40000000-0000-4000-8000-000000000018', 'Escolher uma fonte segura', 'Use um livro, imagem ou vídeo educativo; uma visita só pode acontecer com autorização e acompanhamento de um adulto.', 'action', 1, true, 0, null, 2, 'none', null, true),
  ('41000000-0000-4000-8000-018000000002', '40000000-0000-4000-8000-000000000018', 'Observar e aprender', 'Descubra o que a vaca precisa para viver bem e como o leite pode virar outros alimentos.', 'action', 2, true, 0, null, 2, 'none', null, true),
  ('41000000-0000-4000-8000-018000000003', '40000000-0000-4000-8000-000000000018', 'Desenhar ou registrar', 'Desenhe uma vaca ou escreva uma coisa que aprendeu.', 'action', 3, true, 0, null, 2, 'none', null, true),
  ('41000000-0000-4000-8000-018000000004', '40000000-0000-4000-8000-000000000018', 'Registrar a descoberta', 'Conte uma coisa que aprendeu sobre a vaca e cite dois derivados do leite.', 'evidence', 4, true, 5, null, 2, 'text', null, true)
on conflict (id) do update set
  challenge_id = excluded.challenge_id, title = excluded.title, description = excluded.description,
  step_type = excluded.step_type, order_index = excluded.order_index, required = excluded.required,
  xp_reward = excluded.xp_reward, day_offset = excluded.day_offset, early_window_days = excluded.early_window_days,
  evidence_kind = excluded.evidence_kind, deadline_offset_days = excluded.deadline_offset_days, active = true;
