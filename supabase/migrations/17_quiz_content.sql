-- =====================================================================
-- 17 · Quizzes (Etapa 4)
-- =====================================================================
-- ARQUIVO GERADO por "npm run content:sql" a partir de content/quizzes.json.
-- Não edite à mão. Idempotente: atualiza perguntas/alternativas existentes
-- (mantendo os IDs e o histórico de respostas) e desativa perguntas removidas.

-- Quiz: Por que as árvores são importantes?
insert into public.quizzes (id, lesson_id, title, description, passing_score, xp_reward, improvement_xp_reward, attempts_allowed, active)
values ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'Quiz: Por que as árvores são importantes?', '5 perguntas sobre biodiversidade, ecossistemas, água, solo e planejamento do plantio.', 70, 30, 0, null, true)
on conflict (id) do update set
  lesson_id = excluded.lesson_id, title = excluded.title, description = excluded.description,
  passing_score = excluded.passing_score, xp_reward = excluded.xp_reward,
  improvement_xp_reward = excluded.improvement_xp_reward, attempts_allowed = excluded.attempts_allowed, active = true;

-- evita conflitos de ordem ao reordenar; perguntas fora do JSON ficam inativas (histórico preservado)
update public.quiz_questions set order_index = -order_index - 1000 where quiz_id = '30000000-0000-4000-8000-000000000001' and order_index >= 0;
update public.quiz_questions set active = false where quiz_id = '30000000-0000-4000-8000-000000000001' and id not in ('31000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000002', '31000000-0000-4000-8000-000000000003', '31000000-0000-4000-8000-000000000004', '31000000-0000-4000-8000-000000000005');
insert into public.quiz_questions (id, quiz_id, question, explanation, topic, question_type, order_index, points, active) values
  ('31000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'Por que uma árvore pode ser importante para a biodiversidade?', 'Uma única árvore pode ser casa e alimento para muitos seres vivos: abelhas visitam as flores, aves comem os frutos e fazem ninhos, lagartas se alimentam das folhas.', '🐦 Biodiversidade e habitat', 'single_choice', 1, 1, true),
  ('31000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001', 'O que acontece com as folhas que caem de uma árvore em um ambiente natural?', 'Fungos, bactérias e pequenos animais decompõem folhas e galhos caídos. Os nutrientes voltam para o solo e ajudam novas plantas a crescer.', '🌎 Ecossistemas e solo', 'single_choice', 2, 1, true),
  ('31000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000001', 'Como as árvores ajudam na relação entre a chuva e o solo?', 'As raízes seguram a terra e diminuem a erosão. A copa amortece as gotas e as folhas caídas cobrem o chão, então mais água consegue penetrar no solo.', '💧 Água e solo', 'single_choice', 3, 1, true),
  ('31000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000001', 'Por que é recomendado escolher uma espécie nativa da sua região?', 'Cada espécie tem necessidades próprias. As nativas da região já são adaptadas ao clima e ao solo do lugar e alimentam a fauna que vive ali.', '🌱 Escolha da espécie', 'single_choice', 4, 1, true),
  ('31000000-0000-4000-8000-000000000005', '30000000-0000-4000-8000-000000000001', 'Qual aspecto deve ser considerado antes de plantar uma árvore?', 'Antes de plantar, pense na árvore adulta: ela vai precisar de espaço para raízes e copa, longe de fios, canos e muros, em solo e clima adequados.', '📍 Planejamento do plantio', 'single_choice', 5, 1, true)
on conflict (id) do update set
  quiz_id = excluded.quiz_id, question = excluded.question, explanation = excluded.explanation, topic = excluded.topic,
  question_type = excluded.question_type, order_index = excluded.order_index, points = excluded.points, active = true;

update public.quiz_options set is_correct = false, order_index = -order_index - 1000
where question_id in ('31000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000002', '31000000-0000-4000-8000-000000000003', '31000000-0000-4000-8000-000000000004', '31000000-0000-4000-8000-000000000005') and order_index >= 0;
insert into public.quiz_options (id, question_id, option_text, is_correct, explanation, order_index) values
  ('32000000-0000-4000-8000-000000000011', '31000000-0000-4000-8000-000000000001', 'Porque afasta os insetos e deixa o ambiente mais limpo', false, 'Na verdade, árvores atraem e abrigam insetos, como abelhas e lagartas, que fazem parte do ecossistema.', 1),
  ('32000000-0000-4000-8000-000000000012', '31000000-0000-4000-8000-000000000001', 'Porque oferece abrigo e recursos, como flores, frutos e lugar para ninhos, a diferentes espécies', true, 'Isso mesmo: flores, frutos, galhos e ocos do tronco sustentam muitos seres vivos diferentes.', 2),
  ('32000000-0000-4000-8000-000000000013', '31000000-0000-4000-8000-000000000001', 'Porque é usada apenas por aves, que dependem só dela', false, 'Aves usam árvores, mas insetos, mamíferos, fungos e muitos outros seres também dependem delas.', 3),
  ('32000000-0000-4000-8000-000000000014', '31000000-0000-4000-8000-000000000001', 'Porque cresce sozinha, sem depender de nenhum outro ser vivo', false, 'A árvore também depende de outros seres: animais espalham suas sementes e decompositores reciclam nutrientes.', 4),
  ('32000000-0000-4000-8000-000000000021', '31000000-0000-4000-8000-000000000002', 'Viram lixo que precisa ser retirado do ambiente', false, 'Em ambientes naturais, folhas caídas não são lixo: elas fazem parte do ciclo de nutrientes.', 1),
  ('32000000-0000-4000-8000-000000000022', '31000000-0000-4000-8000-000000000002', 'Deixam o solo mais pobre em nutrientes', false, 'É o contrário: a decomposição das folhas devolve nutrientes ao solo.', 2),
  ('32000000-0000-4000-8000-000000000023', '31000000-0000-4000-8000-000000000002', 'São decompostas e seus nutrientes voltam para o solo', true, 'Exato: decompositores transformam as folhas em matéria orgânica que nutre o solo.', 3),
  ('32000000-0000-4000-8000-000000000024', '31000000-0000-4000-8000-000000000002', 'Ficam no chão para sempre, sem se transformar', false, 'Com o tempo, fungos, bactérias e pequenos animais transformam as folhas em matéria orgânica.', 4),
  ('32000000-0000-4000-8000-000000000031', '31000000-0000-4000-8000-000000000003', 'As raízes seguram o solo e mais água consegue infiltrar na terra', true, 'Isso: raízes, copa e folhas caídas diminuem a erosão e ajudam a água a penetrar no solo.', 1),
  ('32000000-0000-4000-8000-000000000032', '31000000-0000-4000-8000-000000000003', 'A copa impede que a água da chuva chegue ao chão', false, 'A copa amortece a força das gotas, mas a água continua chegando ao solo.', 2),
  ('32000000-0000-4000-8000-000000000033', '31000000-0000-4000-8000-000000000003', 'As raízes soltam a terra para a chuva levá-la embora', false, 'É o contrário: as raízes seguram a terra e ajudam a diminuir a erosão.', 3),
  ('32000000-0000-4000-8000-000000000034', '31000000-0000-4000-8000-000000000003', 'Elas fazem a água escorrer mais rápido pela superfície', false, 'Com vegetação, a água escorre menos pela superfície e infiltra mais no solo.', 4),
  ('32000000-0000-4000-8000-000000000041', '31000000-0000-4000-8000-000000000004', 'Porque é sempre a árvore que cresce mais rápido', false, 'Crescer rápido não é o critério principal — e muitas espécies nativas crescem devagar.', 1),
  ('32000000-0000-4000-8000-000000000042', '31000000-0000-4000-8000-000000000004', 'Porque não precisa de nenhum cuidado depois do plantio', false, 'Mesmo espécies nativas precisam de rega e proteção nos primeiros meses.', 2),
  ('32000000-0000-4000-8000-000000000043', '31000000-0000-4000-8000-000000000004', 'Porque qualquer espécie nativa do Brasil serve para qualquer lugar', false, 'O importante é ser nativa da sua região: o Brasil tem biomas muito diferentes, cada um com suas espécies.', 3),
  ('32000000-0000-4000-8000-000000000044', '31000000-0000-4000-8000-000000000004', 'Porque já é adaptada ao clima e ao solo do lugar e alimenta a fauna local', true, 'Exatamente: adaptada ao ambiente, a espécie nativa tem mais chance de crescer bem e ajuda os animais da região.', 4),
  ('32000000-0000-4000-8000-000000000051', '31000000-0000-4000-8000-000000000005', 'Somente a aparência da muda', false, 'Além da aparência, é importante considerar a espécie, o espaço disponível, o solo e as condições do local.', 1),
  ('32000000-0000-4000-8000-000000000052', '31000000-0000-4000-8000-000000000005', 'O tamanho que a árvore terá quando adulta e o espaço para raízes e copa', true, 'Isso: planejar pensando na árvore adulta evita problemas com fios, canos e construções.', 2),
  ('32000000-0000-4000-8000-000000000053', '31000000-0000-4000-8000-000000000005', 'Plantar o mais perto possível do muro, para a árvore ficar protegida', false, 'Colada ao muro, as raízes podem danificar a construção e a copa cresce sem espaço.', 3),
  ('32000000-0000-4000-8000-000000000054', '31000000-0000-4000-8000-000000000005', 'Escolher um lugar embaixo da fiação, onde há mais sombra', false, 'Embaixo da fiação, a copa vai alcançar os fios e precisará de podas frequentes.', 4)
on conflict (id) do update set
  question_id = excluded.question_id, option_text = excluded.option_text, is_correct = excluded.is_correct,
  explanation = excluded.explanation, order_index = excluded.order_index;

-- Quiz: Como uma planta cresce?
insert into public.quizzes (id, lesson_id, title, description, passing_score, xp_reward, improvement_xp_reward, attempts_allowed, active)
values ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'Quiz: Como uma planta cresce?', '3 perguntas sobre germinação, fotossíntese e cuidados.', 60, 30, 0, null, true)
on conflict (id) do update set
  lesson_id = excluded.lesson_id, title = excluded.title, description = excluded.description,
  passing_score = excluded.passing_score, xp_reward = excluded.xp_reward,
  improvement_xp_reward = excluded.improvement_xp_reward, attempts_allowed = excluded.attempts_allowed, active = true;

