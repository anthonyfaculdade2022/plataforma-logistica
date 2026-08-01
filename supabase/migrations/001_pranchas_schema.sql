create extension if not exists "pgcrypto";
create type public.papel_usuario as enum ('administrador','logistica','solicitante');
create type public.status_frota as enum ('disponivel','em_deslocamento','manutencao');
create type public.status_frete as enum ('pendente','em_deslocamento','concluido');
alter type public.status_frete add value if not exists 'cancelado';
create type public.prioridade_frete as enum ('baixa','media','alta');

create table public.usuarios (id uuid primary key default gen_random_uuid(), nome text not null, email text unique not null, papel papel_usuario not null default 'solicitante', ativo boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.motoristas (id uuid primary key default gen_random_uuid(), usuario_id uuid references public.usuarios(id) on delete set null, nome text not null, telefone text, cnh text unique, ativo boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.frotas (id uuid primary key default gen_random_uuid(), numero text unique not null, modelo text, placa text unique, status status_frota not null default 'disponivel', local_disponivel text check (local_disponivel in ('Aralco','Generalco')), ativo boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.setores (id uuid primary key default gen_random_uuid(), nome text unique not null, ativo boolean not null default true, created_at timestamptz not null default now());
create table public.locais (id uuid primary key default gen_random_uuid(), nome text not null, tipo text, endereco text, ativo boolean not null default true, created_at timestamptz not null default now());
create table public.tipos_equipamento (id uuid primary key default gen_random_uuid(), nome text unique not null, ativo boolean not null default true, created_at timestamptz not null default now());
create table public.equipamentos (id uuid primary key default gen_random_uuid(), codigo text unique not null, tipo_id uuid not null references public.tipos_equipamento(id), descricao text, ativo boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.operacoes (id uuid primary key default gen_random_uuid(), codigo text unique not null, data_operacional date unique not null, inicio_em timestamptz not null, fim_em timestamptz not null, created_at timestamptz not null default now(), constraint janela_operacional_24h check (fim_em = inicio_em + interval '24 hours' - interval '1 second'));
create table public.fretes (id uuid primary key default gen_random_uuid(), operacao_id uuid not null references public.operacoes(id), data date not null, horario time not null, frota_id uuid references public.frotas(id), motorista_id uuid references public.motoristas(id), equipamento_id uuid references public.equipamentos(id), solicitante_id uuid not null references public.usuarios(id), responsavel_logistica_id uuid not null references public.usuarios(id), setor_id uuid not null references public.setores(id), origem_id uuid not null references public.locais(id), destino_id uuid not null references public.locais(id), prioridade prioridade_frete not null default 'media', status status_frete not null default 'pendente', observacao text, inicio_deslocamento timestamptz, concluido_em timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), constraint origem_destino_diferentes check (origem_id <> destino_id), constraint vinculo_deslocamento check (status = 'pendente' or (frota_id is not null and motorista_id is not null)));
create table public.manutencoes (id uuid primary key default gen_random_uuid(), frota_id uuid not null references public.frotas(id), entrada_em timestamptz not null default now(), saida_em timestamptz, tipo text not null check (tipo in ('preventiva','corretiva')), servico text not null, observacoes text, previsao_retorno timestamptz, responsavel_id uuid not null references public.usuarios(id), status text not null default 'em_manutencao' check (status in ('em_manutencao','finalizada')), created_at timestamptz not null default now());

alter table public.manutencoes
  add column numero_os text,
  add column localizacao text,
  add column frete_interrompido_id uuid references public.fretes(id);

alter table public.fretes
  add column frota_inicial_id uuid references public.frotas(id),
  add column frota_anterior_id uuid references public.frotas(id),
  add column motivo_transferencia text,
  add column transferido_em timestamptz;

alter table public.frotas
  add column possui_pre_os boolean not null default false,
  add column numero_pre_os text,
  add column servico_pre_os text;

alter table public.manutencoes
  add column pre_os_utilizada boolean not null default false;

create table public.fretes_alteracoes (
  id uuid primary key default gen_random_uuid(),
  frete_id uuid not null references public.fretes(id) on delete cascade,
  campo text not null,
  valor_anterior text,
  novo_valor text,
  alterado_em timestamptz not null default now()
);

alter table public.fretes
  add column cancelamento_solicitado_por text,
  add column motivo_cancelamento text,
  add column cancelado_em timestamptz;
create index fretes_data_idx on public.fretes(data desc); create index fretes_status_idx on public.fretes(status); create index fretes_frota_idx on public.fretes(frota_id);
create index fretes_operacao_idx on public.fretes(operacao_id);
create or replace function public.garantir_operacao_atual(moment timestamptz default now()) returns public.operacoes language plpgsql security definer as $$ declare operational_date date; result public.operacoes; begin operational_date := case when (moment at time zone 'America/Sao_Paulo')::time < time '07:00' then (moment at time zone 'America/Sao_Paulo')::date - 1 else (moment at time zone 'America/Sao_Paulo')::date end; insert into public.operacoes(codigo,data_operacional,inicio_em,fim_em) values (to_char(operational_date,'YYYYMMDD'),operational_date,(operational_date + time '07:00') at time zone 'America/Sao_Paulo',((operational_date + 1) + time '06:59:59') at time zone 'America/Sao_Paulo') on conflict (data_operacional) do nothing; select * into result from public.operacoes where data_operacional=operational_date; return result; end $$;
alter table public.usuarios enable row level security; alter table public.motoristas enable row level security; alter table public.frotas enable row level security; alter table public.setores enable row level security; alter table public.locais enable row level security; alter table public.tipos_equipamento enable row level security; alter table public.equipamentos enable row level security; alter table public.operacoes enable row level security; alter table public.fretes enable row level security; alter table public.manutencoes enable row level security;
