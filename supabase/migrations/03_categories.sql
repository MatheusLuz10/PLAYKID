-- =====================================================================
-- 03 · Categorias ecológicas
-- =====================================================================

create table public.categories (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  slug         text not null unique,
  description  text,
  icon         text,
  image_url    text,
  color        text,
  -- Temas exibidos na tela "Aprender" (ex.: Árvores, Flores...).
  topics       text[] not null default '{}',
  order_index  integer not null default 0,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

create index categories_active_order_idx on public.categories (active, order_index);
