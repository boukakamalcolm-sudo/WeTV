import { useEffect, useRef, useState } from 'react';
import WatchFlowHome from './components/WatchFlowHome';
import Recherche from './components/Recherche';
import Bibliotheque from './components/Bibliotheque';
import Calendrier from './components/Calendrier';
import Statistiques from './components/Statistiques';
import Fiche from './components/Fiche';
import Bienvenue from './components/Bienvenue';
import AuthLanding from './components/AuthLanding';
import { Amorcage, Tri } from './components/Decouverte';
import { telechargerExport, preferences, synchroniser } from './lib/store';
import { onAuthChange, connecterAvecGoogle, seDeconnecter } from './lib/auth';
import { supabase } from './lib/supabase';
import { notifier } from './lib/toast';
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

const WELCOME_KEY = 'tracker_bienvenue_vue';
const NO_ACCOUNT_KEY = 'tracker_sans_compte';
const SEEDING_KEY = 'tracker_amorcage_passee';

export default function App() {
  const route = useRoute();
  const [amorce, setAmorce] = useState(null);
  const [bienvenueVue, setBienvenueVue] = useState(() => !!localStorage.getItem(WELCOME_KEY));
  const [sansCompte, setSansCompte] = useState(() => !!localStorage.getItem(NO_ACCOUNT_KEY));
  const [utilisateur, setUtilisateur] = useState(undefined);

  useEffect(() => {
    preferences().then((p) => setAmorce(p.length > 0 || !!localStorage.getItem(SEEDING_KEY)));
  }, []);

  useEffect(() => onAuthChange((u) => {
    setUtilisateur(u);
    if (u) synchroniser();
  }), []);

  if (!bienvenueVue) return <Bienvenue onFini={() => { localStorage.setItem(WELCOME_KEY, '1'); setBienvenueVue(true); }} />;
  if (utilisateur === undefined) return null;

  const shouldOfferLogin = !!supabase && !utilisateur && !sansCompte;
  if (shouldOfferLogin) {
    return <AuthLanding onContinueLocal={() => { localStorage.setItem(NO_ACCOUNT_KEY, '1'); setSansCompte(true); }} />;
  }

  if (amorce === null) return null;
  if (!amorce) return <Amorcage onFini={() => { localStorage.setItem(SEEDING_KEY, '1'); setAmorce(true); }} />;

  const fiche = route.match(/^\/titre\/(tv|movie)\/(\d+)$/);

  return (
    <div className="app">
      <Header utilisateur={utilisateur} />
      <main>
        {route === '/' && <WatchFlowHome />}
        {route === '/bibliotheque' && <Bibliotheque />}
        {route === '/calendrier' && <Calendrier />}
        {route === '/stats' && <Statistiques />}
        {route === '/recherche' && <Recherche onAjout={(t) => (location.hash = `/titre/${t.mediaType}/${t.tmdbId}`)} />}
        {route === '/decouvrir' && <Tri />}
        {route === '/reglages' && <Settings utilisateur={utilisateur} />}
        {fiche && <Fiche mediaType={fiche[1]} tmdbId={Number(fiche[2])} />}
      </main>
      <nav className="bottom-nav" aria-label="Navigation principale">
        <Tab href="#/" active={route === '/'} label="Accueil" icon="⌂" />
        <Tab href="#/bibliotheque" active={route === '/bibliotheque'} label="Bibliothèque" icon="▦" />
        <Tab href="#/calendrier" active={route === '/calendrier'} label="Calendrier" icon="◫" />
        <Tab href="#/stats" active={route === '/stats'} label="Statistiques" icon="◔" />
      </nav>
    </div>
  );
}

function Header({ utilisateur }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (!menuRef.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', esc); };
  }, [open]);
  return (
    <header className="app-header">
      <a className="app-logo" href="#/">WatchFlow</a>
      <div className="header-actions">
        <a className="header-icon" href="#/recherche" aria-label="Rechercher">⌕</a>
        <div className="account-menu" ref={menuRef}>
          <button className="header-icon" type="button" aria-expanded={open} aria-label="Menu du compte" onClick={() => setOpen((v) => !v)}>⋯</button>
          {open && <div className="account-popover">
            <a href="#/reglages" onClick={() => setOpen(false)}>Réglages</a>
            {utilisateur ? <button type="button" onClick={() => { setOpen(false); seDeconnecter(); }}>Se déconnecter</button> : <button type="button" onClick={() => { setOpen(false); connecterAvecGoogle(); }}>Se connecter</button>}
          </div>}
        </div>
      </div>
    </header>
  );
}

const Tab = ({ href, active, label, icon }) => <a href={href} className="bottom-tab" aria-current={active ? 'page' : undefined}><span>{icon}</span><small>{label}</small></a>;

const Settings = ({ utilisateur }) => (
  <section className="page">
    <p className="eyebrow">COMPTE</p>
    <h1>Réglages</h1>
    <p className="subtitle">Tes données sont exportables à tout moment.</p>
    <button type="button" className="primary-btn" onClick={async () => { await telechargerExport(); notifier('Export téléchargé'); }}>Exporter mes données</button>
    {supabase && <div className="settings-account">
      <p className="eyebrow">SYNCHRONISATION</p>
      <p className="subtitle">{utilisateur ? `Connecté en tant que ${utilisateur.email}.` : "Pas de compte : suivi local uniquement."}</p>
      {utilisateur ? <button type="button" className="secondary-btn" onClick={seDeconnecter}>Se déconnecter</button> : <button type="button" className="secondary-btn" onClick={connecterAvecGoogle}>Continuer avec Google</button>}
    </div>}
  </section>
);
