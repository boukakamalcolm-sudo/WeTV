import { useEffect, useMemo, useState } from 'react';
import { calendrier, historiqueMois, sortiesConnues, sortiesDuMois } from '../lib/calendrier';

const JOURS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

export default function Calendrier() {
  const [onglet, setOnglet] = useState('avenir');
  const [donnees, setDonnees] = useState(null);
  const [date, setDate] = useState(() => { const d = new Date(); return { annee: d.getFullYear(), mois: d.getMonth() }; });
  const [parJour, setParJour] = useState(new Map());
  const [sorties, setSorties] = useState(null);
  const [jourChoisi, setJourChoisi] = useState(null);

  useEffect(() => { calendrier().then(setDonnees); }, []);

  // Chargées une seule fois pour toute la session, puis reclassées mois par
  // mois côté client : pas de nouvel appel réseau à chaque changement de page.
  useEffect(() => {
    if (onglet !== 'historique' || sorties !== null) return;
    sortiesConnues().then(setSorties);
  }, [onglet, sorties]);

  useEffect(() => {
    if (onglet !== 'historique') return;
    let annule = false;
    historiqueMois(date.annee, date.mois).then((m) => { if (!annule) { setParJour(m); setJourChoisi(null); } });
    return () => { annule = true; };
  }, [onglet, date]);

  const sortiesJour = useMemo(() => sortiesDuMois(sorties || [], date.annee, date.mois), [sorties, date]);

  if (donnees === null) return <div className="ecran" aria-busy="true" />;

  return (
    <section className="ecran calendrier-screen">
      <p className="eyebrow">TON RYTHME</p>
      <h1>📅 Calendrier</h1>

      <div className="segmente" role="tablist" aria-label="Vue du calendrier">
        <button type="button" role="tab" aria-selected={onglet === 'avenir'} className={onglet === 'avenir' ? 'segment active' : 'segment'} onClick={() => setOnglet('avenir')}>À venir</button>
        <button type="button" role="tab" aria-selected={onglet === 'historique'} className={onglet === 'historique' ? 'segment active' : 'segment'} onClick={() => setOnglet('historique')}>Historique</button>
      </div>

      {onglet === 'avenir'
        ? <VueAVenir donnees={donnees} />
        : <VueHistorique date={date} setDate={setDate} parJour={parJour} sortiesJour={sortiesJour} chargeSorties={sorties === null} jourChoisi={jourChoisi} setJourChoisi={setJourChoisi} />}
    </section>
  );
}

function VueAVenir({ donnees }) {
  const { aVenir, dejaSorti } = donnees;
  if (!aVenir.length && !dejaSorti.length) {
    return <p className="secondaire">Aucune sortie à venir, ni en attente, parmi tes séries et films suivis.</p>;
  }
  return (
    <>
      {aVenir.length > 0 && (
        <section className="calendrier-section">
          <h2 className="calendrier-titre-section">Bientôt</h2>
          <ul className="liste-calendrier">
            {aVenir.map((e) => <ItemCalendrier key={`${e.tmdbId}-${e.episode ?? 'film'}`} e={e} />)}
          </ul>
        </section>
      )}
      {dejaSorti.length > 0 && (
        <section className="calendrier-section">
          <h2 className="calendrier-titre-section">Déjà sorti, à voir</h2>
          <p className="secondaire calendrier-sous-titre">Dans ta liste, déjà disponible.</p>
          <ul className="liste-calendrier">
            {dejaSorti.map((e) => <ItemCalendrier key={`${e.tmdbId}-${e.episode ?? 'film'}`} e={e} passe />)}
          </ul>
        </section>
      )}
    </>
  );
}

function ItemCalendrier({ e, passe }) {
  const jours = Math.round((new Date(e.date) - new Date().setHours(0, 0, 0, 0)) / 86400000);
  const d = new Date(e.date);
  const jour = d.toLocaleDateString('fr-FR', { day: '2-digit' });
  const mois = d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
  const badge = passe ? 'Sorti' : jours <= 0 ? "Aujourd'hui" : `${jours} j`;

  return (
    <li className="item-calendrier">
      <div className="datebox"><b>{jour}</b><span>{mois}</span></div>
      <div className="texte">
        <h2>{e.title}</h2>
        <p className="secondaire">
          {e.saison != null
            ? `S${e.saison} E${e.episode}${e.titreEpisode ? ` · ${e.titreEpisode}` : ''}`
            : e.mediaType === 'tv' ? 'Série' : 'Film'}
        </p>
      </div>
      <span className={passe ? 'badge badge-neutre' : 'badge'}>{badge}</span>
    </li>
  );
}

