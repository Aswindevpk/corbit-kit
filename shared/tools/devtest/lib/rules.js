'use strict';
/**
 * devtest rules engine.
 *
 * Pure functions only: no file system, no clock, no network. Status is never
 * stored anywhere; it is always computed from definitions (FIDs, cases) plus
 * the append-only event log. Both programs (fidtrack, cortest), the API server
 * and the checklist page read this one computation, so they cannot disagree
 * about what "complete" means.
 */

const SCENARIO_TYPES = [
  { id: 'functional', label: 'Functional (happy path)', from: 'LOGIC.md section 6, acceptance criteria' },
  { id: 'validation', label: 'Validation / negative', from: 'LOGIC.md section 2, inputs and validation' },
  { id: 'permission', label: 'Permission / role', from: 'LOGIC.md section 2 permission checks, RBAC personas' },
  { id: 'edge-failure', label: 'Edge case / failure', from: 'LOGIC.md section 5, failure and edge-case table' },
  { id: 'ui-state', label: 'UI state', from: 'Shared UI state reference library' },
  { id: 'data-integrity', label: 'Data integrity', from: 'LOGIC.md section 4, data and system behaviour' },
  { id: 'integration', label: 'Integration', from: 'Upstream / downstream FID links' },
  { id: 'e2e-flow', label: 'End-to-end flow', from: 'Complete business workflows' },
  { id: 'regression', label: 'Regression', from: 'Previously failed behaviour' },
];

const LEVELS = ['L1', 'L2', 'C1'];
const RESULTS = ['pass', 'fail', 'blocked'];
const DEV_FIELDS = ['logicRead', 'developed'];
const GATE_MANUAL = [
  { key: 'buildVerified', label: 'The project build is available and verified' },
  { key: 'handoverDocs', label: 'Technical and handover documentation is prepared' },
];

const FID_RE = /^FID\d{2}(\.\d+)*$/;

function parentOf(id) {
  const i = id.lastIndexOf('.');
  return i === -1 ? null : id.slice(0, i);
}

function fidKey(id) {
  return id.slice(3).split('.').map(Number);
}

function compareFid(a, b) {
  const ka = fidKey(a);
  const kb = fidKey(b);
  for (let i = 0; i < Math.max(ka.length, kb.length); i++) {
    if (ka[i] === undefined) return -1;
    if (kb[i] === undefined) return 1;
    if (ka[i] !== kb[i]) return ka[i] - kb[i];
  }
  return 0;
}

function buildTree(fids) {
  const nodes = {};
  const order = fids.map((f) => f.id).sort(compareFid);
  for (const f of fids) {
    nodes[f.id] = {
      id: f.id,
      name: f.name,
      slug: f.slug,
      parent: parentOf(f.id),
      children: [],
      depth: f.id.split('.').length - 1,
      dependsOn: f.dependsOn || [],
      paths: f.paths || [],
    };
  }
  for (const id of order) {
    const p = nodes[id].parent;
    if (p && nodes[p]) nodes[p].children.push(id);
  }
  return { nodes, order };
}

function topLevelOf(id) {
  return id.split('.')[0];
}

function subtreeFp(id, tree, fps) {
  const n = tree.nodes[id];
  if (!n) return '?';
  const own = (fps.byFid && fps.byFid[id]) || '-';
  return [own, ...n.children.map((c) => subtreeFp(c, tree, fps))].join('+');
}

/** The fingerprint of everything a case verifies. A pass is only valid while this is unchanged. */
function scopeFp(def, tree, fps) {
  const links = [...new Set(def.links || [])].sort(compareFid);
  if (def.level === 'L1') return (fps.byFid && fps.byFid[def.fid]) || '-';
  if (def.level === 'L2') return [def.fid, ...links.filter((l) => l !== def.fid)].map((f) => subtreeFp(f, tree, fps)).join('|');
  return links.map((f) => subtreeFp(f, tree, fps)).join('|');
}

function affectedFids(def) {
  if (def.level === 'L1') return [def.fid];
  if (def.level === 'L2') return [...new Set([def.fid, ...(def.links || [])])];
  return [...new Set(def.links || [])];
}

function count(list) {
  const c = { total: 0, approved: 0, pass: 0, fail: 0, blocked: 0, pending: 0, stale: 0, draft: 0 };
  for (const k of list) {
    c.total++;
    c[k.effective]++;
    if (k.effective !== 'draft') c.approved++;
  }
  return c;
}

