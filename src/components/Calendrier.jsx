import { useEffect, useState } from 'react';
import { calendrier } from '../lib/calendrier';

export default function Calendrier() {
  const [episodes, setEpisodes] = useState(null);

  useEffect(() => { calendrier().then(setEpisodes); }, []);

  if (episodes === null) return <div className="ecran" aria-busy="true" />;

  return (
    <section className="ecran">
      <h1>📅 Calendrier</h1>
      {!episodes.length && (
        <p className="secondaire">
          Aucun épisode à venir pour l'instant parmi tes séries suivies.
        </p>
      )}

      <ul className="liste-calendrier">
        {episodes.map((e) => {
          const jours = Math.round((new Date(e.airDate) - new Date().setHours(0, 0, 0, 0)) / 86400000);
          const date = new Date(e.airDate);
          const jour = date.toLocaleDateString('fr-FR', { day: '2-digit' });
          const mois = date.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');

          return (
            <li key={`${e.tmdbId}-${e.episode}`} className="item-calendrier">
              <div className="datebox"><b>{jour}</b><span>{mois}</span></div>
              <div className="texte">
                <h2>{e.title}</h2>
                <p className="secondaire">
                  S{e.saison} E{e.episode}{e.titreEpisode ? ` · ${e.titreEpisode}` : ''}
                </p>
              </div>
              <span className="badge">{jours <= 0 ? "Aujourd'hui" : `${jours} j`}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
