import { useEffect, useMemo, useState } from 'react';
import { sortiesConnues } from '../lib/calendrier';
import { entries as entriesStore, cocher, decocher, majStatut } from '../lib/store';
import { verifierCompletionSerie } from '../lib/completion';
import { grouperParDate } from '../lib/pagination';
import TitleModal, { useTitleModal } from './TitleModal';

const versISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function lundiDe(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // lundi = 0
  return d;
}

function libelleSemaine(debut) {
  const fin = new Date(debut);
  fin.setDate(fin.getDate() + 6);
  const memeMois = debut.getMonth() === fin.getMonth();
  const jourDebut = debut.toLocaleDateString('fr-FR', { day: 'numeric', month: memeMois ? undefined : 'short' });
  const jourFin = fin.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${jourDebut} – ${jourFin}`;
}

function libelleDate(iso) {
  const [y, m, j] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, j);
  const aujourdHui = new Date();
  aujourdHui.setHours(0, 0, 0, 0);
  const diff = Math.round((date - aujourdHui) / 86400000);
  if (diff === 0) return "Aujourd'hui";
  if (diff === -1) return 'Hier';
  if (diff === 1) return 'Demain';
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: date.getFullYear() !== aujourdHui.getFullYear() ? 'numeric' : undefined,
  });
}

const cleEpisode = (s) => `${s.localId}-${s.saison ?? 'f'}-${s.episode ?? ''}`;

export default function Calendrier() {
  const [sorties, setSorties] = useState(null);
  const [vus, setVus] = useState(new Map());
  const [debutSemaine, setDebutSemaine] = useState(() => lundiDe(new Date()));
  const { selected, open, close } = useTitleModal();

  async function charger() {
    const [s, es] = await Promise.all([sortiesConnues(), entriesStore()]);
    setSorties(s);
    setVus(new Map(es.map((e) => [`${e.itemId}-${e.season ?? 'f'}-${e.episode ?? ''}`, e.localId])));
  }

  useEffect(() => {
    charger();
    const f = () => charger();
    addEventListener('tracker:updated', f);
    return () => removeEventListener('tracker:updated', f);
  }, []);

  const groupes = useMemo(() => {
    if (!sorties) return [];
    const finSemaine = new Date(debutSemaine);
    finSemaine.setDate(finSemaine.getDate() + 7);
    const debutStr = versISO(debutSemaine);
    const finStr = versISO(finSemaine);
    const dansLaSemaine = sorties
      .filter((s) => s.date >= debutStr && s.date < finStr)
      .sort((a, b) => a.date.localeCompare(b.date));
    return grouperParDate(dansLaSemaine, (s) => s.date);
  }, [sorties, debutSemaine]);

  function changerSemaine(delta) {
    setDebutSemaine((d) => {
      const n = new Date(d);
      n.setDate(n.getDate() + delta * 7);
      return n;
    });
  }

  async function marquerVu(s) {
    const entryId = vus.get(cleEpisode(s));
    if (entryId != null) {
      // Démarquer : symétrique de l'action de cocher, jusqu'ici impossible
      // depuis le calendrier (le bouton restait désactivé une fois coché).
      await decocher(entryId);
      if (s.saison != null) await verifierCompletionSerie(s.localId);
      else await majStatut(s.localId, 'watchlist');
    } else if (s.saison != null) {
      await cocher({ itemId: s.localId, season: s.saison, episode: s.episode, airDate: s.date });
      await verifierCompletionSerie(s.localId); // "Terminé" seulement si toutes les saisons sont vues
    } else {
      await cocher({ itemId: s.localId, season: null, episode: null });
      await majStatut(s.localId, 'completed');
    }
    dispatchEvent(new CustomEvent('tracker:updated'));
  }

  if (sorties === null) return <div className="ecran" aria-busy="true" />;

  return (
    <section className="ecran calendrier-screen">
      <p className="eyebrow">TON RYTHME</p>
      <h1>📅 Calendrier</h1>
      <p className="subtitle calendrier-sous-titre">Les sorties de tes séries et films suivis, semaine par semaine.</p>

      <button type="button" className="semaine-nav" onClick={() => changerSemaine(-1)}>
        <span aria-hidden="true">‹</span> Semaine précédente
      </button>
      <p className="semaine-label">{libelleSemaine(debutSemaine)}</p>

      {!groupes.length ? (
        <p className="secondaire calendrier-vide">Aucune sortie cette semaine parmi tes séries et films suivis.</p>
      ) : groupes.map((groupe) => (
        <section className="calendrier-section" key={groupe.date}>
          <h2 className="calendrier-titre-section">{libelleDate(groupe.date)}</h2>
          <ul className="liste-calendrier">
            {groupe.items.map((s) => {
              const vu = vus.has(cleEpisode(s));
              return (
                <li className="item-calendrier" key={`${s.tmdbId}-${s.saison ?? 'f'}-${s.episode ?? ''}`}>
                  <button type="button" className="item-calendrier-corps" onClick={() => open(s)}>
                    <div className="datebox" aria-hidden="true"><b>{s.mediaType === 'tv' ? '▶' : '★'}</b></div>
                    <div className="texte">
                      <h2>{s.title}</h2>
                      <p className="secondaire">
                        {s.saison != null ? `S${s.saison} E${s.episode}${s.titreEpisode ? ` · ${s.titreEpisode}` : ''}` : 'Film'}
                      </p>
                    </div>
                  </button>
                  <button
                    type="button"
                    className={vu ? 'marquer-vu vu' : 'marquer-vu'}
                    onClick={() => marquerVu(s)}
                    aria-pressed={vu}
                    aria-label={vu ? `Démarquer ${s.title} comme vu` : `Marquer ${s.title} comme vu`}
                  >
                    {vu ? '✓' : '＋'}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <button type="button" className="semaine-nav" onClick={() => changerSemaine(1)}>
        Semaine suivante <span aria-hidden="true">›</span>
      </button>

      <TitleModal selected={selected} onClose={close} />
    </section>
  );
}
