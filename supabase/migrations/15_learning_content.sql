-- =====================================================================
-- 15 · Conteúdos educativos (Etapa 3)
-- =====================================================================
-- ARQUIVO GERADO por "npm run content:sql" a partir de content/lessons.json.
-- Não edite à mão: edite o JSON e gere novamente.

-- Aulas (upsert)
insert into public.lessons (id, category_id, topic, title, slug, description, difficulty, estimated_minutes, xp_reward, order_index, summary_points, active)
values ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Árvores', 'Por que as árvores são importantes?', 'por-que-as-arvores-sao-importantes', 'Descubra o papel das árvores nos ecossistemas, na vida dos animais, na água e no solo — e o que pensar antes de plantar.', 'beginner', 5, 20, 1, '[{"icon":"🌳","text":"Árvores fazem parte de ecossistemas."},{"icon":"💧","text":"Vegetação está relacionada ao solo e à água."},{"icon":"🐦","text":"Árvores podem fornecer recursos para diferentes espécies."},{"icon":"🌱","text":"A escolha do local e da espécie é importante no plantio."}]'::jsonb, true)
on conflict (id) do update set
  category_id = excluded.category_id, topic = excluded.topic, title = excluded.title, slug = excluded.slug,
  description = excluded.description, difficulty = excluded.difficulty, estimated_minutes = excluded.estimated_minutes,
  xp_reward = excluded.xp_reward, order_index = excluded.order_index, summary_points = excluded.summary_points,
  active = excluded.active;
insert into public.lessons (id, category_id, topic, title, slug, description, difficulty, estimated_minutes, xp_reward, order_index, summary_points, active)
values ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'Plantas', 'Como uma planta cresce?', 'como-uma-planta-cresce', 'Da semente à planta: o que ela precisa para germinar e crescer.', 'beginner', 3, 20, 2, '[{"icon":"🌰","text":"A semente guarda uma planta em miniatura e reservas de alimento."},{"icon":"☀️","text":"Com luz, água e ar, a planta produz o próprio alimento pela fotossíntese."},{"icon":"🌿","text":"Solo, espaço e rega na medida certa ajudam no crescimento."}]'::jsonb, true)
on conflict (id) do update set
  category_id = excluded.category_id, topic = excluded.topic, title = excluded.title, slug = excluded.slug,
  description = excluded.description, difficulty = excluded.difficulty, estimated_minutes = excluded.estimated_minutes,
  xp_reward = excluded.xp_reward, order_index = excluded.order_index, summary_points = excluded.summary_points,
  active = excluded.active;
insert into public.lessons (id, category_id, topic, title, slug, description, difficulty, estimated_minutes, xp_reward, order_index, summary_points, active)
values ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'Hortas', 'O que é uma horta?', 'o-que-e-uma-horta', 'Onde começar, o que plantar e como manter uma horta cheia de vida.', 'beginner', 3, 20, 3, '[{"icon":"🥬","text":"Uma horta pode existir em quintais, escolas, vasos ou espaços comunitários."},{"icon":"☀️","text":"Sol, água por perto e solo com matéria orgânica são o ponto de partida."},{"icon":"🐞","text":"Uma horta saudável convive com insetos que ajudam as plantas."}]'::jsonb, true)
on conflict (id) do update set
  category_id = excluded.category_id, topic = excluded.topic, title = excluded.title, slug = excluded.slug,
  description = excluded.description, difficulty = excluded.difficulty, estimated_minutes = excluded.estimated_minutes,
  xp_reward = excluded.xp_reward, order_index = excluded.order_index, summary_points = excluded.summary_points,
  active = excluded.active;
insert into public.lessons (id, category_id, topic, title, slug, description, difficulty, estimated_minutes, xp_reward, order_index, summary_points, active)
values ('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000002', 'Economia de água', 'Por que precisamos economizar água?', 'por-que-precisamos-economizar-agua', 'Água doce é pouca, dá trabalho para chegar até a torneira — e pequenas atitudes fazem diferença.', 'beginner', 3, 20, 1, '[{"icon":"🌍","text":"A maior parte da água do planeta é salgada; a água doce é uma pequena parte."},{"icon":"🚰","text":"Tratar e distribuir água usa energia e recursos."},{"icon":"💧","text":"Pequenas atitudes do dia a dia evitam desperdício."}]'::jsonb, true)
on conflict (id) do update set
  category_id = excluded.category_id, topic = excluded.topic, title = excluded.title, slug = excluded.slug,
  description = excluded.description, difficulty = excluded.difficulty, estimated_minutes = excluded.estimated_minutes,
  xp_reward = excluded.xp_reward, order_index = excluded.order_index, summary_points = excluded.summary_points,
  active = excluded.active;
insert into public.lessons (id, category_id, topic, title, slug, description, difficulty, estimated_minutes, xp_reward, order_index, summary_points, active)
values ('20000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000002', 'Chuva', 'O que acontece com a água da chuva?', 'o-que-acontece-com-a-agua-da-chuva', 'O caminho da chuva no campo e na cidade, e como aproveitá-la com segurança.', 'beginner', 3, 20, 2, '[{"icon":"🌧️","text":"A chuva pode infiltrar no solo, escorrer para os rios ou evaporar."},{"icon":"🏙️","text":"Superfícies impermeáveis aumentam o escoamento e o risco de alagamentos."},{"icon":"🪣","text":"Água da chuva pode ser reaproveitada, sempre em recipientes tampados."}]'::jsonb, true)
on conflict (id) do update set
  category_id = excluded.category_id, topic = excluded.topic, title = excluded.title, slug = excluded.slug,
  description = excluded.description, difficulty = excluded.difficulty, estimated_minutes = excluded.estimated_minutes,
  xp_reward = excluded.xp_reward, order_index = excluded.order_index, summary_points = excluded.summary_points,
  active = excluded.active;
insert into public.lessons (id, category_id, topic, title, slug, description, difficulty, estimated_minutes, xp_reward, order_index, summary_points, active)
values ('20000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000003', 'Reciclagem', 'O que é reciclagem?', 'o-que-e-reciclagem', 'Como materiais usados viram matéria-prima para novos produtos — e por que separar certo faz diferença.', 'beginner', 3, 20, 1, '[{"icon":"♻️","text":"Reciclar é transformar materiais usados em matéria-prima para novos produtos."},{"icon":"🗑️","text":"Separar recicláveis limpos e secos facilita a coleta seletiva."},{"icon":"🔁","text":"Antes de reciclar, vale reduzir e reutilizar."}]'::jsonb, true)
on conflict (id) do update set
  category_id = excluded.category_id, topic = excluded.topic, title = excluded.title, slug = excluded.slug,
  description = excluded.description, difficulty = excluded.difficulty, estimated_minutes = excluded.estimated_minutes,
  xp_reward = excluded.xp_reward, order_index = excluded.order_index, summary_points = excluded.summary_points,
  active = excluded.active;
