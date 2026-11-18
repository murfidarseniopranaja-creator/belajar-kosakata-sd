-- KosaKata vocabulary learning app schema (Supabase / PostgreSQL).
-- Keep these names in sync with src/lib/supabase.ts and src/App.tsx.

create extension if not exists pgcrypto;

create table if not exists public.categories (
  id text primary key,
  name text not null,
  emoji text not null default '📚',
  color text not null default 'mint',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- The application queries this table as `vocabulary` (singular).
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

-- Enable row-level security and grant only the public operations used by the app.
alter table public.categories enable row level security;
alter table public.vocabulary enable row level security;
alter table public.quiz_scores enable row level security;

drop policy if exists "Public can read categories" on public.categories;
create policy "Public can read categories"
  on public.categories for select to anon, authenticated using (true);

drop policy if exists "Public can read vocabulary" on public.vocabulary;
create policy "Public can read vocabulary"
  on public.vocabulary for select to anon, authenticated using (true);

drop policy if exists "Public can read quiz scores" on public.quiz_scores;
create policy "Public can read quiz scores"
  on public.quiz_scores for select to anon, authenticated using (true);

drop policy if exists "Public can insert quiz scores" on public.quiz_scores;
create policy "Public can insert quiz scores"
  on public.quiz_scores for insert to anon, authenticated with check (true);

grant select on public.categories, public.vocabulary, public.quiz_scores to anon, authenticated;
grant insert on public.quiz_scores to anon, authenticated;

insert into public.categories (id, name, emoji, color, sort_order) values
  ('animals', 'Hewan', '🐼', 'mint', 1),
  ('food', 'Makanan', '🍓', 'sunshine', 2),
  ('school', 'Sekolah', '✏️', 'lavender', 3),
  ('nature', 'Alam', '🌈', 'coral', 4)
on conflict (id) do nothing;
