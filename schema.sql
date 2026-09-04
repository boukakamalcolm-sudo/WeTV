-- Tracker de séries et films personnel
-- Postgres / Supabase. Le même schéma est rejoué en SQLite côté navigateur.

-- Ce que je suis : séries, films, documentaires.
-- Le documentaire n'est pas un type, c'est un genre TMDB (id 99) posé sur un film ou une série.
create table items (
  id            bigserial primary key,
  user_id       uuid    not null default auth.uid() references auth.users(id) on delete cascade,
  tmdb_id       integer not null,
  media_type    text    not null check (media_type in ('tv', 'movie')),
  title         text    not null,
  poster_path   text,
  first_air_year smallint,
  genres        integer[] default '{}',
  runtime_min   smallint,          -- durée moyenne d'un épisode, ou durée du film
  status        text    not null default 'watching'
                check (status in ('watchlist', 'watching', 'completed', 'dropped')),
  added_at      timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, tmdb_id, media_type)
);

-- Un enregistrement par visionnage. Porte le suivi, le commentaire et tous les indicateurs.
-- Pas de contrainte d'unicité : revoir un épisode crée une seconde ligne.
create table entries (
  id            bigserial primary key,
  user_id       uuid    not null default auth.uid() references auth.users(id) on delete cascade,
  item_id       bigint not null references items(id) on delete cascade,
  season        smallint,          -- null pour un film
  episode       smallint,          -- null pour un film
  watched_at    timestamptz not null default now(),
  runtime_min   smallint,          -- figé au moment du visionnage, sinon les stats bougent
  platform      text,              -- netflix, cinema, disney+...
  rating        smallint check (rating between 1 and 5),
  comment       text,
  air_date      date,              -- permet de calculer le retard sur la diffusion
  created_at    timestamptz not null default now()
);

create index entries_item_idx on entries (item_id, season, episode);
create index entries_date_idx on entries (watched_at desc);
create index entries_user_idx on entries (user_id);
create index items_user_idx on items (user_id);

-- Goûts déclarés au swipe. Volontairement séparé de entries :
-- "j'aime" est une intention, pas un visionnage, et n'a rien à faire dans les stats.
create table preferences (
  id            bigserial primary key,
  user_id       uuid    not null default auth.uid() references auth.users(id) on delete cascade,
  tmdb_id       integer not null,
  media_type    text    not null check (media_type in ('tv', 'movie')),
  verdict       text    not null check (verdict in ('like', 'dislike', 'unseen', 'skip')),
  source        text    not null default 'swipe' check (source in ('onboarding', 'swipe')),
  decided_at    timestamptz not null default now(),
  unique (user_id, tmdb_id, media_type)
);

create index preferences_user_idx on preferences (user_id);

-- Scores calculés hors ligne, en lot. L'app se contente de lire.
create table recommendations (
  user_id       uuid    not null default auth.uid() references auth.users(id) on delete cascade,
  tmdb_id       integer not null,
  media_type    text    not null,
  score         real    not null,
  reason        text,               -- "genre thriller, réalisateur déjà aimé"
  computed_at   timestamptz not null default now(),
  primary key (user_id, tmdb_id, media_type)
);

-- Chaque ligne appartient à son utilisateur, jamais visible ni modifiable par un autre.
-- La connexion (optionnelle) sert à retrouver ses propres données sur plusieurs
-- appareils — pas à un usage partagé ou social, hors périmètre du projet.
alter table items enable row level security;
alter table entries enable row level security;
alter table preferences enable row level security;
alter table recommendations enable row level security;

create policy "Chacun ne voit et ne modifie que ses propres items" on items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Chacun ne voit et ne modifie que ses propres entrées" on entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Chacun ne voit et ne modifie que ses propres préférences" on preferences
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Chacun ne voit et ne modifie que ses propres recommandations" on recommendations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Vues de restitution. C'est tout l'intérêt d'avoir du SQL plutôt que du NoSQL.
-- security_invoker : sans quoi la vue s'exécute avec les droits de son créateur
-- et contournerait la RLS ci-dessus, exposant les données de tout le monde.

create view v_heures_par_mois with (security_invoker = true) as
select date_trunc('month', watched_at) as mois,
       round(sum(coalesce(runtime_min, 42)) / 60.0, 1) as heures,
       count(*) as nb_vus
from entries
group by 1
order by 1;

create view v_taux_abandon with (security_invoker = true) as
select count(*) filter (where status = 'dropped')::real
       / nullif(count(*) filter (where status in ('dropped', 'completed')), 0) as taux
from items
where media_type = 'tv';

-- Retard réel sur l'actualité : combien de jours entre la diffusion et mon visionnage.
create view v_retard_diffusion with (security_invoker = true) as
select round(avg(watched_at::date - air_date)) as jours_moyens
from entries
where air_date is not null and watched_at::date >= air_date;

create view v_prochain_episode with (security_invoker = true) as
select i.id, i.tmdb_id, i.title, i.poster_path,
       max(e.season) as derniere_saison,
       max(e.episode) filter (where e.season = (select max(season) from entries where item_id = i.id)) as dernier_episode,
       max(e.watched_at) as vu_le
from items i
join entries e on e.item_id = i.id
where i.media_type = 'tv' and i.status = 'watching'
group by i.id
order by max(e.watched_at) desc;
