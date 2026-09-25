-- =====================================================================
-- 13 · Dados iniciais (seed)
-- =====================================================================
-- IDs fixos tornam o seed idempotente (on conflict do nothing) e fáceis
-- de referenciar em testes. Prefixos: 1=categoria 2=aula 3=quiz
-- 4=desafio 5=nível 6=conquista 7=item do mundo.

-- ---------------------------------------------------------------------
-- Categorias
-- ---------------------------------------------------------------------
insert into public.categories (id, name, slug, description, icon, color, topics, order_index) values
  ('10000000-0000-4000-8000-000000000001', 'Natureza', 'natureza',
   'Árvores, plantas e o solo que sustenta a vida.', '🌳', '#3f7f4c',
   array['Árvores', 'Flores', 'Plantas', 'Solo', 'Florestas', 'Hortas'], 1),
  ('10000000-0000-4000-8000-000000000002', 'Água', 'agua',
   'Cuidar de cada gota, dos rios à torneira de casa.', '💧', '#2f7fae',
   array['Economia de água', 'Reutilização', 'Chuva', 'Rios', 'Preservação'], 2),
  ('10000000-0000-4000-8000-000000000003', 'Resíduos', 'residuos',
   'Reduzir, reutilizar e dar o destino certo ao lixo.', '♻️', '#5f8a3a',
   array['Reciclagem', 'Reutilização', 'Compostagem', 'Redução de resíduos', 'Plásticos'], 3),
  ('10000000-0000-4000-8000-000000000004', 'Energia', 'energia',
   'Usar energia com consciência e conhecer fontes limpas.', '⚡', '#d0921f',
   array['Economia de energia', 'Consumo consciente', 'Energia solar', 'Fontes renováveis'], 4),
  ('10000000-0000-4000-8000-000000000005', 'Biodiversidade', 'biodiversidade',
   'A enorme variedade de vida que compartilha o planeta.', '🐝', '#b7791f',
   array['Abelhas', 'Borboletas', 'Aves', 'Insetos', 'Animais', 'Ecossistemas'], 5),
  ('10000000-0000-4000-8000-000000000006', 'Comunidade', 'comunidade',
   'Transformações que acontecem quando agimos juntos.', '🌎', '#3b6fa0',
   array['Limpeza', 'Hortas comunitárias', 'Projetos ambientais', 'Educação ambiental', 'Ações coletivas'], 6)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Conteúdo: "Por que as árvores são importantes?"
-- ---------------------------------------------------------------------
insert into public.lessons (id, category_id, topic, title, slug, description, content,
                            difficulty, estimated_minutes, xp_reward, order_index) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Árvores',
   'Por que as árvores são importantes?', 'por-que-as-arvores-sao-importantes',
   'Por que as árvores são essenciais e como plantar do jeito certo.',
   'Uma aula curta sobre a importância das árvores, os ecossistemas, a escolha da espécie, o local de plantio e os cuidados básicos.',
   'facil', 4, 50, 1)
on conflict (id) do nothing;

