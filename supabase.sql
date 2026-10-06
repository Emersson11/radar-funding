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
