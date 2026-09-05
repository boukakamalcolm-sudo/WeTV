import { useEffect, useMemo, useState } from 'react';
import { sortiesConnues } from '../lib/calendrier';
import { entries as entriesStore, cocher, majStatut } from '../lib/store';
import { grouperParDate, paginer } from '../lib/pagination';
import PageTabs from './PageTabs';
import TitleModal, { useTitleModal } from './TitleModal';

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
  const [vus, setVus] = useState(new Set());
  const [page, setPage] = useState(0);
  const { selected, open, close } = useTitleModal();

  async function charger() {
    const [s, es] = await Promise.all([sortiesConnues(), entriesStore()]);
    setSorties(s);
    setVus(new Set(es.map((e) => `${e.itemId}-${e.season ?? 'f'}-${e.episode ?? ''}`)));
  }

  useEffect(() => {
    charger();
    const f = () => charger();
    addEventListener('tracker:updated', f);
    return () => removeEventListener('tracker:updated', f);
  }, []);

  const groupes = useMemo(() => {
    if (!sorties) return [];
    const tries = [...sorties].sort((a, b) => a.date.localeCompare(b.date));
    return grouperParDate(tries, (s) => s.date);
  }, [sorties]);

  const pages = useMemo(() => paginer(groupes, 20), [groupes]);

  // Ouvre par défaut sur la page qui contient aujourd'hui, ou la plus proche.
  useEffect(() => {
    if (!pages.length) return;
    const aujourdHui = new Date().toISOString().slice(0, 10);
    const idx = pages.findIndex((p) => p.at(-1).date >= aujourdHui);
    setPage(idx === -1 ? pages.length - 1 : idx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sorties]);

  async function marquerVu(s) {
    if (s.saison != null) {
      await cocher({ itemId: s.localId, season: s.saison, episode: s.episode, airDate: s.date });
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
      <p className="subtitle calendrier-sous-titre">Les sorties de tes séries et films suivis, passées et à venir.</p>

      {!groupes.length ? (
        <p className="secondaire">Aucune sortie connue parmi tes séries et films suivis.</p>
      ) : (
        <>
          <PageTabs total={pages.length} page={page} onChange={setPage} />
          {(pages[page] || []).map((groupe) => (
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
                        disabled={vu}
                        aria-label={vu ? `${s.title} déjà marqué comme vu` : `Marquer ${s.title} comme vu`}
                      >
                        {vu ? '✓' : '＋'}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </>
      )}

      <TitleModal selected={selected} onClose={close} />
    </section>
  );
}
