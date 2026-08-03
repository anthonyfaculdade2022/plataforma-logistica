create table if not exists public.plataforma_estado (
  chave text primary key,
  dados jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.plataforma_estado enable row level security;

comment on table public.plataforma_estado is
  'Estado persistente do módulo de Pranchas. Acesso exclusivo pelo servidor.';