function compute(input) {
  const config = input.config || {};
  const strict = config.strictCoverage !== false;
  const fps = input.fps || { byFid: {}, global: '-' };
  const acs = input.acs || {};
  const events = input.events || [];
  const tree = buildTree(input.fids || []);
  const { nodes, order } = tree;

  // ---- fold the event log -------------------------------------------------
  const dev = {};
  const blocked = {};
  const last = {};
  const runs = {};
  const attempts = [];
  const gateManual = {};
  for (const e of events) {
    const who = (e.actor && e.actor.name) || '?';
    if (e.type === 'dev') {
      (dev[e.fid] = dev[e.fid] || {})[e.field] = { value: !!e.value, by: who, at: e.ts, note: e.note || '' };
    } else if (e.type === 'block') {
      blocked[e.fid] = e.blocked ? { note: e.note || '', by: who, at: e.ts } : null;
    } else if (e.type === 'result') {
      last[e.caseId] = e;
      runs[e.caseId] = (runs[e.caseId] || 0) + 1;
    } else if (e.type === 'c2.start') {
      attempts.push({ n: e.attempt, startedAt: e.ts, by: who, fp: e.fp, commit: e.commit || null, itemIds: e.itemIds || [], items: {}, aborted: null, fpChanged: false, endedAt: null });
    } else if (e.type === 'c2.result') {
      const a = attempts.find((x) => x.n === e.attempt);
      if (a) {
        a.items[e.itemId] = { result: e.result, note: e.note || '', by: who, kind: e.actor && e.actor.kind, at: e.ts };
        if (e.fp !== a.fp) a.fpChanged = true;
        a.endedAt = e.ts;
      }
    } else if (e.type === 'c2.abort') {
      const a = attempts.find((x) => x.n === e.attempt);
      if (a) {
        a.aborted = { note: e.note || '', by: who, at: e.ts };
        a.endedAt = e.ts;
      }
    } else if (e.type === 'gate') {
      gateManual[e.key] = { value: !!e.value, by: who, at: e.ts };
    }
  }

  // ---- cases --------------------------------------------------------------
  const cases = {};
  for (const def of input.cases || []) {
    const sfp = scopeFp(def, tree, fps);
    const l = last[def.id];
    let effective;
    if (def.status !== 'approved') effective = 'draft';
    else if (!l) effective = 'pending';
    else if (l.result === 'pass') effective = l.fp === sfp && l.defHash === def.defHash ? 'pass' : 'stale';
    else effective = l.result === 'blocked' ? 'blocked' : 'fail';
    cases[def.id] = {
      ...def,
      scopeFp: sfp,
      effective,
      runs: runs[def.id] || 0,
      last: l
        ? { result: l.result, at: l.ts, by: l.actor && l.actor.name, kind: l.actor && l.actor.kind, note: l.note || '', evidence: l.evidence || '', commit: l.commit || null, source: l.source || 'manual', staleReason: l.result === 'pass' && effective === 'stale' ? (l.defHash !== def.defHash ? 'test case changed after it passed' : 'code or logic changed after it passed') : '' }
        : null,
    };
  }
  const caseList = Object.values(cases);

  // failing integration cases -> every FID they touch
  const intFail = {};
  const c1Fail = {};
  for (const k of caseList) {
    if (k.effective !== 'fail' && k.effective !== 'blocked') continue;
    if (k.level === 'L2') for (const f of affectedFids(k)) if (f !== k.fid) (intFail[f] = intFail[f] || []).push(k.id);
    if (k.level === 'C1') for (const f of affectedFids(k)) (c1Fail[f] = c1Fail[f] || []).push(k.id);
  }

  // ---- per FID, bottom-up -------------------------------------------------
  const fids = {};
  for (const id of [...order].reverse()) {
    const n = nodes[id];
    const own = caseList.filter((k) => k.fid === id);
    const l1list = own.filter((k) => k.level === 'L1');
    const l2list = own.filter((k) => k.level === 'L2');
    const isParent = n.children.length > 0;
    const fidAcs = acs[id] || [];
    const covered = new Set();
    for (const k of own) if (k.effective !== 'draft') for (const a of k.covers || []) covered.add(a);
    const uncovered = fidAcs.filter((a) => !covered.has(a.id)).map((a) => a.id);

    const c1 = count(l1list);
    let l1state;
    if (c1.fail || c1.blocked) l1state = 'fail';
    else if (isParent && !l1list.length && !uncovered.length) l1state = 'n/a'; // a parent's own criteria may be proved by its integration cases
    else if (!c1.approved) l1state = 'no-tests';
    else if (strict && !fidAcs.length) l1state = 'no-criteria';
    else if (strict && uncovered.length) l1state = 'uncovered';
    else if (c1.stale) l1state = 'stale';
    else if (c1.pending) l1state = 'pending';
    else l1state = 'pass';

    const c2 = count(l2list);
    const l2required = isParent || n.dependsOn.length > 0;
    let l2state;
    if (c2.fail || c2.blocked) l2state = 'fail';
    else if (!c2.approved) l2state = l2required ? 'no-tests' : 'n/a';
    else if (c2.stale) l2state = 'stale';
    else if (c2.pending) l2state = 'pending';
    else l2state = 'pass';

    const d = dev[id] || {};
    const developed = !!(d.developed && d.developed.value);
    const logicRead = !!(d.logicRead && d.logicRead.value);
    const isBlocked = !!blocked[id];
    const kids = n.children.map((c) => fids[c]);
    const failingInt = intFail[id] || [];
    const failingC1 = c1Fail[id] || [];

    const reasons = [];
    if (isBlocked) reasons.push('Blocked: ' + (blocked[id].note || 'no note'));
    if (!developed) reasons.push('Development is not marked complete');
    if (l1state === 'fail') reasons.push('Individual test failing: ' + l1list.filter((k) => k.effective === 'fail' || k.effective === 'blocked').map((k) => k.id).join(', '));
    if (l1state === 'no-tests') reasons.push('No approved individual test cases');
    if (l1state === 'no-criteria') reasons.push('LOGIC.md has no numbered acceptance criteria');
    if (l1state === 'uncovered') reasons.push('Acceptance criteria with no test: ' + uncovered.join(', '));
    if (l1state === 'stale') reasons.push('Individual tests need re-testing (code, logic or test changed after pass)');
    if (l1state === 'pending') reasons.push(c1.pending + ' individual test case(s) not run yet');
    if (l2state === 'fail') reasons.push('Integration test failing: ' + l2list.filter((k) => k.effective === 'fail' || k.effective === 'blocked').map((k) => k.id).join(', '));
    if (l2state === 'no-tests') reasons.push(isParent ? 'Parent feature has no approved integration test cases' : 'Feature has dependencies but no approved integration test cases');
    if (l2state === 'stale') reasons.push('Integration tests need re-testing');
    if (l2state === 'pending') reasons.push(c2.pending + ' integration test case(s) not run yet');
    if (failingInt.length) reasons.push('Failing integration test touches this feature: ' + failingInt.join(', '));
    if (failingC1.length) reasons.push('Failing C1 cross-feature test touches this feature: ' + failingC1.join(', '));
    for (const k of kids) if (!k.complete) reasons.push('Child ' + k.id + ' is not complete');

    const l1ok = l1state === 'pass' || l1state === 'n/a';
    const l2ok = l2state === 'pass' || l2state === 'n/a';
    const stage2Complete = developed && !isBlocked && l1ok && l2ok && !failingInt.length && kids.every((k) => k.stage2Complete);
    const complete = stage2Complete && !failingC1.length && kids.every((k) => k.complete);

    const anyFail = l1state === 'fail' || l2state === 'fail' || failingInt.length > 0 || failingC1.length > 0 || kids.some((k) => k.state === 'failed');
    const anyActivity = developed || logicRead || own.some((k) => k.runs > 0) || kids.some((k) => k.state !== 'not-started');
    let state;
    if (isBlocked || kids.some((k) => k.state === 'blocked')) state = 'blocked';
    else if (anyFail) state = 'failed';
    else if (complete) state = 'complete';
    else if (l1state === 'stale' || l2state === 'stale' || kids.some((k) => k.state === 'needs-retest')) state = 'needs-retest';
    else if (anyActivity) state = 'in-progress';
    else state = 'not-started';

    const typesCovered = [...new Set(own.filter((k) => k.effective !== 'draft').map((k) => k.type).filter(Boolean))];

    fids[id] = {
      id,
      name: n.name,
      parent: n.parent && nodes[n.parent] ? n.parent : null,
      children: n.children,
      depth: n.depth,
      dependsOn: n.dependsOn,
      paths: n.paths,
      isParent,
      dev: { logicRead, developed, developedBy: d.developed ? d.developed.by : null, developedAt: d.developed ? d.developed.at : null },
      blocked: blocked[id] || null,
      acs: fidAcs,
      uncovered,
      typesCovered,
      l1: { state: l1state, ...c1, caseIds: l1list.map((k) => k.id) },
      l2: { state: l2state, required: l2required, ...c2, caseIds: l2list.map((k) => k.id) },
      failingIntegration: failingInt,
      failingC1,
      stage2Complete,
      complete,
      state,
      reasons: complete ? [] : reasons,
    };
  }

  // ---- stage 2 ------------------------------------------------------------
  const all = order.map((id) => fids[id]);
  const stage2 = {
    total: all.length,
    developed: all.filter((f) => f.dev.developed).length,
    l1Passed: all.filter((f) => f.l1.state === 'pass' || f.l1.state === 'n/a').length,
    l2Passed: all.filter((f) => f.l2.state === 'pass' || f.l2.state === 'n/a').length,
    completeCount: all.filter((f) => f.stage2Complete).length,
    complete: all.length > 0 && all.every((f) => f.stage2Complete),
  };

  // ---- C1 -----------------------------------------------------------------
  const c1list = caseList.filter((k) => k.level === 'C1');
  const cc = count(c1list);
  const uncoveredDeps = [];
  for (const f of all) {
    for (const dep of f.dependsOn) {
      if (!nodes[dep] || topLevelOf(dep) === topLevelOf(f.id)) continue;
      const hit = c1list.some((k) => k.effective !== 'draft' && (k.links || []).includes(f.id) && (k.links || []).includes(dep));
      if (!hit) uncoveredDeps.push({ from: f.id, to: dep });
    }
  }
  const hasFlow = c1list.some((k) => k.effective !== 'draft' && k.type === 'e2e-flow');
  let c1state;
  if (cc.fail || cc.blocked) c1state = 'fail';
  else if (!stage2.complete) c1state = 'locked';
  else if (!cc.approved) c1state = 'no-tests';
  else if (strict && (uncoveredDeps.length || !hasFlow)) c1state = 'uncovered';
  else if (cc.stale) c1state = 'stale';
  else if (cc.pending) c1state = 'pending';
  else c1state = 'pass';
  const c1 = { state: c1state, locked: !stage2.complete, ...cc, caseIds: c1list.map((k) => k.id), uncoveredDeps, hasFlow };

  // ---- C2 -----------------------------------------------------------------
  const outAttempts = attempts.map((a) => {
    const failed = a.itemIds.filter((i) => a.items[i] && a.items[i].result !== 'pass');
    const done = a.itemIds.filter((i) => a.items[i]).length;
    let state;
    let reason = '';
    if (a.aborted) {
      state = 'aborted';
      reason = a.aborted.note || 'Attempt aborted';
    } else if (failed.length) {
      state = 'failed';
      reason = 'Failed item: ' + failed.join(', ');
    } else if (a.fpChanged) {
      state = 'invalidated';
      reason = 'Code or logic changed during the attempt';
    } else if (done === a.itemIds.length && a.itemIds.length > 0) {
      state = 'passed';
    } else if (a.fp !== fps.global) {
      state = 'invalidated';
      reason = 'Code or logic changed during the attempt';
    } else {
      state = 'running';
    }
    return { n: a.n, startedAt: a.startedAt, endedAt: a.endedAt, by: a.by, commit: a.commit, fp: a.fp, itemIds: a.itemIds, items: a.items, done, total: a.itemIds.length, failed, state, reason };
  });
  const allComplete = all.length > 0 && all.every((f) => f.complete);
  const lastAttempt = outAttempts[outAttempts.length - 1] || null;
  let c2state;
  if (!lastAttempt) c2state = c1state === 'pass' && allComplete ? 'ready' : 'locked';
  else if (lastAttempt.state === 'running') c2state = 'running';
  else if (lastAttempt.state === 'passed') c2state = lastAttempt.fp === fps.global ? 'pass' : 'stale';
  else c2state = 'fail';
  const c2 = {
    state: c2state,
    attempts: outAttempts,
    current: lastAttempt && lastAttempt.state === 'running' ? lastAttempt.n : null,
    canStart: c1state === 'pass' && allComplete && !(lastAttempt && lastAttempt.state === 'running'),
    nextAttempt: outAttempts.length + 1,
    itemsForNew: [...order, ...c1list.filter((k) => k.effective !== 'draft' && k.type === 'e2e-flow').map((k) => k.id)],
  };

  // ---- exit gate ----------------------------------------------------------
  const openBlockers = all.filter((f) => f.blocked).map((f) => f.id);
  const openFailures = caseList.filter((k) => k.effective === 'fail' || k.effective === 'blocked').map((k) => k.id);
  const checks = [
    { label: 'All approved FIDs are accounted for', ok: all.length > 0 && !(input.issues || []).length, detail: (input.issues || []).length ? (input.issues || []).length + ' structure issue(s)' : all.length + ' FIDs' },
    { label: 'All feature implementations are complete', ok: stage2.developed === stage2.total && stage2.total > 0, detail: stage2.developed + ' / ' + stage2.total },
    { label: 'Individual FID testing is complete', ok: stage2.l1Passed === stage2.total && stage2.total > 0, detail: stage2.l1Passed + ' / ' + stage2.total },
    { label: 'Parent-child and integration verification is complete', ok: stage2.complete, detail: stage2.completeCount + ' / ' + stage2.total },
    { label: 'C1 all-feature integration has passed', ok: c1state === 'pass', detail: c1state },
    { label: 'C2 has passed in one complete attempt', ok: c2state === 'pass', detail: c2state + (outAttempts.length ? ' (' + outAttempts.length + ' attempt(s))' : '') },
    { label: 'No unresolved failures or blockers remain', ok: !openBlockers.length && !openFailures.length, detail: openBlockers.length + openFailures.length ? [...openBlockers, ...openFailures].join(', ') : 'none' },
    ...GATE_MANUAL.map((g) => ({ label: g.label, ok: !!(gateManual[g.key] && gateManual[g.key].value), detail: gateManual[g.key] && gateManual[g.key].value ? 'confirmed by ' + gateManual[g.key].by : 'not confirmed', manualKey: g.key })),
  ];
  const gate = { ready: checks.every((c) => c.ok), checks };

  // ---- rollups ------------------------------------------------------------
  const modules = order
    .filter((id) => !fids[id].parent)
    .map((id) => {
      const members = all.filter((f) => topLevelOf(f.id) === id);
      return { id, name: fids[id].name, total: members.length, complete: members.filter((f) => f.complete).length, state: fids[id].state };
    });
  const byState = {};
  for (const f of all) byState[f.state] = (byState[f.state] || 0) + 1;
  const completeCount = all.filter((f) => f.complete).length;
  const summary = { total: all.length, complete: completeCount, pct: all.length ? Math.round((completeCount / all.length) * 100) : 0, byState, cases: count(caseList) };

  return { order, fids, cases, stage2, c1, c2, gate, modules, summary };
}

