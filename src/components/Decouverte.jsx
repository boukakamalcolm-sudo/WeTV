import { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { poster } from '../lib/tmdb';
import { grilleAmorcage, propositions } from '../lib/reco';
import { jugerTitre, ajouterItem } from '../lib/store';
import { marquerToutVu } from '../lib/completion';

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

// Direction de sortie par action : gauche pour un rejet, droite pour une
// envie, vers le haut pour "déjà vu" — chaque bouton a sa propre trajectoire,
// pas seulement l'effet de bord d'un retrait instantané de la liste.
const SORTIES = {
  dislike: { x: -420, y: 0 },
  watchlist: { x: 420, y: 0 },
  completed: { x: 0, y: -520 },
};
const DUREE_SORTIE = 260;

export function Tri() {
  const [pile, setPile] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [sortie, setSortie] = useState(null); // { id, ...trajectoire } de la carte en cours de sortie

  useEffect(() => { propositions().then((p) => { setPile(p); setChargement(false); }); }, []);

  // "J'aime" ne suffit plus : on distingue une envie (à voir plus tard) d'un
  // souvenir (déjà vu ailleurs), sinon la bibliothèque se remplit de titres
  // dont le statut réel est faux dès l'ajout.
  const juger = async (t, action) => {
    if (sortie) return; // une sortie est déjà en cours, laisse l'animation finir
    setSortie({ id: t.tmdbId, ...SORTIES[action] });
    setTimeout(() => {
      setPile((p) => p.filter((x) => x.tmdbId !== t.tmdbId));
      setSortie(null);
    }, DUREE_SORTIE);
    if (action === 'dislike') {
      await jugerTitre({ tmdbId: t.tmdbId, mediaType: t.mediaType, verdict: 'dislike' });
    } else {
      await jugerTitre({ tmdbId: t.tmdbId, mediaType: t.mediaType, verdict: 'like' });
      const localId = await ajouterItem(t, action === 'completed' ? 'watchlist' : action);
      if (action === 'completed') await marquerToutVu(localId);
      dispatchEvent(new CustomEvent('tracker:updated'));
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
        <Carte titre={haut} onJuger={juger} sortieVers={sortie?.id === haut.tmdbId ? sortie : null} key={haut.tmdbId} />
      </div>

      {/* Alternative non gestuelle au balayage, et chemin le plus fiable à une main. */}
      <div className="tri-actions">
        <motion.button type="button" className="tri-btn tri-btn-non" whileTap={{ scale: 0.88 }} onClick={() => juger(haut, 'dislike')} aria-label="Pas pour moi">
          <span aria-hidden="true">✕</span><small>Pas pour moi</small>
        </motion.button>
        <motion.button type="button" className="tri-btn tri-btn-liste" whileTap={{ scale: 0.88 }} onClick={() => juger(haut, 'watchlist')} aria-label="Ajouter à ma liste">
          <span aria-hidden="true">＋</span><small>Ma liste</small>
        </motion.button>
        <motion.button type="button" className="tri-btn tri-btn-vu" whileTap={{ scale: 0.88 }} onClick={() => juger(haut, 'completed')} aria-label="Déjà vu">
          <span aria-hidden="true">✓</span><small>Déjà vu</small>
        </motion.button>
      </div>

      <p className="secondaire compte">{reste.length + 1} proposition{reste.length ? 's' : ''} en attente</p>
    </section>
  );
}

function Carte({ titre, onJuger, pile, sortieVers }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotation = useTransform(x, [-500, 500], [-20, 20]);
  const opacite = useTransform(x, [-200, 0, 200], [0.3, 1, 0.3]);

  // Anime la sortie déclenchée par un bouton, avec la même texture que le
  // relâcher d'un balayage — pas juste un retrait instantané de la pile.
  useEffect(() => {
    if (!sortieVers) return;
    const c1 = animate(x, sortieVers.x, { duration: DUREE_SORTIE / 1000, ease: 'easeIn' });
    const c2 = animate(y, sortieVers.y, { duration: DUREE_SORTIE / 1000, ease: 'easeIn' });
    return () => { c1.stop(); c2.stop(); };
  }, [sortieVers]);

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
      style={{ x, y, rotate: rotation, opacity: opacite }}
      drag={sortieVers ? false : 'x'}
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
