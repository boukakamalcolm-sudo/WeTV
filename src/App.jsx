import { useEffect, useState } from 'react';
import AuthLanding from './components/AuthLanding';
import Sorties from './components/Sorties';
import Favoris from './components/Favoris';
import Abonnement from './components/Abonnement';
import { onAuthChange, seDeconnecter } from './lib/auth';
import { maCle } from './lib/favoris';
import './styles.css';

function useRoute() {
  const [route, setRoute] = useState(() => location.hash.slice(1) || '/');
  useEffect(() => {
    const update = () => setRoute(location.hash.slice(1) || '/');
    addEventListener('hashchange', update);
    return () => removeEventListener('hashchange', update);
  }, []);
  return route;
}

export default function App() {
  const route = useRoute();
  const [utilisateur, setUtilisateur] = useState(undefined);
  const [cle, setCle] = useState(null);
  const [erreurCle, setErreurCle] = useState('');

  useEffect(() => onAuthChange(setUtilisateur), []);

  useEffect(() => {
    if (!utilisateur) return;
    maCle().then(setCle).catch((e) => setErreurCle(e.message || 'Clé du calendrier indisponible.'));
  }, [utilisateur]);

  if (utilisateur === undefined) return null;
  if (!utilisateur) return <AuthLanding />;

  return (
    <div className="app">
      <header className="app-header">
        <a className="app-logo" href="#/">WeTV <span className="app-logo-sub">console</span></a>
        <button type="button" className="action discret" onClick={async () => { await seDeconnecter(); location.hash = '/'; }}>
          Se déconnecter
        </button>
      </header>
      <main>
        {erreurCle && <p className="alerte" role="alert">{erreurCle}</p>}
        {route === '/' && <Sorties cle={cle} />}
        {route === '/favoris' && <Favoris />}
        {route === '/abonnement' && <Abonnement cle={cle} onCle={setCle} />}
      </main>
      <nav className="bottom-nav" aria-label="Navigation principale">
        <Onglet href="#/" actif={route === '/'} libelle="Sorties" icone="◫" />
        <Onglet href="#/favoris" actif={route === '/favoris'} libelle="Favoris" icone="★" />
        <Onglet href="#/abonnement" actif={route === '/abonnement'} libelle="Abonnement" icone="⇪" />
      </nav>
    </div>
  );
}

const Onglet = ({ href, actif, libelle, icone }) => (
  <a href={href} className="bottom-tab" aria-current={actif ? 'page' : undefined}>
    <span aria-hidden="true">{icone}</span>
    <small>{libelle}</small>
  </a>
);