insert into public.lessons (id, category_id, topic, title, slug, description, difficulty, estimated_minutes, xp_reward, order_index, summary_points, active)
values ('20000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000003', 'Reutilização', 'O que significa reutilizar?', 'o-que-significa-reutilizar', 'Dar uma nova vida aos objetos antes de pensar em descartá-los.', 'beginner', 3, 20, 2, '[{"icon":"🔄","text":"Reutilizar é usar de novo um objeto, sem transformá-lo industrialmente."},{"icon":"💡","text":"Consertar, doar e dar nova função são formas de reutilizar."},{"icon":"🌎","text":"Reutilizar economiza recursos e reduz o lixo."}]'::jsonb, true)
on conflict (id) do update set
  category_id = excluded.category_id, topic = excluded.topic, title = excluded.title, slug = excluded.slug,
  description = excluded.description, difficulty = excluded.difficulty, estimated_minutes = excluded.estimated_minutes,
  xp_reward = excluded.xp_reward, order_index = excluded.order_index, summary_points = excluded.summary_points,
  active = excluded.active;
insert into public.lessons (id, category_id, topic, title, slug, description, difficulty, estimated_minutes, xp_reward, order_index, summary_points, active)
values ('20000000-0000-4000-8000-000000000008', '10000000-0000-4000-8000-000000000004', 'Economia de energia', 'Por que economizar energia?', 'por-que-economizar-energia', 'De onde vem a eletricidade, onde mais gastamos em casa e como economizar.', 'beginner', 3, 20, 1, '[{"icon":"⚡","text":"Toda forma de gerar eletricidade causa algum impacto ambiental."},{"icon":"🏠","text":"Alguns aparelhos consomem mais energia do que outros."},{"icon":"👣","text":"Atitudes simples reduzem o consumo."}]'::jsonb, true)
on conflict (id) do update set
  category_id = excluded.category_id, topic = excluded.topic, title = excluded.title, slug = excluded.slug,
  description = excluded.description, difficulty = excluded.difficulty, estimated_minutes = excluded.estimated_minutes,
  xp_reward = excluded.xp_reward, order_index = excluded.order_index, summary_points = excluded.summary_points,
  active = excluded.active;
insert into public.lessons (id, category_id, topic, title, slug, description, difficulty, estimated_minutes, xp_reward, order_index, summary_points, active)
values ('20000000-0000-4000-8000-000000000009', '10000000-0000-4000-8000-000000000004', 'Fontes renováveis', 'O que são fontes renováveis?', 'o-que-sao-fontes-renovaveis', 'Sol, vento, água e biomassa: fontes que se renovam na natureza — e seus limites.', 'intermediate', 4, 20, 2, '[{"icon":"🔋","text":"Fontes renováveis se renovam na natureza; as não renováveis podem se esgotar."},{"icon":"☀️","text":"Solar, eólica, hidrelétrica e biomassa são exemplos de fontes renováveis."},{"icon":"⚖️","text":"Nenhuma fonte é livre de impactos — a energia mais limpa é a que não é desperdiçada."}]'::jsonb, true)
on conflict (id) do update set
  category_id = excluded.category_id, topic = excluded.topic, title = excluded.title, slug = excluded.slug,
  description = excluded.description, difficulty = excluded.difficulty, estimated_minutes = excluded.estimated_minutes,
  xp_reward = excluded.xp_reward, order_index = excluded.order_index, summary_points = excluded.summary_points,
  active = excluded.active;
insert into public.lessons (id, category_id, topic, title, slug, description, difficulty, estimated_minutes, xp_reward, order_index, summary_points, active)
values ('20000000-0000-4000-8000-000000000010', '10000000-0000-4000-8000-000000000005', 'Ecossistemas', 'O que é biodiversidade?', 'o-que-e-biodiversidade', 'A variedade de vida no planeta, como tudo está conectado e o que ameaça essa riqueza.', 'beginner', 3, 20, 1, '[{"icon":"🦋","text":"Biodiversidade é a variedade de vida: espécies, genes e ecossistemas."},{"icon":"🕸️","text":"Os seres vivos dependem uns dos outros."},{"icon":"🛡️","text":"Proteger a vegetação nativa ajuda a conservar a biodiversidade."}]'::jsonb, true)
on conflict (id) do update set
  category_id = excluded.category_id, topic = excluded.topic, title = excluded.title, slug = excluded.slug,
  description = excluded.description, difficulty = excluded.difficulty, estimated_minutes = excluded.estimated_minutes,
  xp_reward = excluded.xp_reward, order_index = excluded.order_index, summary_points = excluded.summary_points,
  active = excluded.active;
insert into public.lessons (id, category_id, topic, title, slug, description, difficulty, estimated_minutes, xp_reward, order_index, summary_points, active)
values ('20000000-0000-4000-8000-000000000011', '10000000-0000-4000-8000-000000000005', 'Abelhas', 'Por que os polinizadores são importantes?', 'por-que-os-polinizadores-sao-importantes', 'Abelhas, borboletas, aves e morcegos: quem são os polinizadores e por que dependemos deles.', 'intermediate', 4, 20, 2, '[{"icon":"🌸","text":"Polinização é o transporte de pólen que permite a formação de frutos e sementes."},{"icon":"🐝","text":"Abelhas, borboletas, aves e morcegos estão entre os polinizadores."},{"icon":"🍎","text":"Muitos alimentos dependem, em algum grau, dos polinizadores."}]'::jsonb, true)
on conflict (id) do update set
  category_id = excluded.category_id, topic = excluded.topic, title = excluded.title, slug = excluded.slug,
  description = excluded.description, difficulty = excluded.difficulty, estimated_minutes = excluded.estimated_minutes,
  xp_reward = excluded.xp_reward, order_index = excluded.order_index, summary_points = excluded.summary_points,
  active = excluded.active;
insert into public.lessons (id, category_id, topic, title, slug, description, difficulty, estimated_minutes, xp_reward, order_index, summary_points, active)
values ('20000000-0000-4000-8000-000000000012', '10000000-0000-4000-8000-000000000006', 'Ações coletivas', 'O que é uma ação ambiental comunitária?', 'o-que-e-uma-acao-ambiental-comunitaria', 'Como pessoas se organizam para cuidar juntas do lugar onde vivem.', 'beginner', 3, 20, 1, '[{"icon":"🤝","text":"Ações comunitárias reúnem pessoas em torno de um objetivo ambiental comum."},{"icon":"🗺️","text":"Tudo começa identificando um problema e conversando com as pessoas."},{"icon":"🎉","text":"Cuidar do resultado e celebrar mantém a comunidade engajada."}]'::jsonb, true)
on conflict (id) do update set
  category_id = excluded.category_id, topic = excluded.topic, title = excluded.title, slug = excluded.slug,
  description = excluded.description, difficulty = excluded.difficulty, estimated_minutes = excluded.estimated_minutes,
  xp_reward = excluded.xp_reward, order_index = excluded.order_index, summary_points = excluded.summary_points,
  active = excluded.active;
