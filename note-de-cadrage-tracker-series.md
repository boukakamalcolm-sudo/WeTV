# Note de cadrage — WeTV, calendrier des sorties

## Contexte

WeTV a d'abord été un tracker complet (cochage d'épisodes, statistiques,
découverte). Le besoin réel est plus simple : **savoir quand sortent les
séries et films qui m'intéressent**, dans l'agenda que j'utilise déjà.

L'app devient donc :

1. **Un flux iCal vivant** — une URL d'abonnement que l'agenda (Apple
   Calendrier, Google Agenda…) relit tout seul. Pas d'export à refaire.
2. **Une console d'administration** — pour choisir les favoris qui
   alimentent ce flux et gérer l'adresse d'abonnement.

## Ce que contient le calendrier

- **Séries** : un événement par épisode, à sa date de diffusion TMDB, du type
  « The Bear · S4E3 ». Début de saison, final de saison, mi-saison et nouvelle
  série sont signalés dans le titre.
- **Films** : la sortie en salles en France, puis la sortie numérique (VOD /
  streaming) quand TMDB la connaît. Sans aucune date française, la date
  internationale est utilisée, en le disant dans le titre.
- Événements « journée entière » (TMDB ne donne pas d'heure), marqués
  disponibles pour ne pas bloquer l'agenda.
- Fenêtre : les 30 derniers jours et tout ce qui est annoncé ensuite.

## Fraîcheur

Le flux est recalculé depuis TMDB à chaque lecture, avec une heure de cache
au bord du réseau Vercel. Ensuite, c'est l'agenda qui décide : Apple permet
une actualisation horaire, Google relit les abonnements toutes les 12 à 24 h
sans réglage possible.

## Écrans de la console

- **Sorties** — aperçu exact du flux, groupé par jour ; titres sans date
  connue et titres introuvables signalés à part.
- **Favoris** — recherche TMDB avec anti-rebond, ajout, retrait, filtre
  séries / films.
- **Abonnement** — adresse à copier, lien `webcal://` pour Apple, mode
  d'emploi Google, régénération de la clé si l'adresse a fuité.

## Modèle de données

Deux tables (`schema.sql`) : `favoris` (un titre TMDB par ligne, RLS
propriétaire uniquement) et `calendriers` (la clé secrète du flux, lisible
seulement via des fonctions `security definer`). Les tables de l'ancien
tracker restent en base, inutilisées.

## Hors périmètre

Le suivi de visionnage, le social, le natif, les notifications push.

## Pistes

- Choisir le pays des sorties films (FR codé en dur aujourd'hui).
- Plateformes de diffusion dans la description des événements
  (`watch/providers` de TMDB).
- Plusieurs calendriers (un par type, ou par plateforme).
