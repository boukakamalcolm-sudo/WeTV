import { useEffect, useState } from 'react';
import { apercuSorties } from '../lib/favoris';
import { poster } from '../lib/tmdb';

// Aperçu de ce que contient le flux : exactement les mêmes données que
// l'agenda abonné, lues sur la même route serveur.

const aujourdhui = () => new Date().toLocaleDateString('sv-SE');

function libelleJour(iso) {
  const d = new Date(`${iso}T12:00:00`);
  const ecart = Math.round((d - new Date(`${aujourdhui()}T12:00:00`)) / 86400000);
  if (ecart === 0) return "Aujourd'hui";
  if (ecart === 1) return 'Demain';
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined });
}

export default function Sorties({ cle }) {
  const [donnees, setDonnees] = useState(null);
  const [erreur, setErreur] = useState('');
  const [passees, setPassees] = useState(false);

  useEffect(() => {
    if (!cle) return;
    setErreur('');
    apercuSorties(cle).then(setDonnees).catch((e) => setErreur(e.message || 'Aperçu indisponible.'));
  }, [cle]);

  const jour = aujourdhui();
  const visibles = (donnees?.sorties || []).filter((s) => passees || s.date >= jour);
  const parJour = visibles.reduce((acc, s) => {
    (acc[s.date] ||= []).push(s);
    return acc;
  }, {});

  return (
    <section className="page">
      <p className="eyebrow">CALENDRIER</p>
      <h1>Prochaines sorties</h1>
      <p className="subtitle">Ce que ton agenda abonné affiche, recalculé depuis TMDB.</p>

      {erreur && <p className="alerte" role="alert">{erreur}</p>}
      {!donnees && !erreur && <p className="secondaire chargement">Chargement des dates…</p>}

      {donnees && (
        <>
          <label className="interrupteur">
            <input type="checkbox" checked={passees} onChange={(e) => setPassees(e.target.checked)} />
            <span>Afficher aussi les 30 derniers jours</span>
          </label>

          {visibles.length === 0 && (
            <p className="vide">Aucune sortie datée pour tes favoris. Ajoute des titres dans l'onglet Favoris.</p>
          )}

          {Object.entries(parJour).map(([date, sorties]) => (
            <div key={date} className={`jour${date < jour ? ' jour-passe' : ''}`}>
              <h2 className="jour-titre">{libelleJour(date)}</h2>
              <ul className="sorties">
                {sorties.map((s) => (
                  <li key={s.uid} className="sortie">
                    {s.posterPath ? <img src={poster(s.posterPath, 'w92')} alt="" loading="lazy" /> : <span className="vignette-vide" aria-hidden="true" />}
                    <div>
                      <strong>{s.titre}</strong>
                      {s.episode && <span>{s.episode}</span>}
                      <span className="type">{s.mediaType === 'tv' ? 'Série' : 'Film'}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {donnees.enAttente.length > 0 && (
            <div className="encart">
              <h2>Pas encore de date</h2>
              <p className="secondaire">Ils apparaîtront dans l'agenda dès que TMDB connaîtra une date.</p>
              <ul className="liste-simple">{donnees.enAttente.map((t) => <li key={`${t.mediaType}-${t.tmdbId}`}>{t.title}</li>)}</ul>
            </div>
          )}
          {donnees.erreurs.length > 0 && (
            <div className="encart">
              <h2>Introuvables sur TMDB</h2>
              <ul className="liste-simple">{donnees.erreurs.map((t) => <li key={`${t.mediaType}-${t.tmdbId}`}>{t.title}</li>)}</ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
