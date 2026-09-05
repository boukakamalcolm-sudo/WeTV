import { useEffect, useMemo, useState } from 'react';
import { details, season as saisonTmdb, poster } from '../lib/tmdb';
import { cocher, decocher, cocherSaison, annoter, entriesDe, itemParTmdb, ajouterItem } from '../lib/store';

export default function Fiche({ tmdbId, mediaType }) {
  const [fiche, setFiche] = useState(null);
  const [item, setItem] = useState(null);
  const [vus, setVus] = useState([]);
  const [saison, setSaison] = useState(1);
  const [episodes, setEpisodes] = useState([]);
  const [annote, setAnnote] = useState(null);

  useEffect(() => {
    let actif = true;
    Promise.all([details(mediaType, tmdbId), itemParTmdb(tmdbId, mediaType)]).then(async ([d, i]) => {
      if (!actif) return;
      setFiche(d);
      setItem(i);
      if (i) setVus(await entriesDe(i.localId));
      const firstSeason = (d?.seasons || []).find((s) => s.season_number > 0)?.season_number;
      if (firstSeason) setSaison(firstSeason);
    });
    return () => { actif = false; };
  }, [tmdbId, mediaType]);

  useEffect(() => {
    if (mediaType !== 'tv') return;
    let actif = true;
    saisonTmdb(tmdbId, saison)
      .then((s) => {
        if (!actif) return;
        setEpisodes((s.episodes || []).map((e) => ({
          numero: e.episode_number,
          titre: e.name,
          duree: e.runtime,
          diffusion: e.air_date,
          synopsis: e.overview,
          image: e.still_path,
        })));
      })
      .catch(() => actif && setEpisodes([]));
    return () => { actif = false; };
  }, [tmdbId, mediaType, saison]);

  const vusSaison = useMemo(() => new Set(vus.filter((e) => e.season === saison).map((e) => e.episode)), [vus, saison]);
  const nombreVusSaison = vusSaison.size;
  const totalSaison = episodes.length;
  const titre = fiche?.name ?? fiche?.title ?? 'Œuvre';
  const genres = (fiche?.genres ?? []).slice(0, 4).map((g) => g.name).join(' · ');
  const annee = fiche?.first_air_date?.slice(0, 4) ?? fiche?.release_date?.slice(0, 4);

  const assurerItem = async () => {
    if (item) return item;
    await ajouterItem({
      tmdbId,
      mediaType,
      title: titre,
      posterPath: fiche.poster_path,
      genres: (fiche.genres ?? []).map((g) => g.id),
      status: 'watching',
    });
    const n = await itemParTmdb(tmdbId, mediaType);
    setItem(n);
    return n;
  };

  const basculer = async (ep) => {
    const ex = vus.find((e) => e.season === saison && e.episode === ep.numero);
    if (ex) {
      setVus((v) => v.filter((e) => e.localId !== ex.localId));
      await decocher(ex.localId);
      window.dispatchEvent(new CustomEvent('tracker:updated'));
      return;
    }
    const n = await assurerItem();
    const optimistic = { localId: -Date.now(), season: saison, episode: ep.numero, runtimeMin: ep.duree };
    setVus((v) => [...v, optimistic]);
    await cocher({ itemId: n.localId, season: saison, episode: ep.numero, runtimeMin: ep.duree, airDate: ep.diffusion });
    setVus(await entriesDe(n.localId));
    window.dispatchEvent(new CustomEvent('tracker:updated'));
  };

  const basculerFilm = async () => {
    if (vus[0]) {
      await decocher(vus[0].localId);
      setVus([]);
      window.dispatchEvent(new CustomEvent('tracker:updated'));
      return;
    }
    const n = await assurerItem();
    await cocher({ itemId: n.localId, runtimeMin: fiche.runtime });
    setVus(await entriesDe(n.localId));
    window.dispatchEvent(new CustomEvent('tracker:updated'));
  };

  const selectionnerSaisonEtToutCocher = async () => {
    const n = await assurerItem();
    await cocherSaison({ itemId: n.localId, season: saison, episodes });
    setVus(await entriesDe(n.localId));
    window.dispatchEvent(new CustomEvent('tracker:updated'));
  };

  if (!fiche) return <div className="ecran" aria-busy="true" />;

  return (
    <div className="modal-backdrop-app" role="presentation" onClick={(e) => {
      if (e.target === e.currentTarget) location.hash = '/bibliotheque';
    }}>
      <article className="work-modal work-modal-modern" role="dialog" aria-modal="true" aria-label={`Fiche de ${titre}`}>
        <button className="modal-close-app" onClick={() => { location.hash = '/bibliotheque'; }} aria-label="Fermer">×</button>
        <div
          className="work-hero"
          style={{ backgroundImage: `linear-gradient(90deg,rgba(8,9,13,.98) 4%,rgba(8,9,13,.65) 45%,rgba(8,9,13,.18)),url(${poster(fiche.backdrop_path || fiche.poster_path, 'w1280')})` }}
        >
          <div className="work-hero-copy">
            <span className="eyebrow">{mediaType === 'tv' ? 'SÉRIE' : 'FILM'}</span>
            <h1>{titre}</h1>
            <p>{annee}{annee && genres ? ' · ' : ''}{genres}</p>
            {fiche.vote_average > 0 && <span className="work-rating">★ {Number(fiche.vote_average).toFixed(1)}</span>}
          </div>
        </div>

        <div className="work-body">
          {fiche.overview && <p className="work-overview">{fiche.overview}</p>}
          <div className="work-meta-strip">
            {mediaType === 'tv' && fiche.number_of_episodes ? <span>{fiche.number_of_episodes} épisodes</span> : null}
            {fiche.runtime ? <span>{fiche.runtime} min</span> : null}
            {fiche.status ? <span>{fiche.status}</span> : null}
          </div>

          {mediaType === 'movie' ? (
            <button className="primary-btn work-main-action" onClick={basculerFilm}>{vus.length ? '✓ Vu' : 'Marquer comme vu'}</button>
          ) : (
            <>
              <div className="episodes-heading">
                <div>
                  <p className="eyebrow">SUIVI</p>
                  <h2>Épisodes</h2>
                  <p className="subtitle">{nombreVusSaison} / {totalSaison || fiche.seasons?.find((s) => s.season_number === saison)?.episode_count || 0} vus dans cette saison</p>
                </div>
                <button className="secondary-btn" onClick={selectionnerSaisonEtToutCocher}>Tout cocher</button>
              </div>

              <div className="season-selector-row">
                <label htmlFor="season-select">Saison</label>
                <select id="season-select" value={saison} onChange={(e) => setSaison(Number(e.target.value))}>
                  {(fiche.seasons || []).filter((s) => s.season_number > 0).map((s) => (
                    <option key={s.season_number} value={s.season_number}>
                      Saison {s.season_number} · {s.episode_count} épisodes
                    </option>
                  ))}
                </select>
              </div>

              <ul className="episodes-modal compact-episodes">
                {episodes.map((ep) => {
                  const vu = vusSaison.has(ep.numero);
                  return (
                    <li key={ep.numero} className={`episode-card ${vu ? 'seen' : ''}`}>
                      <button className="episode-check" aria-pressed={vu} aria-label={vu ? `Retirer ${ep.titre} des épisodes vus` : `Marquer ${ep.titre} comme vu`} onClick={() => basculer(ep)}>{vu ? '✓' : ''}</button>
                      <div className="episode-card-main">
                        <strong><span className="episode-number">E{String(ep.numero).padStart(2, '0')}</span>{ep.titre}</strong>
                        <span>{ep.diffusion || 'Date inconnue'}{ep.duree ? ` · ${ep.duree} min` : ''}</span>
                        {ep.synopsis && <p>{ep.synopsis}</p>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {mediaType === 'tv' && vus.length > 0 && (
            <button className="ghost-link" onClick={() => setAnnote(vus.find((e) => e.season === saison) || vus[0])}>
              Ajouter une note / commentaire
            </button>
          )}

          {annote && (
            <Annotation
              entree={annote}
              onFermer={() => setAnnote(null)}
              onValider={async (v) => { await annoter(annote.localId, v); setAnnote(null); }}
            />
          )}
        </div>
      </article>
    </div>
  );
}

function Annotation({ entree, onFermer, onValider }) {
  const [note, setNote] = useState(entree.rating ?? 0);
  const [texte, setTexte] = useState(entree.comment ?? '');
  return (
    <div className="annotation-sheet">
      <div className="section-title-row"><h2>Ton avis</h2><button className="modal-close-app" onClick={onFermer}>×</button></div>
      <div className="rating-row">{[1, 2, 3, 4, 5].map((n) => <button key={n} className="rating-btn" aria-pressed={note === n} onClick={() => setNote(n)}>★</button>)}</div>
      <label className="champ" htmlFor="commentaire">Commentaire</label>
      <textarea id="commentaire" value={texte} onChange={(e) => setTexte(e.target.value)} />
      <div className="pied"><button className="secondary-btn" onClick={onFermer}>Annuler</button><button className="primary-btn" onClick={() => onValider({ rating: note || null, comment: texte || null })}>Enregistrer</button></div>
    </div>
  );
}