-- evita conflitos de ordem ao reordenar; perguntas fora do JSON ficam inativas (histórico preservado)
update public.quiz_questions set order_index = -order_index - 1000 where quiz_id = '30000000-0000-4000-8000-000000000002' and order_index >= 0;
update public.quiz_questions set active = false where quiz_id = '30000000-0000-4000-8000-000000000002' and id not in ('31000000-0000-4000-8000-002000000001', '31000000-0000-4000-8000-002000000002', '31000000-0000-4000-8000-002000000003');
insert into public.quiz_questions (id, quiz_id, question, explanation, topic, question_type, order_index, points, active) values
  ('31000000-0000-4000-8000-002000000001', '30000000-0000-4000-8000-000000000002', 'Quando uma semente germina, o que costuma aparecer primeiro?', 'Na germinação, a raiz surge primeiro: ela fixa a plantinha e começa a absorver água. Depois aparecem o caule e as primeiras folhas.', '🌰 Germinação', 'single_choice', 1, 1, true),
  ('31000000-0000-4000-8000-002000000002', '30000000-0000-4000-8000-000000000002', 'O que a planta usa na fotossíntese para produzir o próprio alimento?', 'Na fotossíntese, as folhas usam luz do sol, água vinda das raízes e gás carbônico do ar para produzir açúcares — e liberam oxigênio.', '☀️ Fotossíntese', 'single_choice', 2, 1, true),
  ('31000000-0000-4000-8000-002000000003', '30000000-0000-4000-8000-000000000002', 'Por que regar demais também pode fazer mal a uma planta?', 'As raízes precisam de ar. Em um solo encharcado o tempo todo, elas ficam sem oxigênio e podem apodrecer.', '🌿 Cuidados', 'single_choice', 3, 1, true)
on conflict (id) do update set
  quiz_id = excluded.quiz_id, question = excluded.question, explanation = excluded.explanation, topic = excluded.topic,
  question_type = excluded.question_type, order_index = excluded.order_index, points = excluded.points, active = true;

update public.quiz_options set is_correct = false, order_index = -order_index - 1000
where question_id in ('31000000-0000-4000-8000-002000000001', '31000000-0000-4000-8000-002000000002', '31000000-0000-4000-8000-002000000003') and order_index >= 0;
insert into public.quiz_options (id, question_id, option_text, is_correct, explanation, order_index) values
  ('32000000-0000-4000-8000-002000001001', '31000000-0000-4000-8000-002000000001', 'As folhas', false, 'As folhas aparecem depois. Primeiro a planta precisa se fixar e buscar água.', 1),
  ('32000000-0000-4000-8000-002000001002', '31000000-0000-4000-8000-002000000001', 'A raiz', true, 'Isso: a raiz é a primeira a sair da semente.', 2),
  ('32000000-0000-4000-8000-002000001003', '31000000-0000-4000-8000-002000000001', 'As flores', false, 'Flores surgem muito depois, quando a planta já está desenvolvida.', 3),
  ('32000000-0000-4000-8000-002000001004', '31000000-0000-4000-8000-002000000001', 'Os frutos', false, 'Frutos vêm depois das flores, na planta adulta.', 4),
  ('32000000-0000-4000-8000-002000002001', '31000000-0000-4000-8000-002000000002', 'Apenas a água da chuva', false, 'A água é importante, mas sozinha não basta: a planta também precisa de luz e gás carbônico.', 1),
  ('32000000-0000-4000-8000-002000002002', '31000000-0000-4000-8000-002000000002', 'Apenas os nutrientes da terra', false, 'Nutrientes ajudam, mas o alimento (açúcares) é produzido com luz, água e gás carbônico.', 2),
  ('32000000-0000-4000-8000-002000002003', '31000000-0000-4000-8000-002000000002', 'Luz, água e gás carbônico do ar', true, 'Exato: esses três ingredientes formam os açúcares que fazem a planta crescer.', 3),
  ('32000000-0000-4000-8000-002000002004', '31000000-0000-4000-8000-002000000002', 'Oxigênio e escuridão', false, 'A fotossíntese precisa de luz, e o oxigênio é liberado por ela, não usado.', 4),
  ('32000000-0000-4000-8000-002000003001', '31000000-0000-4000-8000-002000000003', 'Porque as raízes também precisam de ar, e o solo encharcado atrapalha', true, 'Isso: água na medida certa mantém as raízes saudáveis.', 1),
  ('32000000-0000-4000-8000-002000003002', '31000000-0000-4000-8000-002000000003', 'Porque plantas só precisam de água uma vez na vida', false, 'Plantas precisam de água regularmente — só não em excesso.', 2),
  ('32000000-0000-4000-8000-002000003003', '31000000-0000-4000-8000-002000000003', 'Porque a água em excesso faz a planta crescer rápido demais', false, 'O problema do excesso é a falta de ar para as raízes, não o crescimento rápido.', 3),
  ('32000000-0000-4000-8000-002000003004', '31000000-0000-4000-8000-002000000003', 'Porque a água impede a luz de chegar às folhas', false, 'A água do solo não bloqueia a luz. O problema é o encharcamento das raízes.', 4)
on conflict (id) do update set
  question_id = excluded.question_id, option_text = excluded.option_text, is_correct = excluded.is_correct,
  explanation = excluded.explanation, order_index = excluded.order_index;

-- Quiz: O que é uma horta?
insert into public.quizzes (id, lesson_id, title, description, passing_score, xp_reward, improvement_xp_reward, attempts_allowed, active)
values ('30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000003', 'Quiz: O que é uma horta?', '3 perguntas sobre onde e como começar uma horta.', 60, 30, 0, null, true)
on conflict (id) do update set
  lesson_id = excluded.lesson_id, title = excluded.title, description = excluded.description,
  passing_score = excluded.passing_score, xp_reward = excluded.xp_reward,
  improvement_xp_reward = excluded.improvement_xp_reward, attempts_allowed = excluded.attempts_allowed, active = true;

-- evita conflitos de ordem ao reordenar; perguntas fora do JSON ficam inativas (histórico preservado)
update public.quiz_questions set order_index = -order_index - 1000 where quiz_id = '30000000-0000-4000-8000-000000000003' and order_index >= 0;
update public.quiz_questions set active = false where quiz_id = '30000000-0000-4000-8000-000000000003' and id not in ('31000000-0000-4000-8000-003000000001', '31000000-0000-4000-8000-003000000002', '31000000-0000-4000-8000-003000000003');
insert into public.quiz_questions (id, quiz_id, question, explanation, topic, question_type, order_index, points, active) values
  ('31000000-0000-4000-8000-003000000001', '30000000-0000-4000-8000-000000000003', 'Do que a maioria das hortaliças precisa para crescer bem?', 'A maioria das hortaliças precisa de algumas horas de sol direto por dia, além de água e solo com matéria orgânica.', '☀️ Luz', 'single_choice', 1, 1, true),
  ('31000000-0000-4000-8000-003000000002', '30000000-0000-4000-8000-000000000003', 'Qual destes lugares é uma boa opção para começar uma horta?', 'Um lugar com sol e água por perto facilita os cuidados diários e ajuda as plantas a crescer.', '📍 Onde começar', 'single_choice', 2, 1, true),
  ('31000000-0000-4000-8000-003000000003', '30000000-0000-4000-8000-000000000003', 'Como restos de frutas e verduras podem ajudar uma horta?', 'Pela compostagem, restos orgânicos se transformam em adubo, que devolve nutrientes ao solo.', '🐞 Horta viva', 'single_choice', 3, 1, true)
on conflict (id) do update set
  quiz_id = excluded.quiz_id, question = excluded.question, explanation = excluded.explanation, topic = excluded.topic,
  question_type = excluded.question_type, order_index = excluded.order_index, points = excluded.points, active = true;

update public.quiz_options set is_correct = false, order_index = -order_index - 1000
where question_id in ('31000000-0000-4000-8000-003000000001', '31000000-0000-4000-8000-003000000002', '31000000-0000-4000-8000-003000000003') and order_index >= 0;
insert into public.quiz_options (id, question_id, option_text, is_correct, explanation, order_index) values
  ('32000000-0000-4000-8000-003000001001', '31000000-0000-4000-8000-003000000001', 'Ficar na sombra o dia inteiro', false, 'Sem sol, a maioria das hortaliças cresce fraca.', 1),
  ('32000000-0000-4000-8000-003000001002', '31000000-0000-4000-8000-003000000001', 'Algumas horas de sol direto por dia', true, 'Isso: a luz do sol é essencial para a fotossíntese.', 2),
  ('32000000-0000-4000-8000-003000001003', '31000000-0000-4000-8000-003000000001', 'Solo bem compactado e duro', false, 'Solo duro dificulta as raízes. O ideal é terra fofa e com matéria orgânica.', 3),
  ('32000000-0000-4000-8000-003000001004', '31000000-0000-4000-8000-003000000001', 'Água apenas uma vez por mês', false, 'Hortaliças precisam de rega frequente, principalmente em dias secos.', 4),
  ('32000000-0000-4000-8000-003000002001', '31000000-0000-4000-8000-003000000002', 'Um canto que fica sem sol o dia todo', false, 'Falta de luz é um dos principais problemas das hortas.', 1),
  ('32000000-0000-4000-8000-003000002002', '31000000-0000-4000-8000-003000000002', 'Um terreno cheio de entulho, sem preparar a terra', false, 'Seria preciso preparar o solo antes: entulho atrapalha as raízes.', 2),
  ('32000000-0000-4000-8000-003000002003', '31000000-0000-4000-8000-003000000002', 'Um lugar com sol pela manhã e uma torneira perto', true, 'Ótimo: sol e água por perto são os melhores aliados de uma horta.', 3),
  ('32000000-0000-4000-8000-003000002004', '31000000-0000-4000-8000-003000000002', 'Qualquer lugar, desde que fique escondido', false, 'Ficar escondido não ajuda: o que importa é luz, água e bom solo.', 4),
  ('32000000-0000-4000-8000-003000003001', '31000000-0000-4000-8000-003000000003', 'Virando adubo por meio da compostagem', true, 'Isso: a compostagem transforma restos em adubo rico em nutrientes.', 1),
  ('32000000-0000-4000-8000-003000003002', '31000000-0000-4000-8000-003000000003', 'Sendo jogados inteiros sobre as folhas das plantas', false, 'Restos sobre as folhas podem atrair pragas. O caminho é a compostagem.', 2),
  ('32000000-0000-4000-8000-003000003003', '31000000-0000-4000-8000-003000000003', 'Sendo queimados perto da horta', false, 'Queimar polui o ar e desperdiça os nutrientes que poderiam virar adubo.', 3),
  ('32000000-0000-4000-8000-003000003004', '31000000-0000-4000-8000-003000000003', 'Eles não ajudam em nada', false, 'Ajudam, sim: bem compostados, viram adubo para a horta.', 4)
