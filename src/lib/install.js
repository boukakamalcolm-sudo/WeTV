import { useEffect, useState } from 'react';

// Aucune API ne force l'ajout à l'écran d'accueil : c'est un geste
// volontaire, par design. Ce qu'on peut faire diffère selon la plateforme :
// - Android/Chrome expose un vrai prompt natif, déclenchable depuis un bouton.
// - iOS/Safari n'expose rien : on ne peut que guider vers le geste manuel
//   (Partager → Sur l'écran d'accueil).
const estInstalle = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

const estIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;

export function useInstallable() {
  const [prompt, setPrompt] = useState(null);
  const [installe, setInstalle] = useState(estInstalle);

  useEffect(() => {
    const onBeforeInstall = (e) => { e.preventDefault(); setPrompt(e); };
    const onInstalled = () => { setInstalle(true); setPrompt(null); };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const ios = estIOS();
  const disponible = !installe && (!!prompt || ios);

  async function installer() {
    if (prompt) {
      prompt.prompt();
      const { outcome } = await prompt.userChoice;
      setPrompt(null);
      if (outcome === 'accepted') setInstalle(true);
      return 'natif';
    }
    return 'ios';
  }

  return { disponible, installe, installer };
}
