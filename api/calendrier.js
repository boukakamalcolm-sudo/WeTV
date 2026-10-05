import { calendrierIcs } from './_ics.js';
import { sortiesDesFavoris } from './_sorties.js';

// Flux d'abonnement : GET /calendrier.ics?cle=…  (ou /api/calendrier?cle=…)
// La clé secrète identifie le calendrier ; les agendas n'envoient pas
// d'en-tête d'authentification, elle ne peut donc vivre que dans l'URL.
// ?format=json renvoie les mêmes sorties pour l'aperçu de la console.

const supabaseUrl = () => process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseCle = () => process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

// null si la clé est inconnue (ou révoquée), sinon la liste des favoris.
async function favorisDuFlux(cle) {
  const res = await fetch(`${supabaseUrl()}/rest/v1/rpc/favoris_du_flux`, {
    method: 'POST',
    headers: {
      apikey: supabaseCle(),
      Authorization: `Bearer ${supabaseCle()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_cle: cle }),
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}`);
  return res.json();
}

function repondre(res, statut, type, corps, cache = 'no-store') {
  res.statusCode = statut;
  res.setHeader('Content-Type', type);
  res.setHeader('Cache-Control', cache);
  res.end(corps);
}

export default async function handler(req, res) {
  const params = new URL(req.url, 'http://localhost').searchParams;
  const cle = params.get('cle') || '';
  const json = params.get('format') === 'json';

  if (!/^[a-f0-9]{32,}$/.test(cle)) {
    return repondre(res, 400, 'text/plain; charset=utf-8', 'Clé de calendrier manquante ou invalide.');
  }

  let favoris;
  try {
    favoris = await favorisDuFlux(cle);
  } catch {
    return repondre(res, 503, 'text/plain; charset=utf-8', 'Base de données indisponible, réessayer plus tard.');
  }
  if (favoris === null) {
    return repondre(res, 404, 'text/plain; charset=utf-8', 'Calendrier introuvable : la clé a peut-être été régénérée.');
  }

  const resultat = await sortiesDesFavoris(favoris);

  if (json) {
    return repondre(res, 200, 'application/json; charset=utf-8', JSON.stringify(resultat), 'private, max-age=60');
  }
  res.setHeader('Content-Disposition', 'inline; filename="wetv.ics"');
  // Mis en cache une heure au bord du réseau : les agendas relisent souvent,
  // TMDB n'a pas besoin d'être sollicité à chaque fois.
  return repondre(
    res,
    200,
    'text/calendar; charset=utf-8',
    calendrierIcs(resultat.sorties),
    'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
  );
}
