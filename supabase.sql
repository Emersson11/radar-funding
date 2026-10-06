-- Rode este arquivo uma vez no Supabase: SQL Editor > New query > colar > Run.

-- Lançamentos da carteira: cada usuário só enxerga e altera os seus.
create table if not exists public.lancamentos (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  ativo text not null,
  tipo text not null check (tipo in ('compra','venda')),
  qtd numeric not null check (qtd > 0),
  preco numeric not null check (preco >= 0),
  data date not null,
  criado_em timestamptz not null default now()
);
alter table public.lancamentos enable row level security;
drop policy if exists "dono dos lancamentos" on public.lancamentos;
create policy "dono dos lancamentos" on public.lancamentos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Perfil e plano de cada usuário. O usuário só lê o próprio perfil e não consegue
-- mudar o plano; quem muda é você, pelo Table Editor do Supabase.
create table if not exists public.perfis (
  user_id uuid primary key references auth.users on delete cascade,
  email text,
  plano text not null default 'gratis' check (plano in ('gratis','assinante','admin')),
  criado_em timestamptz not null default now()
);
alter table public.perfis enable row level security;
drop policy if exists "le o proprio perfil" on public.perfis;
create policy "le o proprio perfil" on public.perfis for select using (auth.uid() = user_id);

-- Cria o perfil automaticamente quando alguém se cadastra.
create or replace function public.novo_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfis (user_id, email) values (new.id, new.email) on conflict do nothing;
  return new;
end $$;
drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario after insert on auth.users
  for each row execute function public.novo_usuario();

-- ===== Administrador =====
-- O administrador enxerga todos os perfis e pode mudar o plano de cada um.
-- Usuários comuns continuam vendo só o próprio perfil e não conseguem se promover.
create or replace function public.eh_admin() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.perfis where user_id = auth.uid() and plano = 'admin')
$$;
drop policy if exists "admin le todos os perfis" on public.perfis;
create policy "admin le todos os perfis" on public.perfis for select using (public.eh_admin());
drop policy if exists "admin altera planos" on public.perfis;
create policy "admin altera planos" on public.perfis for update using (public.eh_admin()) with check (public.eh_admin());

-- Para tornar a SUA conta administradora, entre no site uma vez e depois rode
-- (trocando o e-mail pelo seu):
--   update public.perfis set plano = 'admin' where email = 'voce@exemplo.com';

-- ===== Conteúdo editável pelo administrador =====
create table if not exists public.modulos (
  id bigint generated always as identity primary key,
  titulo text not null,
  descricao text not null default '',
  ordem int not null default 0
);
create table if not exists public.aulas (
  id bigint generated always as identity primary key,
  modulo_id bigint not null references public.modulos on delete cascade,
  titulo text not null,
  youtube text not null default '',
  duracao text not null default '',
  descricao text not null default '',
  ordem int not null default 0
);
create table if not exists public.config_site (
  chave text primary key,
  valor text not null default ''
);
alter table public.modulos enable row level security;
alter table public.aulas enable row level security;
alter table public.config_site enable row level security;
-- Todos leem; só o administrador altera.
drop policy if exists "todos leem modulos" on public.modulos;
create policy "todos leem modulos" on public.modulos for select using (true);
drop policy if exists "admin altera modulos" on public.modulos;
create policy "admin altera modulos" on public.modulos for all using (public.eh_admin()) with check (public.eh_admin());
drop policy if exists "todos leem aulas" on public.aulas;
create policy "todos leem aulas" on public.aulas for select using (true);
drop policy if exists "admin altera aulas" on public.aulas;
create policy "admin altera aulas" on public.aulas for all using (public.eh_admin()) with check (public.eh_admin());
drop policy if exists "todos leem config" on public.config_site;
create policy "todos leem config" on public.config_site for select using (true);
drop policy if exists "admin altera config" on public.config_site;
create policy "admin altera config" on public.config_site for all using (public.eh_admin()) with check (public.eh_admin());

-- ===== Comentários nas aulas =====
create table if not exists public.comentarios (
  id bigint generated always as identity primary key,
  aula_id bigint not null references public.aulas on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  autor text not null default split_part(coalesce(auth.jwt() ->> 'email', 'usuário'), '@', 1),
  texto text not null check (char_length(texto) between 1 and 2000),
  criado_em timestamptz not null default now()
);
alter table public.comentarios enable row level security;
-- Quem está logado lê; cada um escreve em seu nome; apaga o próprio, e o administrador apaga qualquer um.
drop policy if exists "logados leem comentarios" on public.comentarios;
create policy "logados leem comentarios" on public.comentarios for select using (auth.uid() is not null);
drop policy if exists "comenta em seu nome" on public.comentarios;
create policy "comenta em seu nome" on public.comentarios for insert with check (auth.uid() = user_id);
drop policy if exists "apaga o proprio ou admin" on public.comentarios;
create policy "apaga o proprio ou admin" on public.comentarios for delete using (auth.uid() = user_id or public.eh_admin());

-- ===== Compras em reais =====
alter table public.lancamentos add column if not exists moeda text not null default 'USD' check (moeda in ('USD','BRL'));
alter table public.lancamentos add column if not exists cambio numeric;   -- cotação do dólar em reais no dia da operação

-- ===== Classes de ativo e preços informados à mão =====
alter table public.lancamentos add column if not exists classe text not null default 'cripto'
  check (classe in ('cripto','defi','rv','rf','outros'));
create table if not exists public.precos_manuais (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  ativo text not null,
  preco numeric not null check (preco >= 0),   -- em dólar
  primary key (user_id, ativo)
);
alter table public.precos_manuais enable row level security;
drop policy if exists "dono dos precos" on public.precos_manuais;
create policy "dono dos precos" on public.precos_manuais
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
