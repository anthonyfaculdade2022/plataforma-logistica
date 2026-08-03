alter table public.manutencoes
  drop constraint if exists manutencoes_componente_check;

alter table public.manutencoes
  add constraint manutencoes_componente_check
  check (componente in ('cavalo', 'prancha', 'ambos'));

alter table public.manutencoes
  add column if not exists numero_os_cavalo text,
  add column if not exists numero_os_prancha text;
