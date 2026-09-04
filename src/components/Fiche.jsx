import { useEffect, useMemo, useState } from 'react';
import { details, season as saisonTmdb, poster } from '../lib/tmdb';
import { teinteAffiche, habillage } from '../lib/couleur';
import { cocher, decocher, cocherSaison, annoter, entriesDe, itemParTmdb, ajouterItem } from '../lib/store';

export default function Fiche({ tmdbId, mediaType }) {
  const [fiche, setFiche] = useState(null);
  const [item, setItem] = useState(null);
  const [vus, setVus] = useState([]);
  const [saison, setSaison] = useState(1);
  const [episodes, setEpisodes] = useState([]);
  const [style, setStyle] = useState({});
  const [annote, setAnnote] = useState(null);

  useEffect(() => {
    details(mediaType, tmdbId).then(async (d) => {
      setFiche(d);
      const t = await teinteAffiche(poster(d.poster_path, 'w92'));
      setStyle(habillage(t));
    });
    itemParTmdb(tmdbId, mediaType).then(async (i) => {
      setItem(i);
      if (i) setVus(await entriesDe(i.localId));
    });
  }, [tmdbId, mediaType]);

  useEffect(() => {
    if (mediaType !== 'tv') return;
    saisonTmdb(tmdbId, saison).then((s) =>
      setEpisodes(s.episodes.map((e) => ({
        numero: e.episode_number,
        titre: e.name,
        duree: e.runtime,
        diffusion: e.air_date,
      })))
    );
  }, [tmdbId, mediaType, saison]);

  const vusSaison = useMemo(
    () => new Set(vus.filter((e) => e.season === saison).map((e) => e.episode)),
    [vus, saison]
  );

  const rafraichir = async (itemActuel = item) => itemActuel && setVus(await entriesDe(itemActuel.localId));

  // Regarder un épisode vaut suivre le titre : pas besoin d'être passé par "Suivre"
  // avant de pouvoir cocher depuis une fiche ouverte au fil d'une recherche.
  const assurerItem = async () => {
    if (item) return item;
    await ajouterItem({
      tmdbId, mediaType,
      title: fiche.name ?? fiche.title,
      posterPath: fiche.poster_path,
      genres: (fiche.genres ?? []).map((g) => g.id),
    });
    const nouveau = await itemParTmdb(tmdbId, mediaType);
    setItem(nouveau);
    return nouveau;
  };

  // Cochage optimiste : l'état bascule avant l'écriture, jamais après.
  const basculer = async (ep) => {
    const existante = vus.find((e) => e.season === saison && e.episode === ep.numero);
    if (existante) {
      setVus((v) => v.filter((e) => e.localId !== existante.localId));
      await decocher(existante.localId);
      rafraichir();
      return;
    }
    setVus((v) => [...v, { season: saison, episode: ep.numero, localId: -Date.now() }]);
    const itemActuel = await assurerItem();
    await cocher({ itemId: itemActuel.localId, season: saison, episode: ep.numero, runtimeMin: ep.duree, airDate: ep.diffusion });
    rafraichir(itemActuel);
  };

  // Un film n'a ni saison ni épisode : une seule entrée fait foi.
  const dejaVu = mediaType === 'movie' && vus.length > 0;
  const basculerFilm = async () => {
    if (dejaVu) {
      const existante = vus[0];
      setVus([]);
      await decocher(existante.localId);
      return;
    }
    setVus((v) => [...v, { localId: -Date.now() }]);
    const itemActuel = await assurerItem();
    await cocher({ itemId: itemActuel.localId, season: null, episode: null, runtimeMin: fiche.runtime ?? null });
    rafraichir(itemActuel);
  };

  if (!fiche) return <div className="ecran" aria-busy="true" />;

  const saisons = (fiche.seasons ?? []).filter((s) => s.season_number > 0);
  const progression = episodes.length ? Math.round((vusSaison.size / episodes.length) * 100) : 0;

  return (
    <article className="ecran fiche" style={style}>
      <header className="entete">
        <img src={poster(fiche.poster_path, 'w342')} alt="" width="112" height="168" />
        <div>
          <h1>{fiche.name ?? fiche.title}</h1>
          <p className="secondaire">{(fiche.genres ?? []).map((g) => g.name).join(', ')}</p>
        </div>
      </header>

      {mediaType === 'tv' && (
        <>
          <div className="barre-saison">
            <label htmlFor="saison">Saison</label>
            <select id="saison" value={saison} onChange={(e) => setSaison(Number(e.target.value))}>
              {saisons.map((s) => (
                <option key={s.season_number} value={s.season_number}>
                  {s.season_number} · {s.episode_count} épisodes
                </option>
              ))}
            </select>

            <button
              type="button"
              className="action"
              onClick={async () => {
                const itemActuel = await assurerItem();
                await cocherSaison({ itemId: itemActuel.localId, season: saison, episodes });
                rafraichir(itemActuel);
              }}
            >
              Tout cocher
            </button>
          </div>

          {/* La progression est chiffrée, pas seulement colorée. */}
          <p className="progression">
            <span className="jauge" style={{ '--part': `${progression}%` }} aria-hidden="true" />
            {vusSaison.size} sur {episodes.length} épisodes vus
          </p>

          <ul className="episodes">
            {episodes.map((ep) => {
              const vu = vusSaison.has(ep.numero);
              return (
                <li key={ep.numero} className={vu ? 'episode vu' : 'episode'}>
                  <button
                    type="button"
                    className="action coche"
                    aria-pressed={vu}
                    onClick={() => basculer(ep)}
                    aria-label={`Épisode ${ep.numero}, ${ep.titre}, ${vu ? 'vu' : 'non vu'}`}
                  >
                    <span aria-hidden="true">{vu ? '✓' : ''}</span>
                  </button>

                  <div className="texte">
                    <h2>{ep.numero}. {ep.titre}</h2>
                    <p className="secondaire">{ep.diffusion} {ep.duree ? `· ${ep.duree} min` : ''}</p>
                  </div>

                  {/* Le commentaire est à un geste, mais toujours facultatif :
                      il n'est jamais un préalable au cochage. */}
                  {vu && (
                    <button
                      type="button"
                      className="action discret"
                      onClick={() => setAnnote(vus.find((e) => e.season === saison && e.episode === ep.numero))}
                      aria-label={`Commenter l'épisode ${ep.numero}`}
                    >
                      ✎
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}

      {mediaType === 'movie' && (
        <button
          type="button"
          className="action coche"
          aria-pressed={dejaVu}
          onClick={basculerFilm}
        >
          <span aria-hidden="true">{dejaVu ? '✓' : ''}</span>
          <span className="libelle">{dejaVu ? 'Vu' : 'Marquer comme vu'}</span>
        </button>
      )}

      {annote && (
        <Annotation
          entree={annote}
          onFermer={() => setAnnote(null)}
          onValider={async (valeurs) => { await annoter(annote.localId, valeurs); setAnnote(null); rafraichir(); }}
        />
      )}
    </article>
  );
}

function Annotation({ entree, onFermer, onValider }) {
  const [note, setNote] = useState(entree.rating ?? 0);
  const [texte, setTexte] = useState(entree.comment ?? '');

  return (
    <div className="feuille" role="dialog" aria-label="Note et commentaire">
      <fieldset className="notes">
        <legend>Note</legend>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            className="action"
            aria-pressed={note === n}
            onClick={() => setNote(n)}
          >{n}</button>
        ))}
      </fieldset>

      <label className="champ" htmlFor="c">Commentaire</label>
      <textarea id="c" rows="4" value={texte} onChange={(e) => setTexte(e.target.value)} />

      <div className="pied">
        <button type="button" className="action" onClick={onFermer}>Annuler</button>
        <button type="button" className="action primaire" onClick={() => onValider({ rating: note || null, comment: texte || null })}>
          Enregistrer
        </button>
      </div>
    </div>
  );
}
