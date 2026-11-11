'use strict';
// End-to-end tests of the rules, run against a real temporary project on disk.
// Run with:  node --test test/
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const store = require('../lib/project');

const human = { name: 'Tester', kind: 'human' };
const agent = { name: 'Antigravity', kind: 'agent' };
const bot = { name: 'automation', kind: 'automation' };

function logic(id, n) {
  return `# ${id}\n\n## 5. Outcomes, UI Behaviour and Failures\n\n| Scenario | Condition | Expected behaviour |\n|---|---|---|\n| Network down | No connection | Offline state shown |\n\n## 6. Acceptance Criteria\n\n${Array.from({ length: n }, (_, i) => `${i + 1}. Criterion ${i + 1} of ${id}`).join('\n')}\n`;
}
function makeProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'devtest-'));
  store.writeJson(store.P(root).config, { project: 'Test', fidRoot: 'FID', strictCoverage: true, sharedPaths: [], automation: [] });
  store.writeJson(store.P(root).fids, { fids: [] });
  store.writeJson(store.P(root).c1, { cases: [] });
  for (const [id, name, dependsOn] of [['FID01', 'Auth'], ['FID01.1', 'Sign up'], ['FID01.2', 'Login'], ['FID02', 'Catalog'], ['FID02.1', 'Browse', ['FID01.2']]]) store.addFid(root, { id, name, dependsOn });
  for (const id of ['FID01.1', 'FID01.2', 'FID02.1']) writeLogic(root, id, logic(id, 2));
  return root;
}
function writeLogic(root, id, text) {
  const fids = store.loadFids(root);
  fs.writeFileSync(path.join(store.fidDir(root, fids, id), 'features', 'LOGIC.md'), text);
}
const st = (root) => store.loadState(root).status;
const rec = (root, e) => store.record(root, { actor: human, ...e });
const dev = (root, id) => {
  rec(root, { type: 'dev', fid: id, field: 'logicRead', value: true });
  rec(root, { type: 'dev', fid: id, field: 'developed', value: true });
};
/** Give a FID complete, approved L1 coverage for its acceptance criteria. */
function cover(root, id) {
  const acs = st(root).fids[id].acs;
  const ids = acs.map((ac) => store.saveCase(root, { level: 'L1', fid: id, type: 'functional', title: ac.text, steps: ['Do it'], expected: ac.text, covers: [ac.id], mode: 'manual' }).id);
  store.approveCases(root, ids, human);
  return ids;
}
const passAll = (root, ids) => ids.forEach((caseId) => rec(root, { type: 'result', caseId, result: 'pass' }));
function l2(root, fid, links) {
  const k = store.saveCase(root, { level: 'L2', fid, title: fid + ' works with ' + links.join(' and '), steps: ['Run the joined flow'], expected: 'Works together', links, mode: 'manual' });
  store.approveCases(root, [k.id], human);
  return k.id;
}
/** Take the whole project to "Stage 2 complete". Returns the ids used. */
function finishStage2(root) {
  const ids = {};
  for (const id of ['FID01', 'FID01.1', 'FID01.2', 'FID02', 'FID02.1']) dev(root, id);
  for (const id of ['FID01.1', 'FID01.2', 'FID02.1']) passAll(root, (ids[id] = cover(root, id)));
  ids.it01 = l2(root, 'FID01', ['FID01.1', 'FID01.2']);
  ids.it02 = l2(root, 'FID02', ['FID02.1']);
  ids.it021 = l2(root, 'FID02.1', ['FID01.2']);
  passAll(root, [ids.it01, ids.it02, ids.it021]);
  return ids;
}
function c1(root, links, type) {
  const k = store.saveCase(root, { level: 'C1', type: type || 'integration', title: 'Cross ' + links.join('+'), steps: ['Run it'], expected: 'Works', links, mode: 'manual' });
  store.approveCases(root, [k.id], human);
  return k.id;
}

test('feature lines and acceptance criteria are parsed', () => {
  const fids = store.parseFeatureLines('- **FID01** — User Management\n  FID01.1 - Registration\nFID01.10: Tenth\nFID01.2 — Login\nnoise');
  assert.deepEqual(fids.map((f) => f.id), ['FID01', 'FID01.1', 'FID01.2', 'FID01.10']);
  assert.equal(fids[0].name, 'User Management');
  const acs = store.parseAcs('## 6. Acceptance Criteria\n\n1. First\n2. **Second**\n- AC-5: Fifth\n\n## 7. Other\n1. Not this');
  assert.deepEqual(acs, [{ id: 'AC-1', text: 'First' }, { id: 'AC-2', text: 'Second' }, { id: 'AC-5', text: 'Fifth' }]);
});

