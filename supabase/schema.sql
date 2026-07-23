-- Wild Lama · Canasta de Tareas
-- Ejecutar esto en Supabase → SQL Editor → New query → pegar todo → Run

create extension if not exists pgcrypto;

-- Tipos
do $$ begin
  create type task_type as enum ('diaria', 'fecha', 'semanal');
exception when duplicate_object then null; end $$;

do $$ begin
  create type task_status as enum ('pendiente', 'en_curso', 'completada');
exception when duplicate_object then null; end $$;

-- Personas del equipo
create table if not exists team_members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Tareas
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  type task_type not null,
  specific_date date,               -- solo si type = 'fecha' (usado como "plazo" de reunión)
  reunion text,                     -- solo si type = 'fecha': nombre/tema de la reunión
  days_of_week int[],                -- solo si type = 'semanal'. 0=domingo ... 6=sábado
  status task_status not null default 'pendiente',
  assigned_to uuid references team_members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Si la tabla ya existía sin la columna "reunion", esto la agrega sin romper nada:
alter table tasks add column if not exists reunion text;

-- Habilitar tiempo real
alter publication supabase_realtime add table tasks;
alter publication supabase_realtime add table team_members;

-- RLS: app interna, acceso abierto con la anon key (sin login)
alter table team_members enable row level security;
alter table tasks enable row level security;

create policy "team_members: acceso total" on team_members
  for all using (true) with check (true);

create policy "tasks: acceso total" on tasks
  for all using (true) with check (true);
