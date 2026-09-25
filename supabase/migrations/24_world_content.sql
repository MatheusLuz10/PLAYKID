-- =====================================================================
-- 24 · Mundo virtual: áreas, estágios e itens (Etapa 7)
-- =====================================================================
-- ARQUIVO GERADO por "npm run content:sql" a partir de content/world.json.
-- Não edite à mão. Idempotente: pode ser executado de novo depois de editar o JSON.
-- Itens que saírem do JSON ficam inativos (quem já tem, continua tendo).

insert into public.world_areas (code, name, icon, description, sort_order) values
  ('natural', 'Área natural', '🌳', 'Árvores, flores, plantas e o solo que sustenta a vida.', 1),
  ('water', 'Área da água', '💧', 'Lago, rio, nascente e a vegetação perto da água.', 2),
  ('garden', 'Horta', '🥕', 'Canteiros, hortaliças, ervas e compostagem.', 3),
  ('pollinators', 'Jardim dos polinizadores', '🐝', 'Flores, abelhas, borboletas e pequenos insetos.', 4),
  ('community', 'Área comunitária', '🤝', 'Praça, jardins e espaços coletivos.', 5)
on conflict (code) do update set
  name = excluded.name, icon = excluded.icon, description = excluded.description, sort_order = excluded.sort_order;

insert into public.world_stages (id, stage_number, name, icon, description, status, min_items, min_challenges, min_categories) values
  ('72000000-0000-4000-8000-000000000001', 1, 'Terreno', '🟫', 'Um terreno simples, com poucas plantas, esperando cuidado.', 'empty', 0, 0, 0),
  ('72000000-0000-4000-8000-000000000002', 2, 'Primeiras plantas', '🌱', 'O que você aprendeu começa a brotar.', 'evolving', 1, 0, 1),
  ('72000000-0000-4000-8000-000000000003', 3, 'Ecossistema', '🌳', 'Árvores e flores nascidas de ações reais.', 'evolving', 3, 1, 1),
  ('72000000-0000-4000-8000-000000000004', 4, 'Biodiversidade', '🐝', 'Animais e polinizadores chegam ao seu mundo.', 'developed', 6, 2, 2),
  ('72000000-0000-4000-8000-000000000005', 5, 'Recursos', '💧', 'Água e horta sustentam a vida.', 'rich', 10, 3, 3),
  ('72000000-0000-4000-8000-000000000006', 6, 'Comunidade', '🤝', 'Espaços coletivos cuidados por todos.', 'rich', 14, 4, 4),
  ('72000000-0000-4000-8000-000000000007', 7, 'Ecossistema vivo', '🌎', 'Um mundo completo e diversificado.', 'ecosystem', 20, 6, 5)
on conflict (id) do update set
  stage_number = excluded.stage_number, name = excluded.name, icon = excluded.icon, description = excluded.description,
  status = excluded.status, min_items = excluded.min_items, min_challenges = excluded.min_challenges,
  min_categories = excluded.min_categories;
delete from public.world_stages where id not in ('72000000-0000-4000-8000-000000000001', '72000000-0000-4000-8000-000000000002', '72000000-0000-4000-8000-000000000003', '72000000-0000-4000-8000-000000000004', '72000000-0000-4000-8000-000000000005', '72000000-0000-4000-8000-000000000006', '72000000-0000-4000-8000-000000000007');