test('FIDs are never duplicated and children need their parent', () => {
  const root = makeProject();
  assert.throws(() => store.addFid(root, { id: 'FID01.1', name: 'Again' }), /already exists/);
  assert.throws(() => store.addFid(root, { id: 'FID09.1', name: 'Orphan' }), /add parent FID09 first/);
  assert.throws(() => store.addFid(root, { id: 'F1', name: 'Bad' }), /not a valid FID/);
  assert.equal(store.loadState(root).issues.length, 0);
});

test('development gates testing; drafts and agents cannot produce a pass', () => {
  const root = makeProject();
  const made = store.generateDrafts(root, 'FID01.1').made;
  assert.equal(made.length, 3, 'two acceptance criteria + one failure-table row');
  assert.throws(() => store.approveCases(root, [made[0].id], human), /TODO/);
  const k = store.saveCase(root, { ...made[0], steps: ['Open sign up', 'Submit'] });
  assert.throws(() => rec(root, { type: 'result', caseId: k.id, result: 'pass' }), /still a draft/);
  assert.throws(() => store.approveCases(root, [k.id], agent), /approved by a person/);
  store.approveCases(root, [k.id], human);
  assert.throws(() => rec(root, { type: 'result', caseId: k.id, result: 'pass' }), /not marked as developed/);
  assert.throws(() => rec(root, { type: 'dev', fid: 'FID01.1', field: 'developed', value: true }), /LOGIC.md was read/);
  dev(root, 'FID01.1');
  assert.throws(() => rec(root, { type: 'result', caseId: k.id, result: 'pass', actor: agent }), /AI agent cannot pass/);
  assert.throws(() => rec(root, { type: 'result', caseId: k.id, result: 'fail' }), /needs a note/);
  assert.throws(() => rec(root, { type: 'result', caseId: k.id, result: 'pass', actor: { name: '', kind: 'human' } }), /name is required/);
  rec(root, { type: 'result', caseId: k.id, result: 'pass' });
  const f = st(root).fids['FID01.1'];
  assert.equal(f.l1.state, 'uncovered', 'AC-2 has no approved case yet');
  assert.deepEqual(f.uncovered, ['AC-2']);
  assert.equal(f.complete, false);
});

test('automated cases only pass from a real test report', () => {
  const root = makeProject();
  dev(root, 'FID01.1');
  const k = store.saveCase(root, { level: 'L1', fid: 'FID01.1', title: 'Auto', steps: ['run'], expected: 'ok', covers: ['AC-1'], mode: 'auto' });
  store.approveCases(root, [k.id], human);
  assert.throws(() => rec(root, { type: 'result', caseId: k.id, result: 'pass' }), /only come from a real test run/);
  const r = store.parseJunit(`<testsuite><testcase name="${k.id} signs up" classname="a"/><testcase name="${k.id} second"><failure message="expected 1 &lt; 2">x</failure></testcase><testcase name="no id"/><testcase name="TC-FID01.2-09 skipped"><skipped/></testcase></testsuite>`);
  assert.equal(r.seen, 4);
  assert.deepEqual(r.byId[k.id], { pass: 1, fail: 1, notes: ['expected 1 < 2'] });
  assert.equal(r.byId['TC-FID01.2-09'], undefined);
  rec(root, { type: 'result', caseId: k.id, result: 'pass', source: 'automation', actor: bot });
  assert.equal(st(root).cases[k.id].effective, 'pass');
});

