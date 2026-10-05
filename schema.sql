-- WeTV — calendrier des sorties de mes séries et films favoris.
-- Postgres / Supabase. Se joue tel quel dans l'éditeur SQL.
--
-- Les tables de l'ancien tracker (items, entries, preferences,
-- recommendations) restent en base, intactes mais inutilisées ; leur schéma
-- est dans l'historique git (schema.sql avant la refonte calendrier).

-- Ce que je surveille. L'identifiant TMDB reste la clé de référence.
create table favoris (
  id          bigserial primary key,
  user_id     uuid    not null default auth.uid() references auth.users(id) on delete cascade,
  tmdb_id     integer not null,
  media_type  text    not null check (media_type in ('tv', 'movie')),
  title       text    not null,
  poster_path text,
  annee       smallint,
  added_at    timestamptz not null default now(),
  unique (user_id, tmdb_id, media_type)
);

create index favoris_user_idx on favoris (user_id);

alter table favoris enable row level security;

create policy "Chacun ne voit et ne modifie que ses propres favoris" on favoris
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Une clé secrète par utilisateur : c'est elle qui ouvre le flux iCal
-- (/calendrier.ics?cle=…). Les agendas ne savent pas s'authentifier
-- autrement qu'avec une URL, la clé est donc longue et régénérable.
create table calendriers (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  cle        text not null unique,
  created_at timestamptz not null default now()
);

-- Aucune policy : la table n'est accessible qu'à travers les fonctions
-- ci-dessous, jamais en lecture directe.
alter table calendriers enable row level security;

create function public.nouvelle_cle_calendrier() returns text
language sql volatile set search_path = ''
as $$ select replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '') $$;

-- Renvoie la clé de l'utilisateur connecté, en la créant au premier appel.
create function public.ma_cle_calendrier() returns text
language plpgsql security definer set search_path = ''
as $$
declare
  resultat text;
begin
  if auth.uid() is null then
    raise exception 'Connexion requise';
  end if;
  insert into public.calendriers (user_id, cle)
  values (auth.uid(), public.nouvelle_cle_calendrier())
  on conflict (user_id) do nothing;
  select cle into resultat from public.calendriers where user_id = auth.uid();
  return resultat;
end;
$$;

-- Remplace la clé : l'ancienne URL d'abonnement cesse aussitôt de répondre.
create function public.regenerer_cle_calendrier() returns text
language plpgsql security definer set search_path = ''
as $$
declare
  resultat text;
begin
  if auth.uid() is null then
    raise exception 'Connexion requise';
  end if;
  insert into public.calendriers (user_id, cle)
  values (auth.uid(), public.nouvelle_cle_calendrier())
  on conflict (user_id) do update set cle = excluded.cle, created_at = now()
  returning cle into resultat;
  return resultat;
end;
$$;

-- Lue par le flux (api/calendrier.js) avec la clé anon : renvoie null pour
-- une clé inconnue, sinon les favoris — et rien d'autre — de son propriétaire.
create function public.favoris_du_flux(p_cle text) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select case
    when c.user_id is null then null
    else coalesce(
      (select jsonb_agg(jsonb_build_object(
          'tmdb_id', f.tmdb_id, 'media_type', f.media_type,
          'title', f.title, 'poster_path', f.poster_path))
       from public.favoris f where f.user_id = c.user_id),
      '[]'::jsonb)
  end
  from (select 1) as un
  left join public.calendriers c on c.cle = p_cle and length(p_cle) >= 32
$$;

revoke execute on function public.nouvelle_cle_calendrier() from public, anon, authenticated;
revoke execute on function public.ma_cle_calendrier() from public, anon;
revoke execute on function public.regenerer_cle_calendrier() from public, anon;
revoke execute on function public.favoris_du_flux(text) from public;
grant execute on function public.ma_cle_calendrier() to authenticated;
grant execute on function public.regenerer_cle_calendrier() to authenticated;
grant execute on function public.favoris_du_flux(text) to anon, authenticated;
