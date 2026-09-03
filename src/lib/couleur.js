// Le châssis est neutre, la couleur vient des affiches.
// Extraction de la teinte dominante, puis bascule du texte selon la luminosité,
// pour tenir le contraste de 4,5:1 imposé par les exigences de conception.

const memo = new Map();

export async function teinteAffiche(url) {
  if (!url) return null;
  if (memo.has(url)) return memo.get(url);

  const teinte = await new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onerror = () => resolve(null);
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = c.height = 24;                 // 24x24 suffit largement
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, 24, 24);
      const { data } = ctx.getImageData(0, 0, 24, 24);

      let r = 0, v = 0, b = 0, n = 0;
      for (let i = 0; i < data.length; i += 4) {
        const [pr, pv, pb] = [data[i], data[i + 1], data[i + 2]];
        const max = Math.max(pr, pv, pb), min = Math.min(pr, pv, pb);
        if (max - min < 24) continue;          // on écarte les gris, sans intérêt
        r += pr; v += pv; b += pb; n++;
      }
      if (!n) return resolve(null);
      resolve({ r: Math.round(r / n), v: Math.round(v / n), b: Math.round(b / n) });
    };
    img.src = url;
  });

  memo.set(url, teinte);
  return teinte;
}

export const luminance = ({ r, v, b }) =>
  (0.2126 * r + 0.7152 * v + 0.0722 * b) / 255;

// Rend les variables CSS à poser sur la fiche. Le texte bascule, jamais l'inverse.
export function habillage(teinte) {
  if (!teinte) return {};
  const { r, v, b } = teinte;
  const clair = luminance(teinte) > 0.45;
  return {
    '--accent': `rgb(${r} ${v} ${b})`,
    '--voile': `rgb(${r} ${v} ${b} / 0.18)`,
    '--sur-accent': clair ? '#101215' : '#ecebe8',
  };
}
