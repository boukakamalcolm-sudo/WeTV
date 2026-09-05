# Note de cadrage — Tracker de séries et films

## Contexte

Application personnelle de suivi de séries et de films, développée pour un usage
individuel. Elle remplace un tableur ou une mémoire approximative par un outil
qui retient précisément ce qui a été vu, quand, et ce qu'il reste à voir — sans
jamais dépendre du réseau pour le geste du quotidien : cocher un épisode.

Le CLAUDE.md à la racine du dépôt porte les principes non négociables ; cette
note en détaille le périmètre concret, les écrans, et ce qui reste à construire.

## Les quatre principes (rappel)

1. **Les données appartiennent à l'utilisateur.** Export JSON complet à tout
   moment, identifiant TMDB comme clé universelle.
2. **Aucun geste n'attend le réseau.** Toute écriture passe d'abord par
   IndexedDB, la synchronisation part ensuite en tâche de fond.
3. **Ce qui n'est pas mesuré au moment du visionnage est perdu.** Horodatage,
   durée et plateforme sont enregistrés à chaque entrée.
4. **Le châssis est neutre, la couleur vient des affiches.** Pas de palette
   décorative fixe — deux exceptions assumées et scoping limité : les emojis de
   l'écran d'amorçage, et le style "verre liquide" (translucide, flou
   d'arrière-plan) des puces et de l'en-tête, qui reste sans teinte propre.

## Utilisateur cible

Une seule personne, potentiellement sur plusieurs appareils. Pas de notion de
compte partagé, de profils multiples ni de fonctionnalité sociale.

## Parcours utilisateur

1. **Bienvenue** (une fois) — nom de l'app, promesse en une phrase.
2. **Connexion** (optionnelle) — Google via Supabase Auth, pour retrouver ses
   données sur un autre appareil, ou "Continuer sans compte" pour rester
   strictement local. Le choix est mémorisé et ne redemande plus.
3. **Amorçage** (une fois, ou tant qu'on ne l'a pas passé) — une puce "Tout"
   puis cinq catégories thématiques (Action, Comédie, Drame, Animation,
   Science-fiction, mêlant séries et films), une seule rangée d'affiches
   visible à la fois, avec flèches de défilement. Sert à calibrer les
   premières suggestions de Découvrir. Peut être passé sans rien choisir.
4. **App principale**, quatre onglets en bas (portée du pouce) :
   - **Accueil** — le prochain épisode non vu de chaque série suivie, en
     grandes cartes façon hero (affiche pleine largeur, bouton "Vu" flottant).
   - **Ma bibliothèque** — tous les titres suivis, groupés par statut (en
     cours / à voir / terminé / abandonné). Point d'entrée vers Chercher et
     vers Découvrir, qui n'ont plus d'onglet dédié.
   - **Calendrier** — épisodes pas encore diffusés des séries suivies, avec
     date réelle récupérée sur TMDB.
   - **Statistiques** — temps total, épisodes et films vus, titre favori,
     activité des 7 derniers jours ; calculé en local, disponible même sans
     compte.
   - **Fiche** (accessible depuis une carte, un résultat de recherche ou de
     découverte, jamais un onglet en soi) — cochage épisode par épisode ou
     saison entière, note et commentaire facultatifs, bouton "vu" simple pour
     les films.
   - **Chercher** — recherche TMDB avec anti-rebond, accessible depuis l'icône
     loupe de l'en-tête et depuis Ma bibliothèque.
   - **Découvrir** — tri carte à carte (swipe ou boutons), propositions à deux
     tiers proches des goûts déclarés et un tiers d'exploration délibérée.
   - **Réglages** — export des données, gestion du compte.

Un en-tête persistant (nom de l'app + menu "⋯") permet de rejoindre Réglages
ou de se connecter/déconnecter depuis n'importe quel écran.

## Modèle de données

Quatre tables (`schema.sql`), rejouées à l'identique en IndexedDB côté
navigateur : `items` (ce qui est suivi), `entries` (chaque visionnage, avec
note et commentaire), `preferences` (verdicts du tri et de l'amorçage),
`recommendations` (scores calculés hors ligne, en lot).

Chaque ligne côté Supabase porte un `user_id` et est protégée par des policies
RLS strictes (propriétaire uniquement). Les vues de restitution
(`v_heures_par_mois`, `v_taux_abandon`, etc.) sont `security_invoker` pour ne
jamais contourner cette isolation.

## Synchronisation

Local d'abord : IndexedDB est la source de vérité, une file d'attente
("outbox") pousse les écritures vers Supabase en tâche de fond, un lot à la
fois, sans jamais bloquer un geste. À sens unique (local → distant) pour
l'instant : c'est une sauvegarde multi-appareils, pas encore une fusion de
deux historiques locaux divergents.

## Stack technique

React, Vite, Framer Motion côté interface — rien d'autre. Supabase pour
l'authentification et la synchronisation, TMDB pour les métadonnées
(recherche, fiches, saisons, titres proches, découverte par genre).

## Contraintes de conception

- Tout geste a une alternative au simple appui (le balayage est toujours
  doublé d'un bouton).
- Zones tactiles à 44 points minimum.
- Commandes principales en bas, à portée du pouce ; quatre onglets, pas plus.
- Aucune information portée par la seule couleur.
- Tailles de texte relatives, jamais de mise en page figée sur une seule
  taille d'écran.
- Étiquettes de champ visibles pendant la saisie.
- Champs de saisie à 16 px minimum.

## Hors périmètre

Le social sous toutes ses formes (partage, comptes multiples, listes
partagées). Le natif et l'App Store. Tout moteur 3D embarqué. Les
notifications push.

## Backlog restant

- Service worker pour le chargement hors connexion (les écritures marchent
  déjà hors ligne ; charger l'app elle-même sans réseau, pas encore).
- Icônes du manifeste PWA (192, 512, maskable) — absentes, empêchent une
  installation propre sur l'écran d'accueil.
- Synchronisation bidirectionnelle réelle (actuellement local → distant
  uniquement).
- Journal des commentaires et notes (les données existent, pas encore
  d'écran dédié pour les relire).
- Liste d'envies distincte du statut "à voir".
- Plateformes de streaming par titre (le champ `platform` existe dans le
  schéma, TMDB expose déjà `watch/providers` dans `details()`, non encore
  affiché).
- Bandes-annonces et casting (TMDB les expose aussi, non utilisés).
- Réimport d'un export JSON.