on conflict (id) do update set
  question_id = excluded.question_id, option_text = excluded.option_text, is_correct = excluded.is_correct,
  explanation = excluded.explanation, order_index = excluded.order_index;

-- Quiz: Por que precisamos economizar água?
insert into public.quizzes (id, lesson_id, title, description, passing_score, xp_reward, improvement_xp_reward, attempts_allowed, active)
values ('30000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000004', 'Quiz: Por que precisamos economizar água?', '3 perguntas sobre água doce, energia e atitudes do dia a dia.', 60, 30, 0, null, true)
on conflict (id) do update set
  lesson_id = excluded.lesson_id, title = excluded.title, description = excluded.description,
  passing_score = excluded.passing_score, xp_reward = excluded.xp_reward,
  improvement_xp_reward = excluded.improvement_xp_reward, attempts_allowed = excluded.attempts_allowed, active = true;

-- evita conflitos de ordem ao reordenar; perguntas fora do JSON ficam inativas (histórico preservado)
update public.quiz_questions set order_index = -order_index - 1000 where quiz_id = '30000000-0000-4000-8000-000000000004' and order_index >= 0;
update public.quiz_questions set active = false where quiz_id = '30000000-0000-4000-8000-000000000004' and id not in ('31000000-0000-4000-8000-004000000001', '31000000-0000-4000-8000-004000000002', '31000000-0000-4000-8000-004000000003');
insert into public.quiz_questions (id, quiz_id, question, explanation, topic, question_type, order_index, points, active) values
  ('31000000-0000-4000-8000-004000000001', '30000000-0000-4000-8000-000000000004', 'Por que é importante economizar água doce?', 'A maior parte da água do planeta é salgada. A água doce é uma pequena parte, e muito dela está congelada ou no subsolo.', '🌍 Água doce', 'single_choice', 1, 1, true),
  ('31000000-0000-4000-8000-004000000002', '30000000-0000-4000-8000-000000000004', 'Por que economizar água também ajuda a economizar energia?', 'Captar, tratar e bombear a água até as casas — e depois tratar o esgoto — usa energia e recursos.', '🚰 Água e energia', 'single_choice', 2, 1, true),
  ('31000000-0000-4000-8000-004000000003', '30000000-0000-4000-8000-000000000004', 'Qual destas atitudes ajuda a economizar água?', 'Fechar a torneira ao escovar os dentes, tomar banhos curtos e consertar vazamentos são atitudes simples que evitam desperdício.', '💧 Atitudes', 'single_choice', 3, 1, true)
on conflict (id) do update set
  quiz_id = excluded.quiz_id, question = excluded.question, explanation = excluded.explanation, topic = excluded.topic,
  question_type = excluded.question_type, order_index = excluded.order_index, points = excluded.points, active = true;

update public.quiz_options set is_correct = false, order_index = -order_index - 1000
where question_id in ('31000000-0000-4000-8000-004000000001', '31000000-0000-4000-8000-004000000002', '31000000-0000-4000-8000-004000000003') and order_index >= 0;
insert into public.quiz_options (id, question_id, option_text, is_correct, explanation, order_index) values
  ('32000000-0000-4000-8000-004000001001', '31000000-0000-4000-8000-004000000001', 'Porque a água salgada acabou', false, 'A água salgada é a maior parte da água do planeta — o que é pouco é a água doce.', 1),
  ('32000000-0000-4000-8000-004000001002', '31000000-0000-4000-8000-004000000001', 'Porque a água doce é uma pequena parte da água do planeta', true, 'Isso: e só uma parte dela está facilmente disponível em rios e lagos.', 2),
  ('32000000-0000-4000-8000-004000001003', '31000000-0000-4000-8000-004000000001', 'Porque a água doce só existe em garrafas', false, 'A água doce está em rios, lagos, geleiras e no subsolo.', 3),
  ('32000000-0000-4000-8000-004000001004', '31000000-0000-4000-8000-004000000001', 'Porque a água doce não faz parte do ciclo da água', false, 'Ela faz parte do ciclo da água — mas a quantidade disponível é pequena.', 4),
  ('32000000-0000-4000-8000-004000002001', '31000000-0000-4000-8000-004000000002', 'Porque as torneiras funcionam com pilhas', false, 'Torneiras não usam pilhas. A energia é gasta no tratamento e no bombeamento da água.', 1),
  ('32000000-0000-4000-8000-004000002002', '31000000-0000-4000-8000-004000000002', 'Porque não existe nenhuma relação entre água e energia', false, 'Existe, sim: levar água tratada até sua casa consome energia.', 2),
  ('32000000-0000-4000-8000-004000002003', '31000000-0000-4000-8000-004000000002', 'Porque captar, tratar e bombear a água usa energia', true, 'Exato: menos água desperdiçada significa menos energia gasta.', 3),
  ('32000000-0000-4000-8000-004000002004', '31000000-0000-4000-8000-004000000002', 'Porque a água da torneira gera eletricidade em casa', false, 'A água da torneira não gera eletricidade. É o contrário: fazê-la chegar usa energia.', 4),
  ('32000000-0000-4000-8000-004000003001', '31000000-0000-4000-8000-004000000003', 'Lavar a calçada com a mangueira', false, 'A mangueira gasta muita água. Uma vassoura resolve na maioria das vezes.', 1),
  ('32000000-0000-4000-8000-004000003002', '31000000-0000-4000-8000-004000000003', 'Deixar pequenos vazamentos para consertar depois', false, 'Um pingo contínuo desperdiça muita água ao longo do dia.', 2),
  ('32000000-0000-4000-8000-004000003003', '31000000-0000-4000-8000-004000000003', 'Tomar banhos longos', false, 'Banhos mais curtos economizam água e energia.', 3),
  ('32000000-0000-4000-8000-004000003004', '31000000-0000-4000-8000-004000000003', 'Fechar a torneira enquanto escova os dentes', true, 'Isso: uma atitude simples que evita desperdício todos os dias.', 4)
on conflict (id) do update set
  question_id = excluded.question_id, option_text = excluded.option_text, is_correct = excluded.is_correct,
  explanation = excluded.explanation, order_index = excluded.order_index;

-- Quiz: O que acontece com a água da chuva?
insert into public.quizzes (id, lesson_id, title, description, passing_score, xp_reward, improvement_xp_reward, attempts_allowed, active)
values ('30000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000005', 'Quiz: O que acontece com a água da chuva?', '3 perguntas sobre o caminho da chuva e seu aproveitamento.', 60, 30, 0, null, true)
on conflict (id) do update set
  lesson_id = excluded.lesson_id, title = excluded.title, description = excluded.description,
  passing_score = excluded.passing_score, xp_reward = excluded.xp_reward,
  improvement_xp_reward = excluded.improvement_xp_reward, attempts_allowed = excluded.attempts_allowed, active = true;

-- evita conflitos de ordem ao reordenar; perguntas fora do JSON ficam inativas (histórico preservado)
update public.quiz_questions set order_index = -order_index - 1000 where quiz_id = '30000000-0000-4000-8000-000000000005' and order_index >= 0;
update public.quiz_questions set active = false where quiz_id = '30000000-0000-4000-8000-000000000005' and id not in ('31000000-0000-4000-8000-005000000001', '31000000-0000-4000-8000-005000000002', '31000000-0000-4000-8000-005000000003');
insert into public.quiz_questions (id, quiz_id, question, explanation, topic, question_type, order_index, points, active) values
  ('31000000-0000-4000-8000-005000000001', '30000000-0000-4000-8000-000000000005', 'Que caminhos a água da chuva pode seguir ao cair?', 'A chuva pode infiltrar no solo, escorrer pela superfície até rios e lagos ou evaporar — caminhos que fazem parte do ciclo da água.', '🌧️ Ciclo da água', 'single_choice', 1, 1, true),
  ('31000000-0000-4000-8000-005000000002', '30000000-0000-4000-8000-000000000005', 'Por que as cidades costumam ter mais risco de alagamentos?', 'Asfalto, concreto e telhados não deixam a água infiltrar. Mais água escorre pelas ruas — e lixo nos bueiros piora o problema.', '🏙️ Chuva na cidade', 'single_choice', 2, 1, true),
  ('31000000-0000-4000-8000-005000000003', '30000000-0000-4000-8000-000000000005', 'Qual cuidado é essencial ao guardar água da chuva?', 'Recipientes com água parada precisam ficar tampados, senão podem virar criadouro do mosquito Aedes aegypti. E a água da chuva não deve ser bebida sem tratamento.', '🪣 Aproveitamento', 'single_choice', 3, 1, true)
on conflict (id) do update set
  quiz_id = excluded.quiz_id, question = excluded.question, explanation = excluded.explanation, topic = excluded.topic,
  question_type = excluded.question_type, order_index = excluded.order_index, points = excluded.points, active = true;

