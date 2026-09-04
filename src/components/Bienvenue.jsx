export default function Bienvenue({ onFini }) {
  return (
    <section className="ecran bienvenue">
      <h1>Tracker</h1>
      <p className="secondaire">
        Tes séries, tes films, à ton rythme. Tes données t'appartiennent et
        restent exportables à tout moment. Rien n'attend jamais le réseau :
        cocher un épisode marche même hors connexion.
      </p>
      <div className="pied fixe">
        <button type="button" className="action primaire" onClick={onFini}>
          Commencer
        </button>
      </div>
    </section>
  );
}
