alter table public.fretes
  add column if not exists fluxo_operacao text not null default 'unico'
    check (fluxo_operacao in ('unico', 'sequencia')),
  add column if not exists etapas jsonb,
  add column if not exists etapa_atual integer;
