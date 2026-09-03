# Tracker de séries et films personnel

Application perso, mono-utilisateur. Lire `note-de-cadrage-tracker-series.md`
pour le périmètre et le backlog, `schema.sql` pour le modèle de données.

## Quatre principes, non négociables

**1. Les données appartiennent à l'utilisateur.** Export JSON complet disponible
en permanence. Aucun format propriétaire. L'identifiant TMDB sert de clé de
référence universelle.

**2. Aucun geste n'attend le réseau.** Toute écriture va d'abord dans IndexedDB
et repart plus tard via l'outbox. Si un `await` réseau apparaît entre un clic et
un rendu, c'est une régression. Le cochage d'un épisode est le geste central.

**3. Ce qui n'est pas mesuré au moment du visionnage est perdu.** Chaque entrée
enregistre horodatage, durée, plateforme. Même sans écran de statistiques.

**4. Le châssis est neutre, la couleur vient des affiches.** Pas de palette
décorative. La teinte dominante de l'affiche habille la fiche, le texte bascule
selon la luminosité pour tenir 4,5:1.

## Contraintes de conception

- Tout geste a une alternative au simple appui (balayage doublé d'un bouton).
- Zones tactiles à 44 points minimum.
- Commandes principales en bas, à portée du pouce. Quatre onglets, pas plus.
- Aucune information portée par la seule couleur : coche et libellé systématiques.
- Tailles de texte relatives, pour suivre le réglage système. Jamais de mise en
  page figée sur une seule taille d'écran.
- Étiquettes de champ visibles pendant la saisie, pas de placeholder seul.
- Champs de saisie à 16px minimum, sinon iOS zoome.

## Ce qui est hors périmètre

Le social sous toutes ses formes. Le natif et l'App Store. Tout moteur 3D
embarqué. Les notifications push, reportées après la mise en service.

## Dépendances

React, Vite, Framer Motion. Rien d'autre côté interface. Supabase pour la
synchro, TMDB pour les métadonnées. Toute nouvelle dépendance doit être justifiée.
