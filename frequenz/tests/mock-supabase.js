/* Minimaler Nachbau der Supabase-Endpunkte (Auth + PostgREST-Upsert),
   nur für den Test des Sync-Layers. Speicher im RAM. */
const http = require('http');
const users = new Map();          // email -> {id, password}
const tokens = new Map();         // access_token -> user_id
let lastRecovery = null;
const db = { journal_entries: new Map(), goals: new Map(), app_meta: new Map(), push_subscriptions: new Map() };
const key = (t, r) => t === 'push_subscriptions' ? `${r.endpoint}`
                    : t === 'journal_entries' ? `${r.user_id}|${r.date}`
                    : t === 'goals' ? `${r.user_id}|${r.id}` : `${r.user_id}`;

function body(req) {
  return new Promise(res => { let d = ''; req.on('data', c => d += c); req.on('end', () => res(d ? JSON.parse(d) : {})); });
}
function send(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(obj));
}
function uid(res_) { return 'u_' + Math.random().toString(36).slice(2, 10); }

http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {   // Preflight – echtes Supabase macht das selbst
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization,apikey,content-type,prefer',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS'
    });
    return res.end();
  }
  const u = new URL(req.url, 'http://x');
  const auth = (req.headers.authorization || '').replace('Bearer ', '');
  const me = tokens.get(auth);

  if (u.pathname === '/auth/v1/signup') {
    const b = await body(req);
    if (users.has(b.email)) return send(res, 400, { msg: 'User already registered' });
    const id = uid();
    users.set(b.email, { id, password: b.password, meta: b.data || {} });
    if (process.env.CONFIRM_EMAIL === '1') {   // Bestätigungsmail erforderlich
      return send(res, 200, { id, email: b.email, confirmation_sent_at: new Date().toISOString() });
    }
    const tok = 'tok_' + id + '_' + Date.now();
    tokens.set(tok, id);
    return send(res, 200, { access_token: tok, refresh_token: 'r_' + id, expires_in: 3600, user: { id, email: b.email } });
  }
  if (u.pathname === '/auth/v1/recover') {
    const b = await body(req);
    lastRecovery = users.get(b.email) || null;   // Link wird im Test direkt gebaut
    return send(res, 200, {});
  }
  if (u.pathname === '/auth/v1/user') {
    if (!me) return send(res, 401, { message: 'JWT missing' });
    const entry = [...users.entries()].find(([, v]) => v.id === me);
    if (req.method === 'PUT') {
      const b = await body(req);
      if (b.password) entry[1].password = b.password;
      return send(res, 200, { id: me, email: entry[0] });
    }
    return send(res, 200, { id: me, email: entry[0], user_metadata: entry[1].meta || {} });
  }
  if (u.pathname === '/auth/v1/token') {
    const b = await body(req);
    if (u.searchParams.get('grant_type') === 'refresh_token') {
      const id = String(b.refresh_token).slice(2);
      // wie echtes Supabase: unbekanntes Refresh-Token wird abgelehnt
      if (![...users.values()].some(v => v.id === id)) {
        return send(res, 400, { error: 'invalid_grant', error_description: 'Invalid Refresh Token' });
      }
      const tok = 'tok_' + id + '_' + Date.now(); tokens.set(tok, id);
      const email = [...users.entries()].find(([, v]) => v.id === id)?.[0];
      return send(res, 200, { access_token: tok, refresh_token: b.refresh_token, expires_in: 3600, user: { id, email } });
    }
    const rec = users.get(b.email);
    if (!rec || rec.password !== b.password) return send(res, 400, { error_description: 'Invalid login credentials' });
    const tok = 'tok_' + rec.id + '_' + Date.now(); tokens.set(tok, rec.id);
    return send(res, 200, { access_token: tok, refresh_token: 'r_' + rec.id, expires_in: 3600, user: { id: rec.id, email: b.email } });
  }
  if (u.pathname === '/auth/v1/logout') return send(res, 204, {});

  if (u.pathname === '/test/recovery-token') {      // nur für den Test
    if (!lastRecovery) return send(res, 404, {});
    const tok = 'tok_' + lastRecovery.id + '_' + Date.now();
    tokens.set(tok, lastRecovery.id);
    return send(res, 200, { access_token: tok, refresh_token: 'r_' + lastRecovery.id });
  }
  if (u.pathname === '/rest/v1/rpc/delete_own_account') {
    if (!me) return send(res, 401, { message: 'JWT missing' });
    for (const t of Object.keys(db)) for (const [k, r] of [...db[t].entries()]) if (r.user_id === me) db[t].delete(k);
    for (const [mail, v] of [...users.entries()]) if (v.id === me) users.delete(mail);
    for (const [tok, id] of [...tokens.entries()]) if (id === me) tokens.delete(tok);
    return send(res, 200, null);
  }
  const m = u.pathname.match(/^\/rest\/v1\/(\w+)$/);
  if (m) {
    const table = m[1];
    if (!me) return send(res, 401, { message: 'JWT missing' });
    if (req.method === 'GET') {
      // RLS nachgebildet: nur eigene Zeilen
      return send(res, 200, [...db[table].values()].filter(r => r.user_id === me));
    }
    if (req.method === 'DELETE') {
      for (const [k, r] of [...db[table].entries()]) if (r.user_id === me) db[table].delete(k);
      return send(res, 204, {});
    }
    if (req.method === 'POST') {
      const rows = await body(req);
      for (const r of [].concat(rows)) {
        if (r.user_id !== me) return send(res, 403, { message: 'RLS violation' });
        db[table].set(key(table, r), r);
      }
      return send(res, 201, []);
    }
  }
  send(res, 404, { message: 'not found' });
}).listen(8123, () => console.log('mock supabase auf :8123'));
