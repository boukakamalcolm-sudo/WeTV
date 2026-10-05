// Écriture d'un calendrier iCalendar (RFC 5545) à la main : le format tient en
// quelques règles, une dépendance n'apporterait rien de plus.

const echapper = (texte) =>
  String(texte)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');

// Les lignes dépassant 75 octets sont repliées (CRLF + espace). On compte en
// octets UTF-8 sans jamais couper un caractère accentué en deux.
function replier(ligne) {
  const enc = new TextEncoder();
  const morceaux = [];
  let courant = '';
  let octets = 0;
  for (const car of ligne) {
    const taille = enc.encode(car).length;
    const limite = morceaux.length === 0 ? 75 : 74;
    if (octets + taille > limite) {
      morceaux.push(courant);
      courant = '';
      octets = 0;
    }
    courant += car;
    octets += taille;
  }
  morceaux.push(courant);
  return morceaux.join('\r\n ');
}

const dateIcs = (iso) => iso.replace(/-/g, '');

function lendemain(iso) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

// sorties : [{ uid, date: 'AAAA-MM-JJ', titre, description?, url? }]
// Événements « journée entière » : TMDB ne donne que des dates, pas d'heures.
export function calendrierIcs(sorties, { nom = 'WeTV — sorties', maintenant = new Date() } = {}) {
  const horodatage = maintenant.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lignes = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//WeTV//Sorties//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${echapper(nom)}`,
    'X-WR-TIMEZONE:Europe/Paris',
    // Indication de fréquence de relecture pour les agendas qui la respectent.
    'REFRESH-INTERVAL;VALUE=DURATION:PT6H',
    'X-PUBLISHED-TTL:PT6H',
  ];
  for (const s of sorties) {
    lignes.push(
      'BEGIN:VEVENT',
      `UID:${s.uid}`,
      `DTSTAMP:${horodatage}`,
      `DTSTART;VALUE=DATE:${dateIcs(s.date)}`,
      `DTEND;VALUE=DATE:${dateIcs(lendemain(s.date))}`,
      `SUMMARY:${echapper(s.titre)}`,
      ...(s.description ? [`DESCRIPTION:${echapper(s.description)}`] : []),
      ...(s.url ? [`URL:${s.url}`] : []),
      // Une sortie n'occupe pas l'agenda : ne bloque pas les créneaux.
      'TRANSP:TRANSPARENT',
      'END:VEVENT',
    );
  }
  lignes.push('END:VCALENDAR');
  return lignes.map(replier).join('\r\n') + '\r\n';
}