/**
 * Validate an incoming event against the current computed status.
 * Returns an error message, or null when the event is allowed.
 */
function validateEvent(e, status, config) {
  config = config || {};
  if (!e || typeof e !== 'object') return 'Event must be an object';
  if (!e.actor || !e.actor.name || !String(e.actor.name).trim()) return 'A name is required: say who is recording this';
  if (!['human', 'agent', 'automation'].includes(e.actor.kind)) return 'actor.kind must be human, agent or automation';

  if (e.type === 'dev') {
    if (!status.fids[e.fid]) return 'Unknown FID ' + e.fid;
    if (!DEV_FIELDS.includes(e.field)) return 'Unknown development field ' + e.field;
    if (e.field === 'developed' && e.value && !status.fids[e.fid].dev.logicRead) return e.fid + ': confirm LOGIC.md was read before marking development complete';
    return null;
  }
  if (e.type === 'block') {
    if (!status.fids[e.fid]) return 'Unknown FID ' + e.fid;
    if (e.blocked && !String(e.note || '').trim()) return 'A blocker needs a note explaining what is blocking';
    return null;
  }
  if (e.type === 'result') {
    const k = status.cases[e.caseId];
    if (!k) return 'Unknown test case ' + e.caseId;
    if (!RESULTS.includes(e.result)) return 'Result must be pass, fail or blocked';
    if (k.status !== 'approved') return k.id + ' is still a draft. A person must approve it before results count';
    if (e.result !== 'pass' && !String(e.note || '').trim()) return 'A ' + e.result + ' result needs a note describing what happened';
    if (k.mode === 'auto' && e.source !== 'automation' && e.result === 'pass') return k.id + ' is an automated case. Its pass can only come from a real test run (cortest run / ingest)';
    if (k.mode !== 'auto' && e.result === 'pass' && e.actor.kind === 'agent') return k.id + ' is a manual case. An AI agent cannot pass it; a person must verify it';
    if (k.level === 'C1') {
      if (status.c1.locked) return 'C1 is locked until every FID has finished Stage 2 (development, individual and integration testing)';
    } else {
      const f = status.fids[k.fid];
      if (!f) return k.id + ' belongs to unknown FID ' + k.fid;
      if (!f.dev.developed) return k.fid + ' is not marked as developed yet, so it cannot be tested';
      if (k.level === 'L2') {
        const notDev = [...f.children, ...(k.links || [])].filter((x) => status.fids[x] && !status.fids[x].dev.developed);
        if (notDev.length) return 'Integration test needs these FIDs developed first: ' + [...new Set(notDev)].join(', ');
      }
    }
    return null;
  }
  if (e.type === 'c2.start') {
    if (e.actor.kind === 'agent') return 'A C2 attempt must be started by a person';
    if (status.c2.current) return 'C2 attempt ' + status.c2.current + ' is still running';
    if (!status.c2.canStart) return 'C2 cannot start: C1 must have passed and every FID must be complete';
    return null;
  }
  if (e.type === 'c2.result') {
    const a = status.c2.attempts.find((x) => x.n === e.attempt);
    if (!a) return 'Unknown C2 attempt ' + e.attempt;
    if (a.state !== 'running') return 'C2 attempt ' + a.n + ' is ' + a.state + '. Start a new attempt; results are never carried forward';
    if (!a.itemIds.includes(e.itemId)) return e.itemId + ' is not part of C2 attempt ' + a.n;
    if (a.items[e.itemId]) return e.itemId + ' already has a result in attempt ' + a.n + '. Results in an attempt cannot be changed';
    if (!RESULTS.includes(e.result)) return 'Result must be pass, fail or blocked';
    if (e.result !== 'pass' && !String(e.note || '').trim()) return 'A ' + e.result + ' result needs a note';
    const k = status.cases[e.itemId];
    const auto = k && k.mode === 'auto';
    if (e.result === 'pass' && e.actor.kind === 'agent') return 'An AI agent cannot pass a C2 item; a person must verify it';
    if (e.result === 'pass' && auto && e.source !== 'automation') return e.itemId + ' is automated. Its C2 pass can only come from a real test run';
    return null;
  }
  if (e.type === 'c2.abort') {
    const a = status.c2.attempts.find((x) => x.n === e.attempt);
    if (!a || a.state !== 'running') return 'There is no running C2 attempt ' + e.attempt;
    return null;
  }
  if (e.type === 'gate') {
    if (!GATE_MANUAL.some((g) => g.key === e.key)) return 'Unknown gate item ' + e.key;
    if (e.actor.kind !== 'human') return 'Exit-gate confirmations must come from a person';
    return null;
  }
  return 'Unknown event type ' + e.type;
}

/** Validate a test case definition. Returns an error message or null. */
function validateCase(def, tree) {
  if (!def.id || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(def.id)) return 'Case id is required (letters, digits, dot, dash, underscore)';
  if (!LEVELS.includes(def.level)) return 'level must be L1, L2 or C1';
  if (!def.title || !String(def.title).trim()) return 'title is required';
  if (!String(def.expected || '').trim()) return 'expected result is required';
  if (!['manual', 'auto'].includes(def.mode)) return 'mode must be manual or auto';
  if (def.type && !SCENARIO_TYPES.some((t) => t.id === def.type)) return 'Unknown scenario type ' + def.type;
  const links = def.links || [];
  for (const l of links) if (!tree.nodes[l]) return 'links: unknown FID ' + l;
  if (def.level === 'C1') {
    if (links.length < 2) return 'A C1 case must link at least two FIDs';
  } else if (!tree.nodes[def.fid]) return 'Unknown owner FID ' + def.fid;
  return null;
}

module.exports = { SCENARIO_TYPES, LEVELS, RESULTS, DEV_FIELDS, GATE_MANUAL, FID_RE, parentOf, compareFid, buildTree, topLevelOf, subtreeFp, scopeFp, affectedFids, compute, validateEvent, validateCase };
