'use strict';
/**
 * Local API server + live checklist page. No dependencies.
 *
 *   GET    /                      live FID checklist
 *   GET    /api/state             full computed state
 *   POST   /api/events            record one event  { type, ..., actor:{name,kind} }
 *   POST   /api/cases             create / update a test case  { case }
 *   DELETE /api/cases/:id         delete a test case
 *   POST   /api/cases/approve     { ids:[...], actor }
 *   POST   /api/cases/generate    { fid }   draft cases from LOGIC.md
 *   POST   /api/fids              add a FID  { id, name, dependsOn, paths }
 *   PATCH  /api/fids/:id          rename / change dependencies / paths
 *   GET    /api/logic/:fid        LOGIC.md text
 *   POST   /api/sync              push the whole event log to the database
 *
 * Every write answers { ok:true, state } or { ok:false, error } (HTTP 400).
 */
const http = require('http');
const store = require('./project');

function send(res, code, body, type) {
  const data = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(code, { 'Content-Type': type || 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(data);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => {
      raw += c;
      if (raw.length > 2e6) reject(new store.UserError('Request too large'));
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new store.UserError('Body must be JSON'));
      }
    });
    req.on('error', reject);
  });
}

function createServer(root, opts) {
  opts = opts || {};
  const log = opts.log || (() => {});
  const ok = (res, extra) => {
    const state = store.writeOutputs(root);
    send(res, 200, { ok: true, state, ...(extra || {}) });
  };

  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const route = req.method + ' ' + url.pathname;
    try {
      // Writes must come from this page, not from another site open in the same browser.
      if (req.method !== 'GET' && req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) return send(res, 403, { ok: false, error: 'Cross-site request refused' });

      if (route === 'GET /' || route === 'GET /index.html') return send(res, 200, store.renderChecklist({ live: true, state: store.loadState(root) }), 'text/html; charset=utf-8');
      if (route === 'GET /api/state') return send(res, 200, { ok: true, state: store.loadState(root) });

      if (route === 'POST /api/events') {
        const body = await readBody(req);
        const { event } = store.record(root, body);
        log(event.type + ' ' + (event.caseId || event.fid || event.itemId || event.key || '') + ' ' + (event.result || '') + ' by ' + event.actor.name);
        store.pushEvents(root, [event]).then((r) => {
          for (const k of ['supabase', 'webhook']) if (r[k] && !r[k].ok) log('sync to ' + k + ' failed: ' + r[k].error + ' (run "cortest sync" later)');
        });
        return send(res, 200, { ok: true, event, state: store.loadState(root) });
      }
      if (route === 'POST /api/cases') {
        const body = await readBody(req);
        const def = store.saveCase(root, body.case || body);
        return ok(res, { case: def });
      }
      if (route === 'POST /api/cases/approve') {
        const body = await readBody(req);
        const approved = store.approveCases(root, body.ids || [], body.actor);
        return ok(res, { approved });
      }
      if (route === 'POST /api/cases/generate') {
        const body = await readBody(req);
        const out = store.generateDrafts(root, body.fid);
        return ok(res, { made: out.made.map((k) => k.id), acs: out.acs });
      }
      if (req.method === 'DELETE' && url.pathname.startsWith('/api/cases/')) {
        store.deleteCase(root, decodeURIComponent(url.pathname.slice('/api/cases/'.length)));
        return ok(res);
      }
      if (route === 'POST /api/fids') {
        const fid = store.addFid(root, await readBody(req));
        return ok(res, { fid });
      }
      if (req.method === 'PATCH' && url.pathname.startsWith('/api/fids/')) {
        const fid = store.updateFid(root, decodeURIComponent(url.pathname.slice('/api/fids/'.length)), await readBody(req));
        return ok(res, { fid });
      }
      if (req.method === 'GET' && url.pathname.startsWith('/api/logic/')) {
        const id = decodeURIComponent(url.pathname.slice('/api/logic/'.length));
        const fids = store.loadFids(root);
        if (!fids.some((f) => f.id === id)) throw new store.UserError('Unknown FID ' + id);
        return send(res, 200, { ok: true, fid: id, text: store.readLogic(root, fids, id) });
      }
      if (route === 'POST /api/sync') {
        const report = await store.pushEvents(root, store.readEvents(root));
        return send(res, 200, { ok: true, report });
      }
      return send(res, 404, { ok: false, error: 'Not found: ' + route });
    } catch (err) {
      if (err instanceof store.UserError) return send(res, 400, { ok: false, error: err.message });
      log('error: ' + (err.stack || err));
      return send(res, 500, { ok: false, error: 'Internal error: ' + err.message });
    }
  });
}

function serve(root, opts) {
  opts = opts || {};
  const config = store.loadConfig(root);
  const port = Number(opts.port || config.port || 4173);
  const host = opts.host || '127.0.0.1';
  const server = createServer(root, { log: (m) => console.log('  ' + new Date().toISOString().slice(11, 19) + '  ' + m) });
  return new Promise((resolve, reject) => {
    server.once('error', (err) => reject(err.code === 'EADDRINUSE' ? new store.UserError('Port ' + port + ' is in use. Try --port ' + (port + 1)) : err));
    server.listen(port, host, () => resolve({ server, url: 'http://' + (host === '0.0.0.0' ? 'localhost' : host) + ':' + port + '/' }));
  });
}

module.exports = { createServer, serve };
