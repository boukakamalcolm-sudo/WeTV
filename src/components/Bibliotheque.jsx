import { useEffect, useState } from 'react';
import { items as itemsStore } from '../lib/store';
import { poster } from '../lib/tmdb';

const GROUPES = [
  { statut: 'watching', label: 'En cours' },
  { statut: 'watchlist', label: 'À voir' },
  { statut: 'completed', label: 'Terminé' },
  { statut: 'dropped', label: 'Abandonné' },
];

export default function Bibliotheque() {
  const [items, setItems] = useState(null);

  useEffect(() => { itemsStore().then(setItems); }, []);

  if (items === null) return <div className="ecran" aria-busy="true" />;

  return (
    <section className="ecran">
      <h1>📚 Ma bibliothèque</h1>

      {/* Chercher et Découvrir n'ont plus d'onglet dédié : ils partent d'ici. */}
      <div className="raccourcis">
        <a className="action" href="#/recherche">
          <span aria-hidden="true">⌕</span> Chercher un titre
        </a>
        <a className="action" href="#/decouvrir">
          <span aria-hidden="true">✦</span> Découvrir
        </a>
      </div>

      {!items.length && (
        <p className="secondaire">Rien dans ta bibliothèque pour l'instant.</p>
      )}

      {GROUPES.map(({ statut, label }) => {
        const liste = items.filter((i) => i.status === statut);
        if (!liste.length) return null;
        return (
          <div key={statut}>
            <h2>{label} ({liste.length})</h2>
            <ul className="resultats">
              {liste.map((i) => (
                <li key={i.localId} className="ligne">
                  <a className="ligne-lien" href={`#/titre/${i.mediaType}/${i.tmdbId}`}>
                    <img src={poster(i.posterPath)} alt="" width="48" height="72" loading="lazy" />
                    <div className="texte">
                      <h2>{i.title}</h2>
                      <p>{i.mediaType === 'tv' ? 'Série' : 'Film'}</p>
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}
