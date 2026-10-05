import { useEffect, useMemo, useState } from 'react';
import { search, poster } from '../lib/tmdb';
import { listerFavoris, ajouterFavori, retirerFavori } from '../lib/favoris';

const cleTitre = (tmdbId, mediaType) => `${mediaType}-${tmdbId}`;
const libelleType = (t) => (t === 'tv' ? 'Série' : 'Film');

export default function Favoris() {
  const [favoris, setFavoris] = useState(null);
  const [requete, setRequete] = useState('');
  const [resultats, setResultats] = useState([]);
  const [erreur, setErreur] = useState('');
  const [filtre, setFiltre] = useState('tous');

  useEffect(() => {
    listerFavoris().then(setFavoris).catch((e) => setErreur(e.message));
  }, []);

  // Anti-rebond : pas un appel TMDB par touche frappée.
  useEffect(() => {
    const q = requete.trim();
    if (q.length < 2) { setResultats([]); return; }
    const t = setTimeout(() => search(q).then(setResultats).catch(() => setResultats([])), 300);
    return () => clearTimeout(t);
  }, [requete]);

  const parCle = useMemo(
    () => new Map((favoris || []).map((f) => [cleTitre(f.tmdb_id, f.media_type), f])),
    [favoris],
  );

  async function ajouter(titre) {
    setErreur('');
    try {
      const f = await ajouterFavori(titre);
      setFavoris((liste) => [...liste.filter((x) => x.id !== f.id), f].sort((a, b) => a.title.localeCompare(b.title)));
    } catch (e) {
      setErreur(e.message);
    }
  }

  async function retirer(f) {
    setErreur('');
    const avant = favoris;
    setFavoris((liste) => liste.filter((x) => x.id !== f.id));
    try {
      await retirerFavori(f.id);
    } catch (e) {
      setFavoris(avant);
      setErreur(e.message);
    }
  }

  const affiches = (favoris || []).filter((f) => filtre === 'tous' || f.media_type === filtre);

  return (
    <section className="page">
      <p className="eyebrow">FAVORIS</p>
      <h1>Ce que je surveille</h1>
      <p className="subtitle">Chaque favori alimente le calendrier : épisodes pour les séries, sorties ciné et streaming en France pour les films.</p>

      {erreur && <p className="alerte" role="alert">{erreur}</p>}

      <div className="bloc">
        <label className="champ" htmlFor="recherche">Ajouter une série ou un film</label>
        <input id="recherche" type="search" className="saisie" value={requete} onChange={(e) => setRequete(e.target.value)} autoComplete="off" />
        {resultats.length > 0 && (
          <ul className="resultats">
            {resultats.slice(0, 8).map((t) => {
              const deja = parCle.has(cleTitre(t.tmdbId, t.mediaType));
              return (
                <li key={cleTitre(t.tmdbId, t.mediaType)} className="ligne">
                  {t.posterPath ? <img src={poster(t.posterPath, 'w92')} alt="" loading="lazy" /> : <span className="vignette-vide" aria-hidden="true" />}
                  <div className="ligne-texte">
                    <strong>{t.title}</strong>
                    <span>{libelleType(t.mediaType)}{t.year ? ` · ${t.year}` : ''}</span>
                  </div>
                  <button type="button" className={`action${deja ? ' discret' : ' primaire'}`} disabled={deja} onClick={() => ajouter(t)}>
                    {deja ? '✓ Ajouté' : '+ Ajouter'}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="bloc">
        <div className="titre-ligne">
          <h2>{favoris ? `${favoris.length} favori${favoris.length > 1 ? 's' : ''}` : 'Favoris'}</h2>
          <div className="filtres" role="group" aria-label="Filtrer par type">
            {[['tous', 'Tous'], ['tv', 'Séries'], ['movie', 'Films']].map(([v, l]) => (
              <button key={v} type="button" className="filtre" aria-pressed={filtre === v} onClick={() => setFiltre(v)}>{l}</button>
            ))}
          </div>
        </div>
        {!favoris && !erreur && <p className="secondaire chargement">Chargement…</p>}
        {favoris && affiches.length === 0 && <p className="vide">Aucun favori pour l'instant.</p>}
        <ul className="resultats">
          {affiches.map((f) => (
            <li key={f.id} className="ligne">
              {f.poster_path ? <img src={poster(f.poster_path, 'w92')} alt="" loading="lazy" /> : <span className="vignette-vide" aria-hidden="true" />}
              <div className="ligne-texte">
                <strong>{f.title}</strong>
                <span>{libelleType(f.media_type)}{f.annee ? ` · ${f.annee}` : ''}</span>
              </div>
              <button type="button" className="action discret" onClick={() => retirer(f)} aria-label={`Retirer ${f.title}`}>Retirer</button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
