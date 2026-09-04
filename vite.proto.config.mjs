// PROTOTYPE — throwaway. Proxies /api to the production backend so the dev
// server can show live data without CORS.
import base from './vite.config.mjs';
export default async (ctx) => {
  const cfg = await base(ctx);
  return {
    ...cfg,
    server: {
      ...(cfg.server || {}),
      proxy: {
        '/api': {
          target: 'https://statsplus-backend-production.up.railway.app',
          changeOrigin: true,
          secure: true,
        },
      },
    },
  };
};