function VueHistorique({ date, setDate, parJour, sortiesJour, chargeSorties, jourChoisi, setJourChoisi }) {
  const premierJour = new Date(date.annee, date.mois, 1);
  const decalage = (premierJour.getDay() + 6) % 7; // lundi en première colonne
  const nbJours = new Date(date.annee, date.mois + 1, 0).getDate();
  const cases = [...Array(decalage).fill(null), ...Array.from({ length: nbJours }, (_, i) => i + 1)];
  const total = [...parJour.values()].reduce((s, l) => s + l.length, 0);
  const detailVu = jourChoisi != null ? (parJour.get(jourChoisi) || []) : [];
  const detailSorti = jourChoisi != null ? (sortiesJour.get(jourChoisi) || []) : [];

  function changerMois(delta) {
    const d = new Date(date.annee, date.mois + delta, 1);
    setDate({ annee: d.getFullYear(), mois: d.getMonth() });
  }

  return (
    <section className="calendrier-section">
      <div className="calendrier-nav">
        <button type="button" className="fleche" aria-label="Mois précédent" onClick={() => changerMois(-1)}>‹</button>
        <strong>{MOIS[date.mois]} {date.annee}</strong>
        <button type="button" className="fleche" aria-label="Mois suivant" onClick={() => changerMois(1)}>›</button>
      </div>
      <p className="secondaire calendrier-sous-titre">
        {total ? `${total} visionnage${total > 1 ? 's' : ''} ce mois-ci` : 'Rien de regardé ce mois-ci.'}
        {chargeSorties ? ' · sorties en cours de chargement…' : ''}
      </p>
      <p className="calendrier-legende">
        <span><i className="calendrier-legende-vu" aria-hidden="true" /> regardé</span>
        <span><i className="calendrier-legende-sorti" aria-hidden="true" /> sorti</span>
      </p>

      <div className="calendrier-grille" role="grid" aria-label={`${MOIS[date.mois]} ${date.annee}`}>
        {JOURS.map((j, i) => <span className="calendrier-entete" key={i} aria-hidden="true">{j}</span>)}
        {cases.map((jour, i) => {
          if (jour === null) return <span key={`vide-${i}`} className="calendrier-case vide" aria-hidden="true" />;
          const vus = parJour.get(jour) || [];
          const sortis = sortiesJour.get(jour) || [];
          const intensite = Math.min(4, vus.length);
          const libelle = [
            vus.length ? `${vus.length} visionnage${vus.length > 1 ? 's' : ''}` : null,
            sortis.length ? `${sortis.length} sortie${sortis.length > 1 ? 's' : ''}` : null,
          ].filter(Boolean).join(', ');
          return (
            <button
              type="button"
              key={jour}
              className={`calendrier-case${intensite ? ` niveau-${intensite}` : ''}${jourChoisi === jour ? ' choisi' : ''}`}
              onClick={() => setJourChoisi(jourChoisi === jour ? null : jour)}
              aria-pressed={jourChoisi === jour}
              aria-label={`${jour} ${MOIS[date.mois]}${libelle ? `, ${libelle}` : ''}`}
            >
              {sortis.length > 0 && <span className="pastille-sortie" aria-hidden="true" />}
              <b>{jour}</b>
              {vus.length > 0 && <small>{vus.length}</small>}
            </button>
          );
        })}
      </div>

      {jourChoisi != null && (
        <div className="calendrier-jour-detail">
          <h2>{jourChoisi} {MOIS[date.mois]}</h2>

          <h3 className="calendrier-titre-detail">Regardé</h3>
          {detailVu.length ? (
            <ul className="liste-calendrier">
              {detailVu.map((e) => (
                <li className="item-calendrier" key={e.localId}>
                  <div className="datebox" aria-hidden="true"><b>▶</b></div>
                  <div className="texte">
                    <h2>{e.item?.title || 'Titre supprimé'}</h2>
                    <p className="secondaire">
                      {e.episode != null ? `S${e.season} E${e.episode}` : 'Film'}{e.runtimeMin ? ` · ${e.runtimeMin} min` : ''}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : <p className="secondaire">Rien de regardé ce jour-là.</p>}

          <h3 className="calendrier-titre-detail">Sorti</h3>
          {detailSorti.length ? (
            <ul className="liste-calendrier">
              {detailSorti.map((s) => (
                <li className="item-calendrier" key={`${s.tmdbId}-${s.episode ?? 'film'}`}>
                  <div className="datebox" aria-hidden="true"><b>✦</b></div>
                  <div className="texte">
                    <h2>{s.title}</h2>
                    <p className="secondaire">
                      {s.saison != null ? `S${s.saison} E${s.episode}${s.titreEpisode ? ` · ${s.titreEpisode}` : ''}` : (s.mediaType === 'tv' ? 'Série' : 'Film')}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : <p className="secondaire">{chargeSorties ? 'Chargement…' : 'Rien de sorti ce jour-là parmi tes œuvres suivies.'}</p>}
        </div>
      )}
    </section>
  );
}
