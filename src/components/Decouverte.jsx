import { useEffect, useState } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { poster } from '../lib/tmdb';
import { grilleAmorcage, propositions } from '../lib/reco';
import { jugerTitre, ajouterItem } from '../lib/store';

// Deux temps. La grille pour amorcer, plus rapide parce qu'on balaye l'ensemble
// d'un coup d'oeil. Puis le tri carte à carte, qui affine en continu.

export function Amorcage({ onFini }) {
  const [titres, setTitres] = useState([]);
  const [choisis, setChoisis] = useState(new Set());

  useEffect(() => { grilleAmorcage().then(setTitres); }, []);

  const basculer = (t) => {
    const cle = `${t.mediaType}:${t.tmdbId}`;
    setChoisis((s) => {
      const n = new Set(s);
      n.has(cle) ? n.delete(cle) : n.add(cle);
      return n;
    });
  };

  const valider = async () => {
    for (const t of titres) {
      const cle = `${t.mediaType}:${t.tmdbId}`;
      await jugerTitre({
        tmdbId: t.tmdbId,
        mediaType: t.mediaType,
        verdict: choisis.has(cle) ? 'like' : 'unseen',
        source: 'onboarding',
      });
    }
    onFini?.();
  };

  return (
    <section className="ecran">
      <h1>Ce que tu as aimé</h1>
      <p className="secondaire">Touche les titres que tu as vus et appréciés. Cinq suffisent pour démarrer.</p>

      <ul className="grille">
        {titres.map((t) => {
          const actif = choisis.has(`${t.mediaType}:${t.tmdbId}`);
          return (
            <li key={`${t.mediaType}-${t.tmdbId}`}>
              <button
                type="button"
                className={actif ? 'vignette choisie' : 'vignette'}
                aria-pressed={actif}
                onClick={() => basculer(t)}
              >
                <img src={poster(t.posterPath)} alt={t.title} loading="lazy" />
                {/* L'état choisi n'est pas porté par la seule couleur. */}
                {actif && <span className="marque" aria-hidden="true">✓</span>}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="pied fixe">
        <button type="button" className="action primaire" onClick={valider} disabled={!choisis.size}>
          Continuer ({choisis.size})
        </button>
      </div>
    </section>
  );
}

export function Tri() {
  const [pile, setPile] = useState([]);

  useEffect(() => { propositions().then(setPile); }, []);

  const juger = async (t, verdict) => {
    setPile((p) => p.filter((x) => x.tmdbId !== t.tmdbId));   // retrait optimiste
    await jugerTitre({ tmdbId: t.tmdbId, mediaType: t.mediaType, verdict });
    if (verdict === 'like') await ajouterItem(t);
    setPile((p) => (p.length <= 3 ? p : p));
  };

  if (!pile.length) return <p className="ecran secondaire">Plus rien à trier pour le moment.</p>;

  const [haut, ...reste] = pile;

  return (
    <section className="ecran tri">
      <Carte titre={haut} onJuger={juger} key={haut.tmdbId} />

      {/* Alternative non gestuelle au balayage, et chemin le plus fiable à une main. */}
      <div className="pied fixe">
        <button type="button" className="action" onClick={() => juger(haut, 'dislike')}>Pas pour moi</button>
        <button type="button" className="action" onClick={() => juger(haut, 'unseen')}>Jamais vu</button>
        <button type="button" className="action primaire" onClick={() => juger(haut, 'like')}>J'aime</button>
      </div>

      <p className="secondaire compte">{reste.length} propositions en attente</p>
    </section>
  );
}

function Carte({ titre, onJuger }) {
  const x = useMotionValue(0);
  const rotation = useTransform(x, [-200, 200], [-8, 8]);
  const opacite = useTransform(x, [-200, 0, 200], [0.3, 1, 0.3]);

  return (
    <motion.article
      className="carte-tri"
      style={{ x, rotate: rotation, opacity: opacite }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.3}
      onDragEnd={(_, info) => {
        if (info.offset.x > 120) onJuger(titre, 'like');
        else if (info.offset.x < -120) onJuger(titre, 'dislike');
      }}
    >
      <img src={poster(titre.posterPath, 'w342')} alt="" />
      <div className="legende">
        <h2>{titre.title}</h2>
        <p className="secondaire">{titre.year} · {titre.raison}</p>
      </div>
    </motion.article>
  );
}
