import { useEffect, useState } from 'react';
import ASuivre from './components/ASuivre';
import Recherche from './components/Recherche';
import Fiche from './components/Fiche';
import Bienvenue from './components/Bienvenue';
import Connexion from './components/Connexion';
import { Amorcage, Tri } from './components/Decouverte';
import { telechargerExport, preferences, synchroniser } from './lib/store';
import { onAuthChange, connecterAvecGoogle, seDeconnecter } from './lib/auth';
import { supabase } from './lib/supabase';
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

const CLE_BIENVENUE = 'tracker_bienvenue_vue';
const CLE_SANS_COMPTE = 'tracker_sans_compte';
const CLE_AMORCE_PASSEE = 'tracker_amorcage_passee';

export default function App() {
  const route = useRoute();
  const [amorce, setAmorce] = useState(null);
  const [bienvenueVue, setBienvenueVue] = useState(() => !!localStorage.getItem(CLE_BIENVENUE));
  const [sansCompte, setSansCompte] = useState(() => !!localStorage.getItem(CLE_SANS_COMPTE));
  const [utilisateur, setUtilisateur] = useState(undefined); // undefined = pas encore vérifié

  useEffect(() => {
    preferences().then((p) => setAmorce(p.length > 0 || !!localStorage.getItem(CLE_AMORCE_PASSEE)));
  }, []);
  useEffect(() => onAuthChange((u) => {
    setUtilisateur(u);
    if (u) synchroniser();
  }), []);

  if (!bienvenueVue) {
    return (
      <Bienvenue
        onFini={() => {
          localStorage.setItem(CLE_BIENVENUE, '1');
          setBienvenueVue(true);
        }}
      />
    );
  }

  if (utilisateur === undefined) return null; // le temps de vérifier une session existante

  // Une fois connecté, le choix "sans compte" n'a plus lieu d'être.
  const connexionProposee = !!supabase && !utilisateur && !sansCompte;
  if (connexionProposee) {
    return (
      <Connexion
        onSansCompte={() => {
          localStorage.setItem(CLE_SANS_COMPTE, '1');
          setSansCompte(true);
        }}
      />
    );
  }

  if (amorce === null) return null;
  if (!amorce) {
    return (
      <Amorcage
        onFini={() => {
          localStorage.setItem(CLE_AMORCE_PASSEE, '1');
          setAmorce(true);
        }}
      />
    );
  }

  const fiche = route.match(/^\/titre\/(tv|movie)\/(\d+)$/);

  return (
    <div className="app">
      <main>
        {route === '/' && <ASuivre />}
        {route === '/recherche' && <Recherche onAjout={(t) => (location.hash = `/titre/${t.mediaType}/${t.tmdbId}`)} />}
        {route === '/decouvrir' && <Tri />}
        {route === '/reglages' && <Reglages utilisateur={utilisateur} />}
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

const Reglages = ({ utilisateur }) => (
  <section className="ecran">
    <h1>Réglages</h1>
    <p className="secondaire">
      Tes données t'appartiennent. L'export contient l'intégralité de ton historique,
      dans un format lisible sans cette application.
    </p>
    <button type="button" className="action primaire" onClick={telechargerExport}>
      Exporter mes données
    </button>

    {supabase && (
      <>
        <h2>Compte</h2>
        {utilisateur ? (
          <>
            <p className="secondaire">Connecté en tant que {utilisateur.email}.</p>
            <button type="button" className="action" onClick={seDeconnecter}>
              Se déconnecter
            </button>
          </>
        ) : (
          <>
            <p className="secondaire">
              Pas de compte : ton suivi reste sur cet appareil uniquement.
            </p>
            <button type="button" className="action" onClick={connecterAvecGoogle}>
              Continuer avec Google
            </button>
          </>
        )}
      </>
    )}
  </section>
);
