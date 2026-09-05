import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { aSuivre, cocher, items, entries } from '../lib/store';
import { poster, season } from '../lib/tmdb';

export default function WatchFlowHome() {
  const [watching, setWatching] = useState([]);
  const [recent, setRecent] = useState([]);
  const [stats, setStats] = useState({ hours: 0, episodes: 0, movies: 0, favorite: '—' });
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [next, allItems, allEntries] = await Promise.all([aSuivre(), items(), entries()]);
      const itemById = new Map(allItems.map((i) => [i.localId, i]));
      const watchedByItem = new Map();
      for (const e of allEntries) {
        if (!watchedByItem.has(e.itemId)) watchedByItem.set(e.itemId, []);
        watchedByItem.get(e.itemId).push(e);
      }

      const cards = next.map((show) => {
        const item = itemById.get(show.localId);
        const watched = watchedByItem.get(show.localId) || [];
        const watchedEpisodes = watched.filter((e) => e.episode != null).length;
        const estimatedTotal = Number(show.totalEpisodes || item?.totalEpisodes || 0);
        const progress = estimatedTotal ? Math.min(100, Math.round((watchedEpisodes / estimatedTotal) * 100)) : 0;
        return { ...show, item, progress, art: poster(show.posterPath || item?.posterPath, 'w780') };
      });

      cards.sort((a, b) => {
        if (a.item?.status === 'completed' && b.item?.status !== 'completed') return 1;
        if (a.item?.status !== 'completed' && b.item?.status === 'completed') return -1;
        return (b.item?.updatedAt || 0) - (a.item?.updatedAt || 0);
      });
      setWatching(cards);

      const sortedRecent = [...allEntries]
        .sort((a, b) => new Date(b.watchedAt) - new Date(a.watchedAt))
        .slice(0, 5)
        .map((entry) => ({ ...entry, item: itemById.get(entry.itemId) }));
      setRecent(sortedRecent);

      const total = allEntries.reduce((sum, e) => sum + Number(e.runtimeMin || 0), 0);
      const episodeCount = allEntries.filter((e) => e.episode != null).length;
      const movieCount = allEntries.filter((e) => e.episode == null).length;
      const counts = new Map();
      for (const e of allEntries) counts.set(e.itemId, (counts.get(e.itemId) || 0) + 1);
      const fav = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      const favTitle = itemById.get(fav)?.title || '—';
      setStats({ hours: Math.round((total / 60) * 10) / 10, episodes: episodeCount, movies: movieCount, favorite: favTitle });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const refresh = () => load();
    window.addEventListener('focus', refresh);
    window.addEventListener('tracker:updated', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('tracker:updated', refresh);
    };
  }, []);

  async function markAsSeen(show) {
    await cocher({ itemId: show.localId, season: show.prochaine, episode: show.prochain, runtimeMin: show.runtimeMin, watchedAt: new Date().toISOString() });
    window.dispatchEvent(new CustomEvent('tracker:updated'));
  }

  return (
    <div className="watchflow-home">
      <section className="watchflow-head">
        <div>
          <p className="eyebrow">TON SUIVI</p>
          <h1>Bonsoir Malcolm <span aria-hidden="true">👋</span></h1>
          <p className="subtitle">Reprends exactement là où tu t'es arrêté.</p>
        </div>
        <a className="watchflow-add" href="#/recherche">＋ Ajouter</a>
      </section>

      <section>
        <div className="section-title-row compact">
          <div><p className="eyebrow">EN COURS</p><h2>Continuer à regarder</h2></div>
          {watching.length > 0 && <a className="link-btn" href="#/bibliotheque">Tout voir →</a>}
        </div>
        {loading ? (
          <div className="watchflow-empty">Chargement de ta bibliothèque…</div>
        ) : watching.length ? (
          <div className="watchflow-cards">
            {watching.slice(0, 3).map((show, index) => (
              <motion.article key={show.localId} className={`watchflow-card ${index === 0 ? 'featured' : ''}`} whileTap={{ scale: 0.99 }}>
                <div className="watchflow-art" style={{ backgroundImage: `url(${show.art || ''})` }} />
                <div className="watchflow-overlay" />
                <div className="watchflow-copy">
                  <span>{show.mediaType === 'movie' ? 'FILM' : 'SÉRIE'}</span>
                  <h3>{show.title}</h3>
                  <p>{show.mediaType === 'tv' ? `Saison ${show.prochaine} • Épisode ${show.prochain}` : `${show.progress}% vu`}</p>
                  <div className="watchflow-progress"><i style={{ width: `${show.progress}%` }} /></div>
                </div>
                <button className="watchflow-play" onClick={() => markAsSeen(show)} aria-label={`Marquer ${show.title} comme vu`}>✓</button>
              </motion.article>
            ))}
          </div>
        ) : (
          <div className="watchflow-empty">
            <strong>Ta prochaine soirée commence ici.</strong>
            <p>Ajoute une série ou un film pour voir ton suivi apparaître ici.</p>
            <a className="watchflow-add" href="#/recherche">Chercher un titre</a>
          </div>
        )}
      </section>

      <section className="watchflow-stats">
        <Stat label="Watchtime total" value={`${stats.hours} h`} note="Depuis le début" icon="◷" />
        <Stat label="Épisodes vus" value={stats.episodes} note="Historique" icon="✓" />
        <Stat label="Films terminés" value={stats.movies} note="Historique" icon="★" />
        <Stat label="Titre favori" value={stats.favorite} note="Le plus regardé" icon="⚡" />
      </section>

      <section className="watchflow-lower">
        <div className="watchflow-panel">
          <div className="section-title-row compact"><div><p className="eyebrow">TON RYTHME</p><h2>Activité cette semaine</h2></div><span className="watchflow-pill">7 derniers jours</span></div>
          <WeekChart entries={recent} />
        </div>
        <div className="watchflow-panel">
          <div className="section-title-row compact"><div><p className="eyebrow">HISTORIQUE</p><h2>Vu récemment</h2></div></div>
          <div className="watchflow-history">
            {recent.length ? recent.map((r) => <div className="watchflow-history-item" key={r.localId}><div className="watchflow-thumb" style={{ backgroundImage: `url(${poster(r.item?.posterPath, 'w185') || ''})` }} /><div><strong>{r.item?.title || 'Titre'}</strong><span>{r.episode ? `S${r.season} E${r.episode}` : 'Film'} • {r.runtimeMin || 0} min</span></div></div>) : <p className="subtitle">Ton historique apparaîtra ici.</p>}
          </div>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, note, icon }) {
  return <div className="watchflow-stat"><div className="watchflow-stat-icon">{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{note}</small></div></div>;
}

function WeekChart({ entries }) {
  const now = new Date();
  const values = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now); d.setHours(0,0,0,0); d.setDate(now.getDate() - (6 - i));
    return entries.filter(e => { const x = new Date(e.watchedAt); return x.toDateString() === d.toDateString(); }).reduce((s,e)=>s + Number(e.runtimeMin || 0), 0);
  });
  const max = Math.max(1, ...values);
  return <div className="watchflow-chart">{values.map((v, i) => <div className="bar-wrap" key={i}><div className="bar" style={{ height: `${Math.max(8, (v / max) * 100)}%` }} /><small>{['L','M','M','J','V','S','D'][i]}</small></div>)}</div>;
}
