import { connecterAvecGoogle } from '../lib/auth';

export default function Connexion({ onSansCompte }) {
  return (
    <section className="ecran connexion">
      <h1>Retrouver tes données partout</h1>
      <p className="secondaire">
        Connecte-toi pour retrouver ton suivi sur tous tes appareils. Elles
        restent privées, à toi seul — pas de partage, pas de social.
      </p>
      <div className="pied fixe">
        <button type="button" className="action primaire" onClick={connecterAvecGoogle}>
          Continuer avec Google
        </button>
        <button type="button" className="action discret" onClick={onSansCompte}>
          Continuer sans compte
        </button>
      </div>
    </section>
  );
}
