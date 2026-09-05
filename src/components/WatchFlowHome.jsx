import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { aSuivre, cocher, items, entries, ajouterItem } from '../lib/store';
import { poster, search } from '../lib/tmdb';
import { notifier } from '../lib/toast';
import { prenom } from '../lib/auth';
import TitleModal, { useTitleModal } from './TitleModal';

export default function WatchFlowHome({ utilisateur }) {
  const [watching, setWatching] = useState([]);
  const [recent, setRecent] = useState([]);
  const [stats, setStats] = useState({ hours: 0, episodes: 0, movies: 0, favorite: '—' });
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const { selected, open, close } = useTitleModal();

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
      setWatching(next.map((show) => {
        const watched = watchedByItem.get(show.localId) || [];
        const episodes = watched.filter((e) => e.episode != null).length;
        const total = Number(show.totalEpisodes || itemById.get(show.localId)?.totalEpisodes || 0);
        return { ...show, progress: total ? Math.min(100, Math.round((episodes / total) * 100)) : 0, art: poster(show.backdropPath || show.posterPath, 'w780') };
      }));

      const grouped = new Map();
      for (const e of allEntries) {
        const item = itemById.get(e.itemId);
        if (!item) continue;
        const current = grouped.get(e.itemId);
        if (!current || new Date(e.watchedAt).getTime() > new Date(current.latest.watchedAt).getTime()) grouped.set(e.itemId, { item, latest: e, count: (current?.count || 0) + 1 });
        else current.count += 1;
      }
      setRecent([...grouped.values()].sort((a,b)=>new Date(b.latest.watchedAt)-new Date(a.latest.watchedAt)).slice(0,5));

      const total = allEntries.reduce((s,e)=>s+Number(e.runtimeMin||0),0);
      const episodes = allEntries.filter(e=>e.episode!=null).length;
      const movies = allEntries.filter(e=>e.episode==null).length;
      const counts = new Map(); for (const e of allEntries) counts.set(e.itemId,(counts.get(e.itemId)||0)+1);
      const favId=[...counts.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0];
      setStats({hours:Math.round(total/60*10)/10,episodes,movies,favorite:itemById.get(favId)?.title||'—'});
    } finally { setLoading(false); }
  }

  useEffect(()=>{load();const f=()=>load();window.addEventListener('focus',f);window.addEventListener('tracker:updated',f);return()=>{window.removeEventListener('focus',f);window.removeEventListener('tracker:updated',f)}},[]);

  useEffect(()=>{
    if (!adding || query.trim().length < 2) { setResults([]); setSearching(false); return; }
    setSearching(true);
    const timer = setTimeout(() => search(query).then(setResults).catch(()=>setResults([])).finally(()=>setSearching(false)), 280);
    return () => clearTimeout(timer);
  },[query,adding]);

  async function markAsSeen(show){
    await cocher({itemId:show.localId,season:show.prochaine,episode:show.prochain,runtimeMin:show.runtimeMin});
    window.dispatchEvent(new CustomEvent('tracker:updated'));
  }

  async function addTitle(t, statut){
    await ajouterItem(t, statut);
    notifier(statut==='completed' ? `${t.title} marqué comme déjà vu` : `${t.title} ajouté à ta liste`);
    setQuery(''); setResults([]); setAdding(false);
    window.dispatchEvent(new CustomEvent('tracker:updated'));
  }

  const nom = prenom(utilisateur);

  return <div className="watchflow-home">
    <section className="watchflow-head"><p className="eyebrow">TON SUIVI</p><div className="watchflow-head-row"><h1>Bonsoir{nom ? ` ${nom}` : ''} <span aria-hidden="true">👋</span></h1><button className="watchflow-add" type="button" onClick={()=>setAdding(v=>!v)}>{adding?'× Fermer':'＋ Ajouter'}</button></div><p className="subtitle">Reprends exactement là où tu t'es arrêté.</p></section>

    {adding && <section className="quick-add"><label htmlFor="quick-add-input">Ajouter une série ou un film</label><div className="home-search"><span>⌕</span><input id="quick-add-input" autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="Commence à taper un titre…" autoComplete="off" /></div>{searching&&<p className="subtitle">Recherche…</p>}{!searching&&results.length>0&&<div className="quick-add-results">{results.slice(0,6).map(t=><div className="quick-add-row" key={`${t.mediaType}-${t.tmdbId}`}><img src={poster(t.posterPath,'w185')} alt=""/><span><strong>{t.title}</strong><small>{t.mediaType==='tv'?'Série':'Film'}{t.year?` · ${t.year}`:''}</small></span><span className="quick-add-actions"><button type="button" className="action" onClick={()=>addTitle(t,'watchlist')} aria-label={`Ajouter ${t.title} à ma liste`}><span aria-hidden="true">＋</span><span className="libelle">Ma liste</span></button><button type="button" className="action discret" onClick={()=>addTitle(t,'completed')} aria-label={`Marquer ${t.title} comme déjà vu`}><span aria-hidden="true">✓</span><span className="libelle">Déjà vu</span></button></span></div>)}</div>}{!searching&&query.trim().length>=2&&!results.length&&<p className="subtitle">Aucun titre trouvé.</p>}</section>}

    <section><div className="section-title-row compact"><div><p className="eyebrow">EN COURS</p><h2>Continuer à regarder</h2></div>{watching.length>0&&<a className="link-btn" href="#/bibliotheque">Tout voir →</a>}</div>{loading?<div className="watchflow-empty">Chargement de ta bibliothèque…</div>:watching.length?<div className="watchflow-cards">{watching.slice(0,6).map((show,i)=><motion.article key={show.localId} className={`watchflow-card ${i===0?'featured':''}`} whileTap={{scale:.99}} onClick={()=>open(show)}><div className="watchflow-art" style={{backgroundImage:`url(${show.art||''})`}}/><div className="watchflow-overlay"/><div className="watchflow-copy"><span>{show.mediaType==='movie'?'FILM':'SÉRIE'}</span><h3>{show.title}</h3><p>{show.mediaType==='movie'?'À reprendre':`Saison ${show.prochaine} • Épisode ${show.prochain}`}</p><div className="watchflow-progress"><i style={{width:`${show.progress}%`}}/></div></div><button className="watchflow-play" onClick={(e)=>{e.stopPropagation();markAsSeen(show);}} aria-label="Marquer comme vu">✓</button></motion.article>)}</div>:<div className="watchflow-empty"><strong>Ta prochaine soirée commence ici.</strong><p>Ajoute une série ou un film pour voir ton suivi apparaître ici.</p><button className="watchflow-add" type="button" onClick={()=>setAdding(true)}>Chercher un titre</button></div>}</section>

    <section className="watchflow-discover"><div className="section-title-row compact"><div><p className="eyebrow">POUR TOI</p><h2>Découvrir</h2></div><a className="link-btn" href="#/decouvrir">Explorer →</a></div><a className="discover-card" href="#/decouvrir"><div className="discover-copy"><span>UNE IDÉE POUR CE SOIR</span><h3>Fais-toi surprendre.</h3><p>Des recommandations proches de tes goûts, avec une place volontaire pour la découverte.</p><span className="watchflow-add">Voir la sélection</span></div><div className="discover-orb" aria-hidden="true">✦</div></a></section>

    <section className="watchflow-stats"><Stat label="Watchtime total" value={`${stats.hours} h`} note="Depuis le début" icon="◷"/><Stat label="Épisodes vus" value={stats.episodes} note="Historique" icon="✓"/><Stat label="Films vus" value={stats.movies} note="Historique" icon="★"/><Stat label="Titre favori" value={stats.favorite} note="Le plus regardé" icon="⚡"/></section>
    <section className="watchflow-lower"><div className="watchflow-panel"><div className="section-title-row compact"><div><p className="eyebrow">TON RYTHME</p><h2>Activité cette semaine</h2></div><span className="watchflow-pill">7 derniers jours</span></div><WeekChart entries={recent.map(x=>x.latest)}/></div><div className="watchflow-panel"><div className="section-title-row compact"><div><p className="eyebrow">HISTORIQUE</p><h2>Vu récemment</h2></div></div><div className="watchflow-history">{recent.length?recent.map(r=><div className="watchflow-history-item" key={r.item.localId}><div className="watchflow-thumb" style={{backgroundImage:`url(${poster(r.item.posterPath,'w185')||''})`}}/><div><strong>{r.item.title}</strong><span>{r.item.mediaType==='tv'?`${r.count} épisode${r.count>1?'s':''} • dernier vu S${r.latest.season} E${r.latest.episode}`:`Film • ${r.latest.runtimeMin||0} min`}</span></div></div>):<p className="subtitle">Ton historique apparaîtra ici.</p>}</div></div></section>

    <TitleModal selected={selected} onClose={close} />
  </div>;
}
function Stat({label,value,note,icon}){return <div className="watchflow-stat"><div className="watchflow-stat-icon">{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{note}</small></div></div>}
function WeekChart({entries}){const now=new Date();const values=Array.from({length:7},(_,i)=>{const d=new Date(now);d.setHours(0,0,0,0);d.setDate(now.getDate()-(6-i));return entries.filter(e=>new Date(e.watchedAt).toDateString()===d.toDateString()).reduce((s,e)=>s+Number(e.runtimeMin||0),0)});const max=Math.max(1,...values);return <div className="watchflow-chart">{values.map((v,i)=><div className="bar-wrap" key={i}><div className="bar" style={{height:`${Math.max(8,v/max*100)}%`}}/><small>{['L','M','M','J','V','S','D'][i]}</small></div>)}</div>}
