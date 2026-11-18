-- KosaKata vocabulary learning app schema (Supabase / PostgreSQL)
-- Keep these columns in sync with the interfaces in src/lib/supabase.ts.

create extension if not exists pgcrypto;

create table if not exists public.categories (
  id text primary key,
  name text not null,
  emoji text not null default '📚',
  color text not null default 'mint',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.vocabulary (
  id text primary key,
  category_id text not null references public.categories(id) on delete cascade,
  english text not null,
  indonesian text not null,
  pronunciation text not null default '',
  example text not null default '',
  emoji text not null default '✨',
  created_at timestamptz not null default now()
);

create table if not exists public.quiz_scores (
  id uuid primary key default gen_random_uuid(),
  player_name text not null,
  score integer not null check (score >= 0),
  total_questions integer not null check (total_questions > 0),
  category_id text references public.categories(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Demo data
insert into public.categories (id, name, emoji, color, sort_order) values
  ('animals', 'Hewan', '🐼', 'mint', 1),
  ('food', 'Makanan', '🍓', 'sunshine', 2),
  ('school', 'Sekolah', '✏️', 'lavender', 3),
  ('nature', 'Alam', '🌈', 'coral', 4)
on conflict (id) do nothing;
