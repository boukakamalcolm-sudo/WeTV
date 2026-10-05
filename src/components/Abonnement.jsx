import { useState } from 'react';
import { regenererCle, urlFlux, urlWebcal } from '../lib/favoris';

export default function Abonnement({ cle, onCle }) {
  const [message, setMessage] = useState('');
  const [erreur, setErreur] = useState('');

  if (!cle) return <section className="page"><p className="secondaire chargement">Chargement…</p></section>;

  const url = urlFlux(cle);

  async function copier() {
    try {
      await navigator.clipboard.writeText(url);
      setMessage('Adresse copiée.');
    } catch {
      setMessage("Copie impossible : sélectionne l'adresse à la main.");
    }
  }

  async function regenerer() {
    if (!confirm("L'adresse actuelle cessera de fonctionner. Il faudra se réabonner partout. Continuer ?")) return;
    setErreur('');
    try {
      onCle(await regenererCle());
      setMessage('Nouvelle adresse créée. Réabonne tes agendas avec celle-ci.');
    } catch (e) {
      setErreur(e.message);
    }
  }

  return (
    <section className="page">
      <p className="eyebrow">ABONNEMENT</p>
      <h1>Ton calendrier</h1>
      <p className="subtitle">Une seule adresse, à ajouter une fois. L'agenda la relit tout seul : nouveaux favoris et dates corrigées arrivent sans rien refaire.</p>

      <div className="bloc">
        <label className="champ" htmlFor="url-flux">Adresse d'abonnement</label>
        <input id="url-flux" className="saisie" readOnly value={url} onFocus={(e) => e.target.select()} />
        <div className="raccourcis">
          <button type="button" className="action primaire" onClick={copier}>Copier l'adresse</button>
          <a className="action" href={urlWebcal(cle)}>Ouvrir dans Calendrier</a>
        </div>
        {message && <p className="info" role="status">{message}</p>}
        {erreur && <p className="alerte" role="alert">{erreur}</p>}
      </div>

      <div className="bloc">
        <h2>Apple Calendrier (iPhone, Mac)</h2>
        <p className="secondaire">Touche « Ouvrir dans Calendrier », puis S'abonner. Dans les réglages du calendrier, règle « Actualiser » sur toutes les heures.</p>
        <h2>Google Agenda</h2>
        <p className="secondaire">Sur ordinateur : Autres agendas, « + », À partir de l'URL, colle l'adresse. Google relit les abonnements à son rythme, souvent toutes les 12 à 24 h.</p>
      </div>

      <div className="bloc">
        <h2>Adresse compromise ?</h2>
        <p className="secondaire">Toute personne qui a l'adresse voit tes favoris. En la régénérant, l'ancienne cesse de fonctionner.</p>
        <button type="button" className="action discret" onClick={regenerer}>Régénérer l'adresse</button>
      </div>
    </section>
  );
}