test('a sub-feature completes only with every criterion covered and passing', () => {
  const root = makeProject();
  dev(root, 'FID01.1');
  const ids = cover(root, 'FID01.1');
  rec(root, { type: 'result', caseId: ids[0], result: 'pass' });
  assert.equal(st(root).fids['FID01.1'].l1.state, 'pending');
  rec(root, { type: 'result', caseId: ids[1], result: 'fail', note: 'Wrong message' });
  assert.equal(st(root).fids['FID01.1'].state, 'failed');
  assert.equal(st(root).fids['FID01'].state, 'failed', 'a failed child fails its parent');
  rec(root, { type: 'result', caseId: ids[1], result: 'pass' });
  const s = st(root);
  assert.equal(s.fids['FID01.1'].complete, true);
  assert.equal(s.fids['FID01.1'].state, 'complete');
  assert.equal(s.fids['FID01'].complete, false, 'finishing children never completes the parent by itself');
  assert.match(fs.readFileSync(path.join(root, 'ERROR_DICTIONARY.md'), 'utf8'), /### Resolved[\s\S]*Wrong message/);
});

test('a pass expires when logic, code or the test case changes', () => {
  const root = makeProject();
  dev(root, 'FID01.1');
  const ids = cover(root, 'FID01.1');
  passAll(root, ids);
  assert.equal(st(root).fids['FID01.1'].complete, true);

  const fids = store.loadFids(root);
  fs.writeFileSync(path.join(store.fidDir(root, fids, 'FID01.1'), 'features', 'signup.ts'), 'export const a = 1;');
  let s = st(root);
  assert.equal(s.cases[ids[0]].effective, 'stale');
  assert.equal(s.fids['FID01.1'].state, 'needs-retest');
  assert.equal(s.fids['FID01.1'].complete, false);
  passAll(root, ids);
  assert.equal(st(root).fids['FID01.1'].complete, true);

  // implementation that lives outside the FID folder is tracked through "paths"
  fs.mkdirSync(path.join(root, 'src/features/auth'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src/features/auth/index.ts'), '1');
  store.updateFid(root, 'FID01.1', { paths: ['src/features/auth'] });
  passAll(root, ids);
  fs.writeFileSync(path.join(root, 'src/features/auth/index.ts'), '2');
  assert.equal(st(root).fids['FID01.1'].state, 'needs-retest');
  passAll(root, ids);

  // editing an approved case sends it back to draft, so its old pass no longer counts
  store.saveCase(root, { ...st(root).cases[ids[0]], expected: 'Something different' });
  s = st(root);
  assert.equal(s.cases[ids[0]].status, 'draft');
  assert.equal(s.fids['FID01.1'].complete, false);
});

test('integration failure marks every linked feature not complete', () => {
  const root = makeProject();
  for (const id of ['FID01', 'FID01.1', 'FID01.2']) dev(root, id);
  for (const id of ['FID01.1', 'FID01.2']) passAll(root, cover(root, id));
  assert.equal(st(root).fids['FID01'].l2.state, 'no-tests', 'a parent needs its own integration test');
  const it = l2(root, 'FID01', ['FID01.1', 'FID01.2']);
  rec(root, { type: 'result', caseId: it, result: 'fail', note: 'Login does not see the new account' });
  let s = st(root);
  for (const id of ['FID01', 'FID01.1', 'FID01.2']) {
    assert.equal(s.fids[id].complete, false, id);
    assert.equal(s.fids[id].state, 'failed', id);
  }
  assert.deepEqual(s.fids['FID01.1'].failingIntegration, [it]);
  rec(root, { type: 'result', caseId: it, result: 'pass' });
  s = st(root);
  for (const id of ['FID01', 'FID01.1', 'FID01.2']) assert.equal(s.fids[id].complete, true, id);
});

test('C1 is locked until Stage 2 is complete, needs full coverage, and its failures propagate', () => {
  const root = makeProject();
  const x = c1(root, ['FID01.1', 'FID02.1']);
  assert.equal(st(root).c1.state, 'locked');
  assert.throws(() => rec(root, { type: 'result', caseId: x, result: 'pass' }), /C1 is locked/);
  assert.throws(() => store.saveCase(root, { level: 'C1', title: 'One', steps: ['a'], expected: 'b', links: ['FID01'], mode: 'manual' }), /at least two FIDs/);
  finishStage2(root);
  let s = st(root);
  assert.equal(s.stage2.complete, true);
  assert.equal(s.c1.state, 'uncovered');
  assert.deepEqual(s.c1.uncoveredDeps, [{ from: 'FID02.1', to: 'FID01.2' }]);
  const dep = c1(root, ['FID02.1', 'FID01.2']);
  assert.equal(st(root).c1.state, 'uncovered', 'still needs an end-to-end flow');
  const flow = c1(root, ['FID01.1', 'FID01.2', 'FID02.1'], 'e2e-flow');
  assert.equal(st(root).c1.state, 'pending');
  passAll(root, [x, dep]);
  rec(root, { type: 'result', caseId: flow, result: 'fail', note: 'Catalog empty after login' });
  s = st(root);
  assert.equal(s.c1.state, 'fail');
  assert.equal(s.c1.locked, false, 'a C1 failure must not lock C1, or it could never be re-run');
  for (const id of ['FID01.1', 'FID01.2', 'FID02.1', 'FID01', 'FID02']) assert.equal(s.fids[id].complete, false, id);
  assert.throws(() => rec(root, { type: 'c2.start' }), /C2 cannot start/);
  rec(root, { type: 'result', caseId: flow, result: 'pass' });
  s = st(root);
  assert.equal(s.c1.state, 'pass');
  assert.equal(s.summary.complete, 5);
});

test('C2: one failure invalidates the attempt and nothing carries forward', () => {
  const root = makeProject();
  finishStage2(root);
  const a = c1(root, ['FID02.1', 'FID01.2']);
  const flow = c1(root, ['FID01.1', 'FID01.2', 'FID02.1'], 'e2e-flow');
  passAll(root, [a, flow]);
  assert.throws(() => rec(root, { type: 'c2.start', actor: agent }), /started by a person/);
  let { event } = rec(root, { type: 'c2.start' });
  assert.equal(event.attempt, 1);
  assert.deepEqual(event.itemIds, ['FID01', 'FID01.1', 'FID01.2', 'FID02', 'FID02.1', flow]);
  assert.throws(() => rec(root, { type: 'c2.start' }), /still running/);
  rec(root, { type: 'c2.result', itemId: 'FID01', result: 'pass' });
  assert.throws(() => rec(root, { type: 'c2.result', itemId: 'FID01', result: 'pass' }), /cannot be changed/);
  assert.throws(() => rec(root, { type: 'c2.result', itemId: 'FID01.1', result: 'pass', actor: agent }), /AI agent cannot pass/);
  rec(root, { type: 'c2.result', itemId: 'FID01.1', result: 'fail', note: 'OTP never arrives' });
  let s = st(root);
  assert.equal(s.c2.attempts[0].state, 'failed');
  assert.equal(s.c2.state, 'fail');
  assert.throws(() => rec(root, { type: 'c2.result', itemId: 'FID01.2', result: 'pass' }), /Start a new attempt/);
  assert.equal(s.fids['FID01.1'].complete, true, 'a failed C2 attempt does not erase development and testing status');

  event = rec(root, { type: 'c2.start' }).event;
  assert.equal(event.attempt, 2);
  assert.equal(st(root).c2.attempts[1].done, 0, 'a new attempt starts blank');
  for (const itemId of event.itemIds) rec(root, { type: 'c2.result', itemId, result: 'pass' });
  s = st(root);
  assert.equal(s.c2.attempts[1].state, 'passed');
  assert.equal(s.c2.state, 'pass');
  assert.equal(s.c2.attempts.length, 2, 'failed attempts stay in the history');

  assert.equal(s.gate.ready, false, 'build and handover still need a person to confirm');
  assert.throws(() => rec(root, { type: 'gate', key: 'buildVerified', value: true, actor: agent }), /must come from a person/);
  rec(root, { type: 'gate', key: 'buildVerified', value: true });
  rec(root, { type: 'gate', key: 'handoverDocs', value: true });
  assert.equal(st(root).gate.ready, true);

  // any change after the pass makes C2 (and the gate) stale again
  writeLogic(root, 'FID02.1', logic('FID02.1', 2) + '\nchanged\n');
  s = st(root);
  assert.equal(s.c2.state, 'stale');
  assert.equal(s.gate.ready, false);
});

test('C2: changing code during an attempt invalidates it', () => {
  const root = makeProject();
  finishStage2(root);
  passAll(root, [c1(root, ['FID02.1', 'FID01.2']), c1(root, ['FID01.1', 'FID02.1'], 'e2e-flow')]);
  rec(root, { type: 'c2.start' });
  rec(root, { type: 'c2.result', itemId: 'FID01', result: 'pass' });
  store.writeJson(store.P(root).config, { ...store.loadConfig(root), sharedPaths: ['shared'] });
  fs.mkdirSync(path.join(root, 'shared'), { recursive: true });
  fs.writeFileSync(path.join(root, 'shared/helper.ts'), 'changed mid-attempt');
  const a = st(root).c2.attempts[0];
  assert.equal(a.state, 'invalidated');
  assert.match(a.reason, /changed during the attempt/);
});

test('outputs: checklist snapshot, directory and event log', () => {
  const root = makeProject();
  dev(root, 'FID01.1');
  const state = store.writeOutputs(root);
  const html = fs.readFileSync(path.join(root, 'FID_CHECKLIST.html'), 'utf8');
  assert.match(html, /window\.__DEVTEST__=\{"live":false/);
  assert.ok(!html.includes('<!--DEVTEST_BOOT-->'));
  assert.match(fs.readFileSync(path.join(root, 'FID_DIRECTORY.md'), 'utf8'), /FID01\.1 \| Sign up \| FID01 \| `FID\/FID01-auth\/FID01\.1-sign-up\/`/);
  const events = store.readEvents(root);
  assert.equal(events.length, 2);
  assert.ok(events.every((e) => e.id && e.ts && e.actor.name === 'Tester'));
  assert.equal(state.eventCount, 2);
});
