import { useEffect, useState } from 'react';
import { search, poster } from '../lib/tmdb';
import { ajouterItem } from '../lib/store';
import { notifier } from '../lib/toast';

export default function Recherche({ onAjout }) {
  const [q, setQ] = useState('');
  const [res, setRes] = useState([]);
  const [charge, setCharge] = useState(false);

  // Anti-rebond : on interroge TMDB quand la frappe se calme, pas à chaque touche.
  useEffect(() => {
    if (q.trim().length < 2) { setRes([]); return; }
    setCharge(true);
    const t = setTimeout(() => {
      search(q).then(setRes).catch(() => setRes([])).finally(() => setCharge(false));
    }, 280);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <section className="ecran">
      {/* L'étiquette reste visible pendant la saisie : pas de texte de substitution seul. */}
      <label className="champ" htmlFor="q">Chercher une série, un film, un documentaire</label>
      <input
        id="q"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoComplete="off"
        enterKeyHint="search"
      />

      <ul className="resultats" aria-busy={charge}>
        {res.map((t) => (
          <li key={`${t.mediaType}-${t.tmdbId}`} className="ligne">
            <a className="ligne-lien" href={`#/titre/${t.mediaType}/${t.tmdbId}`}>
              <img src={poster(t.posterPath)} alt="" width="48" height="72" loading="lazy" />
              <div className="texte">
                <h2>{t.title}</h2>
                <p>
                  {t.mediaType === 'tv' ? 'Série' : 'Film'}
                  {t.year && ` · ${t.year}`}
                  {t.documentaire && <span className="badge">Documentaire</span>}
                </p>
              </div>
            </a>
            <button
              type="button"
              className="action"
              onClick={async () => { await ajouterItem(t); notifier(`${t.title} ajouté à ta bibliothèque`); onAjout?.(t); }}
              aria-label={`Suivre ${t.title}`}
            >
              <span aria-hidden="true">+</span>
              <span className="libelle">Suivre</span>
            </button>
          </li>
        ))}
      </ul>

      {q.length >= 2 && !charge && !res.length && (
        <p className="secondaire">Aucun titre trouvé pour « {q} ».</p>
      )}
    </section>
  );
}
