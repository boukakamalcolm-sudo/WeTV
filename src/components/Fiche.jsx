import { useEffect, useState } from 'react';
import { details, season as saisonTmdb, poster } from '../lib/tmdb';
import { cocher, decocher, cocherSaison, annoter, entriesDe, itemParTmdb, ajouterItem } from '../lib/store';

export default function Fiche({ tmdbId, mediaType }) {
  const [fiche, setFiche] = useState(null); const [item, setItem] = useState(null); const [vus, setVus] = useState([]); const [saison, setSaison] = useState(1); const [episodes, setEpisodes] = useState([]); const [annote, setAnnote] = useState(null);
  useEffect(()=>{details(mediaType,tmdbId).then(setFiche); itemParTmdb(tmdbId,mediaType).then(async i=>{setItem(i);if(i)setVus(await entriesDe(i.localId));});},[tmdbId,mediaType]);
  useEffect(()=>{if(mediaType==='tv')saisonTmdb(tmdbId,saison).then(s=>setEpisodes((s.episodes||[]).map(e=>({numero:e.episode_number,titre:e.name,duree:e.runtime,diffusion:e.air_date}))))},[tmdbId,mediaType,saison]);
  const vusSaison=new Set(vus.filter(e=>e.season===saison).map(e=>e.episode));
  const assurerItem=async()=>{if(item)return item;await ajouterItem({tmdbId,mediaType,title:fiche.name??fiche.title,posterPath:fiche.poster_path,genres:(fiche.genres??[]).map(g=>g.id),status:'watching'});const n=await itemParTmdb(tmdbId,mediaType);setItem(n);return n};
  const basculer=async ep=>{const ex=vus.find(e=>e.season===saison&&e.episode===ep.numero);if(ex){setVus(v=>v.filter(e=>e.localId!==ex.localId));await decocher(ex.localId);return}const n=await assurerItem();const optimistic={localId:-Date.now(),season:saison,episode:ep.numero};setVus(v=>[...v,optimistic]);await cocher({itemId:n.localId,season:saison,episode:ep.numero,runtimeMin:ep.duree,airDate:ep.diffusion});setVus(await entriesDe(n.localId));window.dispatchEvent(new CustomEvent('tracker:updated'))};
  const basculerFilm=async()=>{if(vus[0]){await decocher(vus[0].localId);setVus([]);return}const n=await assurerItem();await cocher({itemId:n.localId,runtimeMin:fiche.runtime});setVus(await entriesDe(n.localId));window.dispatchEvent(new CustomEvent('tracker:updated'))};
  if(!fiche)return <div className="ecran" aria-busy="true"/>;
  return <div className="modal-backdrop-app" role="presentation" onClick={e=>{if(e.target===e.currentTarget)location.hash=mediaType==='tv'?'/bibliotheque':'/bibliotheque'}}><article className="work-modal" role="dialog" aria-modal="true">
    <button className="modal-close-app" onClick={()=>location.hash='/bibliotheque'} aria-label="Fermer">×</button>
    <div className="work-hero" style={{backgroundImage:`linear-gradient(90deg,rgba(8,9,13,.95) 5%,rgba(8,9,13,.5),rgba(8,9,13,.18)),url(${poster(fiche.backdrop_path||fiche.poster_path,'w780')})`}}>
      <div className="work-hero-copy"><span className="eyebrow">{mediaType==='tv'?'SÉRIE':'FILM'}</span><h1>{fiche.name??fiche.title}</h1><p>{fiche.first_air_date?.slice(0,4)??fiche.release_date?.slice(0,4)} · {(fiche.genres??[]).slice(0,3).map(g=>g.name).join(' · ')}</p></div>
    </div>
    <div className="work-body"><p className="work-overview">{fiche.overview || 'Aucun synopsis disponible pour cette œuvre.'}</p>
      {mediaType==='movie' ? <button className="primary-btn" onClick={basculerFilm}>{vus.length?'✓ Vu':'Marquer comme vu'}</button> : <>
        <div className="season-toolbar"><select aria-label="Saison" value={saison} onChange={e=>setSaison(+e.target.value)}>{(fiche.seasons||[]).filter(s=>s.season_number>0).map(s=><option key={s.season_number} value={s.season_number}>Saison {s.season_number} · {s.episode_count} épisodes</option>)}</select><button className="secondary-btn" onClick={async()=>{const n=await assurerItem();await cocherSaison({itemId:n.localId,season:saison,episodes});setVus(await entriesDe(n.localId));window.dispatchEvent(new CustomEvent('tracker:updated'))}}>Tout cocher</button></div>
        <ul className="episodes-modal">{episodes.map(ep=>{const vu=vusSaison.has(ep.numero);return <li key={ep.numero} className={vu?'episode-card seen':'episode-card'}><button className="episode-check" aria-pressed={vu} onClick={()=>basculer(ep)}>{vu?'✓':''}</button><div><strong>E{String(ep.numero).padStart(2,'0')} · {ep.titre}</strong><span>{ep.diffusion||'Date inconnue'}{ep.duree?` · ${ep.duree} min`:''}</span></div></li>})}</ul>
      </>}
      {mediaType==='tv'&&<button className="ghost-link" onClick={()=>setAnnote(vus.find(e=>e.season===saison&&e.episode===[...vusSaison][0])||null)}>Ajouter une note / commentaire</button>}
      {annote&&<Annotation entree={annote} onFermer={()=>setAnnote(null)} onValider={async v=>{await annoter(annote.localId,v);setAnnote(null)}}/>}
    </div>
  </article></div>
}
function Annotation({entree,onFermer,onValider}){const[note,setNote]=useState(entree.rating??0);const[texte,setTexte]=useState(entree.comment??'');return <div className="annotation-sheet"><div className="section-title-row"><h2>Ton avis</h2><button className="modal-close-app" onClick={onFermer}>×</button></div><div className="rating-row">{[1,2,3,4,5].map(n=><button key={n} className="rating-btn" aria-pressed={note===n} onClick={()=>setNote(n)}>★</button>)}</div><label className="champ" htmlFor="commentaire">Commentaire</label><textarea id="commentaire" value={texte} onChange={e=>setTexte(e.target.value)} /><div className="pied"><button className="secondary-btn" onClick={onFermer}>Annuler</button><button className="primary-btn" onClick={()=>onValider({rating:note||null,comment:texte||null})}>Enregistrer</button></div></div>}
