// Regroupe une liste (déjà triée) par date, puis découpe en pages sans
// jamais couper un groupe de même date entre deux pages — un jour donné
// reste toujours entier sur une seule page.

export function grouperParDate(liste, dateDe) {
  const parJour = new Map();
  for (const item of liste) {
    const cle = dateDe(item);
    if (!parJour.has(cle)) parJour.set(cle, []);
    parJour.get(cle).push(item);
  }
  return [...parJour.entries()].map(([date, items]) => ({ date, items }));
}

export function paginer(groupes, taillePage = 20) {
  const pages = [];
  let page = [];
  let compte = 0;
  for (const g of groupes) {
    if (compte && compte + g.items.length > taillePage) {
      pages.push(page);
      page = [];
      compte = 0;
    }
    page.push(g);
    compte += g.items.length;
  }
  if (page.length) pages.push(page);
  return pages;
}