update public.quiz_options set is_correct = false, order_index = -order_index - 1000
where question_id in ('31000000-0000-4000-8000-005000000001', '31000000-0000-4000-8000-005000000002', '31000000-0000-4000-8000-005000000003') and order_index >= 0;
insert into public.quiz_options (id, question_id, option_text, is_correct, explanation, order_index) values
  ('32000000-0000-4000-8000-005000001001', '31000000-0000-4000-8000-005000000001', 'Ela sempre evapora imediatamente', false, 'Parte evapora, mas outra parte infiltra no solo ou escorre até rios.', 1),
  ('32000000-0000-4000-8000-005000001002', '31000000-0000-4000-8000-005000000001', 'Infiltrar no solo, escorrer até rios ou evaporar', true, 'Isso: esses caminhos fazem parte do ciclo da água.', 2),
  ('32000000-0000-4000-8000-005000001003', '31000000-0000-4000-8000-005000000001', 'Ela desaparece depois de tocar o chão', false, 'A água não desaparece: ela muda de lugar ou de estado.', 3),
  ('32000000-0000-4000-8000-005000001004', '31000000-0000-4000-8000-005000000001', 'Ela sempre vai direto para o mar', false, 'Parte chega aos rios e ao mar, mas outra infiltra ou evapora.', 4),
  ('32000000-0000-4000-8000-005000002001', '31000000-0000-4000-8000-005000000002', 'Porque chove sempre mais nas cidades', false, 'O principal problema é a água não conseguir infiltrar no solo.', 1),
  ('32000000-0000-4000-8000-005000002002', '31000000-0000-4000-8000-005000000002', 'Porque as árvores das cidades causam enchentes', false, 'Árvores e áreas verdes ajudam a absorver água, diminuindo alagamentos.', 2),
  ('32000000-0000-4000-8000-005000002003', '31000000-0000-4000-8000-005000000002', 'Porque os bueiros absorvem toda a água', false, 'Bueiros escoam parte da água, e entupidos por lixo pioram o problema.', 3),
  ('32000000-0000-4000-8000-005000002004', '31000000-0000-4000-8000-005000000002', 'Porque asfalto e concreto impedem a água de infiltrar no solo', true, 'Exato: superfícies impermeáveis aumentam o escoamento.', 4),
  ('32000000-0000-4000-8000-005000003001', '31000000-0000-4000-8000-005000000003', 'Manter o recipiente bem tampado', true, 'Isso: tampar evita a criação do mosquito Aedes aegypti.', 1),
  ('32000000-0000-4000-8000-005000003002', '31000000-0000-4000-8000-005000000003', 'Deixar o recipiente aberto para juntar mais água', false, 'Água parada aberta pode virar criadouro de mosquitos.', 2),
  ('32000000-0000-4000-8000-005000003003', '31000000-0000-4000-8000-005000000003', 'Usar para beber sem nenhum tratamento', false, 'A água da chuva guardada serve para regar e limpar, não para beber sem tratamento.', 3),
  ('32000000-0000-4000-8000-005000003004', '31000000-0000-4000-8000-005000000003', 'Não há nenhum cuidado necessário', false, 'Há, sim: o principal é manter o recipiente tampado.', 4)
on conflict (id) do update set
  question_id = excluded.question_id, option_text = excluded.option_text, is_correct = excluded.is_correct,
  explanation = excluded.explanation, order_index = excluded.order_index;

-- Quiz: O que é reciclagem?
insert into public.quizzes (id, lesson_id, title, description, passing_score, xp_reward, improvement_xp_reward, attempts_allowed, active)
values ('30000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000006', 'Quiz: O que é reciclagem?', '3 perguntas sobre reciclagem e coleta seletiva.', 60, 30, 0, null, true)
on conflict (id) do update set
  lesson_id = excluded.lesson_id, title = excluded.title, description = excluded.description,
  passing_score = excluded.passing_score, xp_reward = excluded.xp_reward,
  improvement_xp_reward = excluded.improvement_xp_reward, attempts_allowed = excluded.attempts_allowed, active = true;

-- evita conflitos de ordem ao reordenar; perguntas fora do JSON ficam inativas (histórico preservado)
update public.quiz_questions set order_index = -order_index - 1000 where quiz_id = '30000000-0000-4000-8000-000000000006' and order_index >= 0;
update public.quiz_questions set active = false where quiz_id = '30000000-0000-4000-8000-000000000006' and id not in ('31000000-0000-4000-8000-006000000001', '31000000-0000-4000-8000-006000000002', '31000000-0000-4000-8000-006000000003');
insert into public.quiz_questions (id, quiz_id, question, explanation, topic, question_type, order_index, points, active) values
  ('31000000-0000-4000-8000-006000000001', '30000000-0000-4000-8000-000000000006', 'O que significa reciclar?', 'Reciclar é transformar materiais já usados em matéria-prima para fabricar novos produtos.', '♻️ Reciclagem', 'single_choice', 1, 1, true),
  ('31000000-0000-4000-8000-006000000002', '30000000-0000-4000-8000-000000000006', 'No padrão brasileiro de coleta seletiva, qual é a cor da lixeira para plástico?', 'Pela Resolução CONAMA nº 275/2001: azul para papel, vermelho para plástico, verde para vidro, amarelo para metal e marrom para orgânicos.', '🗑️ Coleta seletiva', 'single_choice', 2, 1, true),
  ('31000000-0000-4000-8000-006000000003', '30000000-0000-4000-8000-000000000006', 'Qual atitude facilita o trabalho da reciclagem?', 'Embalagens limpas e secas, separadas dos restos de comida, são mais fáceis de triar e reciclar.', '🧼 Separação', 'single_choice', 3, 1, true)
on conflict (id) do update set
  quiz_id = excluded.quiz_id, question = excluded.question, explanation = excluded.explanation, topic = excluded.topic,
  question_type = excluded.question_type, order_index = excluded.order_index, points = excluded.points, active = true;

update public.quiz_options set is_correct = false, order_index = -order_index - 1000
where question_id in ('31000000-0000-4000-8000-006000000001', '31000000-0000-4000-8000-006000000002', '31000000-0000-4000-8000-006000000003') and order_index >= 0;
insert into public.quiz_options (id, question_id, option_text, is_correct, explanation, order_index) values
  ('32000000-0000-4000-8000-006000001001', '31000000-0000-4000-8000-006000000001', 'Usar o mesmo pote de novo para guardar alimentos', false, 'Isso é reutilizar. Reciclar envolve transformar o material.', 1),
  ('32000000-0000-4000-8000-006000001002', '31000000-0000-4000-8000-006000000001', 'Transformar materiais usados em matéria-prima para novos produtos', true, 'Isso mesmo.', 2),
  ('32000000-0000-4000-8000-006000001003', '31000000-0000-4000-8000-006000000001', 'Jogar todo o lixo no mesmo saco', false, 'Misturar tudo dificulta a reciclagem. É preciso separar.', 3),
  ('32000000-0000-4000-8000-006000001004', '31000000-0000-4000-8000-006000000001', 'Queimar o lixo em casa', false, 'Queimar polui o ar e não recicla nada.', 4),
  ('32000000-0000-4000-8000-006000002001', '31000000-0000-4000-8000-006000000002', 'Azul', false, 'Azul é para papel.', 1),
  ('32000000-0000-4000-8000-006000002002', '31000000-0000-4000-8000-006000000002', 'Verde', false, 'Verde é para vidro.', 2),
  ('32000000-0000-4000-8000-006000002003', '31000000-0000-4000-8000-006000000002', 'Vermelha', true, 'Isso: vermelho é a cor do plástico.', 3),
  ('32000000-0000-4000-8000-006000002004', '31000000-0000-4000-8000-006000000002', 'Amarela', false, 'Amarelo é para metal.', 4),
  ('32000000-0000-4000-8000-006000003001', '31000000-0000-4000-8000-006000000003', 'Misturar restos de comida com os recicláveis', false, 'Restos de comida sujam os recicláveis e dificultam o reaproveitamento.', 1),
  ('32000000-0000-4000-8000-006000003002', '31000000-0000-4000-8000-006000000003', 'Separar embalagens limpas e secas', true, 'Isso ajuda muito as cooperativas de reciclagem.', 2),
  ('32000000-0000-4000-8000-006000003003', '31000000-0000-4000-8000-006000000003', 'Colocar tudo no lixo comum', false, 'No lixo comum, o material reciclável se perde.', 3),
  ('32000000-0000-4000-8000-006000003004', '31000000-0000-4000-8000-006000000003', 'Descartar vidro quebrado solto na lixeira', false, 'Vidro quebrado deve ser embrulhado para proteger quem faz a coleta.', 4)
on conflict (id) do update set
  question_id = excluded.question_id, option_text = excluded.option_text, is_correct = excluded.is_correct,
  explanation = excluded.explanation, order_index = excluded.order_index;

-- Quiz: O que significa reutilizar?
insert into public.quizzes (id, lesson_id, title, description, passing_score, xp_reward, improvement_xp_reward, attempts_allowed, active)
values ('30000000-0000-4000-8000-000000000007', '20000000-0000-4000-8000-000000000007', 'Quiz: O que significa reutilizar?', '3 perguntas sobre reutilização.', 60, 30, 0, null, true)
on conflict (id) do update set
  lesson_id = excluded.lesson_id, title = excluded.title, description = excluded.description,
  passing_score = excluded.passing_score, xp_reward = excluded.xp_reward,
  improvement_xp_reward = excluded.improvement_xp_reward, attempts_allowed = excluded.attempts_allowed, active = true;