-- Códigos antigos liberados antes do upsert (os itens mantêm os mesmos IDs).
update public.world_items set code = 'old_' || replace(id::text, '-', '_'), slug = 'old-' || id::text
where id in ('70000000-0000-4000-8000-000000000005', '70000000-0000-4000-8000-000000000006', '70000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000007', '70000000-0000-4000-8000-000000000008', '70000000-0000-4000-8000-000000000009', '70000000-0000-4000-8000-000000000002', '70000000-0000-4000-8000-000000000010', '70000000-0000-4000-8000-000000000011', '70000000-0000-4000-8000-000000000012', '70000000-0000-4000-8000-000000000013', '70000000-0000-4000-8000-000000000014', '70000000-0000-4000-8000-000000000015', '70000000-0000-4000-8000-000000000016', '70000000-0000-4000-8000-000000000003', '70000000-0000-4000-8000-000000000017', '70000000-0000-4000-8000-000000000018', '70000000-0000-4000-8000-000000000019', '70000000-0000-4000-8000-000000000004', '70000000-0000-4000-8000-000000000020', '70000000-0000-4000-8000-000000000021', '70000000-0000-4000-8000-000000000022', '70000000-0000-4000-8000-000000000023', '70000000-0000-4000-8000-000000000024', '70000000-0000-4000-8000-000000000025', '70000000-0000-4000-8000-000000000026', '70000000-0000-4000-8000-000000000027', '70000000-0000-4000-8000-000000000028', '70000000-0000-4000-8000-000000000029', '70000000-0000-4000-8000-000000000030', '70000000-0000-4000-8000-000000000031', '70000000-0000-4000-8000-000000000032', '70000000-0000-0000-0000-000000000033');
insert into public.world_items (id, code, slug, name, description, meaning, icon, area, category_id, item_type, rarity,
  milestone, unlock_type, unlock_reference, min_level, sort_order, metadata, unlock_title, unlock_message, active) values
  ('70000000-0000-4000-8000-000000000005', 'plant_small', 'plant_small', 'Pequena planta', 'Um broto que já estava no terreno.', 'O começo da sua jornada: todo ecossistema começa pequeno.', '🌱', 'natural', '10000000-0000-4000-8000-000000000001', 'plant', 'common',
   false, 'initial', null, null, 1, '{"slot":{"x":10,"y":88}}'::jsonb, null, null, true),
  ('70000000-0000-4000-8000-000000000006', 'bush_basic', 'bush_basic', 'Arbusto', 'Vegetação que cresce com o conhecimento.', 'Sua primeira lição concluída: aprender também faz o mundo crescer.', '🌿', 'natural', '10000000-0000-4000-8000-000000000001', 'plant', 'common',
   false, 'achievement', 'primeiro-aprendizado', null, 2, '{"slot":{"x":88,"y":58}}'::jsonb, null, null, true),
  ('70000000-0000-4000-8000-000000000001', 'tree_basic', 'tree_basic', 'Árvore jovem', 'A árvore que nasceu do seu plantio real.', 'O plantio que você fez no mundo real e acompanhou por seis meses.', '🌳', 'natural', '10000000-0000-4000-8000-000000000001', 'tree', 'common',
   false, 'challenge', 'plante-uma-arvore', null, 3, '{"slot":{"x":55,"y":88}}'::jsonb, 'Seu mundo cresceu!', 'Você realizou uma ação no mundo real. Agora existe uma nova árvore no seu mundo ECO QUEST.', true),
  ('70000000-0000-4000-8000-000000000007', 'tree_first_step', 'tree_first_step', 'Árvore do Primeiro Passo', 'Marco especial da sua primeira ação ambiental.', 'O dia em que você transformou conhecimento em ação pela primeira vez.', '🌳', 'natural', '10000000-0000-4000-8000-000000000001', 'tree', 'rare',
   true, 'achievement', 'primeiro-passo', null, 4, '{"slot":{"x":68,"y":56}}'::jsonb, null, null, true),
  ('70000000-0000-4000-8000-000000000008', 'tree_large', 'tree_large', 'Árvore grande', 'Uma árvore que cresceu com a sua jornada.', 'Sua constância: chegar ao nível 5 mostra que você continua cuidando.', '🌳', 'natural', '10000000-0000-4000-8000-000000000001', 'tree', 'uncommon',
   false, 'level', '5', null, 5, '{"slot":{"x":42,"y":54}}'::jsonb, null, null, true),
  ('70000000-0000-4000-8000-000000000009', 'tree_special', 'tree_special', 'Árvore especial', 'Árvore rara do Guardião das Plantas.', 'Cinco ações pela natureza: plantios, cultivos e acompanhamentos.', '🌲', 'natural', '10000000-0000-4000-8000-000000000001', 'tree', 'epic',
   true, 'achievement', 'guardiao-das-plantas', null, 6, '{"slot":{"x":16,"y":52}}'::jsonb, null, null, true),
  ('70000000-0000-4000-8000-000000000002', 'flower_basic', 'flower_basic', 'Flor', 'Uma flor cultivada por você.', 'A flor que você cultivou e acompanhou no mundo real.', '🌸', 'natural', '10000000-0000-4000-8000-000000000001', 'flower', 'common',
   false, 'challenge', 'cultive-uma-flor', null, 7, '{"slot":{"x":30,"y":90}}'::jsonb, 'Nova vida no seu mundo!', 'Seu mundo ganhou uma nova espécie vegetal.', true),
  ('70000000-0000-4000-8000-000000000010', 'flowerbed', 'flowerbed', 'Canteiro de flores', 'Um canteiro cheio de cor.', 'Três desafios de natureza concluídos: você virou um pequeno jardineiro.', '🌼', 'natural', '10000000-0000-4000-8000-000000000001', 'flower', 'uncommon',
   false, 'achievement', 'pequeno-jardineiro', null, 8, '{"slot":{"x":80,"y":90}}'::jsonb, null, null, true),
  ('70000000-0000-4000-8000-000000000011', 'riverbank', 'riverbank', 'Vegetação de margem', 'Plantas que protegem as margens.', 'O que você aprendeu sobre por que economizar água.', '🌾', 'water', '10000000-0000-4000-8000-000000000002', 'plant', 'common',
   false, 'lesson', 'por-que-precisamos-economizar-agua', null, 9, '{"slot":{"x":12,"y":88}}'::jsonb, null, null, true),
  ('70000000-0000-4000-8000-000000000012', 'pond', 'pond', 'Lago', 'Um pequeno lago de água limpa.', 'O que você aprendeu sobre o caminho da água da chuva.', '🪷', 'water', '10000000-0000-4000-8000-000000000002', 'water', 'common',
   false, 'lesson', 'o-que-acontece-com-a-agua-da-chuva', null, 10, '{"slot":{"x":38,"y":74}}'::jsonb, null, null, true),
  ('70000000-0000-4000-8000-000000000013', 'water_basic', 'water_basic', 'Pequeno ponto de água', 'Água cuidada gota a gota.', 'O desperdício de água que você reduziu em casa.', '💧', 'water', '10000000-0000-4000-8000-000000000002', 'water', 'common',
   false, 'challenge', 'reduza-o-desperdicio-de-agua', null, 11, '{"slot":{"x":64,"y":88}}'::jsonb, 'A água chegou ao seu mundo!', 'Cada gota que você economizou virou vida no seu ecossistema.', true),
  ('70000000-0000-4000-8000-000000000014', 'river', 'river', 'Rio', 'Um rio que atravessa o seu mundo.', 'Uma jornada longa: o nível 7 mostra o quanto você já cuidou.', '🌊', 'water', '10000000-0000-4000-8000-000000000002', 'water', 'rare',
   false, 'level', '7', null, 12, '{"slot":{"x":86,"y":58}}'::jsonb, null, null, true),
  ('70000000-0000-4000-8000-000000000015', 'garden_bed', 'garden_bed', 'Canteiro', 'Terra preparada para o cultivo.', 'O que você aprendeu sobre como funciona uma horta.', '🌱', 'garden', '10000000-0000-4000-8000-000000000001', 'plant', 'common',
   false, 'lesson', 'o-que-e-uma-horta', null, 13, '{"slot":{"x":12,"y":88}}'::jsonb, null, null, true),
  ('70000000-0000-4000-8000-000000000016', 'herbs', 'herbs', 'Ervas', 'Ervas aromáticas.', 'O que você aprendeu sobre como uma planta cresce.', '🌿', 'garden', '10000000-0000-4000-8000-000000000001', 'plant', 'common',
   false, 'lesson', 'como-uma-planta-cresce', null, 14, '{"slot":{"x":30,"y":62}}'::jsonb, null, null, true),
  ('70000000-0000-4000-8000-000000000003', 'garden_basic', 'garden_basic', 'Horta Inicial', 'Sua primeira horta com hortaliças.', 'A horta que você montou e cuidou no mundo real.', '🥬', 'garden', '10000000-0000-4000-8000-000000000001', 'plant', 'rare',
   true, 'challenge', 'crie-uma-pequena-horta', null, 15, '{"slot":{"x":48,"y":88}}'::jsonb, 'Sua horta nasceu!', 'Seu mundo agora tem uma horta cultivada por você.', true),
  ('70000000-0000-4000-8000-000000000017', 'carrot', 'carrot', 'Cenoura', 'Cenouras crescendo no canteiro.', 'O alimento que nasce do cuidado com a terra.', '🥕', 'garden', '10000000-0000-4000-8000-000000000001', 'plant', 'common',
   false, 'challenge', 'crie-uma-pequena-horta', null, 16, '{"slot":{"x":66,"y":64}}'::jsonb, null, null, true),
  ('70000000-0000-4000-8000-000000000018', 'tomato', 'tomato', 'Tomate', 'Tomates maduros.', 'Sua evolução: o nível 4 trouxe a primeira colheita.', '🍅', 'garden', '10000000-0000-4000-8000-000000000001', 'plant', 'common',
   false, 'level', '4', null, 17, '{"slot":{"x":84,"y":88}}'::jsonb, null, null, true),
  ('70000000-0000-4000-8000-000000000019', 'compost', 'compost', 'Composteira', 'Restos orgânicos virando adubo.', 'A semana em que você separou os seus resíduos.', '♻️', 'garden', '10000000-0000-4000-8000-000000000003', 'decoration', 'common',
   false, 'challenge', 'separe-seus-residuos-por-7-dias', null, 18, '{"slot":{"x":88,"y":52}}'::jsonb, 'Nada se perde!', 'Seus resíduos separados viraram uma composteira no seu mundo.', true),
  ('70000000-0000-4000-8000-000000000004', 'flower_pollinator', 'flower_pollinator', 'Flores para polinizadores', 'Flores que atraem abelhas e borboletas.', 'O espaço para polinizadores que você criou no mundo real.', '🌺', 'pollinators', '10000000-0000-4000-8000-000000000005', 'flower', 'common',
   false, 'challenge', 'crie-um-espaco-para-polinizadores', null, 19, '{"slot":{"x":14,"y":88}}'::jsonb, 'A vida está chegando!', 'Seu mundo agora possui um espaço para polinizadores.', true),
  ('70000000-0000-4000-8000-000000000020', 'bee', 'bee', 'Abelha', 'Uma abelha visitando as flores.', 'As flores que você plantou atraíram polinizadores.', '🐝', 'pollinators', '10000000-0000-4000-8000-000000000005', 'animal', 'common',
   false, 'challenge', 'crie-um-espaco-para-polinizadores', null, 20, '{"slot":{"x":28,"y":50}}'::jsonb, null, null, true),
  ('70000000-0000-4000-8000-000000000021', 'butterfly', 'butterfly', 'Borboleta', 'Uma borboleta de passagem.', 'Um ambiente acolhedor para a vida.', '🦋', 'pollinators', '10000000-0000-4000-8000-000000000005', 'animal', 'common',
   false, 'challenge', 'crie-um-espaco-para-polinizadores', null, 21, '{"slot":{"x":58,"y":44}}'::jsonb, null, null, true),
  ('70000000-0000-4000-8000-000000000022', 'pollinator_garden', 'pollinator_garden', 'Jardim da Vida', 'Jardim especial dos polinizadores.', 'Seu primeiro desafio de biodiversidade concluído.', '🌻', 'pollinators', '10000000-0000-4000-8000-000000000005', 'flower', 'epic',
   true, 'achievement', 'amigo-dos-polinizadores', null, 22, '{"slot":{"x":40,"y":86}}'::jsonb, null, null, true),
  ('70000000-0000-4000-8000-000000000023', 'ladybug', 'ladybug', 'Joaninha', 'Uma joaninha nas folhas.', 'O que você aprendeu sobre biodiversidade.', '🐞', 'pollinators', '10000000-0000-4000-8000-000000000005', 'animal', 'common',
   false, 'lesson', 'o-que-e-biodiversidade', null, 23, '{"slot":{"x":64,"y":88}}'::jsonb, null, null, true),
  ('70000000-0000-4000-8000-000000000024', 'insect', 'insect', 'Pequeno inseto', 'Pequenos seres que movem o ecossistema.', 'O que você aprendeu sobre a importância dos polinizadores.', '🐛', 'pollinators', '10000000-0000-4000-8000-000000000005', 'animal', 'common',
   false, 'lesson', 'por-que-os-polinizadores-sao-importantes', null, 24, '{"slot":{"x":86,"y":88}}'::jsonb, null, null, true),
  ('70000000-0000-4000-8000-000000000025', 'bird', 'bird', 'Pássaro', 'Um pássaro que encontrou abrigo.', 'Você explorou quatro temas ambientais e o seu mundo ficou mais diverso.', '🐦', 'pollinators', '10000000-0000-4000-8000-000000000005', 'animal', 'uncommon',
   false, 'achievement', 'explorador-eco', null, 25, '{"slot":{"x":84,"y":36}}'::jsonb, null, null, true),
  ('70000000-0000-4000-8000-000000000026', 'community_tree', 'community_tree', 'Árvore comunitária', 'Uma árvore cuidada por todos.', 'A ação ambiental coletiva de que você participou.', '🌳', 'community', '10000000-0000-4000-8000-000000000006', 'tree', 'common',
   false, 'challenge', 'participe-de-uma-acao-ambiental', null, 26, '{"slot":{"x":14,"y":76}}'::jsonb, 'Juntos fazemos mais!', 'Sua participação numa ação coletiva trouxe uma árvore comunitária para o seu mundo.', true),
  ('70000000-0000-4000-8000-000000000027', 'green_square', 'green_square', 'Praça Verde', 'Praça especial da comunidade.', 'Sua primeira ação comunitária.', '🏞️', 'community', '10000000-0000-4000-8000-000000000006', 'building', 'epic',
   true, 'achievement', 'acao-em-comunidade', null, 27, '{"slot":{"x":38,"y":88}}'::jsonb, null, null, true),
  ('70000000-0000-4000-8000-000000000028', 'community_garden', 'community_garden', 'Jardim', 'Um jardim aberto a todos.', 'Sua evolução: o nível 3 trouxe um jardim para a comunidade.', '🌷', 'community', '10000000-0000-4000-8000-000000000006', 'flower', 'common',
   false, 'level', '3', null, 28, '{"slot":{"x":62,"y":88}}'::jsonb, null, null, true),
  ('70000000-0000-4000-8000-000000000029', 'green_area', 'green_area', 'Área verde reaproveitada', 'Vasos feitos com materiais reutilizados.', 'O que você aprendeu sobre reutilizar.', '🪴', 'community', '10000000-0000-4000-8000-000000000003', 'decoration', 'common',
   false, 'lesson', 'o-que-significa-reutilizar', null, 29, '{"slot":{"x":86,"y":88}}'::jsonb, null, null, true),
  ('70000000-0000-4000-8000-000000000030', 'solar_panel', 'solar_panel', 'Painel solar', 'Energia limpa para a comunidade.', 'A semana de consumo consciente que você completou.', '☀️', 'community', '10000000-0000-4000-8000-000000000004', 'building', 'common',
   false, 'challenge', 'semana-do-consumo-consciente', null, 30, '{"slot":{"x":34,"y":52}}'::jsonb, 'Energia limpa!', 'Seu consumo consciente trouxe um painel solar para o seu mundo.', true),
  ('70000000-0000-4000-8000-000000000031', 'sustainable_light', 'sustainable_light', 'Iluminação sustentável', 'Luz que economiza energia.', 'O que você aprendeu sobre fontes renováveis.', '💡', 'community', '10000000-0000-4000-8000-000000000004', 'building', 'common',
   false, 'lesson', 'o-que-sao-fontes-renovaveis', null, 31, '{"slot":{"x":58,"y":56}}'::jsonb, null, null, true),
  ('70000000-0000-4000-8000-000000000032', 'community_space', 'community_space', 'Centro ecológico', 'Um espaço para aprender e agir juntos.', 'Nível 10: uma referência em cuidar do planeta.', '🏡', 'community', '10000000-0000-4000-8000-000000000006', 'building', 'legendary',
   false, 'level', '10', null, 32, '{"slot":{"x":82,"y":54}}'::jsonb, null, null, true),
  ('70000000-0000-0000-0000-000000000033', 'cow_pasture', 'cow_pasture', 'Vaca no pasto', 'Uma vaca em um espaço verde e seguro.', 'Você aprendeu sobre os animais e a origem dos derivados do leite.', '🐄', 'natural', '10000000-0000-4000-8000-000000000001', 'animal', 'common',
   false, 'challenge', 'conheca-a-vaca-e-os-derivados-do-leite', null, 33, '{"slot":{"x":74,"y":82}}'::jsonb, null, null, true)
