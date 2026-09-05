import { useEffect, useMemo, useState } from 'react';
import { items as itemsStore, entries as entriesStore } from '../lib/store';
import { poster } from '../lib/tmdb';
import TitleModal, { useTitleModal } from './TitleModal';

const GROUPES = [
  { statut: 'watching', label: 'En cours' },
  { statut: 'watchlist', label: 'À voir' },
  { statut: 'completed', label: 'Terminé' },
  { statut: 'dropped', label: 'Abandonné' },
];

export default function Bibliotheque() {
  const [items, setItems] = useState(null);
  const [entries, setEntries] = useState([]);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('smart');
  const { selected, open, close } = useTitleModal();

  async function load() {
    const [data, history] = await Promise.all([itemsStore(), entriesStore()]);
    setItems(data);
    setEntries(history);
  }

  useEffect(() => {
    load();
    const f = () => load();
    addEventListener('tracker:updated', f);
    addEventListener('focus', f);
    return () => { removeEventListener('tracker:updated', f); removeEventListener('focus', f); };
  }, []);

  const rows = useMemo(() => {
    if (!items) return [];
    const q = query.trim().toLowerCase();
    const counts = new Map();
    const latest = new Map();
    for (const e of entries) {
      counts.set(e.itemId, (counts.get(e.itemId) || 0) + 1);
      const ts = new Date(e.watchedAt || e.createdAt || 0).getTime();
      latest.set(e.itemId, Math.max(latest.get(e.itemId) || 0, ts));
    }
    return items
      .filter((i) => !q || i.title.toLowerCase().includes(q))
      .map((i) => ({ ...i, watchedCount: counts.get(i.localId) || 0, latestWatched: latest.get(i.localId) || 0 }))
      .sort((a, b) => {
        const rank = { watching: 0, watchlist: 1, dropped: 2, completed: 3 };
        if (sort === 'smart') return rank[a.status] - rank[b.status] || (b.latestWatched || b.updatedAt || 0) - (a.latestWatched || a.updatedAt || 0);
        if (sort === 'recent') return (b.latestWatched || b.updatedAt || 0) - (a.latestWatched || a.updatedAt || 0);
        if (sort === 'title') return a.title.localeCompare(b.title, 'fr');
        return b.watchedCount - a.watchedCount || a.title.localeCompare(b.title, 'fr');
      });
  }, [items, entries, query, sort]);

  if (!items) return <div className="ecran" aria-busy="true" />;

  return (
    <section className="ecran bibliotheque-screen">
      <div className="library-head">
        <div>
          <p className="eyebrow">TA COLLECTION</p>
          <h1>📚 Ma bibliothèque</h1>
          <p className="subtitle">{items.length} œuvre{items.length > 1 ? 's' : ''} suivie{items.length > 1 ? 's' : ''}</p>
        </div>
        <div className="raccourcis">
          <a className="action" href="#/recherche"><span aria-hidden="true">⌕</span> Chercher</a>
          <a className="action" href="#/decouvrir"><span aria-hidden="true">✦</span> Découvrir</a>
        </div>
      </div>

      <div className="library-toolbar">
        {/* Étiquette réellement associée au champ, pas juste une icône décorative. */}
        <label className="library-search" htmlFor="library-query">
          <span aria-hidden="true">⌕</span>
          <input
            id="library-query"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher dans ma bibliothèque…"
          />
        </label>
        <select className="library-sort" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Trier la bibliothèque">
          <option value="smart">Organisation intelligente</option>
          <option value="recent">Plus récent</option>
          <option value="title">A → Z</option>
          <option value="count">Plus regardé</option>
        </select>
      </div>

      {!rows.length ? (
        <div className="watchflow-empty">
          <strong>Ta bibliothèque est vide.</strong>
          <p>Ajoute une œuvre depuis la recherche pour commencer ton suivi.</p>
          <a className="watchflow-add" href="#/recherche">Chercher un titre</a>
        </div>
      ) : GROUPES.map((g) => {
        const list = rows.filter((i) => i.status === g.statut);
        if (!list.length) return null;
        return (
          <section key={g.statut} className={`library-group library-group-${g.statut}`}>
            <div className="section-title-row compact">
              <div>
                <p className="eyebrow">{g.statut === 'completed' ? 'ARCHIVE' : 'SUIVI'}</p>
                <h2>{g.label} ({list.length})</h2>
              </div>
            </div>
            <div className="library-grid">
              {list.map((i) => (
                <button
                  className="library-card"
                  key={i.localId}
                  onClick={() => open(i)}
                  aria-label={`Voir les informations de ${i.title}`}
                >
                  <img src={poster(i.posterPath, 'w342') || ''} alt="" loading="lazy" />
                  <div className="library-card-body">
                    <strong>{i.title}</strong>
                    <span>
                      {i.mediaType === 'tv' ? 'Série' : 'Film'}
                      {i.watchedCount ? ` · ${i.watchedCount} vu${i.watchedCount > 1 ? 's' : ''}` : ''}
                    </span>
                    {/* Un film est vu ou non : une barre de progression n'a de sens que pour une série. */}
                    {i.status === 'watching' && i.mediaType === 'tv' && (
                      <div className="mini-progress">
                        <i style={{ width: `${Math.min(96, Math.max(8, i.watchedCount * 8))}%` }} />
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </section>
        );
      })}

      <TitleModal selected={selected} onClose={close} />
    </section>
  );
}