-- evita conflitos de ordem ao reordenar; perguntas fora do JSON ficam inativas (histórico preservado)
update public.quiz_questions set order_index = -order_index - 1000 where quiz_id = '30000000-0000-4000-8000-000000000007' and order_index >= 0;
update public.quiz_questions set active = false where quiz_id = '30000000-0000-4000-8000-000000000007' and id not in ('31000000-0000-4000-8000-007000000001', '31000000-0000-4000-8000-007000000002', '31000000-0000-4000-8000-007000000003');
insert into public.quiz_questions (id, quiz_id, question, explanation, topic, question_type, order_index, points, active) values
  ('31000000-0000-4000-8000-007000000001', '30000000-0000-4000-8000-000000000007', 'Qual é a diferença entre reutilizar e reciclar?', 'Reutilizar é usar o objeto de novo, sem transformação industrial. Reciclar é transformar o material em matéria-prima.', '🔄 Reutilizar x reciclar', 'single_choice', 1, 1, true),
  ('31000000-0000-4000-8000-007000000002', '30000000-0000-4000-8000-000000000007', 'Qual destas atitudes é um exemplo de reutilização?', 'Doar, consertar e dar nova função a objetos são formas de reutilizar.', '💡 Exemplos', 'single_choice', 2, 1, true),
  ('31000000-0000-4000-8000-007000000003', '30000000-0000-4000-8000-000000000007', 'Por que reutilizar ajuda o ambiente?', 'Cada objeto reutilizado evita a fabricação de um novo, economizando matéria-prima, água e energia, e reduz o lixo.', '🌎 Benefícios', 'single_choice', 3, 1, true)
on conflict (id) do update set
  quiz_id = excluded.quiz_id, question = excluded.question, explanation = excluded.explanation, topic = excluded.topic,
  question_type = excluded.question_type, order_index = excluded.order_index, points = excluded.points, active = true;

update public.quiz_options set is_correct = false, order_index = -order_index - 1000
where question_id in ('31000000-0000-4000-8000-007000000001', '31000000-0000-4000-8000-007000000002', '31000000-0000-4000-8000-007000000003') and order_index >= 0;
insert into public.quiz_options (id, question_id, option_text, is_correct, explanation, order_index) values
  ('32000000-0000-4000-8000-007000001001', '31000000-0000-4000-8000-007000000001', 'São exatamente a mesma coisa', false, 'São diferentes: um usa o objeto de novo, o outro transforma o material.', 1),
  ('32000000-0000-4000-8000-007000001002', '31000000-0000-4000-8000-007000000001', 'Reciclar é jogar fora e reutilizar é comprar de novo', false, 'Nenhum dos dois significa jogar fora ou comprar de novo.', 2),
  ('32000000-0000-4000-8000-007000001003', '31000000-0000-4000-8000-007000000001', 'Reutilizar exige uma fábrica; reciclar não', false, 'É o contrário: quem normalmente precisa de indústria é a reciclagem.', 3),
  ('32000000-0000-4000-8000-007000001004', '31000000-0000-4000-8000-007000000001', 'Reutilizar é usar o objeto de novo; reciclar transforma o material', true, 'Exato.', 4),
  ('32000000-0000-4000-8000-007000002001', '31000000-0000-4000-8000-007000000002', 'Doar roupas que não servem mais', true, 'Isso: a roupa continua sendo usada por outra pessoa.', 1),
  ('32000000-0000-4000-8000-007000002002', '31000000-0000-4000-8000-007000000002', 'Comprar roupas novas toda semana', false, 'Comprar mais aumenta o consumo; reutilizar é aproveitar o que já existe.', 2),
  ('32000000-0000-4000-8000-007000002003', '31000000-0000-4000-8000-007000000002', 'Jogar potes no lixo comum', false, 'Assim o pote não é reutilizado nem reciclado.', 3),
  ('32000000-0000-4000-8000-007000002004', '31000000-0000-4000-8000-007000000002', 'Queimar caixas de papelão', false, 'Queimar polui e desperdiça um material que poderia ter nova função.', 4),
  ('32000000-0000-4000-8000-007000003001', '31000000-0000-4000-8000-007000000003', 'Porque aumenta a quantidade de lixo', false, 'Reutilizar diminui o lixo.', 1),
  ('32000000-0000-4000-8000-007000003002', '31000000-0000-4000-8000-007000000003', 'Porque economiza matéria-prima, água e energia', true, 'Isso: menos fabricação, menos recursos usados.', 2),
  ('32000000-0000-4000-8000-007000003003', '31000000-0000-4000-8000-007000000003', 'Porque gasta mais energia do que fabricar algo novo', false, 'Em geral é o contrário: reutilizar evita a energia gasta na fabricação.', 3),
  ('32000000-0000-4000-8000-007000003004', '31000000-0000-4000-8000-007000000003', 'Não faz diferença para o ambiente', false, 'Faz diferença, sim: menos consumo e menos lixo.', 4)
on conflict (id) do update set
  question_id = excluded.question_id, option_text = excluded.option_text, is_correct = excluded.is_correct,
  explanation = excluded.explanation, order_index = excluded.order_index;

-- Quiz: Por que economizar energia?
insert into public.quizzes (id, lesson_id, title, description, passing_score, xp_reward, improvement_xp_reward, attempts_allowed, active)
values ('30000000-0000-4000-8000-000000000008', '20000000-0000-4000-8000-000000000008', 'Quiz: Por que economizar energia?', '3 perguntas sobre impacto e consumo de energia.', 60, 30, 0, null, true)
on conflict (id) do update set
  lesson_id = excluded.lesson_id, title = excluded.title, description = excluded.description,
  passing_score = excluded.passing_score, xp_reward = excluded.xp_reward,
  improvement_xp_reward = excluded.improvement_xp_reward, attempts_allowed = excluded.attempts_allowed, active = true;

-- evita conflitos de ordem ao reordenar; perguntas fora do JSON ficam inativas (histórico preservado)
update public.quiz_questions set order_index = -order_index - 1000 where quiz_id = '30000000-0000-4000-8000-000000000008' and order_index >= 0;
update public.quiz_questions set active = false where quiz_id = '30000000-0000-4000-8000-000000000008' and id not in ('31000000-0000-4000-8000-008000000001', '31000000-0000-4000-8000-008000000002', '31000000-0000-4000-8000-008000000003');
insert into public.quiz_questions (id, quiz_id, question, explanation, topic, question_type, order_index, points, active) values
  ('31000000-0000-4000-8000-008000000001', '30000000-0000-4000-8000-000000000008', 'Por que gerar eletricidade causa impactos ambientais?', 'Toda forma de geração tem algum impacto: hidrelétricas alagam áreas, termelétricas queimam combustíveis, e até eólicas e solares usam recursos.', '⚡ Impactos', 'single_choice', 1, 1, true),
  ('31000000-0000-4000-8000-008000000002', '30000000-0000-4000-8000-000000000008', 'Qual tipo de lâmpada gasta menos energia para iluminar o mesmo ambiente?', 'Lâmpadas de LED gastam bem menos energia do que as incandescentes para produzir a mesma iluminação.', '💡 Iluminação', 'single_choice', 2, 1, true),
  ('31000000-0000-4000-8000-008000000003', '30000000-0000-4000-8000-000000000008', 'Qual destas atitudes economiza energia em casa?', 'Apagar luzes, tirar carregadores da tomada e não deixar a geladeira aberta são atitudes simples de economia.', '👣 Atitudes', 'single_choice', 3, 1, true)
on conflict (id) do update set
  quiz_id = excluded.quiz_id, question = excluded.question, explanation = excluded.explanation, topic = excluded.topic,
  question_type = excluded.question_type, order_index = excluded.order_index, points = excluded.points, active = true;

update public.quiz_options set is_correct = false, order_index = -order_index - 1000
where question_id in ('31000000-0000-4000-8000-008000000001', '31000000-0000-4000-8000-008000000002', '31000000-0000-4000-8000-008000000003') and order_index >= 0;
insert into public.quiz_options (id, question_id, option_text, is_correct, explanation, order_index) values
  ('32000000-0000-4000-8000-008000001001', '31000000-0000-4000-8000-008000000001', 'Porque toda forma de geração tem algum impacto', true, 'Isso: por isso a energia mais limpa é a que não é desperdiçada.', 1),
  ('32000000-0000-4000-8000-008000001002', '31000000-0000-4000-8000-008000000001', 'Porque só as usinas solares causam impacto', false, 'Todas as formas de geração têm algum impacto, não só a solar.', 2),
  ('32000000-0000-4000-8000-008000001003', '31000000-0000-4000-8000-008000000001', 'Porque a eletricidade não causa impacto nenhum', false, 'Toda geração de energia causa algum impacto.', 3),
  ('32000000-0000-4000-8000-008000001004', '31000000-0000-4000-8000-008000000001', 'Porque a eletricidade só causa impacto à noite', false, 'O impacto está na geração, a qualquer hora.', 4),
  ('32000000-0000-4000-8000-008000002001', '31000000-0000-4000-8000-008000000002', 'Incandescente', false, 'A incandescente transforma boa parte da energia em calor, não em luz.', 1),
  ('32000000-0000-4000-8000-008000002002', '31000000-0000-4000-8000-008000000002', 'Todas gastam a mesma energia', false, 'Há grande diferença de consumo entre os tipos de lâmpada.', 2),
  ('32000000-0000-4000-8000-008000002003', '31000000-0000-4000-8000-008000000002', 'LED', true, 'Isso: o LED ilumina gastando bem menos energia.', 3),
  ('32000000-0000-4000-8000-008000002004', '31000000-0000-4000-8000-008000000002', 'Qualquer lâmpada acesa durante o dia', false, 'Durante o dia, o melhor é aproveitar a luz natural.', 4),
  ('32000000-0000-4000-8000-008000003001', '31000000-0000-4000-8000-008000000003', 'Deixar carregadores sempre na tomada', false, 'Aparelhos na tomada podem continuar consumindo um pouco de energia.', 1),
  ('32000000-0000-4000-8000-008000003002', '31000000-0000-4000-8000-008000000003', 'Abrir a geladeira várias vezes sem necessidade', false, 'Cada abertura faz a geladeira gastar mais para esfriar de novo.', 2),
  ('32000000-0000-4000-8000-008000003003', '31000000-0000-4000-8000-008000000003', 'Tomar banhos bem longos no chuveiro elétrico', false, 'O chuveiro elétrico é um dos aparelhos que mais consomem energia.', 3),
  ('32000000-0000-4000-8000-008000003004', '31000000-0000-4000-8000-008000000003', 'Apagar a luz ao sair do cômodo', true, 'Isso: um hábito simples que economiza todos os dias.', 4)
