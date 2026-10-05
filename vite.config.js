import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// En local, Vite sert aussi le flux (/calendrier.ics et /api/calendrier) comme
// le fait Vercel en production, pour tester la console sans autre outil.
function fluxEnLocal() {
  return {
    name: 'flux-calendrier-local',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!/^\/(calendrier\.ics|api\/calendrier)(\?|$)/.test(req.url)) return next();
        const { default: handler } = await server.ssrLoadModule('/api/calendrier.js');
        handler(req, res);
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''));
  return { plugins: [react(), fluxEnLocal()] };
});
