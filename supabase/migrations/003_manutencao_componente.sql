alter table public.manutencoes
  add column if not exists componente text not null default 'cavalo'
  check (componente in ('cavalo', 'prancha'));
