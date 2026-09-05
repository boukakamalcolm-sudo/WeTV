import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { aSuivre, cocher, items, entries } from '../lib/store';
import { poster } from '../lib/tmdb';

const fallbackCards = [
  { title: 'Severance', meta: 'Saison 2 • Épisode 6', progress: 64, art: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=80' },
  { title: 'The Bear', meta: 'Saison 3 • Épisode 4', progress: 38, art: 'https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=1200&q=80' },
  { title: 'Dune: Part Two', meta: 'Film • 47%', progress: 47, art: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80' },
];

export default function WatchFlowHome() {
  const [watching, setWatching] = useState(null);
  const [recent, setRecent] = useState([]);
  const [stats, setStats] = useState({ hours: 0, episodes: 0, movies: 0, favorite: '—' });

  async function load() {
    const [next, allItems, allEntries] = await Promise.all([aSuivre(), items(), entries()]);
    setWatching(next);
    const sorted = [...allEntries].sort((a, b) => b.watchedAt - a.watchedAt).slice(0, 5).map((entry) => ({
      ...entry,
      item: allItems.find((i) => i.localId === entry.itemId),
    }));
    setRecent(sorted);
    const total = allEntries.reduce((sum, e) => sum + Number(e.runtimeMin || 0), 0);
    const episodeCount = allEntries.filter((e) => e.episode != null).length;
    const movieCount = allEntries.filter((e) => e.episode == null).length;
    const counts = new Map();
    for (const e of allEntries) counts.set(e.itemId, (counts.get(e.itemId) || 0) + 1);
    const fav = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    const favTitle = allItems.find((i) => i.localId === fav)?.title || '—';
    setStats({ hours: Math.round((total / 60) * 10) / 10, episodes: episodeCount, movies: movieCount, favorite: favTitle });
  }

  useEffect(() => { load(); window.addEventListener('focus', load); return () => window.removeEventListener('focus', load); }, []);

  const live = watching?.length ? watching.slice(0, 3).map((show, index) => ({ ...show, progress: Math.min(92, 18 + index * 17), art: poster(show.posterPath, 'w780') })) : fallbackCards;

  async function markAsSeen(show) {
    await cocher({ itemId: show.localId, season: show.prochaine, episode: show.prochain, runtimeMin: show.runtimeMin });
    await load();
  }

  return (
    <div className="watchflow-home">
      <section className="watchflow-head">
        <div>
          <p className="eyebrow">SAMEDI 5 SEPTEMBRE</p>
          <h1>Bonsoir Malcolm <span aria-hidden="true">👋</span></h1>
          <p className="subtitle">Prêt à reprendre là où tu t'es arrêté ?</p>
        </div>
        <a className="watchflow-add" href="#/recherche">＋ Ajouter</a>
      </section>

      <section>
        <div className="section-title-row compact">
          <div><p className="eyebrow">EN COURS</p><h2>Continuer à regarder</h2></div>
          <a className="link-btn" href="#/bibliotheque">Tout voir →</a>
        </div>
        <div className="watchflow-cards">
          {live.map((show, index) => (
            <motion.article key={`${show.tmdbId || show.title}-${index}`} className={`watchflow-card ${index === 0 ? 'featured' : ''}`} whileTap={{ scale: 0.99 }}>
              <div className="watchflow-art" style={{ backgroundImage: `url(${show.art})` }} />
              <div className="watchflow-overlay" />
              <div className="watchflow-copy">
                <span>{show.mediaType === 'movie' ? 'FILM' : 'SÉRIE'}</span>
                <h3>{show.title}</h3>
                <p>{show.meta || `Saison ${show.prochaine} • Épisode ${show.prochain}`}</p>
                <div className="watchflow-progress"><i style={{ width: `${show.progress || 0}%` }} /></div>
              </div>
              {show.localId && <button className="watchflow-play" onClick={() => markAsSeen(show)} aria-label={`Marquer ${show.title} comme vu`}>▶</button>}
            </motion.article>
          ))}
        </div>
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
            {recent.length ? recent.map((r) => <div className="watchflow-history-item" key={r.localId}><div className="watchflow-thumb" style={{ backgroundImage: `url(${poster(r.item?.posterPath, 'w185')})` }} /><div><strong>{r.item?.title || 'Titre'}</strong><span>{r.episode ? `S${r.season} E${r.episode}` : 'Film'} • {r.runtimeMin || 0} min</span></div></div>) : <p className="subtitle">Ton historique apparaîtra ici.</p>}
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
