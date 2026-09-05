import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { details, poster, season as saisonTmdb } from '../lib/tmdb';
import { entriesDe, cocher, decocher, cocherSaison, majStatut } from '../lib/store';
import { verifierCompletionSerie } from '../lib/completion';

// Popup partagée entre Accueil et Bibliothèque : un seul endroit pour ouvrir
// les infos d'une œuvre, plutôt que deux implémentations qui divergent.
export function useTitleModal() {
  const [selected, setSelected] = useState(null);

  const open = async (item) => {
    setSelected({ item, loading: true });
    try {
      const data = await details(item.mediaType, item.tmdbId);
      setSelected({ item, data, loading: false });
    } catch {
      setSelected({ item, data: null, loading: false });
    }
  };

  return { selected, open, close: () => setSelected(null) };
}

export default function TitleModal({ selected, onClose }) {
  return (
    <AnimatePresence>
      {selected && (
        <motion.div
          className="modal-backdrop"
          role="presentation"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Feuille qui remonte du bas avec un léger rebond : plus proche du
              pouce que centrer un dialogue, et le ressort donne la texture
              demandée sans dépendre d'une seule image de fond. */}
          <motion.div
            className="title-modal"
            role="dialog"
            aria-modal="true"
            aria-label={selected.item.title}
            onClick={(e) => e.stopPropagation()}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 22 }}
          >
            <span className="title-modal-grip" aria-hidden="true" />
            <button className="modal-close" onClick={onClose} aria-label="Fermer">×</button>
            <TitleModalContenu selected={selected} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function TitleModalContenu({ selected }) {
  const { item, data, loading } = selected;
  const estSerie = item.mediaType === 'tv';
  return (
    <>
      <div
        className="title-modal-hero"
        style={{ backgroundImage: `linear-gradient(0deg,rgba(9,10,14,.97),rgba(9,10,14,.12)),url(${poster(data?.backdrop_path || item.posterPath, 'w780') || ''})` }}
      />
      <div className="title-modal-content">
        <p className="eyebrow">{estSerie ? 'SÉRIE' : 'FILM'}</p>
        <h2>{data?.title || data?.name || item.title}</h2>
        <div className="title-meta">
          {data?.vote_average ? `★ ${data.vote_average.toFixed(1)}` : ''}
          {data?.release_date || data?.first_air_date ? ` · ${(data.release_date || data.first_air_date).slice(0, 4)}` : ''}
          {data?.runtime ? ` · ${data.runtime} min` : ''}
        </div>
        {loading ? (
          <p className="subtitle">Chargement des informations…</p>
        ) : (
          <p className="title-overview">{data?.overview || 'Aucun synopsis disponible pour ce titre.'}</p>
        )}
        {data?.genres?.length > 0 && (
          <div className="title-genres">
            {data.genres.slice(0, 5).map((g) => <span key={g.id}>{g.name}</span>)}
          </div>
        )}

        {!loading && item.localId != null && (estSerie
          ? <EpisodesPanel item={item} data={data} />
          : <FilmAction item={item} data={data} />)}
      </div>
    </>
  );
}

// Un film n'a pas de progression : il est vu ou il ne l'est pas.
function FilmAction({ item, data }) {
  const [vu, setVu] = useState(item.status === 'completed');
  const [enCours, setEnCours] = useState(false);

  async function basculer() {
    setEnCours(true);
    try {
      if (!vu) {
        await cocher({ itemId: item.localId, season: null, episode: null, runtimeMin: data?.runtime || null });
        await majStatut(item.localId, 'completed');
      } else {
        await majStatut(item.localId, 'watchlist');
      }
      setVu((v) => !v);
      dispatchEvent(new CustomEvent('tracker:updated'));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="episodes-panel">
      <button
        type="button"
        className={vu ? 'episode-row film-toggle watched' : 'episode-row film-toggle'}
        onClick={basculer}
        disabled={enCours}
        aria-pressed={vu}
      >
        <span className="episode-check" aria-hidden="true">{vu ? '✓' : ''}</span>
        <span className="episode-info"><strong>{vu ? 'Déjà vu' : 'Marquer comme vu'}</strong></span>
      </button>
    </div>
  );
}

// Liste des épisodes d'une saison, cochable un par un ou d'un coup.
function EpisodesPanel({ item, data }) {
  const [entries, setEntries] = useState(null);
  const [saison, setSaison] = useState(null);
  const [episodes, setEpisodes] = useState(null);
  const [chargeSaison, setChargeSaison] = useState(false);

  const saisons = useMemo(() => (data?.seasons || []).filter((s) => s.season_number > 0), [data]);

  useEffect(() => { entriesDe(item.localId).then(setEntries); }, [item.localId]);

  const vus = useMemo(() => {
    const m = new Map();
    (entries || []).filter((e) => e.episode != null).forEach((e) => m.set(`${e.season}-${e.episode}`, e.localId));
    return m;
  }, [entries]);

  // Ouvre par défaut sur la première saison qui a un épisode non vu.
  useEffect(() => {
    if (!saisons.length || entries === null || saison != null) return;
    for (const s of saisons) {
      let vusDansSaison = 0;
      for (const cle of vus.keys()) if (cle.startsWith(`${s.season_number}-`)) vusDansSaison += 1;
      if (vusDansSaison < s.episode_count) { setSaison(s.season_number); return; }
    }
    setSaison(saisons.at(-1).season_number);
  }, [saisons, entries, vus, saison]);

  useEffect(() => {
    if (saison == null) return;
    let annule = false;
    setChargeSaison(true);
    setEpisodes(null);
    saisonTmdb(item.tmdbId, saison)
      .then((d) => { if (!annule) setEpisodes(d.episodes || []); })
      .catch(() => { if (!annule) setEpisodes([]); })
      .finally(() => { if (!annule) setChargeSaison(false); });
    return () => { annule = true; };
  }, [saison, item.tmdbId]);

  async function toggle(ep) {
    const cle = `${saison}-${ep.episode_number}`;
    const entryId = vus.get(cle);
    if (entryId) await decocher(entryId);
    else await cocher({ itemId: item.localId, season: saison, episode: ep.episode_number, runtimeMin: ep.runtime || data?.episode_run_time?.[0] || null, airDate: ep.air_date || null });
    setEntries(await entriesDe(item.localId));
    await verifierCompletionSerie(item.localId);
    dispatchEvent(new CustomEvent('tracker:updated'));
  }

  async function toutCocher() {
    if (!episodes?.length) return;
    await cocherSaison({
      itemId: item.localId,
      season: saison,
      episodes: episodes.map((e) => ({ numero: e.episode_number, duree: e.runtime || data?.episode_run_time?.[0] || null, diffusion: e.air_date })),
    });
    setEntries(await entriesDe(item.localId));
    await verifierCompletionSerie(item.localId);
    dispatchEvent(new CustomEvent('tracker:updated'));
  }

  if (!saisons.length) return null;

  return (
    <div className="episodes-panel">
      <div className="season-tabs" role="tablist" aria-label="Saisons">
        {saisons.map((s) => (
          <button
            key={s.season_number}
            type="button"
            role="tab"
            aria-selected={saison === s.season_number}
            className={saison === s.season_number ? 'season-tab active' : 'season-tab'}
            onClick={() => setSaison(s.season_number)}
          >
            Saison {s.season_number}
          </button>
        ))}
      </div>

      {chargeSaison || episodes === null ? (
        <p className="subtitle">Chargement des épisodes…</p>
      ) : (
        <>
          <button type="button" className="season-mark-all" onClick={toutCocher}>
            ✓ Tout marquer comme vu
          </button>
          <ul className="episode-list">
            {episodes.map((ep) => {
              const vu = vus.has(`${saison}-${ep.episode_number}`);
              return (
                <li key={ep.id}>
                  <button
                    type="button"
                    className={vu ? 'episode-row watched' : 'episode-row'}
                    aria-pressed={vu}
                    onClick={() => toggle(ep)}
                  >
                    <span className="episode-check" aria-hidden="true">{vu ? '✓' : ''}</span>
                    <span className="episode-info">
                      <strong>{ep.episode_number}. {ep.name}</strong>
                      <small>
                        {ep.air_date ? new Date(ep.air_date).toLocaleDateString('fr-FR') : 'Date inconnue'}
                        {ep.runtime ? ` · ${ep.runtime} min` : ''}
                        {vu ? ' · Vu' : ''}
                      </small>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
