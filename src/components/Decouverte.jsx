import { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { poster } from '../lib/tmdb';
import { grilleAmorcage, propositions } from '../lib/reco';
import { jugerTitre, ajouterItem } from '../lib/store';

// Deux temps. La grille pour amorcer, plus rapide parce qu'on balaye l'ensemble
// d'un coup d'oeil. Puis le tri carte à carte, qui affine en continu.

export function Amorcage({ onFini }) {
  const [categories, setCategories] = useState([]);
  const [choisis, setChoisis] = useState(new Set());
  const [categorieId, setCategorieId] = useState('tout');
  const rangeeRef = useRef(null);

  useEffect(() => { grilleAmorcage().then(setCategories); }, []);

  const categorie = categories.find((c) => c.id === categorieId);

  const basculer = (t) => {
    const cle = `${t.mediaType}:${t.tmdbId}`;
    setChoisis((s) => {
      const n = new Set(s);
      n.has(cle) ? n.delete(cle) : n.add(cle);
      return n;
    });
  };

  // Un même titre peut apparaître dans "Tout" et dans sa catégorie propre :
  // la Map ne l'écrit qu'une fois, quel que soit le nombre de rangées où il figure.
  const valider = async () => {
    const tous = new Map();
    for (const cat of categories) {
      for (const t of cat.titres) tous.set(`${t.mediaType}:${t.tmdbId}`, t);
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

  const defiler = (sens) => rangeeRef.current?.scrollBy({ left: sens * 320, behavior: 'smooth' });

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

      {/* Une seule catégorie à la fois : pas de rangées empilées, la hauteur d'écran ne bouge pas. */}
      <div className="puces-genre" role="group" aria-label="Catégorie">
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            className={categorieId === cat.id ? 'puce active' : 'puce'}
            aria-pressed={categorieId === cat.id}
            onClick={() => setCategorieId(cat.id)}
          >
            <span aria-hidden="true">{cat.emoji}</span> {cat.label}
          </button>
        ))}
      </div>

      {categorie && (
        <div className="rangee-defilement">
          <button
            type="button"
            className="fleche fleche-gauche"
            aria-label="Défiler vers la gauche"
            onClick={() => defiler(-1)}
          >‹</button>

          <ul className="defilement" ref={rangeeRef}>
            {categorie.titres.map((t) => {
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

          <button
            type="button"
            className="fleche fleche-droite"
            aria-label="Défiler vers la droite"
            onClick={() => defiler(1)}
          >›</button>
        </div>
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
  const [chargement, setChargement] = useState(true);

  useEffect(() => { propositions().then((p) => { setPile(p); setChargement(false); }); }, []);

  // "J'aime" ne suffit plus : on distingue une envie (à voir plus tard) d'un
  // souvenir (déjà vu ailleurs), sinon la bibliothèque se remplit de titres
  // dont le statut réel est faux dès l'ajout.
  const juger = async (t, action) => {
    setPile((p) => p.filter((x) => x.tmdbId !== t.tmdbId));   // retrait optimiste
    if (action === 'dislike') {
      await jugerTitre({ tmdbId: t.tmdbId, mediaType: t.mediaType, verdict: 'dislike' });
    } else {
      await jugerTitre({ tmdbId: t.tmdbId, mediaType: t.mediaType, verdict: 'like' });
      await ajouterItem(t, action); // 'watchlist' ou 'completed'
    }
  };

  if (chargement) return <div className="ecran tri" aria-busy="true" />;
  if (!pile.length) return (
    <section className="ecran tri">
      <div className="tri-vide">
        <span aria-hidden="true">✦</span>
        <strong>Plus rien à trier pour le moment.</strong>
        <p className="secondaire">Reviens plus tard, de nouvelles suggestions arriveront.</p>
      </div>
    </section>
  );

  const [haut, second, ...reste] = pile;

  return (
    <section className="ecran tri">
      <div className="tri-head">
        <p className="eyebrow">POUR TOI</p>
        <h1>Découvrir</h1>
        <p className="subtitle">Balaye ou choisis une réponse : chaque avis affine tes prochaines suggestions.</p>
      </div>

      <div className="tri-pile">
        {second && <Carte titre={second} pile aria-hidden="true" />}
        <Carte titre={haut} onJuger={juger} key={haut.tmdbId} />
      </div>

      {/* Alternative non gestuelle au balayage, et chemin le plus fiable à une main. */}
      <div className="tri-actions">
        <button type="button" className="tri-btn tri-btn-non" onClick={() => juger(haut, 'dislike')} aria-label="Pas pour moi">
          <span aria-hidden="true">✕</span><small>Pas pour moi</small>
        </button>
        <button type="button" className="tri-btn tri-btn-liste" onClick={() => juger(haut, 'watchlist')} aria-label="Ajouter à ma liste">
          <span aria-hidden="true">＋</span><small>Ma liste</small>
        </button>
        <button type="button" className="tri-btn tri-btn-vu" onClick={() => juger(haut, 'completed')} aria-label="Déjà vu">
          <span aria-hidden="true">✓</span><small>Déjà vu</small>
        </button>
      </div>

      <p className="secondaire compte">{reste.length + 1} proposition{reste.length ? 's' : ''} en attente</p>
    </section>
  );
}

function Carte({ titre, onJuger, pile }) {
  const x = useMotionValue(0);
  const rotation = useTransform(x, [-200, 200], [-8, 8]);
  const opacite = useTransform(x, [-200, 0, 200], [0.3, 1, 0.3]);

  if (pile) {
    return (
      <article className="carte-tri carte-tri-fond" aria-hidden="true">
        <img src={poster(titre.posterPath, 'w342')} alt="" />
      </article>
    );
  }

  return (
    <motion.article
      className="carte-tri"
      style={{ x, rotate: rotation, opacity: opacite }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.3}
      onDragEnd={(_, info) => {
        if (info.offset.x > 120) onJuger(titre, 'watchlist');
        else if (info.offset.x < -120) onJuger(titre, 'dislike');
      }}
    >
      <img src={poster(titre.posterPath, 'w342')} alt="" />
      <div className="carte-overlay" aria-hidden="true" />
      <div className="legende">
        <h2>{titre.title}</h2>
        <p className="secondaire">{titre.year} · {titre.raison}</p>
      </div>
    </motion.article>
  );
}
