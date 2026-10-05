# WeTV — calendrier des sorties

Outil perso, mono-utilisateur. Un flux iCal vivant annonce les sorties des
séries et films favoris ; l'app web n'est plus qu'une console d'administration
de ces favoris. Lire `note-de-cadrage-tracker-series.md` pour le périmètre,
`schema.sql` pour le modèle de données.

## Quatre principes, non négociables

**1. Un flux, pas des exports.** Le calendrier est une URL d'abonnement unique
(`/calendrier.ics?cle=…`), recalculée à chaque lecture. Jamais de fichier .ics
figé à réimporter. Les UID des événements sont stables (`tv-<id>-s<S>e<E>@wetv`,
`movie-<id>-<cinema|numerique|sortie>@wetv`) : les changer crée des doublons
chez tous les abonnés.

**2. TMDB est la seule source des dates.** On ne stocke aucune date de sortie
en base : seulement les favoris (identifiant TMDB comme clé universelle). Une
date corrigée sur TMDB doit arriver d'elle-même dans l'agenda.

**3. La clé du flux est un secret.** Elle ouvre les favoris sans connexion ;
elle reste longue, régénérable, et ne passe que par les fonctions SQL
`security definer` prévues. Aucune lecture directe de `calendriers`.

**4. Le flux ne tombe pas pour un titre.** Un favori introuvable sur TMDB est
signalé dans la console, jamais une erreur qui vide tout le calendrier.

## Contraintes de conception (console)

- Zones tactiles à 44 points minimum.
- Commandes principales en bas, à portée du pouce. Trois onglets : Sorties,
  Favoris, Abonnement.
- Aucune information portée par la seule couleur : coche et libellé systématiques.
- Tailles de texte relatives (rem), jamais de mise en page figée sur une taille d'écran.
- Étiquettes de champ visibles pendant la saisie, pas de placeholder seul.
- Champs de saisie à 16px minimum, sinon iOS zoome.

## Ce qui est hors périmètre

Le suivi de visionnage (épisodes vus, statistiques, recommandations) : c'était
l'ancien tracker, retiré. Le social sous toutes ses formes. Le natif et l'App
Store. Les notifications push : l'agenda s'en charge.

## Dépendances

React et Vite côté console, Supabase pour les comptes et les favoris, TMDB pour
les métadonnées. Le flux (`api/`) n'a aucune dépendance : fonctions Vercel en
Node avec `fetch`, iCalendar écrit à la main. Toute nouvelle dépendance doit
être justifiée.
