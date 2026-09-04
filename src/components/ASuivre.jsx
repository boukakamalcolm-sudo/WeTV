import { useEffect, useState } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { aSuivre, cocher } from '../lib/store';
import { poster } from '../lib/tmdb';

// L'interface reste neutre : la couleur vient des affiches, pas du châssis.
// Zones tactiles à 44 points minimum, conformément au guide DISIC.

export default function ASuivre() {
  const [liste, setListe] = useState(null);

  useEffect(() => { aSuivre().then(setListe); }, []);

  if (liste === null) return <Squelette />;
  if (!liste.length) return <Vide />;

  // Retrait optimiste : la carte part, l'écriture suit. On ne remonte jamais d'erreur ici.
  const valider = (serie) => {
    setListe((l) => l.filter((s) => s.localId !== serie.localId));
    cocher({
      itemId: serie.localId,
      season: serie.prochaine,
      episode: serie.prochain,
      runtimeMin: serie.runtimeMin,
    });
  };

  return (
    <section className="pile">
      <h1>À suivre</h1>
      {liste.map((serie) => (
        <Carte key={serie.localId} serie={serie} onValider={() => valider(serie)} />
      ))}
    </section>
  );
}

function Carte({ serie, onValider }) {
  const x = useMotionValue(0);
  const opacite = useTransform(x, [0, 120], [1, 0.4]);

  return (
    <motion.article
      className="carte"
      style={{ x, opacity: opacite }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.25}
      onDragEnd={(_, info) => { if (info.offset.x > 110) onValider(); }}
    >
      <a className="carte-lien" href={`#/titre/tv/${serie.tmdbId}`}>
        <img
          src={poster(serie.posterPath)}
          alt=""
          width="64"
          height="96"
          loading="lazy"
        />

        <div className="texte">
          <h2>{serie.title}</h2>
          <p>Saison {serie.prochaine}, épisode {serie.prochain}</p>
        </div>
      </a>

      {/* Alternative non gestuelle au balayage, exigée par le critère 14.4 du RGAA.
          C'est aussi le chemin le plus fiable à une main. */}
      <button
        type="button"
        className="valider"
        onClick={onValider}
        aria-label={`Marquer l'épisode ${serie.prochain} de ${serie.title} comme vu`}
      >
        <span aria-hidden="true">✓</span>
        <span className="libelle">Vu</span>
      </button>
    </motion.article>
  );
}

// L'état vide est une invitation, pas une excuse.
const Vide = () => (
  <section className="vide">
    <h1>Rien en attente</h1>
    <p>Ajoute une série pour voir apparaître ton prochain épisode ici.</p>
    <a className="valider" href="#/recherche">Chercher une série</a>
  </section>
);

const Squelette = () => (
  <section className="pile" aria-busy="true" aria-label="Chargement">
    {[0, 1, 2].map((i) => <div key={i} className="carte fantome" />)}
  </section>
);