on conflict (id) do update set
  question_id = excluded.question_id, option_text = excluded.option_text, is_correct = excluded.is_correct,
  explanation = excluded.explanation, order_index = excluded.order_index;

-- Quiz: O que são fontes renováveis?
insert into public.quizzes (id, lesson_id, title, description, passing_score, xp_reward, improvement_xp_reward, attempts_allowed, active)
values ('30000000-0000-4000-8000-000000000009', '20000000-0000-4000-8000-000000000009', 'Quiz: O que são fontes renováveis?', '3 perguntas sobre fontes de energia.', 60, 30, 0, null, true)
on conflict (id) do update set
  lesson_id = excluded.lesson_id, title = excluded.title, description = excluded.description,
  passing_score = excluded.passing_score, xp_reward = excluded.xp_reward,
  improvement_xp_reward = excluded.improvement_xp_reward, attempts_allowed = excluded.attempts_allowed, active = true;

-- evita conflitos de ordem ao reordenar; perguntas fora do JSON ficam inativas (histórico preservado)
update public.quiz_questions set order_index = -order_index - 1000 where quiz_id = '30000000-0000-4000-8000-000000000009' and order_index >= 0;
update public.quiz_questions set active = false where quiz_id = '30000000-0000-4000-8000-000000000009' and id not in ('31000000-0000-4000-8000-009000000001', '31000000-0000-4000-8000-009000000002', '31000000-0000-4000-8000-009000000003');
insert into public.quiz_questions (id, quiz_id, question, explanation, topic, question_type, order_index, points, active) values
  ('31000000-0000-4000-8000-009000000001', '30000000-0000-4000-8000-000000000009', 'O que caracteriza uma fonte de energia renovável?', 'Fontes renováveis se renovam naturalmente, como a luz do sol, o vento, o movimento da água e a biomassa.', '🔋 Fontes renováveis', 'single_choice', 1, 1, true),
  ('31000000-0000-4000-8000-009000000002', '30000000-0000-4000-8000-000000000009', 'Qual destas fontes é NÃO renovável?', 'Gás natural, petróleo e carvão são combustíveis fósseis: existem em quantidade limitada e liberam gases de efeito estufa quando queimados.', '🛢️ Não renováveis', 'single_choice', 2, 1, true),
  ('31000000-0000-4000-8000-009000000003', '30000000-0000-4000-8000-000000000009', 'Por que ainda é importante economizar energia vinda de fontes renováveis?', 'Nenhuma fonte é livre de impactos: hidrelétricas alagam áreas, parques eólicos mudam a paisagem, painéis precisam de materiais.', '⚖️ Impactos', 'single_choice', 3, 1, true)
on conflict (id) do update set
  quiz_id = excluded.quiz_id, question = excluded.question, explanation = excluded.explanation, topic = excluded.topic,
  question_type = excluded.question_type, order_index = excluded.order_index, points = excluded.points, active = true;

update public.quiz_options set is_correct = false, order_index = -order_index - 1000
where question_id in ('31000000-0000-4000-8000-009000000001', '31000000-0000-4000-8000-009000000002', '31000000-0000-4000-8000-009000000003') and order_index >= 0;
insert into public.quiz_options (id, question_id, option_text, is_correct, explanation, order_index) values
  ('32000000-0000-4000-8000-009000001001', '31000000-0000-4000-8000-009000000001', 'Ela se renova naturalmente, como o sol e o vento', true, 'Isso mesmo.', 1),
  ('32000000-0000-4000-8000-009000001002', '31000000-0000-4000-8000-009000000001', 'Ela existe em quantidade limitada e pode acabar', false, 'Essa é a característica das fontes não renováveis.', 2),
  ('32000000-0000-4000-8000-009000001003', '31000000-0000-4000-8000-009000000001', 'Ela só funciona durante a noite', false, 'Ser renovável não tem a ver com horário de funcionamento.', 3),
  ('32000000-0000-4000-8000-009000001004', '31000000-0000-4000-8000-009000000001', 'Ela sempre vem do petróleo', false, 'O petróleo é um combustível fóssil, não renovável.', 4),
  ('32000000-0000-4000-8000-009000002001', '31000000-0000-4000-8000-009000000002', 'Solar', false, 'A luz do sol se renova todos os dias.', 1),
  ('32000000-0000-4000-8000-009000002002', '31000000-0000-4000-8000-009000000002', 'Eólica', false, 'O vento é uma fonte renovável.', 2),
  ('32000000-0000-4000-8000-009000002003', '31000000-0000-4000-8000-009000000002', 'Biomassa', false, 'Biomassa, como o bagaço de cana, é considerada renovável.', 3),
  ('32000000-0000-4000-8000-009000002004', '31000000-0000-4000-8000-009000000002', 'Gás natural', true, 'Isso: é um combustível fóssil, portanto não renovável.', 4),
  ('32000000-0000-4000-8000-009000003001', '31000000-0000-4000-8000-009000000003', 'Porque renováveis poluem mais do que o carvão', false, 'Em geral, renováveis emitem bem menos do que o carvão.', 1),
  ('32000000-0000-4000-8000-009000003002', '31000000-0000-4000-8000-009000000003', 'Porque nenhuma fonte de energia é livre de impactos', true, 'Exato: a energia mais limpa é a que não é desperdiçada.', 2),
  ('32000000-0000-4000-8000-009000003003', '31000000-0000-4000-8000-009000000003', 'Porque as fontes renováveis vão acabar em breve', false, 'Elas se renovam — o motivo é o impacto que toda geração causa.', 3),
  ('32000000-0000-4000-8000-009000003004', '31000000-0000-4000-8000-009000000003', 'Não é importante economizar', false, 'É importante: toda geração tem algum impacto.', 4)
on conflict (id) do update set
  question_id = excluded.question_id, option_text = excluded.option_text, is_correct = excluded.is_correct,
  explanation = excluded.explanation, order_index = excluded.order_index;

-- Quiz: O que é biodiversidade?
insert into public.quizzes (id, lesson_id, title, description, passing_score, xp_reward, improvement_xp_reward, attempts_allowed, active)
values ('30000000-0000-4000-8000-000000000010', '20000000-0000-4000-8000-000000000010', 'Quiz: O que é biodiversidade?', '3 perguntas sobre a variedade da vida.', 60, 30, 0, null, true)
on conflict (id) do update set
  lesson_id = excluded.lesson_id, title = excluded.title, description = excluded.description,
  passing_score = excluded.passing_score, xp_reward = excluded.xp_reward,
  improvement_xp_reward = excluded.improvement_xp_reward, attempts_allowed = excluded.attempts_allowed, active = true;

-- evita conflitos de ordem ao reordenar; perguntas fora do JSON ficam inativas (histórico preservado)
update public.quiz_questions set order_index = -order_index - 1000 where quiz_id = '30000000-0000-4000-8000-000000000010' and order_index >= 0;
update public.quiz_questions set active = false where quiz_id = '30000000-0000-4000-8000-000000000010' and id not in ('31000000-0000-4000-8000-010000000001', '31000000-0000-4000-8000-010000000002', '31000000-0000-4000-8000-010000000003');
insert into public.quiz_questions (id, quiz_id, question, explanation, topic, question_type, order_index, points, active) values
  ('31000000-0000-4000-8000-010000000001', '30000000-0000-4000-8000-000000000010', 'O que é biodiversidade?', 'Biodiversidade é a variedade de vida: diversidade de espécies, diversidade genética e diversidade de ecossistemas.', '🦋 Biodiversidade', 'single_choice', 1, 1, true),
  ('31000000-0000-4000-8000-010000000002', '30000000-0000-4000-8000-000000000010', 'O que pode acontecer quando uma espécie desaparece de um ecossistema?', 'Os seres vivos dependem uns dos outros. Quando uma espécie desaparece, outras que dependiam dela podem ser afetadas.', '🕸️ Conexões', 'single_choice', 2, 1, true),
  ('31000000-0000-4000-8000-010000000003', '30000000-0000-4000-8000-000000000010', 'Qual destas é uma ameaça à biodiversidade?', 'Destruição de habitats, poluição e espécies invasoras estão entre as principais ameaças.', '🛡️ Ameaças', 'single_choice', 3, 1, true)
on conflict (id) do update set
  quiz_id = excluded.quiz_id, question = excluded.question, explanation = excluded.explanation, topic = excluded.topic,
  question_type = excluded.question_type, order_index = excluded.order_index, points = excluded.points, active = true;

