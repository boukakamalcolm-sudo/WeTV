import { useEffect, useRef, useState } from 'react';
import WatchFlowHome from './components/WatchFlowHome';
import Recherche from './components/Recherche';
import Bibliotheque from './components/Bibliotheque';
import Calendrier from './components/Calendrier';
import Statistiques from './components/Statistiques';
import Fiche from './components/FicheV2';
import AuthLanding from './components/AuthLanding';
import { Amorcage, Tri } from './components/Decouverte';
import { telechargerExport, preferences, synchroniser, telecharger } from './lib/store';
import { onAuthChange, seDeconnecter } from './lib/auth';
import { supabase } from './lib/supabase';
import { notifier } from './lib/toast';
import { useInstallable } from './lib/install';
import './styles.css';
import './components/FicheV2.css';

function useRoute() {
  const [route, setRoute] = useState(() => location.hash.slice(1) || '/');
  useEffect(() => {
    const update = () => setRoute(location.hash.slice(1) || '/');
    addEventListener('hashchange', update);
    return () => removeEventListener('hashchange', update);
  }, []);
  return route;
}

const SEEDING_KEY = 'tracker_amorcage_passee';

export default function App() {
  const route = useRoute();
  const [amorce, setAmorce] = useState(null);
  const [utilisateur, setUtilisateur] = useState(undefined);
  const [instructionsIOS, setInstructionsIOS] = useState(false);

  useEffect(() => {
    preferences().then((p) => setAmorce(p.length > 0 || !!localStorage.getItem(SEEDING_KEY)));
  }, []);

  useEffect(() => onAuthChange((u) => {
    setUtilisateur(u);
    if (u) {
      (async () => {
        // Rapatrie d'abord ce qui existe déjà côté compte (nouvel appareil,
        // même compte Google), avant de repousser d'éventuels changements
        // locaux en attente — sinon un nouvel appareil reste vide.
        await telecharger();
        synchroniser();
        const p = await preferences();
        if (p.length > 0) setAmorce(true);
        dispatchEvent(new CustomEvent('tracker:updated'));
      })();
    }
  }), []);

  if (utilisateur === undefined) return null;
  if (!utilisateur) return <AuthLanding />;

  if (amorce === null) return null;
  if (!amorce) return <Amorcage onFini={() => { localStorage.setItem(SEEDING_KEY, '1'); setAmorce(true); }} />;

  const fiche = route.match(/^\/titre\/(tv|movie)\/(\d+)$/);
  const closeFiche = () => { location.hash = '/bibliotheque'; };

  return (
    <div className="app">
      <Header utilisateur={utilisateur} onDemanderInstructionsIOS={() => setInstructionsIOS(true)} />
      <main>
        {route === '/' && <WatchFlowHome utilisateur={utilisateur} />}
        {route === '/bibliotheque' && <Bibliotheque />}
        {route === '/calendrier' && <Calendrier />}
        {route === '/stats' && <Statistiques />}
        {route === '/recherche' && <Recherche onAjout={(t) => (location.hash = `/titre/${t.mediaType}/${t.tmdbId}`)} />}
        {route === '/decouvrir' && <Tri />}
        {route === '/reglages' && <Settings utilisateur={utilisateur} />}
        {fiche && <Fiche mediaType={fiche[1]} tmdbId={Number(fiche[2])} onClose={closeFiche} />}
      </main>
      <nav className="bottom-nav" aria-label="Navigation principale">
        <Tab href="#/" active={route === '/'} label="Accueil" icon="⌂" />
        <Tab href="#/bibliotheque" active={route === '/bibliotheque'} label="Bibliothèque" icon="▦" />
        <Tab href="#/calendrier" active={route === '/calendrier'} label="Calendrier" icon="◫" />
        <Tab href="#/stats" active={route === '/stats'} label="Statistiques" icon="◔" />
      </nav>
      {/* Rendu hors du header : le backdrop-filter du header crée son propre
          bloc de positionnement, ce qui casserait le position:fixed du modal. */}
      {instructionsIOS && <InstructionsInstallationIOS onClose={() => setInstructionsIOS(false)} />}
    </div>
  );
}

function Header({ utilisateur, onDemanderInstructionsIOS }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const { disponible: installDisponible, installer } = useInstallable();
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
            {installDisponible && (
              <button type="button" onClick={async () => { setOpen(false); const resultat = await installer(); if (resultat === 'ios') onDemanderInstructionsIOS(); }}>
                Installer l'app
              </button>
            )}
            <a href="#/reglages" onClick={() => setOpen(false)}>Réglages</a>
            {utilisateur && <button type="button" onClick={async () => { setOpen(false); await seDeconnecter(); window.location.hash = '/'; window.location.reload(); }}>Se déconnecter</button>}
          </div>}
        </div>
      </div>
    </header>
  );
}

function InstructionsInstallationIOS({ onClose }) {
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div className="title-modal install-instructions" role="dialog" aria-modal="true" aria-label="Installer l'app" onClick={(e) => e.stopPropagation()}>
        <span className="title-modal-grip" aria-hidden="true" />
        <button className="modal-close" onClick={onClose} aria-label="Fermer">×</button>
        <div className="title-modal-content">
          <p className="eyebrow">INSTALLER L'APP</p>
          <h2>Ajoute WatchFlow à ton écran d'accueil</h2>
          <ol className="install-etapes">
            <li>Appuie sur <strong>Partager</strong> <span aria-hidden="true">⬆︎</span> en bas de Safari</li>
            <li>Choisis <strong>Sur l'écran d'accueil</strong></li>
            <li>Confirme en appuyant sur <strong>Ajouter</strong></li>
          </ol>
        </div>
      </div>
    </div>
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
      <p className="subtitle">Connecté en tant que {utilisateur.email}.</p>
      <button type="button" className="secondary-btn" onClick={async () => { await seDeconnecter(); window.location.hash = '/'; window.location.reload(); }}>Se déconnecter</button>
    </div>}
  </section>
);
