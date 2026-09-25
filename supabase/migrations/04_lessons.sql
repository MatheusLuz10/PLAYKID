-- =====================================================================
-- 04 · Conteúdos educativos (aulas) e suas seções
-- =====================================================================

create table public.lessons (
  id                 uuid primary key default gen_random_uuid(),
  category_id        uuid not null references public.categories (id) on delete restrict,
  -- Tema da categoria ao qual a aula pertence (ex.: 'Árvores').
  topic              text,
  title              text not null,
  slug               text not null unique,
  description        text,
  content            text,
  cover_image_url    text,
  difficulty         public.difficulty_level not null default 'facil',
  estimated_minutes  integer not null default 5 check (estimated_minutes > 0),
  xp_reward          integer not null default 50 check (xp_reward >= 0),
  active             boolean not null default true,
  order_index        integer not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index lessons_category_order_idx on public.lessons (category_id, order_index);

create trigger lessons_set_updated_at
  before update on public.lessons
  for each row execute function public.set_updated_at();

-- Cada seção vira um "cartão" da aula interativa.
-- Formato de content: parágrafo(s) de texto; linhas iniciadas por "- "
-- são exibidas como destaques (checklist).
create table public.lesson_sections (
  id            uuid primary key default gen_random_uuid(),
  lesson_id     uuid not null references public.lessons (id) on delete cascade,
  section_type  text not null default 'content' check (section_type in ('content', 'fun_fact')),
  icon          text,
  title         text not null,
  content       text not null,
  image_url     text,
  video_url     text,
  order_index   integer not null default 0,
  created_at    timestamptz not null default now(),
  unique (lesson_id, order_index)
);
