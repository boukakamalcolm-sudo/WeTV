# Tracker de séries et films

Application personnelle, mono-utilisateur, en PWA. Le premier lot du backlog est couvert : recherche et ajout, suivi épisode par épisode, commentaire et note, file à suivre, découverte par tri, export.

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

La clé TMDB s'obtient gratuitement sur themoviedb.org, dans Paramètres puis API, pour un usage non commercial.

Les deux variables Supabase sont facultatives : sans elles, l'app reste pleinement
fonctionnelle en local (IndexedDB), la synchro ne fait simplement rien.

```
npm run dev
```

Le fichier `schema.sql` se joue tel quel dans l'éditeur SQL de Supabase.

## Ce que contient le projet

`schema.sql` définit les quatre tables et les vues de restitution. `items` pour ce qui est suivi, `entries` pour chaque visionnage avec sa note et son commentaire, `preferences` pour les verdicts du tri, `recommendations` pour les scores calculés en lot.

`src/lib/store.js` porte le principe local d'abord. Chaque écriture va dans IndexedDB et dépose sa jumelle dans une file d'attente, vidée trois secondes plus tard en arrière-plan vers Supabase (si configuré), un lot à la fois pour qu'un échec isolé ne bloque ni ne double les autres. Aucun geste n'attend le réseau. L'export JSON est là dès le départ.

`src/lib/supabase.js` crée le client à partir des variables d'environnement, ou reste `null` si elles sont absentes.

`src/lib/tmdb.js` couvre la recherche, la fiche, les saisons, les titres proches et l'exploration par genre. Une fonction de normalisation unique garantit que le reste de l'application ne connaît qu'une seule forme d'objet.

`src/lib/reco.js` produit les propositions du premier lot, sans modèle : deux tiers de titres proches de ce qui est déjà suivi, un tiers tiré d'un genre absent de la bibliothèque. Cette part d'exploration est ce qui empêche le système de se refermer sur lui-même.

`src/lib/couleur.js` extrait la teinte dominante d'une affiche et bascule la couleur du texte selon la luminosité obtenue, pour tenir le contraste.

`src/components/ASuivre.jsx` est l'écran d'accueil : le prochain épisode non vu de chaque série, validable au balayage ou au bouton.

`src/components/Fiche.jsx` gère le cochage épisode par épisode, le cochage de saison entière et la feuille de note et commentaire.

`src/components/Decouverte.jsx` contient les deux temps de la découverte : la grille d'amorçage à la création du compte, puis le tri carte à carte.

`CLAUDE.md` résume les principes à ne pas défaire. À garder à la racine du projet.

## Ce qui reste à faire

Le service worker pour le hors connexion, les icônes du manifeste, puis les récits du deuxième lot : calendrier, liste d'envies, tableau de bord, journal des commentaires, plateformes de streaming, réimport.

La synchro Supabase n'envoie que dans un sens (local vers distant) : elle sert de
sauvegarde, pas encore de vraie synchro multi-appareil. Rien ne redescend le
distant vers un nouvel appareil ni ne fusionne deux historiques locaux divergents.

Les tables Supabase n'ont pas de policies RLS : la clé anon publique dans le
bundle client peut lire et écrire toutes les lignes. Acceptable pour un usage
strictement personnel avec la clé non partagée, mais à corriger avant tout
partage du projet.

## Deux points à ne pas défaire

L'écriture ne doit jamais attendre le réseau. Si un `await` réseau apparaît entre le clic et le rendu, la sensation de fluidité disparaît.

Le balayage garde toujours son équivalent au tap. C'est une exigence d'accessibilité et le chemin le plus fiable en usage réel.

This product uses the TMDB API but is not endorsed or certified by TMDB.
