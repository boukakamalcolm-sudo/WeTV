import { useEffect, useRef, useState } from 'react';
import AccueilMobile from './components/AccueilMobile';
import ASuivre from './components/ASuivre';
import Recherche from './components/Recherche';
import Bibliotheque from './components/Bibliotheque';
import Calendrier from './components/Calendrier';
import Statistiques from './components/Statistiques';
import Fiche from './components/Fiche';
import Bienvenue from './components/Bienvenue';
import Connexion from './components/Connexion';
import { Amorcage, Tri } from './components/Decouverte';
import { telechargerExport, preferences, synchroniser } from './lib/store';
import { onAuthChange, connecterAvecGoogle, seDeconnecter } from './lib/auth';
import { supabase } from './lib/supabase';
import { notifier } from './lib/toast';
import './styles.css';

function useRoute() {
  const [route, setRoute] = useState(() => location.hash.slice(1) || '/');
  useEffect(() => {
    const maj = () => setRoute(location.hash.slice(1) || '/');
    addEventListener('hashchange', maj);
    return () => removeEventListener('hashchange', maj);
  }, []);
  return route;
}

const CLE_BIENVENUE = 'tracker_bienvenue_vue';
const CLE_SANS_COMPTE = 'tracker_sans_compte';
const CLE_AMORCE_PASSEE = 'tracker_amorcage_passee';

export default function App() {
  const route = useRoute();
  const [amorce, setAmorce] = useState(null);
  const [bienvenueVue, setBienvenueVue] = useState(() => !!localStorage.getItem(CLE_BIENVENUE));
  const [sansCompte, setSansCompte] = useState(() => !!localStorage.getItem(CLE_SANS_COMPTE));
  const [utilisateur, setUtilisateur] = useState(undefined);

  useEffect(() => {
    preferences().then((p) => setAmorce(p.length > 0 || !!localStorage.getItem(CLE_AMORCE_PASSEE)));
  }, []);

  useEffect(() => onAuthChange((u) => {
    setUtilisateur(u);
    if (u) synchroniser();
  }), []);

  if (!bienvenueVue) {
    return <Bienvenue onFini={() => { localStorage.setItem(CLE_BIENVENUE, '1'); setBienvenueVue(true); }} />;
  }
  if (utilisateur === undefined) return null;

  const connexionProposee = !!supabase && !utilisateur && !sansCompte;
  if (connexionProposee) {
    return <Connexion onSansCompte={() => { localStorage.setItem(CLE_SANS_COMPTE, '1'); setSansCompte(true); }} />;
  }

  if (amorce === null) return null;
  if (!amorce) {
    return <Amorcage onFini={() => { localStorage.setItem(CLE_AMORCE_PASSEE, '1'); setAmorce(true); }} />;
  }

  const fiche = route.match(/^\/titre\/(tv|movie)\/(\d+)$/);

  return (
    <div className="app">
      <Entete utilisateur={utilisateur} />
      <Toast />
      <main>
        {route === '/' && <AccueilMobile />}
        {route === '/bibliotheque' && <Bibliotheque />}
        {route === '/calendrier' && <Calendrier />}
        {route === '/stats' && <Statistiques />}
        {route === '/recherche' && <Recherche onAjout={(t) => (location.hash = `/titre/${t.mediaType}/${t.tmdbId}`)} />}
        {route === '/decouvrir' && <Tri />}
        {route === '/reglages' && <Reglages utilisateur={utilisateur} />}
        {fiche && <Fiche mediaType={fiche[1]} tmdbId={Number(fiche[2])} />}
      </main>
      <nav className="barre" aria-label="Navigation principale">
        <Onglet href="#/" actif={route === '/'} libelle="Accueil" icone="⌂" />
        <Onglet href="#/bibliotheque" actif={route === '/bibliotheque'} libelle="Bibliothèque" icone="▦" />
        <Onglet href="#/calendrier" actif={route === '/calendrier'} libelle="Calendrier" icone="◫" />
        <Onglet href="#/stats" actif={route === '/stats'} libelle="Statistiques" icone="◔" />
      </nav>
    </div>
  );
}

function Entete({ utilisateur }) {
  const [ouvert, setOuvert] = useState(false);
  const menuRef = useRef(null);
  useEffect(() => {
    if (!ouvert) return;
    const fermerSiExterieur = (e) => { if (!menuRef.current?.contains(e.target)) setOuvert(false); };
    const fermerSurEchap = (e) => { if (e.key === 'Escape') setOuvert(false); };
    document.addEventListener('pointerdown', fermerSiExterieur);
    document.addEventListener('keydown', fermerSurEchap);
    return () => { document.removeEventListener('pointerdown', fermerSiExterieur); document.removeEventListener('keydown', fermerSurEchap); };
  }, [ouvert]);
  return (
    <header className="entete-app">
      <a className="logo" href="#/">Tracker</a>
      <div className="entete-actions">
        <a className="menu-bouton" href="#/recherche" aria-label="Chercher un titre">⌕</a>
        <div className="menu-compte" ref={menuRef}>
          <button type="button" className="menu-bouton" aria-haspopup="menu" aria-expanded={ouvert} aria-label="Menu du compte" onClick={() => setOuvert((o) => !o)}>⋯</button>
          {ouvert && (
            <ul className="menu-liste" role="menu">
              <li role="none"><a role="menuitem" href="#/reglages" onClick={() => setOuvert(false)}>Réglages</a></li>
              <li role="none">{utilisateur ? <button role="menuitem" type="button" onClick={() => { setOuvert(false); seDeconnecter(); }}>Se déconnecter</button> : <button role="menuitem" type="button" onClick={() => { setOuvert(false); connecterAvecGoogle(); }}>Se connecter</button>}</li>
            </ul>
          )}
        </div>
      </div>
    </header>
  );
}

function Toast() {
  const [message, setMessage] = useState(null);
  const timerRef = useRef(null);
  useEffect(() => {
    const afficher = (e) => { clearTimeout(timerRef.current); setMessage(e.detail); timerRef.current = setTimeout(() => setMessage(null), 2200); };
    window.addEventListener('tracker:toast', afficher);
    return () => { window.removeEventListener('tracker:toast', afficher); clearTimeout(timerRef.current); };
  }, []);
  if (!message) return null;
  return <div className="toast" role="status">{message}</div>;
}

const Onglet = ({ href, actif, libelle, icone }) => <a href={href} className="onglet" aria-current={actif ? 'page' : undefined}><span aria-hidden="true">{icone}</span><span className="libelle">{libelle}</span></a>;

const Reglages = ({ utilisateur }) => (
  <section className="ecran">
    <h1>Réglages</h1>
    <p className="secondaire">Tes données t'appartiennent. L'export contient l'intégralité de ton historique.</p>
    <button type="button" className="action primaire" onClick={async () => { await telechargerExport(); notifier('Export téléchargé'); }}>Exporter mes données</button>
    {supabase && <><h2>Compte</h2>{utilisateur ? <><p className="secondaire">Connecté en tant que {utilisateur.email}.</p><button type="button" className="action" onClick={seDeconnecter}>Se déconnecter</button></> : <><p className="secondaire">Pas de compte : ton suivi reste sur cet appareil uniquement.</p><button type="button" className="action" onClick={connecterAvecGoogle}>Continuer avec Google</button></>}</>}
  </section>
);
