import { useEffect, useMemo, useState } from 'react';
import { details, season as saisonTmdb, poster } from '../lib/tmdb';
import { cocher, decocher, cocherSaison, entriesDe, itemParTmdb, ajouterItem } from '../lib/store';

export default function FicheV2({ tmdbId, mediaType, onClose }) {
  const [data, setData] = useState(null);
  const [item, setItem] = useState(null);
  const [vus, setVus] = useState([]);
  const [saison, setSaison] = useState(1);
  const [episodes, setEpisodes] = useState([]);

  useEffect(() => {
    Promise.all([details(mediaType, tmdbId), itemParTmdb(tmdbId, mediaType)]).then(async ([d, i]) => {
      setData(d); setItem(i);
      if (i) setVus(await entriesDe(i.localId));
      const first = (d?.seasons || []).find((s) => s.season_number > 0)?.season_number;
      if (first) setSaison(first);
    });
  }, [tmdbId, mediaType]);

  useEffect(() => {
    if (mediaType !== 'tv') return;
    saisonTmdb(tmdbId, saison).then((s) => setEpisodes((s.episodes || []).map((e) => ({
      numero: e.episode_number, titre: e.name, duree: e.runtime, diffusion: e.air_date, image: e.still_path,
    }))));
  }, [tmdbId, mediaType, saison]);

  const vusSaison = useMemo(() => new Set(vus.filter((e) => e.season === saison).map((e) => e.episode)), [vus, saison]);
  const title = data?.name || data?.title || '';
  const year = (data?.first_air_date || data?.release_date || '').slice(0, 4);
  const genres = (data?.genres || []).slice(0, 4).map((g) => g.name).join(' · ');

  const ensureItem = async () => {
    if (item) return item;
    await ajouterItem({ tmdbId, mediaType, title, posterPath: data.poster_path, genres: (data.genres || []).map((g) => g.id), status: 'watching' });
    const n = await itemParTmdb(tmdbId, mediaType); setItem(n); return n;
  };

  const toggleEpisode = async (ep) => {
    const existing = vus.find((e) => e.season === saison && e.episode === ep.numero);
    if (existing) {
      await decocher(existing.localId); setVus((v) => v.filter((e) => e.localId !== existing.localId));
    } else {
      const n = await ensureItem();
      await cocher({ itemId: n.localId, season: saison, episode: ep.numero, runtimeMin: ep.duree, airDate: ep.diffusion });
      setVus(await entriesDe(n.localId));
    }
    window.dispatchEvent(new CustomEvent('tracker:updated'));
  };

  const markSeason = async () => {
    const n = await ensureItem();
    await cocherSaison({ itemId: n.localId, season: saison, episodes });
    setVus(await entriesDe(n.localId));
    window.dispatchEvent(new CustomEvent('tracker:updated'));
  };

  if (!data) return null;
  return <div className="title-sheet-backdrop" onClick={(e) => e.currentTarget === e.target && onClose?.()}>
    <article className="title-sheet" role="dialog" aria-modal="true">
      <button className="sheet-close" onClick={onClose} aria-label="Fermer">×</button>
      <div className="sheet-hero" style={{ backgroundImage: `linear-gradient(90deg,rgba(8,9,13,.98) 0%,rgba(8,9,13,.55) 48%,rgba(8,9,13,.1)),url(${poster(data.backdrop_path || data.poster_path, 'w1280')})` }}>
        <div className="sheet-hero-content">
          <span className="eyebrow">{mediaType === 'tv' ? 'SÉRIE' : 'FILM'}</span>
          <h1>{title}</h1>
          <p>{year}{year && genres ? ' · ' : ''}{genres}</p>
          {data.vote_average ? <strong>★ {Number(data.vote_average).toFixed(1)}</strong> : null}
        </div>
      </div>
      <div className="sheet-content">
        {data.overview && <p className="sheet-overview">{data.overview}</p>}
        {mediaType === 'movie' ? (
          <div className="sheet-actions"><button className="primary-btn">Marquer comme vu</button></div>
        ) : (
          <>
            <div className="sheet-section-head">
              <div><p className="eyebrow">SUIVI</p><h2>Épisodes</h2></div>
              <button className="secondary-btn" onClick={markSeason}>Tout cocher</button>
            </div>
            <div className="season-pills" role="tablist" aria-label="Saisons">
              {(data.seasons || []).filter((s) => s.season_number > 0).map((s) => <button key={s.season_number} className={saison === s.season_number ? 'season-pill active' : 'season-pill'} onClick={() => setSaison(s.season_number)}>S{s.season_number}</button>)}
            </div>
            <select className="season-select" value={saison} onChange={(e) => setSaison(Number(e.target.value))} aria-label="Choisir la saison">
              {(data.seasons || []).filter((s) => s.season_number > 0).map((s) => <option key={s.season_number} value={s.season_number}>Saison {s.season_number} · {s.episode_count} épisodes</option>)}
            </select>
            <div className="season-progress-line"><span>{vusSaison.size} / {episodes.length || 0} vus</span><i style={{ width: `${episodes.length ? Math.round(vusSaison.size / episodes.length * 100) : 0}%` }} /></div>
            <div className="episode-list">
              {episodes.map((ep) => {
                const seen = vusSaison.has(ep.numero);
                return <button key={ep.numero} className={seen ? 'episode-mini seen' : 'episode-mini'} onClick={() => toggleEpisode(ep)}>
                  <span className="episode-thumb" style={{ backgroundImage: `url(${poster(ep.image, 'w185') || ''})` }} />
                  <span className="episode-info"><strong><b>E{String(ep.numero).padStart(2, '0')}</b>{ep.titre}</strong><small>{ep.diffusion || 'Date inconnue'}{ep.duree ? ` · ${ep.duree} min` : ''}</small></span>
                  <span className="episode-state">{seen ? '✓' : '+'}</span>
                </button>;
              })}
            </div>
          </>
        )}
      </div>
    </article>
  </div>;
}