insert into public.lessons (id, category_id, topic, title, slug, description, difficulty, estimated_minutes, xp_reward, order_index, summary_points, active)
values ('20000000-0000-4000-8000-000000000013', '10000000-0000-4000-8000-000000000001', 'Alimentação e animais', 'A vaca e os derivados do leite', 'a-vaca-e-os-derivados-do-leite', 'Descubra de onde vem o leite, quais alimentos podem ser feitos com ele e como respeitar os animais.', 'beginner', 5, 20, 13, '[{"icon":"🐄","text":"Vacas são animais que precisam de cuidado, espaço, água e alimento."},{"icon":"🥛","text":"O leite pode ser transformado em diferentes alimentos."},{"icon":"🧀","text":"Queijo, iogurte e manteiga são exemplos de derivados do leite."},{"icon":"🌱","text":"Escolhas conscientes valorizam o bem-estar animal e evitam desperdício."}]'::jsonb, true)
on conflict (id) do update set
  category_id = excluded.category_id, topic = excluded.topic, title = excluded.title, slug = excluded.slug,
  description = excluded.description, difficulty = excluded.difficulty, estimated_minutes = excluded.estimated_minutes,
  xp_reward = excluded.xp_reward, order_index = excluded.order_index, summary_points = excluded.summary_points,
  active = excluded.active;
insert into public.lessons (id, category_id, topic, title, slug, description, difficulty, estimated_minutes, xp_reward, order_index, summary_points, active)
values ('20000000-0000-4000-8000-000000000014', '10000000-0000-4000-8000-000000000006', 'Móveis da casa', 'Os móveis da nossa casa', 'os-moveis-da-nossa-casa', 'Descubra para que servem os móveis, do que eles são feitos e como cuidar deles para durarem muito tempo.', 'beginner', 4, 20, 2, '[{"icon":"🛋️","text":"Cada móvel tem uma função: sentar, dormir, guardar ou apoiar."},{"icon":"🌳","text":"Muitos móveis são feitos de madeira, que vem das árvores."},{"icon":"🧽","text":"Cuidar dos móveis faz com que eles durem mais e evita desperdício."},{"icon":"♻️","text":"Um móvel velho pode ser consertado, reaproveitado ou doado."}]'::jsonb, true)
on conflict (id) do update set
  category_id = excluded.category_id, topic = excluded.topic, title = excluded.title, slug = excluded.slug,
  description = excluded.description, difficulty = excluded.difficulty, estimated_minutes = excluded.estimated_minutes,
  xp_reward = excluded.xp_reward, order_index = excluded.order_index, summary_points = excluded.summary_points,
  active = excluded.active;

-- Pré-requisitos (depois que todas as aulas existem)
update public.lessons set prerequisite_lesson_id = null where id = '20000000-0000-4000-8000-000000000001';
update public.lessons set prerequisite_lesson_id = null where id = '20000000-0000-4000-8000-000000000002';
update public.lessons set prerequisite_lesson_id = null where id = '20000000-0000-4000-8000-000000000003';
update public.lessons set prerequisite_lesson_id = null where id = '20000000-0000-4000-8000-000000000004';
update public.lessons set prerequisite_lesson_id = null where id = '20000000-0000-4000-8000-000000000005';
update public.lessons set prerequisite_lesson_id = null where id = '20000000-0000-4000-8000-000000000006';
update public.lessons set prerequisite_lesson_id = null where id = '20000000-0000-4000-8000-000000000007';
update public.lessons set prerequisite_lesson_id = null where id = '20000000-0000-4000-8000-000000000008';
update public.lessons set prerequisite_lesson_id = null where id = '20000000-0000-4000-8000-000000000009';
update public.lessons set prerequisite_lesson_id = null where id = '20000000-0000-4000-8000-000000000010';
update public.lessons set prerequisite_lesson_id = null where id = '20000000-0000-4000-8000-000000000011';
update public.lessons set prerequisite_lesson_id = null where id = '20000000-0000-4000-8000-000000000012';
update public.lessons set prerequisite_lesson_id = null where id = '20000000-0000-4000-8000-000000000013';
update public.lessons set prerequisite_lesson_id = null where id = '20000000-0000-4000-8000-000000000014';

