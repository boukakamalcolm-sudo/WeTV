# WeTV — calendrier des sorties

Un flux iCal vivant des sorties de mes séries et films favoris, et une console
web pour gérer ces favoris.

## Mise en route

```
npm install
```

Créer un `.env` à partir de `.env.example` :

```
VITE_TMDB_KEY=votre_cle
VITE_SUPABASE_URL=votre_url_supabase
VITE_SUPABASE_ANON_KEY=votre_cle_anon_supabase
```

La clé TMDB s'obtient gratuitement sur themoviedb.org (Paramètres, API). Jouer
`schema.sql` dans l'éditeur SQL de Supabase.

```
npm run dev
```

En local, Vite sert aussi le flux (`/calendrier.ics`), comme Vercel en
production.

## Organisation

- `api/calendrier.js` — la fonction Vercel du flux. Lit les favoris liés à la
  clé (`favoris_du_flux`), calcule les sorties, renvoie du `text/calendar`
  (ou du JSON avec `?format=json`, pour l'aperçu de la console).
- `api/_sorties.js` — les dates : épisodes des saisons en cours et à venir,
  sorties ciné et numériques françaises des films.
- `api/_ics.js` — l'écriture iCalendar (échappement, repli des lignes).
- `vercel.json` — `/calendrier.ics` pointe vers la fonction.
- `src/` — la console React : Sorties, Favoris, Abonnement.

Les fonctions lisent `VITE_TMDB_KEY`, `VITE_SUPABASE_URL` et
`VITE_SUPABASE_ANON_KEY` (ou `TMDB_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`),
déjà présentes dans le projet Vercel.

This product uses the TMDB API but is not endorsed or certified by TMDB.
