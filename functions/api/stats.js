// Cloudflare Pages Function behind the "N% of players won today" line.
// GET  /api/stats?date=YYYY-MM-DD -> { date, played, wins }
// POST /api/stats { date, won }   -> 204; one result per visitor per day
// Results live in D1 (binding DB, table in migrations/). Visitors are a salted
// hash of their IP and the date, so no address is stored.
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const json = (body, status = 200, headers = {}) => Response.json(body, { status, headers });

// Players are in every time zone, so "today" is anywhere from yesterday to tomorrow in UTC.
const plausible = (date, now = Date.now()) => DATE.test(date) && Math.abs(Date.parse(`${date}T12:00:00Z`) - now) <= 40 * 3600e3;

async function visitor(request, date, salt) {
  const ip = request.headers.get('cf-connecting-ip') || '';
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${date}:${ip}`));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestGet({ request, env }) {
  const date = new URL(request.url).searchParams.get('date') || '';
  if (!DATE.test(date)) return json({ error: 'bad date' }, 400);
  const row = await env.DB.prepare('SELECT COUNT(*) AS played, COALESCE(SUM(won), 0) AS wins FROM results WHERE date = ?').bind(date).first();
  return json({ date, played: row.played, wins: row.wins }, 200, { 'cache-control': 'public, max-age=60' });
}

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad json' }, 400);
  }
  if (!plausible(body?.date) || typeof body.won !== 'boolean') return json({ error: 'bad body' }, 400);
  // shortcut: a shared IP (school, office, carrier NAT) counts as one player; fine for a rough percentage.
  const id = await visitor(request, body.date, env.SALT || 'pwt-today');
  await env.DB.prepare('INSERT OR IGNORE INTO results (date, visitor, won) VALUES (?, ?, ?)').bind(body.date, id, body.won ? 1 : 0).run();
  return new Response(null, { status: 204 });
}

export { plausible };
