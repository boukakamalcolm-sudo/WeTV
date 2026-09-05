import { useState } from 'react';
import { connecterAvecGoogle, seConnecterAvecEmail, creerCompteAvecEmail, resetMotDePasse } from '../lib/auth';

export default function AuthLanding() {
  const [mode, setMode] = useState('landing');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const go = (next) => { setMode(next); setError(''); setMessage(''); };

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true); setError(''); setMessage('');
    try {
      if (mode === 'signup') {
        if (password.length < 6) throw new Error('Choisis un mot de passe d’au moins 6 caractères.');
        if (password !== confirmation) throw new Error('Les mots de passe ne correspondent pas.');
        const result = await creerCompteAvecEmail(email.trim(), password);
        if (result?.requiresConfirmation) setMessage('Compte créé. Vérifie ton adresse e-mail pour confirmer ton compte.');
      } else if (mode === 'login') {
        await seConnecterAvecEmail(email.trim(), password);
      } else if (mode === 'reset') {
        await resetMotDePasse(email.trim());
        setMessage('Si cette adresse existe, un lien de réinitialisation vient d’être envoyé.');
      }
    } catch (e) {
      setError(e?.message || 'Une erreur est survenue.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="auth-landing">
      <div className="auth-backdrop" aria-hidden="true">
        <div className="auth-glow glow-a" /><div className="auth-glow glow-b" />
        <div className="auth-film auth-film-a" /><div className="auth-film auth-film-b" /><div className="auth-film auth-film-c" />
      </div>
      <header className="auth-brand">WatchFlow<span>●</span></header>

      {mode === 'landing' ? (
        <div className="auth-content">
          <div className="auth-kicker">TON UNIVERS DE WATCHING</div>
          <h1>Ne te demande plus où tu t’es arrêté.</h1>
          <p>WatchFlow garde en mémoire chaque épisode, chaque film et chaque minute regardée — pour que tu puisses reprendre exactement là où tu en étais.</p>
          <div className="auth-actions">
            <button className="auth-primary google" type="button" onClick={connecterAvecGoogle}>
              <span className="google-mark" aria-hidden="true">G</span><span>Continuer avec Google</span>
            </button>
            <button className="auth-secondary" type="button" onClick={() => go('login')}>Se connecter avec un e-mail</button>
          </div>
          <p className="auth-signup">Pas encore de compte ? <button type="button" onClick={() => go('signup')}>Créer un compte</button></p>
        </div>
      ) : (
        <div className="auth-form-shell">
          <button className="auth-back" type="button" onClick={() => go('landing')}>← Retour</button>
          <div className="auth-kicker">WATCHFLOW</div>
          <h1>{mode === 'signup' ? 'Créer ton compte' : mode === 'reset' ? 'Réinitialiser ton mot de passe' : 'Bon retour'}</h1>
          <p>{mode === 'signup' ? 'Retrouve ton historique sur tous tes appareils.' : mode === 'reset' ? 'Entre ton adresse e-mail pour recevoir un lien.' : 'Connecte-toi pour retrouver ton univers de séries et de films.'}</p>

          <form onSubmit={submit} className="auth-form">
            <label htmlFor="auth-email">Adresse e-mail</label>
            <input id="auth-email" type="email" inputMode="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required />

            {mode !== 'reset' && <>
              <label htmlFor="auth-password">Mot de passe</label>
              <input id="auth-password" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} required />
            </>}

            {mode === 'signup' && <>
              <label htmlFor="auth-confirm">Confirmer le mot de passe</label>
              <input id="auth-confirm" type="password" autoComplete="new-password" value={confirmation} onChange={e => setConfirmation(e.target.value)} required />
            </>}

            {error && <p className="auth-error" role="alert">{error}</p>}
            {message && <p className="auth-message" role="status">{message}</p>}

            <button className="auth-primary" type="submit" disabled={busy}>
              {busy ? 'Chargement…' : mode === 'signup' ? 'Créer mon compte' : mode === 'reset' ? 'Envoyer le lien' : 'Se connecter'}
            </button>
          </form>

          {mode === 'login' && <button className="auth-text-link" type="button" onClick={() => go('reset')}>Mot de passe oublié ?</button>}
          {mode === 'login' && <p className="auth-signup">Pas encore de compte ? <button type="button" onClick={() => go('signup')}>Créer un compte</button></p>}
          {mode === 'signup' && <p className="auth-signup">Déjà un compte ? <button type="button" onClick={() => go('login')}>Se connecter</button></p>}
        </div>
      )}
    </section>
  );
}
