import { useEffect, useState } from 'react';
import { aSuivre, cocher } from '../lib/store';

export default function AccueilMobile() {
  const [titres, setTitres] = useState([]);

  async function charger() {
    try {
      setTitres(await aSuivre());
    } catch {
      setTitres([]);
    }
  }

  useEffect(() => {
    charger();
    const onFocus = () => charger();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  async function marquerVu(titre) {
    await cocher({
      itemId: titre.localId,
      season: titre.prochaine,
      episode: titre.prochain,
      runtimeMin: titre.runtimeMin ?? null,
    });
    await charger();
  }

  if (!titres.length) {
    return (
      <section className="ecran accueil-mobile">
        <div className="accueil-intro">
          <p className="surtitre">À SUIVRE</p>
          <h1>Ton prochain épisode.</h1>
          <p className="secondaire">Ajoute une série à ta bibliothèque et son prochain épisode apparaîtra ici.</p>
          <a className="action primaire" href="#/recherche">Ajouter une série</a>
        </div>
      </section>
    );
  }

  return (
    <section className="ecran accueil-mobile">
      <div className="accueil-intro">
        <p className="surtitre">À SUIVRE</p>
        <h1>Ton prochain épisode.</h1>
      </div>

      <div className="cartes-suivi">
        {titres.map((titre) => (
          <article className="carte-suivi" key={`${titre.tmdbId}-${titre.mediaType}`}>
            {titre.posterPath ? (
              <img src={titre.posterPath.startsWith('http') ? titre.posterPath : `https://image.tmdb.org/t/p/w780${titre.posterPath}`} alt="" />
            ) : <div className="affiche-manquante" aria-hidden="true" />}
            <div className="carte-voile" />
            <div className="carte-suivi-texte">
              <p className="surtitre">S{titre.prochaine} · E{titre.prochain}</p>
              <h2>{titre.title}</h2>
            </div>
            <button
              className="vu-flottant"
              type="button"
              aria-label={`Marquer S${titre.prochaine} E${titre.prochain} de ${titre.title} comme vu`}
              onClick={() => marquerVu(titre)}
            >
              ✓
            </button>
            <a className="carte-suivi-lien" href={`#/titre/${titre.mediaType}/${titre.tmdbId}`} aria-label={`Ouvrir ${titre.title}`} />
          </article>
        ))}
      </div>
    </section>
  );
}