insert into public.lesson_sections (id, lesson_id, section_type, icon, title, content, order_index) values
  ('21000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'content', '🌳',
   'Por que as árvores importam?',
   'Pela fotossíntese, as árvores absorvem gás carbônico (CO₂) e liberam oxigênio. Elas também fazem sombra, refrescam o ambiente e ajudam a água da chuva a penetrar no solo.
- Absorvem CO₂ e liberam oxigênio
- Fazem sombra e reduzem o calor
- Protegem o solo contra a erosão', 1),
  ('21000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 'content', '🐦',
   'Uma casa para muitas vidas',
   'Uma árvore é um pequeno ecossistema. Seus frutos, flores e folhas alimentam aves, insetos e outros animais, e seus galhos e troncos servem de abrigo. As folhas que caem viram adubo e alimentam o solo.
- Alimento: frutos, flores e néctar
- Abrigo para ninhos e insetos
- Folhas caídas nutrem o solo', 2),
  ('21000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', 'content', '🌱',
   'A espécie certa',
   'Prefira espécies nativas da sua região. Elas já são adaptadas ao clima e ao solo locais e alimentam a fauna que vive ali. Espécies invasoras podem prejudicar as plantas nativas.
- Nativas se adaptam melhor
- Peça orientação em viveiros ou órgãos ambientais', 3),
  ('21000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000001', 'content', '📍',
   'O lugar certo',
   'Pense no tamanho que a árvore terá quando adulta. Raízes e copa precisam de espaço. Evite plantar embaixo de fios elétricos, sobre encanamentos ou colado a muros. Em calçadas e praças, consulte a prefeitura antes.
- Espaço para raízes e copa
- Longe de fios e canos
- Autorização em áreas públicas', 4),
  ('21000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000001', 'content', '💧',
   'Cuidados básicos',
   'Os primeiros meses são os mais importantes. Regue com frequência quando não chover, use uma estaca (tutor) para manter a muda firme e cubra o solo ao redor com folhas secas para manter a umidade.
- Rega regular no início
- Tutor para dar firmeza
- Cobertura de folhas secas no solo', 5),
  ('21000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000001', 'fun_fact', '💡',
   'Você sabia?',
   'Nas cidades, ruas arborizadas podem ficar vários graus mais frescas do que ruas sem árvores. Por isso as árvores são grandes aliadas contra as chamadas “ilhas de calor”.', 6)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Quiz (5 perguntas, aprovação com 60%)
-- ---------------------------------------------------------------------
insert into public.quizzes (id, lesson_id, title, description, passing_score, xp_reward, attempts_allowed) values
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001',
   'Quiz: Por que as árvores são importantes?',
   '5 perguntas sobre a aula. Acerte pelo menos 3 para liberar o desafio.', 60, 100, null)
on conflict (id) do nothing;

insert into public.quiz_questions (id, quiz_id, question, explanation, order_index, points) values
  ('31000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001',
   'Qual destes é um benefício das árvores para o ambiente?',
   'Pela fotossíntese, as árvores absorvem CO₂ e liberam oxigênio. A sombra da copa também ajuda a refrescar o ambiente.', 1, 1),
  ('31000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001',
   'Por que as árvores são importantes para os ecossistemas?',
   'Árvores podem fornecer alimento e abrigo para diversas espécies e participam de processos importantes dos ecossistemas, como a formação de matéria orgânica no solo.', 2, 1),
  ('31000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000001',
   'Que tipo de espécie é mais indicado para plantar?',
   'Espécies nativas já são adaptadas ao clima e ao solo do lugar e alimentam a fauna local. Espécies invasoras podem competir com as nativas e prejudicá-las.', 3, 1),
  ('31000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000001',
   'Qual é o melhor local para plantar uma árvore?',
   'Uma árvore adulta precisa de espaço. Longe de fios, canos e muros ela cresce saudável sem causar problemas — e em áreas públicas é preciso autorização da prefeitura.', 4, 1),
  ('31000000-0000-4000-8000-000000000005', '30000000-0000-4000-8000-000000000001',
   'Qual cuidado é essencial nos primeiros meses após o plantio?',
   'No início a muda ainda está criando raízes. Rega regular (principalmente sem chuva) e um tutor para dar firmeza aumentam muito as chances de ela sobreviver.', 5, 1)
on conflict (id) do nothing;

insert into public.quiz_options (id, question_id, option_text, is_correct, order_index) values
  ('32000000-0000-4000-8000-000000000011', '31000000-0000-4000-8000-000000000001', 'Aumentam a erosão do solo', false, 1),
  ('32000000-0000-4000-8000-000000000012', '31000000-0000-4000-8000-000000000001', 'Absorvem CO₂ e fazem sombra', true, 2),
  ('32000000-0000-4000-8000-000000000013', '31000000-0000-4000-8000-000000000001', 'Deixam a água da chuva escorrer mais rápido', false, 3),
  ('32000000-0000-4000-8000-000000000014', '31000000-0000-4000-8000-000000000001', 'Aumentam a temperatura ao redor', false, 4),

  ('32000000-0000-4000-8000-000000000021', '31000000-0000-4000-8000-000000000002', 'Porque afastam todos os animais', false, 1),
  ('32000000-0000-4000-8000-000000000022', '31000000-0000-4000-8000-000000000002', 'Porque só servem de decoração', false, 2),
  ('32000000-0000-4000-8000-000000000023', '31000000-0000-4000-8000-000000000002', 'Porque fornecem alimento e abrigo para muitas espécies', true, 3),
  ('32000000-0000-4000-8000-000000000024', '31000000-0000-4000-8000-000000000002', 'Porque não interagem com outros seres vivos', false, 4),

  ('32000000-0000-4000-8000-000000000031', '31000000-0000-4000-8000-000000000003', 'Uma espécie nativa da sua região', true, 1),
  ('32000000-0000-4000-8000-000000000032', '31000000-0000-4000-8000-000000000003', 'Qualquer espécie, tanto faz', false, 2),
  ('32000000-0000-4000-8000-000000000033', '31000000-0000-4000-8000-000000000003', 'Uma espécie invasora que cresce rápido', false, 3),
  ('32000000-0000-4000-8000-000000000034', '31000000-0000-4000-8000-000000000003', 'A espécie mais rara que existir', false, 4),

  ('32000000-0000-4000-8000-000000000041', '31000000-0000-4000-8000-000000000004', 'Embaixo de fios elétricos', false, 1),
  ('32000000-0000-4000-8000-000000000042', '31000000-0000-4000-8000-000000000004', 'Colada a um muro ou sobre um cano', false, 2),
  ('32000000-0000-4000-8000-000000000043', '31000000-0000-4000-8000-000000000004', 'Em qualquer calçada, sem consultar ninguém', false, 3),
  ('32000000-0000-4000-8000-000000000044', '31000000-0000-4000-8000-000000000004', 'Um lugar com espaço para as raízes e a copa crescerem', true, 4),

  ('32000000-0000-4000-8000-000000000051', '31000000-0000-4000-8000-000000000005', 'Não regar nunca, para a raiz ficar forte', false, 1),
  ('32000000-0000-4000-8000-000000000052', '31000000-0000-4000-8000-000000000005', 'Regar com frequência e manter a muda firme com um tutor', true, 2),
  ('32000000-0000-4000-8000-000000000053', '31000000-0000-4000-8000-000000000005', 'Retirar todas as folhas da muda', false, 3),
  ('32000000-0000-4000-8000-000000000054', '31000000-0000-4000-8000-000000000005', 'Cobrir a muda com plástico', false, 4)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Desafio: Plante uma árvore (+ etapas)
-- ---------------------------------------------------------------------
insert into public.challenges (id, category_id, lesson_id, icon, title, slug, description, instructions,
                               safety_notes, difficulty, deadline_days, xp_reward,
                               requires_evidence, requires_follow_up) values
  ('40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
   '20000000-0000-4000-8000-000000000001', '🌳', 'Plante uma árvore', 'plante-uma-arvore',
   'Plante uma árvore ou uma muda adequada ao local onde você vive.',
   'Escolha uma espécie nativa da sua região (peça ajuda em um viveiro).
Escolha um local com espaço, sol e, se for área pública, com autorização.
Cave uma cova um pouco maior que o torrão da muda.
Posicione a muda sem enterrar o caule, cubra com terra e firme bem.
Regue bem e prenda a muda a uma estaca (tutor).
Registre a realização com uma fotografia.',
   'Crianças devem plantar com a ajuda de um adulto.
Use luvas e ferramentas adequadas.
Não plante em áreas de preservação ou em terrenos alheios sem permissão.
Regue com frequência nos primeiros meses, principalmente sem chuva.',
   'medio', 15, 500, true, true)
on conflict (id) do nothing;

insert into public.challenge_steps (id, challenge_id, title, description, step_type, order_index,
                                    required, xp_reward, day_offset) values
  ('41000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001',
   'Escolha a espécie e o local', 'Espécie nativa, espaço para crescer e autorização quando necessário.',
   'instruction', 1, true, 0, null),
  ('41000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000001',
   'Plante a muda', 'Cave, posicione, cubra com terra, regue e coloque o tutor.',
   'action', 2, true, 0, null),
  ('41000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000001',
   'Plantio', 'Registro da muda no dia em que foi plantada.',
   'evidence', 3, true, 0, 0),
  ('41000000-0000-4000-8000-000000000004', '40000000-0000-4000-8000-000000000001',
   'Concluir o desafio', 'Confirme a realização para receber a recompensa.',
   'completion', 4, true, 0, null),
  ('41000000-0000-4000-8000-000000000005', '40000000-0000-4000-8000-000000000001',
   'Primeiro acompanhamento', 'A muda pegou? Registre como ela está depois de um mês.',
   'follow_up', 5, true, 100, 30),
  ('41000000-0000-4000-8000-000000000006', '40000000-0000-4000-8000-000000000001',
   'Segundo acompanhamento', 'Três meses de cuidado! Registre o crescimento.',
   'follow_up', 6, true, 100, 90),
  ('41000000-0000-4000-8000-000000000007', '40000000-0000-4000-8000-000000000001',
   'Terceiro acompanhamento', 'Seis meses! Registre como sua árvore está.',
   'follow_up', 7, true, 100, 180)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Níveis (1 a 5)
-- ---------------------------------------------------------------------
insert into public.levels (id, level_number, name, xp_required, description, reward, icon) values
  ('50000000-0000-4000-8000-000000000001', 1, 'Explorador', 0,
   'Começando a descobrir o mundo natural.', 'Seu mundo ecológico', '🌱'),
  ('50000000-0000-4000-8000-000000000002', 2, 'Aprendiz da Natureza', 100,
   'Já entende como a natureza funciona.', null, '🌿'),
  ('50000000-0000-4000-8000-000000000003', 3, 'Cuidador', 400,
   'Transforma conhecimento em cuidado real.', null, '🌳'),
  ('50000000-0000-4000-8000-000000000004', 4, 'Protetor da Biodiversidade', 800,
   'Protege a vida em todas as suas formas.', null, '🐝'),
  ('50000000-0000-4000-8000-000000000005', 5, 'Guardião do Ecossistema', 1500,
   'Uma referência em ações ambientais.', null, '🏞️')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Conquistas
-- ---------------------------------------------------------------------
insert into public.achievements (id, name, slug, description, icon, xp_reward, requirement_type, requirement_value) values
  ('60000000-0000-4000-8000-000000000001', 'Primeira Semente', 'primeira-semente',
   'Concluir o primeiro conteúdo.', '🌱', 0, 'lessons_completed', '1'),
  ('60000000-0000-4000-8000-000000000002', 'Primeiro Conhecimento', 'primeiro-conhecimento',
   'Ser aprovado no primeiro quiz.', '🧠', 0, 'quizzes_passed', '1'),
  ('60000000-0000-4000-8000-000000000003', 'Primeira Árvore', 'primeira-arvore',
   'Completar o desafio “Plante uma árvore”.', '🌳', 0, 'challenge_completed', 'plante-uma-arvore'),
  ('60000000-0000-4000-8000-000000000004', 'Primeiro Desafio', 'primeiro-desafio',
   'Completar o primeiro desafio.', '🎯', 0, 'challenges_completed', '1'),
  ('60000000-0000-4000-8000-000000000005', 'Primeiro Ciclo Completo', 'primeiro-ciclo-completo',
   'Aprender, agir e ver o seu mundo evoluir pela primeira vez.', '🌎', 0, 'cycles_completed', '1')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Itens do mundo
-- ---------------------------------------------------------------------
insert into public.world_items (id, name, slug, type, description, rarity, unlock_requirement, metadata) values
  ('70000000-0000-4000-8000-000000000001', 'Primeira Árvore', 'primeira-arvore', 'tree',
   'A árvore que nasceu do seu primeiro plantio real.', 'common',
   '{"type": "challenge_completed", "challenge_slug": "plante-uma-arvore"}',
   '{"kind": "tree", "emoji": "🌳", "slot": {"x": 200, "y": 196}}')
on conflict (id) do nothing;
