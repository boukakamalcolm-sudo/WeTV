import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { details, poster } from '../lib/tmdb';

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
  return (
    <>
      <div
        className="title-modal-hero"
        style={{ backgroundImage: `linear-gradient(0deg,rgba(9,10,14,.97),rgba(9,10,14,.12)),url(${poster(data?.backdrop_path || item.posterPath, 'w780') || ''})` }}
      />
      <div className="title-modal-content">
        <p className="eyebrow">{item.mediaType === 'tv' ? 'SÉRIE' : 'FILM'}</p>
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
      </div>
    </>
  );
}
