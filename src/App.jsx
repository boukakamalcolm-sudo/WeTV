import { useEffect, useState } from 'react';
import ASuivre from './components/ASuivre';
import Recherche from './components/Recherche';
import Fiche from './components/Fiche';
import { Amorcage, Tri } from './components/Decouverte';
import { telechargerExport, preferences } from './lib/store';
import './styles.css';

// Routage minimal sur le fragment d'URL. Une dépendance de moins,
// et le retour arrière du navigateur fonctionne tel quel.
function useRoute() {
  const [route, setRoute] = useState(() => location.hash.slice(1) || '/');
  useEffect(() => {
    const maj = () => setRoute(location.hash.slice(1) || '/');
    addEventListener('hashchange', maj);
    return () => removeEventListener('hashchange', maj);
  }, []);
  return route;
}

export default function App() {
  const route = useRoute();
  const [amorce, setAmorce] = useState(null);

  useEffect(() => { preferences().then((p) => setAmorce(p.length > 0)); }, []);

  if (amorce === null) return null;
  if (!amorce) return <Amorcage onFini={() => setAmorce(true)} />;

  const fiche = route.match(/^\/titre\/(tv|movie)\/(\d+)$/);

  return (
    <div className="app">
      <main>
        {route === '/' && <ASuivre />}
        {route === '/recherche' && <Recherche onAjout={() => (location.hash = '/')} />}
        {route === '/decouvrir' && <Tri />}
        {route === '/reglages' && <Reglages />}
        {fiche && <Fiche mediaType={fiche[1]} tmdbId={Number(fiche[2])} />}
      </main>

      {/* Navigation en bas : à portée du pouce, quatre sections, pas davantage. */}
      <nav className="barre" aria-label="Navigation principale">
        <Onglet href="#/" actif={route === '/'} libelle="À suivre" icone="▶" />
        <Onglet href="#/recherche" actif={route === '/recherche'} libelle="Chercher" icone="⌕" />
        <Onglet href="#/decouvrir" actif={route === '/decouvrir'} libelle="Découvrir" icone="✦" />
        <Onglet href="#/reglages" actif={route === '/reglages'} libelle="Réglages" icone="⚙" />
      </nav>
    </div>
  );
}

const Onglet = ({ href, actif, libelle, icone }) => (
  <a href={href} className="onglet" aria-current={actif ? 'page' : undefined}>
    <span aria-hidden="true">{icone}</span>
    <span className="libelle">{libelle}</span>
  </a>
);

const Reglages = () => (
  <section className="ecran">
    <h1>Réglages</h1>
    <p className="secondaire">
      Tes données t'appartiennent. L'export contient l'intégralité de ton historique,
      dans un format lisible sans cette application.
    </p>
    <button type="button" className="action primaire" onClick={telechargerExport}>
      Exporter mes données
    </button>
  </section>
);
