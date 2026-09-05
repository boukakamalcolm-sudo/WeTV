// Un événement global plutôt qu'un contexte React : le toast n'a besoin
// d'aucune donnée partagée, juste d'un message à afficher deux secondes.
export function notifier(message) {
  window.dispatchEvent(new CustomEvent('tracker:toast', { detail: message }));
}