update public.quiz_options set is_correct = false, order_index = -order_index - 1000
where question_id in ('31000000-0000-4000-8000-010000000001', '31000000-0000-4000-8000-010000000002', '31000000-0000-4000-8000-010000000003') and order_index >= 0;
insert into public.quiz_options (id, question_id, option_text, is_correct, explanation, order_index) values
  ('32000000-0000-4000-8000-010000001001', '31000000-0000-4000-8000-010000000001', 'Apenas o número de árvores de uma cidade', false, 'Biodiversidade inclui todos os seres vivos, não só árvores.', 1),
  ('32000000-0000-4000-8000-010000001002', '31000000-0000-4000-8000-010000000001', 'Somente os animais ameaçados de extinção', false, 'Ela inclui todas as formas de vida, ameaçadas ou não.', 2),
  ('32000000-0000-4000-8000-010000001003', '31000000-0000-4000-8000-010000000001', 'A variedade de vida: espécies, genes e ecossistemas', true, 'Isso mesmo.', 3),
  ('32000000-0000-4000-8000-010000001004', '31000000-0000-4000-8000-010000000001', 'Os tipos de rochas de uma região', false, 'Rochas não são seres vivos. Biodiversidade é a variedade da vida.', 4),
  ('32000000-0000-4000-8000-010000002001', '31000000-0000-4000-8000-010000000002', 'Outras espécies podem ser afetadas', true, 'Isso: na natureza tudo está conectado.', 1),
  ('32000000-0000-4000-8000-010000002002', '31000000-0000-4000-8000-010000000002', 'Nada muda no ecossistema', false, 'As relações entre espécies fazem com que a perda de uma afete outras.', 2),
  ('32000000-0000-4000-8000-010000002003', '31000000-0000-4000-8000-010000000002', 'O ecossistema sempre fica mais forte', false, 'Perder espécies costuma deixar o ecossistema mais frágil.', 3),
  ('32000000-0000-4000-8000-010000002004', '31000000-0000-4000-8000-010000000002', 'As outras espécies passam a viver para sempre', false, 'Não há relação desse tipo. O mais comum é outras espécies serem prejudicadas.', 4),
  ('32000000-0000-4000-8000-010000003001', '31000000-0000-4000-8000-010000000003', 'Proteger a vegetação nativa', false, 'Proteger a vegetação nativa é uma forma de conservar a biodiversidade.', 1),
  ('32000000-0000-4000-8000-010000003002', '31000000-0000-4000-8000-010000000003', 'Criar áreas protegidas', false, 'Áreas protegidas ajudam a conservar espécies.', 2),
  ('32000000-0000-4000-8000-010000003003', '31000000-0000-4000-8000-010000000003', 'Destruir habitats naturais', true, 'Isso: sem habitat, muitas espécies não sobrevivem.', 3),
  ('32000000-0000-4000-8000-010000003004', '31000000-0000-4000-8000-010000000003', 'Plantar espécies nativas', false, 'Plantar nativas ajuda a biodiversidade local.', 4)
on conflict (id) do update set
  question_id = excluded.question_id, option_text = excluded.option_text, is_correct = excluded.is_correct,
  explanation = excluded.explanation, order_index = excluded.order_index;

-- Quiz: Por que os polinizadores são importantes?
insert into public.quizzes (id, lesson_id, title, description, passing_score, xp_reward, improvement_xp_reward, attempts_allowed, active)
values ('30000000-0000-4000-8000-000000000011', '20000000-0000-4000-8000-000000000011', 'Quiz: Por que os polinizadores são importantes?', '3 perguntas sobre polinização e polinizadores.', 60, 30, 0, null, true)
on conflict (id) do update set
  lesson_id = excluded.lesson_id, title = excluded.title, description = excluded.description,
  passing_score = excluded.passing_score, xp_reward = excluded.xp_reward,
  improvement_xp_reward = excluded.improvement_xp_reward, attempts_allowed = excluded.attempts_allowed, active = true;

-- evita conflitos de ordem ao reordenar; perguntas fora do JSON ficam inativas (histórico preservado)
update public.quiz_questions set order_index = -order_index - 1000 where quiz_id = '30000000-0000-4000-8000-000000000011' and order_index >= 0;
update public.quiz_questions set active = false where quiz_id = '30000000-0000-4000-8000-000000000011' and id not in ('31000000-0000-4000-8000-011000000001', '31000000-0000-4000-8000-011000000002', '31000000-0000-4000-8000-011000000003');
insert into public.quiz_questions (id, quiz_id, question, explanation, topic, question_type, order_index, points, active) values
  ('31000000-0000-4000-8000-011000000001', '30000000-0000-4000-8000-000000000011', 'O que é polinização?', 'Polinização é o transporte de pólen de uma flor para outra, o que permite a formação de frutos e sementes.', '🌸 Polinização', 'single_choice', 1, 1, true),
  ('31000000-0000-4000-8000-011000000002', '30000000-0000-4000-8000-000000000011', 'Qual destes animais pode atuar como polinizador?', 'Abelhas, borboletas, besouros, beija-flores e morcegos estão entre os polinizadores.', '🐝 Polinizadores', 'single_choice', 2, 1, true),
  ('31000000-0000-4000-8000-011000000003', '30000000-0000-4000-8000-000000000011', 'Como podemos ajudar os polinizadores?', 'Plantar flores variadas e evitar agrotóxicos no jardim oferece alimento e reduz ameaças aos polinizadores.', '🌼 Como ajudar', 'single_choice', 3, 1, true)
on conflict (id) do update set
  quiz_id = excluded.quiz_id, question = excluded.question, explanation = excluded.explanation, topic = excluded.topic,
  question_type = excluded.question_type, order_index = excluded.order_index, points = excluded.points, active = true;

update public.quiz_options set is_correct = false, order_index = -order_index - 1000
where question_id in ('31000000-0000-4000-8000-011000000001', '31000000-0000-4000-8000-011000000002', '31000000-0000-4000-8000-011000000003') and order_index >= 0;
insert into public.quiz_options (id, question_id, option_text, is_correct, explanation, order_index) values
  ('32000000-0000-4000-8000-011000001001', '31000000-0000-4000-8000-011000000001', 'A queda das folhas no outono', false, 'Queda de folhas é outro processo. Polinização envolve o pólen das flores.', 1),
  ('32000000-0000-4000-8000-011000001002', '31000000-0000-4000-8000-011000000001', 'O transporte de pólen entre flores, que permite frutos e sementes', true, 'Isso mesmo.', 2),
  ('32000000-0000-4000-8000-011000001003', '31000000-0000-4000-8000-011000000001', 'A produção de mel pelas abelhas', false, 'O mel é produzido pelas abelhas, mas polinização é o transporte de pólen.', 3),
  ('32000000-0000-4000-8000-011000001004', '31000000-0000-4000-8000-011000000001', 'A rega das plantas pela chuva', false, 'A chuva rega as plantas; polinização é o transporte de pólen.', 4),
  ('32000000-0000-4000-8000-011000002001', '31000000-0000-4000-8000-011000000002', 'Minhoca', false, 'Minhocas ajudam o solo, mas não visitam flores para transportar pólen.', 1),
  ('32000000-0000-4000-8000-011000002002', '31000000-0000-4000-8000-011000000002', 'Peixe', false, 'Peixes não costumam visitar flores.', 2),
  ('32000000-0000-4000-8000-011000002003', '31000000-0000-4000-8000-011000000002', 'Tartaruga', false, 'Tartarugas não são conhecidas como polinizadoras.', 3),
  ('32000000-0000-4000-8000-011000002004', '31000000-0000-4000-8000-011000000002', 'Beija-flor', true, 'Isso: ao buscar néctar, o beija-flor leva pólen de flor em flor.', 4),
  ('32000000-0000-4000-8000-011000003001', '31000000-0000-4000-8000-011000000003', 'Plantando flores variadas e evitando agrotóxicos', true, 'Isso: alimento disponível e menos veneno ajudam muito.', 1),
  ('32000000-0000-4000-8000-011000003002', '31000000-0000-4000-8000-011000000003', 'Usando mais agrotóxicos no jardim', false, 'Agrotóxicos estão entre as ameaças aos polinizadores.', 2),
  ('32000000-0000-4000-8000-011000003003', '31000000-0000-4000-8000-011000000003', 'Retirando as flores do jardim', false, 'Sem flores, os polinizadores ficam sem alimento.', 3),
  ('32000000-0000-4000-8000-011000003004', '31000000-0000-4000-8000-011000000003', 'Removendo ninhos de abelhas nativas', false, 'Abelhas nativas sem ferrão são importantes polinizadoras e devem ser protegidas.', 4)
on conflict (id) do update set
  question_id = excluded.question_id, option_text = excluded.option_text, is_correct = excluded.is_correct,
  explanation = excluded.explanation, order_index = excluded.order_index;

-- Quiz: O que é uma ação ambiental comunitária?
insert into public.quizzes (id, lesson_id, title, description, passing_score, xp_reward, improvement_xp_reward, attempts_allowed, active)
values ('30000000-0000-4000-8000-000000000012', '20000000-0000-4000-8000-000000000012', 'Quiz: O que é uma ação ambiental comunitária?', '3 perguntas sobre ações coletivas.', 60, 30, 0, null, true)
on conflict (id) do update set
  lesson_id = excluded.lesson_id, title = excluded.title, description = excluded.description,
  passing_score = excluded.passing_score, xp_reward = excluded.xp_reward,
  improvement_xp_reward = excluded.improvement_xp_reward, attempts_allowed = excluded.attempts_allowed, active = true;

-- evita conflitos de ordem ao reordenar; perguntas fora do JSON ficam inativas (histórico preservado)
update public.quiz_questions set order_index = -order_index - 1000 where quiz_id = '30000000-0000-4000-8000-000000000012' and order_index >= 0;
update public.quiz_questions set active = false where quiz_id = '30000000-0000-4000-8000-000000000012' and id not in ('31000000-0000-4000-8000-012000000001', '31000000-0000-4000-8000-012000000002', '31000000-0000-4000-8000-012000000003');
insert into public.quiz_questions (id, quiz_id, question, explanation, topic, question_type, order_index, points, active) values
  ('31000000-0000-4000-8000-012000000001', '30000000-0000-4000-8000-000000000012', 'O que é uma ação ambiental comunitária?', 'É quando um grupo de pessoas se organiza para cuidar do ambiente onde vive, como em mutirões, hortas comunitárias ou plantios.', '🤝 Ação comunitária', 'single_choice', 1, 1, true),
  ('31000000-0000-4000-8000-012000000002', '30000000-0000-4000-8000-000000000012', 'Qual costuma ser o primeiro passo de uma ação comunitária?', 'Tudo começa identificando um problema e conversando com as pessoas envolvidas. Depois vêm o planejamento e os materiais.', '🗺️ Planejamento', 'single_choice', 2, 1, true),
  ('31000000-0000-4000-8000-012000000003', '30000000-0000-4000-8000-000000000012', 'Qual cuidado de segurança é importante em um mutirão de limpeza?', 'Use luvas, não recolha objetos cortantes ou perigosos com as mãos e mantenha crianças sempre acompanhadas de adultos.', '🧤 Segurança', 'single_choice', 3, 1, true)
