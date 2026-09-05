import { useEffect, useState } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { poster } from '../lib/tmdb';
import { grilleAmorcage, propositions } from '../lib/reco';
import { jugerTitre, ajouterItem } from '../lib/store';

// Deux temps. La grille pour amorcer, plus rapide parce qu'on balaye l'ensemble
// d'un coup d'oeil. Puis le tri carte à carte, qui affine en continu.

export function Amorcage({ onFini }) {
  const [categories, setCategories] = useState([]);
  const [choisis, setChoisis] = useState(new Set());
  const [type, setType] = useState('tv');
  const [genreId, setGenreId] = useState(null);

  useEffect(() => {
    grilleAmorcage().then((cats) => {
      setCategories(cats);
      setGenreId(cats.find((c) => c.cle === 'tv')?.genres[0]?.id ?? null);
    });
  }, []);

  const categorie = categories.find((c) => c.cle === type);
  const genre = categorie?.genres.find((g) => g.id === genreId);

  // Changer de type change aussi les genres disponibles : on repart du premier.
  const changerType = (t) => {
    setType(t);
    setGenreId(categories.find((c) => c.cle === t)?.genres[0]?.id ?? null);
  };

  const basculer = (t) => {
    const cle = `${t.mediaType}:${t.tmdbId}`;
    setChoisis((s) => {
      const n = new Set(s);
      n.has(cle) ? n.delete(cle) : n.add(cle);
      return n;
    });
  };

  // Un même titre peut apparaître dans plusieurs genres : on ne l'écrit qu'une fois.
  const valider = async () => {
    const tous = new Map();
    for (const cat of categories) {
      for (const g of cat.genres) {
        for (const t of g.titres) tous.set(`${t.mediaType}:${t.tmdbId}`, t);
      }
    }
    for (const [cle, t] of tous) {
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
    <section className="ecran amorcage">
      <h1>👋 Bienvenue dans ta bibliothèque</h1>
      <p className="secondaire">
        Touche les titres que tu as déjà vus et appréciés. Cinq suffisent pour démarrer :
        ça sert à calibrer tes premières suggestions sur <strong>Découvrir</strong>, en te
        proposant à la fois des titres proches de tes goûts et, volontairement, quelques
        pistes différentes — pour ne pas t'enfermer dans les mêmes recommandations. Tu
        peux aussi passer cette étape et revenir choisir plus tard.
      </p>

      {/* Un seul type à la fois : pas de rangées empilées, la hauteur d'écran ne bouge pas. */}
      <div className="onglets-type" role="group" aria-label="Type de titre">
        {categories.map((cat) => (
          <button
            key={cat.cle}
            type="button"
            className={type === cat.cle ? 'action primaire' : 'action'}
            aria-pressed={type === cat.cle}
            onClick={() => changerType(cat.cle)}
          >
            <span aria-hidden="true">{cat.emoji}</span> {cat.label}
          </button>
        ))}
      </div>

      {categorie && (
        <div className="puces-genre" role="group" aria-label="Genre">
          {categorie.genres.map((g) => (
            <button
              key={g.id}
              type="button"
              className={genreId === g.id ? 'puce active' : 'puce'}
              aria-pressed={genreId === g.id}
              onClick={() => setGenreId(g.id)}
            >
              {g.label}
            </button>
          ))}
        </div>
      )}

      {genre && (
        <ul className="defilement">
          {genre.titres.map((t) => {
            const actif = choisis.has(`${t.mediaType}:${t.tmdbId}`);
            return (
              <li key={`${t.mediaType}-${t.tmdbId}`}>
                <button
                  type="button"
                  className={actif ? 'vignette choisie' : 'vignette'}
                  aria-pressed={actif}
                  aria-label={t.title}
                  onClick={() => basculer(t)}
                >
                  <img src={poster(t.posterPath, 'w342')} alt="" loading="lazy" />
                  {/* L'état choisi n'est pas porté par la seule couleur. */}
                  {actif && <span className="marque" aria-hidden="true">✅</span>}
                </button>
                <p className="vignette-titre">{t.title}</p>
              </li>
            );
          })}
        </ul>
      )}

      <div className="pied fixe">
        <button type="button" className="action primaire" onClick={valider} disabled={!choisis.size}>
          Continuer ({choisis.size})
        </button>
        <button type="button" className="action discret" onClick={() => onFini?.()}>
          Passer cette étape
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
