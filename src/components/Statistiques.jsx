import { useEffect, useMemo, useState } from 'react';
import { statistiques, repartitionGenres, topTitres, historiqueComplet } from '../lib/stats';
import { grouperParDate, paginer } from '../lib/pagination';
import { poster } from '../lib/tmdb';
import PageTabs from './PageTabs';

const JOURS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

function dateLocale(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function libelleDate(iso) {
  const [y, m, j] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, j);
  const aujourdHui = new Date();
  aujourdHui.setHours(0, 0, 0, 0);
  const diff = Math.round((date - aujourdHui) / 86400000);
  if (diff === 0) return "Aujourd'hui";
  if (diff === -1) return 'Hier';
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: date.getFullYear() !== aujourdHui.getFullYear() ? 'numeric' : undefined,
  });
}

export default function Statistiques() {
  const [stats, setStats] = useState(null);
  const [genres, setGenres] = useState(null);
  const [top, setTop] = useState(null);
  const [historique, setHistorique] = useState(null);
  const [page, setPage] = useState(0);

  useEffect(() => {
    statistiques().then(setStats);
    repartitionGenres().then(setGenres);
    topTitres().then(setTop);
    historiqueComplet().then(setHistorique);
  }, []);

  const groupes = useMemo(() => {
    if (!historique) return [];
    return grouperParDate(historique, (e) => dateLocale(e.watchedAt));
  }, [historique]);
  const pages = useMemo(() => paginer(groupes, 20), [groupes]);

  if (stats === null) return <div className="ecran" aria-busy="true" />;

  const maxActivite = Math.max(1, ...stats.activite);
  const maxGenre = Math.max(1, ...(genres ?? []).map((g) => g.minutes));

  return (
    <section className="ecran">
      <p className="eyebrow">TON SUIVI</p>
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

      <h2 className="stats-titre-section">Activité des 7 derniers jours</h2>
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

      {genres?.length > 0 && (
        <>
          <h2 className="stats-titre-section">Par genre</h2>
          <ul className="liste-genres">
            {genres.map((g) => (
              <li key={g.id}>
                <span className="liste-genres-label">{g.label}</span>
                <div className="liste-genres-barre"><i style={{ width: `${Math.round((g.minutes / maxGenre) * 100)}%` }} /></div>
                <span className="liste-genres-valeur">{Math.round(g.minutes / 60 * 10) / 10} h</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {top?.length > 0 && (
        <>
          <h2 className="stats-titre-section">Le plus regardé</h2>
          <ul className="liste-top">
            {top.map((t, i) => (
              <li key={t.item.localId}>
                <span className="liste-top-rang">{i + 1}</span>
                <img src={poster(t.item.posterPath, 'w185') || ''} alt="" loading="lazy" />
                <div className="texte">
                  <strong>{t.item.title}</strong>
                  <span className="secondaire">{t.visionnages} visionnage{t.visionnages > 1 ? 's' : ''}</span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <h2 className="stats-titre-section">Ce que tu as regardé</h2>
      {!groupes.length ? (
        <p className="secondaire">Rien de regardé pour l'instant.</p>
      ) : (
        <>
          <PageTabs total={pages.length} page={page} onChange={setPage} />
          {(pages[page] || []).map((groupe) => (
            <section className="calendrier-section" key={groupe.date}>
              <h2 className="calendrier-titre-section">{libelleDate(groupe.date)}</h2>
              <ul className="liste-calendrier">
                {groupe.items.map((e) => (
                  <li className="item-calendrier" key={e.localId}>
                    <div className="datebox" aria-hidden="true"><b>▶</b></div>
                    <div className="texte">
                      <h2>{e.item?.title ?? 'Titre supprimé'}</h2>
                      <p className="secondaire">
                        {e.episode != null ? `S${e.season} E${e.episode}` : 'Film'}{e.runtimeMin ? ` · ${e.runtimeMin} min` : ''}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </section>
  );
}
