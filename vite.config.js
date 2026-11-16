import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Local stand-in for the /api/stats endpoint:
// GET ?date=YYYY-MM-DD -> { date, played, wins }; POST { date, won } records a result.
function statsApi() {
  const file = path.resolve('.data/stats.json');
  const read = () => {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      return {};
    }
  };
  const handler = (req, res, next) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname !== '/api/stats') return next();
    const send = (code, body) => {
      res.statusCode = code;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(body));
    };
    if (req.method === 'GET') {
      const date = url.searchParams.get('date');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return send(400, { error: 'bad date' });
      const day = read()[date] || { played: 0, wins: 0 };
      return send(200, { date, ...day });
    }
    if (req.method === 'POST') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        try {
          const { date, won } = JSON.parse(body);
          if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || typeof won !== 'boolean') return send(400, { error: 'bad body' });
          const all = read();
          const day = (all[date] ??= { played: 0, wins: 0 });
          day.played++;
          if (won) day.wins++;
          fs.mkdirSync(path.dirname(file), { recursive: true });
          fs.writeFileSync(file, JSON.stringify(all, null, 2));
          res.statusCode = 204;
          res.end();
        } catch {
          send(400, { error: 'bad json' });
        }
      });
      return;
    }
    send(405, { error: 'method not allowed' });
  };
  return {
    name: 'pwt-today-stats-api',
    configureServer: (server) => void server.middlewares.use(handler),
    configurePreviewServer: (server) => void server.middlewares.use(handler),
  };
}

export default defineConfig({
  plugins: [react(), statsApi()],
  worker: { format: 'es' },
});