on conflict (id) do update set
  code = excluded.code, slug = excluded.slug, name = excluded.name, description = excluded.description,
  meaning = excluded.meaning, icon = excluded.icon, area = excluded.area, category_id = excluded.category_id,
  item_type = excluded.item_type, rarity = excluded.rarity, milestone = excluded.milestone,
  unlock_type = excluded.unlock_type, unlock_reference = excluded.unlock_reference, min_level = excluded.min_level,
  sort_order = excluded.sort_order, metadata = excluded.metadata, unlock_title = excluded.unlock_title,
  unlock_message = excluded.unlock_message, active = true;
update public.world_items set active = false where id not in ('70000000-0000-4000-8000-000000000005', '70000000-0000-4000-8000-000000000006', '70000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000007', '70000000-0000-4000-8000-000000000008', '70000000-0000-4000-8000-000000000009', '70000000-0000-4000-8000-000000000002', '70000000-0000-4000-8000-000000000010', '70000000-0000-4000-8000-000000000011', '70000000-0000-4000-8000-000000000012', '70000000-0000-4000-8000-000000000013', '70000000-0000-4000-8000-000000000014', '70000000-0000-4000-8000-000000000015', '70000000-0000-4000-8000-000000000016', '70000000-0000-4000-8000-000000000003', '70000000-0000-4000-8000-000000000017', '70000000-0000-4000-8000-000000000018', '70000000-0000-4000-8000-000000000019', '70000000-0000-4000-8000-000000000004', '70000000-0000-4000-8000-000000000020', '70000000-0000-4000-8000-000000000021', '70000000-0000-4000-8000-000000000022', '70000000-0000-4000-8000-000000000023', '70000000-0000-4000-8000-000000000024', '70000000-0000-4000-8000-000000000025', '70000000-0000-4000-8000-000000000026', '70000000-0000-4000-8000-000000000027', '70000000-0000-4000-8000-000000000028', '70000000-0000-4000-8000-000000000029', '70000000-0000-4000-8000-000000000030', '70000000-0000-4000-8000-000000000031', '70000000-0000-4000-8000-000000000032', '70000000-0000-0000-0000-000000000033');

-- Mundo inicial
update public.worlds
set name = 'Meu Primeiro Ecossistema', description = 'Este mundo cresce conforme você aprende e transforma suas ações em atitudes reais.'
where name = 'Meu Mundo' or description is null;

-- Posições padrão dos itens já conquistados seguem o novo layout (em %).
update public.user_world_items uwi
set position_x = (wi.metadata -> 'slot' ->> 'x')::numeric,
    position_y = (wi.metadata -> 'slot' ->> 'y')::numeric
from public.world_items wi
where wi.id = uwi.world_item_id and (uwi.position_x is null or uwi.position_x > 100 or uwi.position_y > 100);

-- Aplica as regras a todos os jogadores (itens iniciais, desbloqueios já merecidos, estágio).
select public.sync_world(user_id) from public.profiles;