-- Seções (recriadas)
delete from public.lesson_sections where lesson_id in ('20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000007', '20000000-0000-4000-8000-000000000008', '20000000-0000-4000-8000-000000000009', '20000000-0000-4000-8000-000000000010', '20000000-0000-4000-8000-000000000011', '20000000-0000-4000-8000-000000000012', '20000000-0000-4000-8000-000000000013', '20000000-0000-4000-8000-000000000014');
insert into public.lesson_sections (id, lesson_id, section_type, icon, title, content, image_url, image_alt, blocks, order_index) values
  ('21000000-0000-4000-8000-000000001001', '20000000-0000-4000-8000-000000000001', 'content', '🌳', 'Muito mais do que paisagem', 'Uma árvore é muito mais do que um elemento da paisagem.
Árvores são plantas com tronco lenhoso que podem viver por muitos anos. Pela fotossíntese, elas usam a luz do sol para absorver gás carbônico (CO₂) do ar e liberar oxigênio.
Também fazem sombra e deixam o ambiente ao redor mais fresco.
- Absorvem CO₂ e liberam oxigênio
- Fazem sombra e refrescam o ambiente
- Podem viver por muitos anos', '/lessons/arvores-1.svg', 'Ilustração de uma árvore grande ao lado de uma casa, com o sol ao fundo e sombra sobre o gramado.', '[{"type":"think","prompt":"Quantas árvores você consegue encontrar no caminho até sua casa?"}]'::jsonb, 1),
  ('21000000-0000-4000-8000-000000001002', '20000000-0000-4000-8000-000000000001', 'content', '🌎', 'Ecossistemas', 'Um ecossistema é o conjunto de seres vivos de um lugar e das relações entre eles e o ambiente: luz, água, ar e solo.
A árvore participa dessas relações o tempo todo. Ela retira água e nutrientes do solo, recebe luz do sol e devolve folhas, galhos e frutos que caem no chão.
Fungos, bactérias e pequenos animais decompõem esse material, que volta a nutrir o solo.
- A árvore recebe luz, água e nutrientes
- Folhas caídas são decompostas
- Os nutrientes voltam para o solo', '/lessons/arvores-2.svg', 'Ciclo com setas: o sol ilumina a árvore, folhas caem no solo, são decompostas e os nutrientes voltam às raízes.', '[{"type":"fun_fact","title":"Você sabia?","text":"Nas cidades, ruas arborizadas costumam ser mais frescas do que ruas sem árvores. Por isso as árvores são aliadas contra as chamadas “ilhas de calor”."}]'::jsonb, 2),
  ('21000000-0000-4000-8000-000000001003', '20000000-0000-4000-8000-000000000001', 'content', '🐦', 'Vida', 'Uma única árvore pode ser casa e alimento para muitos seres vivos.
Suas flores oferecem néctar e pólen para abelhas e borboletas. Os frutos alimentam aves e outros animais — que depois espalham as sementes. Galhos e ocos do tronco viram abrigo e lugar de ninho.
- Flores: néctar e pólen
- Frutos: alimento e dispersão de sementes
- Galhos e troncos: abrigo e ninhos', null, null, '[{"type":"observe","prompt":"Observe a ilustração. Quantos seres vivos estão usando esta árvore?","image_url":"/lessons/arvores-3.svg","image_alt":"Árvore com um ninho de pássaro em um galho, uma abelha visitando uma flor e uma lagarta comendo uma folha.","answer":"Três: um pássaro no ninho, uma abelha na flor e uma lagarta na folha. A mesma árvore oferece abrigo, néctar e alimento."}]'::jsonb, 3),
  ('21000000-0000-4000-8000-000000001004', '20000000-0000-4000-8000-000000000001', 'content', '💧', 'Água e solo', 'As raízes seguram a terra e ajudam a diminuir a erosão, que acontece quando a chuva e o vento levam o solo embora.
A copa amortece a força das gotas de chuva, e as folhas caídas cobrem o chão. Assim, mais água consegue penetrar no solo em vez de escorrer pela superfície.
- Raízes seguram o solo
- A copa amortece a chuva
- Mais água infiltra no solo', '/lessons/arvores-4.svg', 'Corte do solo mostrando raízes de uma árvore e gotas de chuva infiltrando na terra.', '[{"type":"fun_fact","title":"Você sabia?","text":"Pelas folhas, as plantas liberam vapor d’água para o ar. Esse processo se chama transpiração e faz parte do ciclo da água."}]'::jsonb, 4),
  ('21000000-0000-4000-8000-000000001005', '20000000-0000-4000-8000-000000000001', 'content', '🌱', 'Antes de plantar', 'Não basta colocar uma árvore em qualquer lugar. Antes de plantar, vale pensar em alguns pontos:
- Espécie: prefira espécies nativas da sua região
- Espaço: imagine o tamanho da árvore adulta
- Solo: a terra precisa receber as raízes
- Água: a muda precisa de rega nos primeiros meses
- Clima: a espécie deve combinar com o clima local
- Futuro: raízes e copa não podem atrapalhar fios, canos e muros', null, null, '[{"type":"choice","prompt":"🌳 Escolha o local: onde você plantaria uma árvore que vai ficar grande?","options":[{"id":"fiacao","icon":"⚡","label":"Embaixo da fiação elétrica da rua","is_best":false,"feedback":"Quando crescer, a copa vai alcançar os fios e precisará de podas frequentes. Para árvores grandes, procure um lugar sem fiação."},{"id":"quintal","icon":"☀️","label":"Em um espaço aberto e ensolarado, longe de muros e canos","is_best":true,"feedback":"Boa escolha! Com espaço para a copa e as raízes, a árvore cresce saudável sem causar problemas."},{"id":"muro","icon":"🧱","label":"Colada ao muro da casa","is_best":false,"feedback":"Sem espaço, as raízes podem danificar o muro e a copa cresce torta. Deixe uma boa distância de construções."}]},{"type":"tip","text":"Antes de plantar, pergunte em um viveiro ou na secretaria de meio ambiente da sua cidade quais espécies nativas combinam com a sua região."}]'::jsonb, 5);
insert into public.lesson_sections (id, lesson_id, section_type, icon, title, content, image_url, image_alt, blocks, order_index) values
  ('21000000-0000-4000-8000-000000002001', '20000000-0000-4000-8000-000000000002', 'content', '🌰', 'Tudo começa na semente', 'Dentro da semente existe um embrião — uma plantinha em miniatura — e uma reserva de alimento.
Quando encontra água e temperatura adequada, a semente germina: primeiro surge a raiz, depois o caule e as primeiras folhas.
- A raiz aparece primeiro
- Depois surgem caule e folhas', null, null, '[]'::jsonb, 1),
  ('21000000-0000-4000-8000-000000002002', '20000000-0000-4000-8000-000000000002', 'content', '☀️', 'Luz, água e ar', 'As folhas usam a luz do sol, a água que vem das raízes e o gás carbônico do ar para produzir açúcares. Isso é a fotossíntese.
Esses açúcares são o alimento que faz a planta crescer. Nesse processo, a planta libera oxigênio.', null, null, '[{"type":"fun_fact","title":"Você sabia?","text":"Muitas plantas crescem em direção à luz. Esse movimento se chama fototropismo — repare nas plantas perto de janelas."}]'::jsonb, 2),
  ('21000000-0000-4000-8000-000000002003', '20000000-0000-4000-8000-000000000002', 'content', '🌿', 'Cuidando do crescimento', 'Além de luz, a planta precisa de solo com nutrientes e espaço para as raízes.
A água deve vir na medida certa: terra encharcada o tempo todo também faz mal, porque as raízes precisam de ar.', null, null, '[{"type":"think","prompt":"Que plantas você vê crescendo perto de você? De onde elas recebem luz?"},{"type":"tip","text":"Quer ver a germinação de perto? Coloque um grão de feijão em algodão úmido e observe por alguns dias."}]'::jsonb, 3);
insert into public.lesson_sections (id, lesson_id, section_type, icon, title, content, image_url, image_alt, blocks, order_index) values
  ('21000000-0000-4000-8000-000000003001', '20000000-0000-4000-8000-000000000003', 'content', '🥬', 'Um pedaço de terra que alimenta', 'Horta é um espaço para cultivar hortaliças, temperos e ervas.
Ela pode estar no quintal, na escola, em vasos na varanda ou em um terreno da comunidade.
- Quintais e varandas
- Escolas
- Hortas comunitárias', null, null, '[]'::jsonb, 1),
  ('21000000-0000-4000-8000-000000003002', '20000000-0000-4000-8000-000000000003', 'content', '📍', 'Onde e como começar', 'A maioria das hortaliças precisa de algumas horas de sol direto por dia.
Ter água por perto facilita a rega, e um solo fofo com matéria orgânica ajuda as raízes.
Para começar, escolha plantas fáceis, como cebolinha, alface e manjericão.', null, null, '[{"type":"choice","prompt":"Onde você começaria uma horta?","options":[{"id":"sombra","icon":"🌑","label":"Em um canto que fica na sombra o dia todo","is_best":false,"feedback":"Sem sol, a maioria das hortaliças cresce fraca. Procure um lugar iluminado."},{"id":"sol","icon":"🚰","label":"Em um lugar com sol pela manhã e uma torneira perto","is_best":true,"feedback":"Ótimo! Sol e água por perto são os melhores aliados de uma horta."},{"id":"entulho","icon":"🧱","label":"Sobre terra compactada e restos de obra","is_best":false,"feedback":"Solo duro e com entulho dificulta as raízes. Seria preciso preparar a terra antes."}]}]'::jsonb, 2),
  ('21000000-0000-4000-8000-000000003003', '20000000-0000-4000-8000-000000000003', 'content', '🐞', 'Uma horta cheia de vida', 'Flores perto da horta atraem polinizadores, e alguns insetos ajudam a controlar pragas.
Restos de frutas e verduras podem virar adubo por meio da compostagem.', null, null, '[{"type":"fun_fact","title":"Você sabia?","text":"Joaninhas se alimentam de pulgões, pequenos insetos que atacam as plantas. Por isso são consideradas aliadas das hortas."},{"type":"tip","text":"Comece pequeno: um vaso de temperos já é uma horta e ensina muito sobre cuidar das plantas."}]'::jsonb, 3);
insert into public.lesson_sections (id, lesson_id, section_type, icon, title, content, image_url, image_alt, blocks, order_index) values
  ('21000000-0000-4000-8000-000000004001', '20000000-0000-4000-8000-000000000004', 'content', '🌍', 'Pouca água doce', 'Parece que água é o que não falta: ela cobre a maior parte da superfície da Terra.
Mas quase toda essa água é salgada. A água doce é uma pequena parte, e muito dela está congelada em geleiras ou escondida no subsolo.', null, null, '[{"type":"fun_fact","title":"Você sabia?","text":"Segundo o Serviço Geológico dos Estados Unidos (USGS), cerca de 97% da água da Terra é salgada."}]'::jsonb, 1),
  ('21000000-0000-4000-8000-000000004002', '20000000-0000-4000-8000-000000000004', 'content', '🚰', 'Da natureza até a torneira', 'Antes de chegar à sua casa, a água é captada de rios ou represas, tratada e bombeada por canos.
Depois de usada, vira esgoto, que também precisa de tratamento.
Todo esse caminho usa energia e recursos. Economizar água também é economizar energia.', null, null, '[]'::jsonb, 2),
  ('21000000-0000-4000-8000-000000004003', '20000000-0000-4000-8000-000000000004', 'content', '💧', 'Pequenas atitudes', '- Fechar a torneira enquanto escova os dentes
- Tomar banhos mais curtos
- Consertar vazamentos
- Usar vassoura em vez de mangueira para limpar a calçada
- Reaproveitar a água da máquina de lavar para limpar o quintal', null, null, '[{"type":"think","prompt":"Em quais momentos do seu dia você usa água? Em qual deles daria para economizar?"},{"type":"tip","text":"Uma torneira pingando o dia inteiro desperdiça muita água. Se encontrar um vazamento, avise um adulto."}]'::jsonb, 3);
insert into public.lesson_sections (id, lesson_id, section_type, icon, title, content, image_url, image_alt, blocks, order_index) values
  ('21000000-0000-4000-8000-000000005001', '20000000-0000-4000-8000-000000000005', 'content', '🌧️', 'O caminho da chuva', 'Quando a chuva cai, a água pode seguir caminhos diferentes:
- Infiltrar no solo e abastecer a água subterrânea
- Escorrer pela superfície até rios e lagos
- Evaporar e voltar para a atmosfera
Esses caminhos fazem parte do ciclo da água.', null, null, '[]'::jsonb, 1),
  ('21000000-0000-4000-8000-000000005002', '20000000-0000-4000-8000-000000000005', 'content', '🏙️', 'Chuva na cidade', 'Asfalto, concreto e telhados não deixam a água infiltrar. Por isso, nas cidades, mais água escorre pelas ruas, o que aumenta o risco de alagamentos.
Lixo jogado na rua entope bueiros e piora o problema.', null, null, '[{"type":"choice","prompt":"Em qual destes lugares a água da chuva infiltra melhor?","options":[{"id":"asfalto","icon":"🛣️","label":"Rua asfaltada","is_best":false,"feedback":"O asfalto é impermeável: a água escorre em vez de infiltrar."},{"id":"jardim","icon":"🌿","label":"Jardim com solo e plantas","is_best":true,"feedback":"Isso! Solo coberto por plantas deixa a água penetrar e ainda segura a terra."},{"id":"concreto","icon":"🏢","label":"Pátio de concreto","is_best":false,"feedback":"O concreto também impede a infiltração. Áreas verdes ajudam muito a cidade."}]}]'::jsonb, 2),
  ('21000000-0000-4000-8000-000000005003', '20000000-0000-4000-8000-000000000005', 'content', '🪣', 'Aproveitar a chuva', 'A água da chuva pode ser guardada em cisternas e usada para regar plantas e limpar áreas externas.
Ela não deve ser bebida sem tratamento adequado.', null, null, '[{"type":"tip","text":"Todo recipiente com água parada precisa ficar tampado: aberto, ele pode virar criadouro do mosquito Aedes aegypti."}]'::jsonb, 3);
insert into public.lesson_sections (id, lesson_id, section_type, icon, title, content, image_url, image_alt, blocks, order_index) values
  ('21000000-0000-4000-8000-000000006001', '20000000-0000-4000-8000-000000000006', 'content', '♻️', 'Um novo começo para os materiais', 'Reciclar é transformar materiais já usados em matéria-prima para fabricar novos produtos.
Papel, plástico, metal e vidro estão entre os materiais mais recicláveis.', null, null, '[]'::jsonb, 1),
  ('21000000-0000-4000-8000-000000006002', '20000000-0000-4000-8000-000000000006', 'content', '🗑️', 'Separar certo', 'A reciclagem começa em casa: separe os recicláveis dos restos de comida.
Na coleta seletiva, o Brasil usa um padrão de cores (Resolução CONAMA nº 275/2001):
- Azul: papel
- Vermelho: plástico
- Verde: vidro
- Amarelo: metal
- Marrom: resíduos orgânicos', null, null, '[{"type":"choice","prompt":"Em qual lixeira vai uma lata de alumínio?","options":[{"id":"azul","icon":"🔵","label":"Azul","is_best":false,"feedback":"A azul é para papel. Metais vão em outra cor."},{"id":"amarela","icon":"🟡","label":"Amarela","is_best":true,"feedback":"Isso mesmo! Amarelo é a cor dos metais, como latas de alumínio."},{"id":"verde","icon":"🟢","label":"Verde","is_best":false,"feedback":"A verde é para vidro. A lata vai na amarela."}]}]'::jsonb, 2),
  ('21000000-0000-4000-8000-000000006003', '20000000-0000-4000-8000-000000000006', 'content', '🔁', 'Reciclar é o último passo', 'Antes de reciclar, pense em reduzir o que você consome e em reutilizar o que já tem. Reciclar é importante, mas gerar menos resíduo é ainda melhor.', null, null, '[{"type":"fun_fact","title":"Você sabia?","text":"O alumínio pode ser reciclado muitas vezes sem perder suas propriedades."},{"type":"tip","text":"Lave e seque as embalagens antes de separá-las: isso facilita o trabalho das cooperativas de reciclagem."}]'::jsonb, 3);
insert into public.lesson_sections (id, lesson_id, section_type, icon, title, content, image_url, image_alt, blocks, order_index) values
  ('21000000-0000-4000-8000-000000007001', '20000000-0000-4000-8000-000000000007', 'content', '🔄', 'Usar de novo', 'Reutilizar é usar novamente um objeto, com a mesma função ou com uma nova, sem que ele precise passar por uma fábrica.
É diferente de reciclar, em que o material é transformado em matéria-prima.', null, null, '[]'::jsonb, 1),
  ('21000000-0000-4000-8000-000000007002', '20000000-0000-4000-8000-000000000007', 'content', '💡', 'Ideias para reutilizar', '- Potes de vidro para guardar alimentos
- Embalagens como vasos para mudas
- Doar roupas, livros e brinquedos
- Consertar em vez de jogar fora', null, null, '[{"type":"think","prompt":"Que objeto da sua casa poderia ganhar uma nova função?"}]'::jsonb, 2),
  ('21000000-0000-4000-8000-000000007003', '20000000-0000-4000-8000-000000000007', 'content', '🌎', 'Por que isso importa', 'Cada objeto reutilizado é um objeto novo que não precisou ser fabricado e um a menos no lixo. Isso economiza matéria-prima, água e energia.', null, null, '[{"type":"choice","prompt":"Qual destas atitudes é um exemplo de reutilizar?","options":[{"id":"descartar","icon":"🗑️","label":"Colocar o pote vazio na lixeira de recicláveis","is_best":false,"feedback":"Isso é encaminhar para a reciclagem — importante, mas não é reutilizar."},{"id":"guardar","icon":"🫙","label":"Usar o pote de vidro para guardar grãos","is_best":true,"feedback":"Exatamente! O pote ganhou uma nova função sem precisar ser fabricado de novo."},{"id":"comprar","icon":"🛒","label":"Comprar um pote novo","is_best":false,"feedback":"Comprar um novo gera mais consumo. Reutilizar é aproveitar o que já existe."}]}]'::jsonb, 3);
insert into public.lesson_sections (id, lesson_id, section_type, icon, title, content, image_url, image_alt, blocks, order_index) values
  ('21000000-0000-4000-8000-000000008001', '20000000-0000-4000-8000-000000000008', 'content', '⚡', 'De onde vem a energia', 'A eletricidade é gerada em usinas — hidrelétricas, eólicas, solares, termelétricas — e viaja por linhas de transmissão até as casas.
Toda forma de geração tem algum impacto: represas alagam áreas, termelétricas queimam combustíveis.', null, null, '[]'::jsonb, 1),
  ('21000000-0000-4000-8000-000000008002', '20000000-0000-4000-8000-000000000008', 'content', '🏠', 'Consumo em casa', 'Chuveiro elétrico, ar-condicionado e geladeira estão entre os aparelhos que mais consomem energia em uma casa.
Aparelhos em modo de espera (standby) também continuam gastando um pouco.', null, null, '[{"type":"fun_fact","title":"Você sabia?","text":"Lâmpadas de LED gastam bem menos energia do que as incandescentes para iluminar o mesmo ambiente."}]'::jsonb, 2),
  ('21000000-0000-4000-8000-000000008003', '20000000-0000-4000-8000-000000000008', 'content', '👣', 'Atitudes que fazem diferença', '- Apagar a luz ao sair do cômodo
- Tirar da tomada carregadores que não estão em uso
- Não deixar a porta da geladeira aberta
- Tomar banhos mais curtos', null, null, '[{"type":"tip","text":"Aproveite a luz do dia: abrir cortinas e janelas pode dispensar lâmpadas acesas."}]'::jsonb, 3);
insert into public.lesson_sections (id, lesson_id, section_type, icon, title, content, image_url, image_alt, blocks, order_index) values
  ('21000000-0000-4000-8000-000000009001', '20000000-0000-4000-8000-000000000009', 'content', '🔋', 'Renováveis e não renováveis', 'Fontes renováveis se renovam naturalmente: a luz do sol, o vento, o movimento da água e a biomassa (como o bagaço da cana).
Fontes não renováveis, como petróleo, carvão e gás natural, existem em quantidade limitada e liberam gases de efeito estufa quando queimadas.', null, null, '[]'::jsonb, 1),
  ('21000000-0000-4000-8000-000000009002', '20000000-0000-4000-8000-000000000009', 'content', '☀️', 'Conhecendo as fontes', '- Solar: painéis transformam a luz do sol em eletricidade
- Eólica: turbinas giram com o vento
- Hidrelétrica: a força da água dos rios move turbinas
- Biomassa: restos vegetais são usados para gerar energia', null, null, '[{"type":"fun_fact","title":"Você sabia?","text":"No Brasil, a maior parte da eletricidade vem de fontes renováveis, principalmente das usinas hidrelétricas."}]'::jsonb, 2),
  ('21000000-0000-4000-8000-000000009003', '20000000-0000-4000-8000-000000000009', 'content', '⚖️', 'Nenhuma fonte é perfeita', 'Hidrelétricas alagam grandes áreas, parques eólicos mudam a paisagem e podem afetar aves, e painéis solares precisam de materiais para serem fabricados.
Por isso, além de escolher fontes renováveis, é importante não desperdiçar energia.', null, null, '[{"type":"choice","prompt":"Qual destas fontes é renovável?","options":[{"id":"carvao","icon":"⛏️","label":"Carvão mineral","is_best":false,"feedback":"O carvão levou milhões de anos para se formar e pode se esgotar: é não renovável."},{"id":"vento","icon":"🌬️","label":"Vento","is_best":true,"feedback":"Isso! O vento se renova naturalmente e move as turbinas eólicas."},{"id":"petroleo","icon":"🛢️","label":"Petróleo","is_best":false,"feedback":"O petróleo é um combustível fóssil, portanto não renovável."}]}]'::jsonb, 3);
insert into public.lesson_sections (id, lesson_id, section_type, icon, title, content, image_url, image_alt, blocks, order_index) values
  ('21000000-0000-4000-8000-000000010001', '20000000-0000-4000-8000-000000000010', 'content', '🦋', 'A variedade da vida', 'Biodiversidade é a variedade de vida na Terra. Ela inclui:
- A diversidade de espécies
- A diversidade genética dentro de cada espécie
- A diversidade de ecossistemas, como florestas, rios e cerrados', null, null, '[]'::jsonb, 1),
  ('21000000-0000-4000-8000-000000010002', '20000000-0000-4000-8000-000000000010', 'content', '🕸️', 'Tudo conectado', 'Os seres vivos dependem uns dos outros: plantas alimentam animais, animais espalham sementes, fungos decompõem restos e devolvem nutrientes ao solo.
Quando uma espécie desaparece, outras podem ser afetadas.', null, null, '[{"type":"fun_fact","title":"Você sabia?","text":"O Brasil é considerado um dos países com maior biodiversidade do mundo, com biomas como a Amazônia, o Cerrado e a Mata Atlântica."}]'::jsonb, 2),
  ('21000000-0000-4000-8000-000000010003', '20000000-0000-4000-8000-000000000010', 'content', '🛡️', 'Ameaças e cuidados', 'A destruição de habitats, a poluição e as espécies invasoras estão entre as principais ameaças à biodiversidade.
Proteger a vegetação nativa e nunca retirar animais silvestres da natureza são formas de cuidar.', null, null, '[{"type":"think","prompt":"Quantos tipos diferentes de seres vivos você consegue ver hoje, contando plantas, insetos e aves?"}]'::jsonb, 3);
insert into public.lesson_sections (id, lesson_id, section_type, icon, title, content, image_url, image_alt, blocks, order_index) values
  ('21000000-0000-4000-8000-000000011001', '20000000-0000-4000-8000-000000000011', 'content', '🌸', 'O que é polinização', 'Para formar frutos e sementes, muitas plantas precisam que o pólen de uma flor chegue a outra.
Esse transporte se chama polinização. Às vezes é feito pelo vento, mas muitas plantas dependem de animais.', null, null, '[]'::jsonb, 1),
  ('21000000-0000-4000-8000-000000011002', '20000000-0000-4000-8000-000000000011', 'content', '🐝', 'Quem poliniza', '- Abelhas, incluindo as abelhas nativas sem ferrão
- Borboletas e mariposas
- Besouros
- Beija-flores
- Morcegos', null, null, '[{"type":"think","prompt":"Da próxima vez que vir uma flor, observe: algum animal a visita?"}]'::jsonb, 2),
  ('21000000-0000-4000-8000-000000011003', '20000000-0000-4000-8000-000000000011', 'content', '🍎', 'Alimento e natureza', 'Sem polinizadores, muitas plantas produziriam menos frutos e sementes — o que afeta tanto a natureza quanto a nossa alimentação.
O uso excessivo de agrotóxicos e a perda de áreas naturais estão entre as ameaças a esses animais.', null, null, '[{"type":"fun_fact","title":"Você sabia?","text":"Segundo a IPBES, plataforma científica internacional sobre biodiversidade, cerca de 75% dos tipos de cultivos alimentares do mundo dependem, em algum grau, da polinização por animais."},{"type":"tip","text":"Plantar flores variadas e evitar agrotóxicos no jardim ajuda os polinizadores."}]'::jsonb, 3);
insert into public.lesson_sections (id, lesson_id, section_type, icon, title, content, image_url, image_alt, blocks, order_index) values
  ('21000000-0000-4000-8000-000000012001', '20000000-0000-4000-8000-000000000012', 'content', '🤝', 'Juntos pelo lugar onde vivemos', 'Uma ação ambiental comunitária acontece quando um grupo de pessoas se organiza para cuidar do ambiente onde vive.
- Mutirões de limpeza
- Hortas comunitárias
- Plantio de árvores em praças', null, null, '[]'::jsonb, 1),
  ('21000000-0000-4000-8000-000000012002', '20000000-0000-4000-8000-000000000012', 'content', '🗺️', 'Como começar', 'Identifique um problema, converse com vizinhos, escola ou associação do bairro e planejem juntos: materiais, segurança e, quando necessário, autorização da prefeitura.', null, null, '[{"type":"choice","prompt":"Qual costuma ser o primeiro passo de uma ação comunitária?","options":[{"id":"comprar","icon":"🛒","label":"Comprar materiais","is_best":false,"feedback":"Materiais vêm depois do planejamento. Primeiro é preciso saber o que fazer e com quem."},{"id":"conversar","icon":"💬","label":"Identificar o problema e conversar com as pessoas","is_best":true,"feedback":"Isso! Uma ação comunitária nasce do diálogo sobre um problema comum."},{"id":"sozinho","icon":"🙈","label":"Fazer tudo sozinho, sem avisar ninguém","is_best":false,"feedback":"Sozinho não é comunitário, e sem combinar com as pessoas a ação pode não se manter."}]}]'::jsonb, 2),
  ('21000000-0000-4000-8000-000000012003', '20000000-0000-4000-8000-000000000012', 'content', '🎉', 'Depois da ação', 'O cuidado continua depois do mutirão: regar as mudas, manter o lugar limpo, compartilhar os resultados e celebrar juntos.', null, null, '[{"type":"tip","text":"Em ações de limpeza, use luvas e nunca recolha objetos cortantes ou perigosos com as mãos. Crianças sempre acompanhadas de adultos."}]'::jsonb, 3);
insert into public.lesson_sections (id, lesson_id, section_type, icon, title, content, image_url, image_alt, blocks, order_index) values
  ('21000000-0000-4000-8000-000000013001', '20000000-0000-4000-8000-000000000013', 'content', '🐄', 'Conhecendo a vaca', 'A vaca é um mamífero: quando filhote, alimenta-se do leite da mãe. Em fazendas, as vacas precisam de água limpa, alimento, abrigo, espaço e cuidados de pessoas responsáveis.
- É um mamífero
- Precisa de água, alimento e descanso
- Deve ser tratada com respeito e cuidado', null, null, '[{"type":"think","prompt":"O que um animal precisa para viver bem?"}]'::jsonb, 1),
  ('21000000-0000-4000-8000-000000013002', '20000000-0000-4000-8000-000000000013', 'content', '🥛', 'Do leite aos alimentos', 'O leite pode ser usado para fazer alimentos como queijo, iogurte, manteiga e coalhada. Esses alimentos são chamados de derivados do leite. Cada um passa por uma preparação diferente.
- Leite pode virar queijo
- Leite pode virar iogurte
- Leite pode virar manteiga', null, null, '[{"type":"choice","prompt":"Qual destes é um derivado do leite?","options":[{"id":"arroz","icon":"🍚","label":"Arroz","is_best":false,"feedback":"Arroz é um grão, não um derivado do leite."},{"id":"queijo","icon":"🧀","label":"Queijo","is_best":true,"feedback":"Isso! O queijo pode ser produzido a partir do leite."},{"id":"maca","icon":"🍎","label":"Maçã","is_best":false,"feedback":"A maçã é uma fruta, não um derivado do leite."}]}]'::jsonb, 2),
  ('21000000-0000-4000-8000-000000013003', '20000000-0000-4000-8000-000000000013', 'content', '💚', 'Cuidar e não desperdiçar', 'Conhecer a origem dos alimentos ajuda a agradecer o trabalho das pessoas e a respeitar os animais. Podemos servir apenas o que vamos comer, guardar corretamente o que sobrar e conversar com um adulto sobre escolhas alimentares.', null, null, '[{"type":"tip","text":"Nunca entre em uma fazenda, toque ou alimente um animal sem a autorização e a presença de um adulto responsável."}]'::jsonb, 3);
insert into public.lesson_sections (id, lesson_id, section_type, icon, title, content, image_url, image_alt, blocks, order_index) values
  ('21000000-0000-4000-8000-000000014001', '20000000-0000-4000-8000-000000000014', 'content', '🏠', 'Para que servem os móveis?', 'Móveis são os objetos grandes que deixam a casa confortável. Cada cômodo tem os seus: na sala tem sofá, no quarto tem cama e guarda-roupa, na cozinha tem mesa e cadeiras.
- Sofá e cadeira: para sentar
- Cama: para dormir e descansar
- Guarda-roupa e estante: para guardar coisas
- Mesa: para apoiar, comer e estudar', null, null, '[{"type":"choice","prompt":"Qual móvel serve para guardar roupas?","options":[{"id":"guarda-roupa","icon":"🚪","label":"Guarda-roupa","is_best":true,"feedback":"Isso! O guarda-roupa guarda roupas, sapatos e cobertores."},{"id":"sofa","icon":"🛋️","label":"Sofá","is_best":false,"feedback":"O sofá serve para sentar e descansar na sala."},{"id":"mesa","icon":"🍽️","label":"Mesa","is_best":false,"feedback":"A mesa serve para apoiar pratos, livros e cadernos."}]}]'::jsonb, 1),
  ('21000000-0000-4000-8000-000000014002', '20000000-0000-4000-8000-000000000014', 'content', '🌳', 'Do que os móveis são feitos?', 'Muitos móveis são feitos de madeira, que vem das árvores. Outros usam metal, plástico, vidro ou tecido. Olhar com atenção ajuda a descobrir: a madeira tem desenhos de linhas, o metal é frio e brilhante, o tecido é macio.
- Madeira: vem das árvores
- Metal: frio e resistente
- Tecido: macio, como no sofá', null, null, '[{"type":"think","prompt":"Qual é o móvel de madeira mais perto de você agora?"}]'::jsonb, 2),
  ('21000000-0000-4000-8000-000000014003', '20000000-0000-4000-8000-000000000014', 'content', '🧽', 'Cuidar para durar', 'Quando cuidamos dos móveis, eles duram muitos anos e menos árvores precisam ser cortadas para fazer móveis novos. Não pular em cima da cama, não riscar a mesa e limpar a poeira são jeitos de cuidar. Um móvel velho pode ser consertado, pintado ou doado para outra família.', null, null, '[{"type":"tip","text":"Nunca suba em móveis nem tente mover um móvel pesado sozinho: peça ajuda a um adulto."}]'::jsonb, 3);

-- Conteúdos relacionados (recriados)
delete from public.lesson_related where lesson_id in ('20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000007', '20000000-0000-4000-8000-000000000008', '20000000-0000-4000-8000-000000000009', '20000000-0000-4000-8000-000000000010', '20000000-0000-4000-8000-000000000011', '20000000-0000-4000-8000-000000000012', '20000000-0000-4000-8000-000000000013', '20000000-0000-4000-8000-000000000014');
insert into public.lesson_related (lesson_id, related_lesson_id, order_index) values
  ('20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', 1),
  ('20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000011', 2),
  ('20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000005', 3),
  ('20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000003', 4),
  ('20000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000003', 1),
  ('20000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 2),
  ('20000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000010', 3),
  ('20000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000002', 1),
  ('20000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000011', 2),
  ('20000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000007', 3),
  ('20000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000005', 1),
  ('20000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000008', 2),
  ('20000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000007', 3),
  ('20000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000004', 1),
  ('20000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000001', 2),
  ('20000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000012', 3),
  ('20000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000007', 1),
  ('20000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000012', 2),
  ('20000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000008', 3),
  ('20000000-0000-4000-8000-000000000007', '20000000-0000-4000-8000-000000000006', 1),
  ('20000000-0000-4000-8000-000000000007', '20000000-0000-4000-8000-000000000003', 2),
  ('20000000-0000-4000-8000-000000000007', '20000000-0000-4000-8000-000000000012', 3),
  ('20000000-0000-4000-8000-000000000008', '20000000-0000-4000-8000-000000000009', 1),
  ('20000000-0000-4000-8000-000000000008', '20000000-0000-4000-8000-000000000004', 2),
  ('20000000-0000-4000-8000-000000000008', '20000000-0000-4000-8000-000000000006', 3),
  ('20000000-0000-4000-8000-000000000009', '20000000-0000-4000-8000-000000000008', 1),
  ('20000000-0000-4000-8000-000000000009', '20000000-0000-4000-8000-000000000010', 2),
  ('20000000-0000-4000-8000-000000000009', '20000000-0000-4000-8000-000000000005', 3),
  ('20000000-0000-4000-8000-000000000010', '20000000-0000-4000-8000-000000000011', 1),
  ('20000000-0000-4000-8000-000000000010', '20000000-0000-4000-8000-000000000001', 2),
  ('20000000-0000-4000-8000-000000000010', '20000000-0000-4000-8000-000000000002', 3),
  ('20000000-0000-4000-8000-000000000011', '20000000-0000-4000-8000-000000000010', 1),
  ('20000000-0000-4000-8000-000000000011', '20000000-0000-4000-8000-000000000003', 2),
  ('20000000-0000-4000-8000-000000000011', '20000000-0000-4000-8000-000000000001', 3),
  ('20000000-0000-4000-8000-000000000012', '20000000-0000-4000-8000-000000000006', 1),
  ('20000000-0000-4000-8000-000000000012', '20000000-0000-4000-8000-000000000003', 2),
  ('20000000-0000-4000-8000-000000000012', '20000000-0000-4000-8000-000000000001', 3),
  ('20000000-0000-4000-8000-000000000013', '20000000-0000-4000-8000-000000000012', 1),
  ('20000000-0000-4000-8000-000000000013', '20000000-0000-4000-8000-000000000003', 2),
  ('20000000-0000-4000-8000-000000000014', '20000000-0000-4000-8000-000000000012', 1),
  ('20000000-0000-4000-8000-000000000014', '20000000-0000-4000-8000-000000000007', 2);
