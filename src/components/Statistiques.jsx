import { useEffect, useState } from 'react';
import { statistiques } from '../lib/stats';

const JOURS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

export default function Statistiques() {
  const [stats, setStats] = useState(null);

  useEffect(() => { statistiques().then(setStats); }, []);

  if (stats === null) return <div className="ecran" aria-busy="true" />;

  const maxActivite = Math.max(1, ...stats.activite);

  return (
    <section className="ecran">
      <h1>📊 Statistiques</h1>

      <div className="grille-stats">
        <div className="stat-carte">
          <span className="secondaire">Temps total</span>
          <strong>{stats.heures} h</strong>
        </div>
        <div className="stat-carte">
          <span className="secondaire">Épisodes vus</span>
          <strong>{stats.episodesVus}</strong>
        </div>
        <div className="stat-carte">
          <span className="secondaire">Films vus</span>
          <strong>{stats.filmsVus}</strong>
        </div>
        <div className="stat-carte">
          <span className="secondaire">Favori</span>
          <strong>{stats.favori?.title ?? '—'}</strong>
        </div>
      </div>

      <h2>Activité des 7 derniers jours</h2>
      {/* La hauteur des barres n'est pas la seule information : les minutes
          exactes restent lisibles au survol via le titre natif du navigateur. */}
      <div className="graphique">
        {stats.activite.map((minutes, i) => (
          <div className="barre-jour" key={i} title={`${minutes} min`}>
            <div className="barre-graphique" style={{ '--h': `${Math.round((minutes / maxActivite) * 100)}%` }} />
            <small>{JOURS[i]}</small>
          </div>
        ))}
      </div>
    </section>
  );
}
