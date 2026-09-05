import { useEffect, useMemo, useState } from 'react';
import { items as itemsStore, entries as entriesStore } from '../lib/store';
import { details, poster } from '../lib/tmdb';

const GROUPES = [
  { statut: 'watching', label: 'En cours' },
  { statut: 'watchlist', label: 'À voir' },
  { statut: 'dropped', label: 'Abandonné' },
  { statut: 'completed', label: 'Terminé' },
];

export default function Bibliotheque() {
  const [items, setItems] = useState(null);
  const [entries, setEntries] = useState([]);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('smart');
  const [selected, setSelected] = useState(null);

  async function load() {
    const [data, history] = await Promise.all([itemsStore(), entriesStore()]);
    setItems(data);
    setEntries(history);
  }

  useEffect(() => { load(); const refresh = () => load(); window.addEventListener('tracker:updated', refresh); return () => window.removeEventListener('tracker:updated', refresh); }, []);

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
      .filter(i => !q || i.title.toLowerCase().includes(q))
      .map(i => ({ ...i, watchedCount: counts.get(i.localId) || 0, latestWatched: latest.get(i.localId) || 0 }))
      .sort((a, b) => {
        const rank = { watching: 0, watchlist: 1, dropped: 2, completed: 3 };
        if (sort === 'smart') return (rank[a.status] - rank[b.status]) || ((b.latestWatched || b.updatedAt || 0) - (a.latestWatched || a.updatedAt || 0));
        if (sort === 'recent') return (b.latestWatched || b.updatedAt || 0) - (a.latestWatched || a.updatedAt || 0);
        if (sort === 'title') return a.title.localeCompare(b.title, 'fr');
        return (b.watchedCount - a.watchedCount) || a.title.localeCompare(b.title, 'fr');
      });
  }, [items, entries, query, sort]);

  async function openTitle(item) {
    setSelected({ item, loading: true });
    try {
      const data = await details(item.mediaType, item.tmdbId);
      setSelected({ item, data, loading: false });
    } catch {
      setSelected({ item, data: null, loading: false });
    }
  }

  if (items === null) return <div className="ecran" aria-busy="true" />;

  return (
    <section className="ecran bibliotheque-screen">
      <div className="library-head">
        <div><p className="eyebrow">TA COLLECTION</p><h1>📚 Ma bibliothèque</h1><p className="subtitle">Retrouve tout ton suivi au même endroit.</p></div>
        <div className="raccourcis"><a className="action" href="#/recherche">⌕ Chercher</a><a className="action" href="#/decouvrir">✦ Découvrir</a></div>
      </div>

      <div className="library-toolbar">
        <label className="library-search"><span>⌕</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Rechercher dans ma bibliothèque" /></label>
        <select className="library-sort" value={sort} onChange={e => setSort(e.target.value)} aria-label="Trier la bibliothèque">
          <option value="smart">Organisation intelligente</option><option value="recent">Plus récent</option><option value="title">A → Z</option><option value="count">Plus regardé</option>
        </select>
      </div>

      {!rows.length && <div className="watchflow-empty"><strong>Ta bibliothèque est vide.</strong><p>Ajoute une œuvre depuis la recherche pour commencer ton suivi.</p><a className="watchflow-add" href="#/recherche">Chercher un titre</a></div>}

      {GROUPES.map(({ statut, label }) => {
        const list = rows.filter(i => i.status === statut);
        if (!list.length) return null;
        return <section key={statut} className={`library-group library-group-${statut}`}>
          <div className="section-title-row compact"><div><p className="eyebrow">{statut === 'completed' ? 'ARCHIVE' : 'SUIVI'}</p><h2>{label} ({list.length})</h2></div></div>
          <div className="library-grid">
            {list.map(i => <button className="library-card" key={i.localId} onClick={() => openTitle(i)}>
              <img src={poster(i.posterPath, 'w342') || ''} alt="" loading="lazy" />
              <div className="library-card-body"><strong>{i.title}</strong><span>{i.mediaType === 'tv' ? 'Série' : 'Film'}{i.watchedCount ? ` · ${i.watchedCount} vu${i.watchedCount > 1 ? 's' : ''}` : ''}</span>{i.status === 'watching' && <div className="mini-progress"><i style={{ width: `${Math.min(96, Math.max(8, i.watchedCount * 8))}%` }} /></div>}</div>
            </button>)}
          </div>
        </section>;
      })}

      {selected && <TitleModal selected={selected} onClose={() => setSelected(null)} />}
    </section>
  );
}

function TitleModal({ selected, onClose }) {
  const { item, data, loading } = selected;
  return <div className="modal-backdrop" role="presentation" onClick={onClose}>
    <div className="title-modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
      <button className="modal-close" onClick={onClose} aria-label="Fermer">×</button>
      <div className="title-modal-hero" style={{ backgroundImage: `linear-gradient(0deg,rgba(9,10,14,.97),rgba(9,10,14,.12)),url(${poster(data?.backdrop_path ? data.backdrop_path : item.posterPath, 'w780') || ''})` }} />
      <div className="title-modal-content">
        <p className="eyebrow">{item.mediaType === 'tv' ? 'SÉRIE' : 'FILM'}</p>
        <h2>{data?.title || data?.name || item.title}</h2>
        <div className="title-meta">{data?.vote_average ? `★ ${data.vote_average.toFixed(1)}` : ''}{data?.release_date || data?.first_air_date ? ` · ${(data.release_date || data.first_air_date).slice(0,4)}` : ''}{data?.runtime ? ` · ${data.runtime} min` : ''}</div>
        {loading ? <p className="subtitle">Chargement des informations…</p> : <p className="title-overview">{data?.overview || 'Aucun synopsis disponible pour ce titre.'}</p>}
        {data?.genres?.length > 0 && <div className="title-genres">{data.genres.slice(0,5).map(g => <span key={g.id}>{g.name}</span>)}</div>}
        <div className="title-modal-actions"><a className="watchflow-add" href={`#/titre/${item.mediaType}/${item.tmdbId}`}>Ouvrir la fiche</a><button className="action" onClick={onClose}>Fermer</button></div>
      </div>
    </div>
  </div>;
}
