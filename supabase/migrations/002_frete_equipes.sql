-- Equipe de transporte vinculada ao frete.
-- Frota e motorista são obrigatórios e sempre persistidos como um conjunto.
create table if not exists public.fretes_equipes (
  id uuid primary key default gen_random_uuid(),
  frete_id uuid not null references public.fretes(id) on delete cascade,
  frota_id uuid not null references public.frotas(id),
  motorista_id uuid not null references public.motoristas(id),
  ordem integer not null default 1 check (ordem > 0),
  created_at timestamptz not null default now(),
  unique (frete_id, frota_id),
  unique (frete_id, ordem)
);

create index if not exists fretes_equipes_frete_id_idx
  on public.fretes_equipes (frete_id);

create index if not exists fretes_equipes_frota_id_idx
  on public.fretes_equipes (frota_id);

alter table public.fretes_equipes enable row level security;

create policy "Usuários autenticados podem consultar equipes de frete"
  on public.fretes_equipes for select
  to authenticated
  using (true);

create policy "Usuários autenticados podem gerenciar equipes de frete"
  on public.fretes_equipes for all
  to authenticated
  using (true)
  with check (true);