on conflict (id) do update set
  quiz_id = excluded.quiz_id, question = excluded.question, explanation = excluded.explanation, topic = excluded.topic,
  question_type = excluded.question_type, order_index = excluded.order_index, points = excluded.points, active = true;

update public.quiz_options set is_correct = false, order_index = -order_index - 1000
where question_id in ('31000000-0000-4000-8000-012000000001', '31000000-0000-4000-8000-012000000002', '31000000-0000-4000-8000-012000000003') and order_index >= 0;
insert into public.quiz_options (id, question_id, option_text, is_correct, explanation, order_index) values
  ('32000000-0000-4000-8000-012000001001', '31000000-0000-4000-8000-012000000001', 'Uma ação feita por uma pessoa sozinha, sem avisar ninguém', false, 'Ação comunitária envolve pessoas se organizando juntas.', 1),
  ('32000000-0000-4000-8000-012000001002', '31000000-0000-4000-8000-012000000001', 'Um grupo de pessoas organizado para cuidar do ambiente onde vive', true, 'Isso mesmo.', 2),
  ('32000000-0000-4000-8000-012000001003', '31000000-0000-4000-8000-012000000001', 'A compra de produtos ecológicos', false, 'Comprar produtos é uma escolha individual, não uma ação comunitária.', 3),
  ('32000000-0000-4000-8000-012000001004', '31000000-0000-4000-8000-012000000001', 'Algo que só o governo pode fazer', false, 'A comunidade também pode se organizar e agir.', 4),
  ('32000000-0000-4000-8000-012000002001', '31000000-0000-4000-8000-012000000002', 'Comprar os materiais', false, 'Materiais vêm depois de saber o que será feito e com quem.', 1),
  ('32000000-0000-4000-8000-012000002002', '31000000-0000-4000-8000-012000000002', 'Começar sem nenhum planejamento', false, 'Sem planejar, a ação pode não ser segura nem se manter.', 2),
  ('32000000-0000-4000-8000-012000002003', '31000000-0000-4000-8000-012000000002', 'Esperar que outras pessoas façam', false, 'Esperar não inicia a mudança.', 3),
  ('32000000-0000-4000-8000-012000002004', '31000000-0000-4000-8000-012000000002', 'Identificar o problema e conversar com as pessoas', true, 'Isso: a ação nasce do diálogo sobre um problema comum.', 4),
  ('32000000-0000-4000-8000-012000003001', '31000000-0000-4000-8000-012000000003', 'Recolher vidro quebrado com as mãos', false, 'Objetos cortantes nunca devem ser recolhidos com as mãos.', 1),
  ('32000000-0000-4000-8000-012000003002', '31000000-0000-4000-8000-012000000003', 'Usar luvas e não pegar objetos cortantes com as mãos', true, 'Isso: segurança em primeiro lugar.', 2),
  ('32000000-0000-4000-8000-012000003003', '31000000-0000-4000-8000-012000000003', 'Deixar crianças trabalhando sozinhas', false, 'Crianças devem estar sempre acompanhadas de adultos.', 3),
  ('32000000-0000-4000-8000-012000003004', '31000000-0000-4000-8000-012000000003', 'Dispensar as luvas para trabalhar mais rápido', false, 'Luvas protegem contra cortes e contaminação.', 4)
on conflict (id) do update set
  question_id = excluded.question_id, option_text = excluded.option_text, is_correct = excluded.is_correct,
  explanation = excluded.explanation, order_index = excluded.order_index;

-- Quiz: A vaca e os derivados do leite
insert into public.quizzes (id, lesson_id, title, description, passing_score, xp_reward, improvement_xp_reward, attempts_allowed, active)
values ('30000000-0000-4000-8000-000000000013', '20000000-0000-4000-8000-000000000013', 'Quiz: A vaca e os derivados do leite', '4 perguntas sobre vacas, leite, derivados e cuidado com os animais.', 70, 30, 0, null, true)
on conflict (id) do update set
  lesson_id = excluded.lesson_id, title = excluded.title, description = excluded.description,
  passing_score = excluded.passing_score, xp_reward = excluded.xp_reward,
  improvement_xp_reward = excluded.improvement_xp_reward, attempts_allowed = excluded.attempts_allowed, active = true;

-- evita conflitos de ordem ao reordenar; perguntas fora do JSON ficam inativas (histórico preservado)
update public.quiz_questions set order_index = -order_index - 1000 where quiz_id = '30000000-0000-4000-8000-000000000013' and order_index >= 0;
update public.quiz_questions set active = false where quiz_id = '30000000-0000-4000-8000-000000000013' and id not in ('31000000-0000-4000-8000-013000000001', '31000000-0000-4000-8000-013000000002', '31000000-0000-4000-8000-013000000003', '31000000-0000-4000-8000-013000000004');
insert into public.quiz_questions (id, quiz_id, question, explanation, topic, question_type, order_index, points, active) values
  ('31000000-0000-4000-8000-013000000001', '30000000-0000-4000-8000-000000000013', 'O que é importante para uma vaca viver bem?', 'Vacas precisam de água, alimento, espaço, abrigo e cuidados responsáveis.', '🐄 Animais', 'single_choice', 1, 1, true),
  ('31000000-0000-4000-8000-013000000002', '30000000-0000-4000-8000-000000000013', 'Qual alimento pode ser feito a partir do leite?', 'Queijo é um derivado do leite.', '🥛 Leite', 'single_choice', 2, 1, true),
  ('31000000-0000-4000-8000-013000000003', '30000000-0000-4000-8000-000000000013', 'Qual opção apresenta apenas derivados do leite?', 'Queijo, iogurte e manteiga podem ser produzidos a partir do leite.', '🧀 Derivados', 'single_choice', 3, 1, true),
  ('31000000-0000-4000-8000-013000000004', '30000000-0000-4000-8000-000000000013', 'Como uma criança deve agir perto de uma vaca desconhecida?', 'A criança deve observar à distância e pedir orientação a um adulto.', '💚 Cuidado', 'single_choice', 4, 1, true)
on conflict (id) do update set
  quiz_id = excluded.quiz_id, question = excluded.question, explanation = excluded.explanation, topic = excluded.topic,
  question_type = excluded.question_type, order_index = excluded.order_index, points = excluded.points, active = true;

update public.quiz_options set is_correct = false, order_index = -order_index - 1000
where question_id in ('31000000-0000-4000-8000-013000000001', '31000000-0000-4000-8000-013000000002', '31000000-0000-4000-8000-013000000003', '31000000-0000-4000-8000-013000000004') and order_index >= 0;
insert into public.quiz_options (id, question_id, option_text, is_correct, explanation, order_index) values
  ('32000000-0000-4000-8000-013000001001', '31000000-0000-4000-8000-013000000001', 'Água, alimento, espaço e cuidado', true, 'Correto! Todo animal precisa de cuidados e condições adequadas.', 1),
  ('32000000-0000-4000-8000-013000001002', '31000000-0000-4000-8000-013000000001', 'Ficar sempre sozinha e sem água', false, 'Animais precisam de água, alimento e condições adequadas.', 2),
  ('32000000-0000-4000-8000-013000001003', '31000000-0000-4000-8000-013000000001', 'Comer apenas doces', false, 'Doces não substituem a alimentação adequada do animal.', 3),
  ('32000000-0000-4000-8000-013000001004', '31000000-0000-4000-8000-013000000001', 'Viver sem descanso', false, 'Descanso também faz parte do cuidado com os animais.', 4),
  ('32000000-0000-4000-8000-013000002001', '31000000-0000-4000-8000-013000000002', 'Queijo', true, 'Isso! Queijo é um derivado do leite.', 1),
  ('32000000-0000-4000-8000-013000002002', '31000000-0000-4000-8000-013000000002', 'Cenoura', false, 'Cenoura é uma raiz, não um derivado do leite.', 2),
  ('32000000-0000-4000-8000-013000002003', '31000000-0000-4000-8000-013000000002', 'Arroz', false, 'Arroz é um grão, não um derivado do leite.', 3),
  ('32000000-0000-4000-8000-013000002004', '31000000-0000-4000-8000-013000000002', 'Maçã', false, 'Maçã é uma fruta, não um derivado do leite.', 4),
  ('32000000-0000-4000-8000-013000003001', '31000000-0000-4000-8000-013000000003', 'Queijo, iogurte e manteiga', true, 'Correto! Os três são derivados do leite.', 1),
  ('32000000-0000-4000-8000-013000003002', '31000000-0000-4000-8000-013000000003', 'Banana, maçã e pera', false, 'Esses alimentos são frutas.', 2),
  ('32000000-0000-4000-8000-013000003003', '31000000-0000-4000-8000-013000000003', 'Arroz, feijão e milho', false, 'Esses alimentos são grãos ou sementes.', 3),
  ('32000000-0000-4000-8000-013000003004', '31000000-0000-4000-8000-013000000003', 'Cenoura, batata e mandioca', false, 'Esses alimentos são raízes ou tubérculos.', 4),
  ('32000000-0000-4000-8000-013000004001', '31000000-0000-4000-8000-013000000004', 'Observar e pedir ajuda a um adulto', true, 'Isso! Segurança e respeito vêm primeiro.', 1),
  ('32000000-0000-4000-8000-013000004002', '31000000-0000-4000-8000-013000000004', 'Correr atrás dela', false, 'Correr atrás pode assustar o animal e causar acidentes.', 2),
  ('32000000-0000-4000-8000-013000004003', '31000000-0000-4000-8000-013000000004', 'Oferecer qualquer comida', false, 'Nunca alimente um animal sem autorização de um adulto responsável.', 3),
  ('32000000-0000-4000-8000-013000004004', '31000000-0000-4000-8000-013000000004', 'Entrar sozinho no cercado', false, 'Crianças não devem entrar sozinhas em cercados.', 4)
on conflict (id) do update set
  question_id = excluded.question_id, option_text = excluded.option_text, is_correct = excluded.is_correct,
  explanation = excluded.explanation, order_index = excluded.order_index;
