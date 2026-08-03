alter table public.frotas
  add column if not exists sem_motorista boolean not null default false;
