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
            <div className="ligne-actions">
              <button
                type="button"
                className="action"
                onClick={async () => { await ajouterItem(t, 'watchlist'); notifier(`${t.title} ajouté à ta liste`); onAjout?.(t); }}
                aria-label={`Ajouter ${t.title} à ma liste`}
              >
                <span aria-hidden="true">＋</span>
                <span className="libelle">Ma liste</span>
              </button>
              <button
                type="button"
                className="action discret"
                onClick={async () => { await ajouterItem(t, 'completed'); notifier(`${t.title} marqué comme déjà vu`); onAjout?.(t); }}
                aria-label={`Marquer ${t.title} comme déjà vu`}
              >
                <span aria-hidden="true">✓</span>
                <span className="libelle">Déjà vu</span>
              </button>
            </div>
          </li>
        ))}
      </ul>

      {q.length >= 2 && !charge && !res.length && (
        <p className="secondaire">Aucun titre trouvé pour « {q} ».</p>
      )}
    </section>
  );
}
