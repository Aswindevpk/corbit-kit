'use strict';
/**
 * Project store: everything that touches the file system, git or the network.
 *
 * Layout inside a project (follows the COR Development Standard):
 *
 *   PROJECT_ROOT/
 *   ├── FID/FID01-auth/features/{LOGIC.md, tests/cases.json, ...}
 *   │   └── FID01.1-otp-login/features/{LOGIC.md, tests/cases.json, ...}
 *   ├── FID_DIRECTORY.md      generated
 *   ├── FID_CHECKLIST.html    generated snapshot of the live checklist
 *   ├── ERROR_DICTIONARY.md   hand-written + a generated block
 *   └── devtest/{config.json, fids.json, c1.json, events.jsonl}
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const rules = require('./rules');

const TOOL_ROOT = path.resolve(__dirname, '..');
const SKIP = new Set(['node_modules', '.git', '.DS_Store', 'dist', 'build', '__pycache__', '.next', '.dart_tool']);

class UserError extends Error {}

// ---------------------------------------------------------------- basics ---
function sha(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}
function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    throw new UserError('Cannot parse ' + file + ': ' + err.message);
  }
}
function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}
function slugify(name) {
  return String(name).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'feature';
}
function P(root) {
  const dir = path.join(root, 'devtest');
  return { dir, config: path.join(dir, 'config.json'), fids: path.join(dir, 'fids.json'), c1: path.join(dir, 'c1.json'), events: path.join(dir, 'events.jsonl'), env: path.join(dir, '.env') };
}
function findRoot(start) {
  let dir = path.resolve(start || process.cwd());
  for (;;) {
    if (fs.existsSync(path.join(dir, 'devtest', 'config.json'))) return dir;
    const up = path.dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
}
function requireRoot(start) {
  const root = findRoot(start);
  if (!root) throw new UserError('No devtest project found here. Run "fidtrack init" in the project root first.');
  return root;
}
function loadConfig(root) {
  return { project: path.basename(root), fidRoot: 'FID', strictCoverage: true, sharedPaths: [], automation: [], port: 4173, ...readJson(P(root).config, {}) };
}
function loadFids(root) {
  return readJson(P(root).fids, { fids: [] }).fids;
}
function saveFids(root, fids) {
  writeJson(P(root).fids, { fids: [...fids].sort((a, b) => rules.compareFid(a.id, b.id)) });
}
function gitCommit(root) {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || null;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------- FID dirs ---
function fidDir(root, fids, id, config) {
  const byId = Object.fromEntries(fids.map((f) => [f.id, f]));
  const parts = id.split('.');
  const segs = [];
  for (let i = 1; i <= parts.length; i++) {
    const pid = parts.slice(0, i).join('.');
    const f = byId[pid];
    if (!f) throw new UserError(id + ': parent ' + pid + ' is not in the FID registry. Add the parent first.');
    segs.push(pid + '-' + f.slug);
  }
  return path.join(root, (config || loadConfig(root)).fidRoot, ...segs);
}

function logicTemplate(f) {
  return `# ${f.id} — ${f.name}

> Extracted feature logic for ${f.id}. Follow the COR Logic Document Standard (CLDS):
> keep all six headings, mark a section N/A when it does not apply.

## 1. Feature Overview

- Description:
- Actor:
- Trigger:
- Preconditions:
- Upstream:
- Downstream:
- Relevant UI screen:
- Dependencies and shared rule references:

## 2. Inputs and Validation

## 3. Step-by-Step Execution Logic

## 4. Data and System Behaviour

## 5. Outcomes, UI Behaviour and Failures

| Scenario | Condition | Expected behaviour |
|---|---|---|

## 6. Acceptance Criteria

<!-- Number every criterion (1. 2. 3.). Each one must be covered by at least one test case. -->
`;
}

function ensureFid(root, fids, f, config) {
  const dir = fidDir(root, fids, f.id, config);
  const feat = path.join(dir, 'features');
  fs.mkdirSync(path.join(feat, 'tests'), { recursive: true });
  const logic = path.join(feat, 'LOGIC.md');
  if (!fs.existsSync(logic)) fs.writeFileSync(logic, logicTemplate(f));
  const cases = path.join(feat, 'tests', 'cases.json');
  if (!fs.existsSync(cases)) writeJson(cases, { fid: f.id, cases: [] });
  return dir;
}

function addFid(root, input) {
  const fids = loadFids(root);
  const id = String(input.id || '').trim();
  const name = String(input.name || '').trim();
  if (!rules.FID_RE.test(id)) throw new UserError('"' + id + '" is not a valid FID. Use FID01, FID01.1, FID01.1.1 ...');
  if (!name) throw new UserError(id + ': a feature name is required');
  if (fids.some((f) => f.id === id)) throw new UserError(id + ' already exists. FIDs are never reused or reassigned.');
  const parent = rules.parentOf(id);
  if (parent && !fids.some((f) => f.id === parent)) throw new UserError(id + ': add parent ' + parent + ' first');
  const dependsOn = (input.dependsOn || []).filter(Boolean);
  for (const d of dependsOn) if (!fids.some((f) => f.id === d)) throw new UserError(id + ': dependsOn refers to unknown FID ' + d);
  const f = { id, name, slug: slugify(name), dependsOn, paths: (input.paths || []).filter(Boolean) };
  fids.push(f);
  saveFids(root, fids);
  ensureFid(root, fids, f);
  return f;
}

function updateFid(root, id, patch) {
  const fids = loadFids(root);
  const f = fids.find((x) => x.id === id);
  if (!f) throw new UserError('Unknown FID ' + id);
  if (patch.name) f.name = String(patch.name).trim(); // slug (and so the folder) stays stable on rename
  if (patch.dependsOn) {
    for (const d of patch.dependsOn) if (!fids.some((x) => x.id === d) || d === id) throw new UserError(id + ': invalid dependency ' + d);
    f.dependsOn = patch.dependsOn;
  }
  if (patch.paths) f.paths = patch.paths.filter(Boolean);
  saveFids(root, fids);
  return f;
}

/**
 * Adopt a single FID's already-written Logic Document (Phase 4 output: one file,
 * one FID) into its tracked features/LOGIC.md. This is the normal bridge between
 * the human-in-the-loop workflow and the FID tree: the AI/human writes the doc
 * wherever is convenient, a person reviews it, then this locks it into place so
 * fingerprinting and acceptance-criteria parsing see it.
 */
function adoptLogic(root, id, filePath, opts) {
  const fids = loadFids(root);
  const config = loadConfig(root);
  const f = fids.find((x) => x.id === id);
  if (!f) throw new UserError('Unknown FID ' + id + '. Run "fidtrack status" to see the tree, or add it first.');
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) throw new UserError('File not found: ' + filePath);
  const text = fs.readFileSync(abs, 'utf8');
  if (!new RegExp('\\b' + id.replace(/\./g, '\\.') + '\\b').test(text.slice(0, 400)) && !(opts && opts.force)) {
    throw new UserError(id + ': this file does not mention ' + id + ' near the top, so it may be the wrong file. Pass --force if it is right.');
  }
  const dest = path.join(ensureFid(root, fids, f, config), 'features', 'LOGIC.md');
  const existing = fs.existsSync(dest) ? fs.readFileSync(dest, 'utf8') : '';
  if (existing && existing !== logicTemplate(f) && existing !== text && !(opts && opts.force)) {
    throw new UserError(id + ': features/LOGIC.md already has content. Pass --force to overwrite (existing passes may expire).');
  }
  fs.writeFileSync(dest, text.endsWith('\n') ? text : text + '\n');
  return dest;
}

/** Parse "FID01 — User Management" style lines (the Feature Scope Document format). */
function parseFeatureLines(text) {
  const out = [];
  for (const raw of String(text).split(/\r?\n/)) {
    const m = raw.match(/(FID\d{2}(?:\.\d+)*)[\s*_`\])]*(?:[—–:|-]+\s*)?(.+?)\s*$/);
    if (!m) continue;
    const name = m[2].replace(/[*_`#|]/g, '').replace(/\s+/g, ' ').trim();
    if (name && !out.some((x) => x.id === m[1])) out.push({ id: m[1], name });
  }
  return out.sort((a, b) => rules.compareFid(a.id, b.id));
}

/** Split a master logic document into each FID's LOGIC.md by "## FID01.1 — Name" headings. */
function extractLogic(root, masterText, opts) {
  const fids = loadFids(root);
  const config = loadConfig(root);
  const lines = masterText.split(/\r?\n/);
  const heads = [];
  lines.forEach((line, i) => {
    const m = line.match(/^(#{1,6})\s*\[?(FID\d{2}(?:\.\d+)*)\]?\s*(?:[—–:-]+\s*)?(.*)$/);
    if (m) heads.push({ i, depth: m[1].length, id: m[2] });
  });
  const written = [];
  const unknown = [];
  heads.forEach((h, n) => {
    const next = heads.slice(n + 1).find((x) => x.depth <= h.depth);
    const end = next ? next.i : lines.length;
    // do not swallow nested child-FID sections into the parent
    const firstChild = heads.slice(n + 1).find((x) => x.i < end);
    const body = lines.slice(h.i, firstChild ? firstChild.i : end).join('\n').trim() + '\n';
    const f = fids.find((x) => x.id === h.id);
    if (!f) return unknown.push(h.id);
    const file = path.join(ensureFid(root, fids, f, config), 'features', 'LOGIC.md');
    const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    if (existing && existing !== logicTemplate(f) && !(opts && opts.force)) return written.push({ id: h.id, skipped: true });
    fs.writeFileSync(file, body.replace(/^#{1,6}/, '#'));
    written.push({ id: h.id, skipped: false });
  });
  return { written, unknown };
}

// ------------------------------------------------------------ LOGIC.md ---
function readLogic(root, fids, id, config) {
  const file = path.join(fidDir(root, fids, id, config), 'features', 'LOGIC.md');
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}

function sectionLines(text, re) {
  const lines = text.split(/\r?\n/);
  const isHead = (l) => /^#{1,6}\s/.test(l) || /^\*\*\d+[.)]\s.+\*\*\s*$/.test(l.trim());
  const start = lines.findIndex((l) => isHead(l) && re.test(l));
  if (start === -1) return [];
  const out = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (isHead(lines[i])) break;
    out.push(lines[i]);
  }
  return out;
}

/** Numbered acceptance criteria from section 6 of a LOGIC.md -> [{id:'AC-1', text}] */
function parseAcs(text) {
  const out = [];
  for (const line of sectionLines(text, /acceptance criteria/i)) {
    const m = line.match(/^\s{0,3}(?:[-*]\s+)?(?:\[[ xX]?\]\s*)?(?:\*\*)?(?:AC[- ]?(\d+)|(\d+))(?:\*\*)?\s*[.):—-]\s*(.+)$/);
    if (!m) continue;
    const id = 'AC-' + Number(m[1] || m[2]);
    if (!out.some((a) => a.id === id)) out.push({ id, text: m[3].replace(/\*\*/g, '').trim() });
  }
  return out;
}

/** Rows of the failure / edge-case table in section 5 -> [{scenario, condition, expected}] */
function parseFailureRows(text) {
  const rows = [];
  for (const line of sectionLines(text, /outcomes|failures/i)) {
    if (!/^\s*\|/.test(line) || /^\s*\|\s*:?-{2,}/.test(line)) continue;
    const cells = line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
    if (cells.length < 2 || !cells[0] || /^(scenario|case|failure|condition|error)$/i.test(cells[0])) continue;
    rows.push({ scenario: cells[0], condition: cells.length > 2 ? cells[1] : '', expected: cells[cells.length - 1] });
  }
  return rows;
}

// ----------------------------------------------------------------- cases ---
function defHash(def) {
  return sha(JSON.stringify([def.level, def.fid || '', def.title, def.precondition || '', def.steps || [], def.expected || '', def.mode, def.type || '', [...(def.links || [])].sort()])).slice(0, 12);
}
function casesFile(root, fids, id, config) {
  return path.join(fidDir(root, fids, id, config), 'features', 'tests', 'cases.json');
}
function normalizeCase(raw, fid) {
  const def = {
    id: String(raw.id || '').trim(),
    level: raw.level || 'L1',
    fid: raw.level === 'C1' ? null : fid || raw.fid || null,
    title: String(raw.title || '').trim(),
    type: raw.type || (raw.level === 'C1' ? 'integration' : raw.level === 'L2' ? 'integration' : 'functional'),
    precondition: String(raw.precondition || '').trim(),
    steps: (Array.isArray(raw.steps) ? raw.steps : String(raw.steps || '').split(/\r?\n/)).map((s) => String(s).trim()).filter(Boolean),
    expected: String(raw.expected || '').trim(),
    covers: (raw.covers || []).map((c) => String(c).trim().toUpperCase().replace(/^AC[- ]?(\d+)$/, 'AC-$1')).filter(Boolean),
    links: [...new Set((raw.links || []).map((l) => String(l).trim()).filter(Boolean))],
    mode: raw.mode || 'manual',
    status: raw.status === 'approved' ? 'approved' : 'draft',
    approvedBy: raw.approvedBy || null,
    approvedAt: raw.approvedAt || null,
  };
  def.defHash = defHash(def);
  return def;
}
function loadCases(root, fids, config) {
  config = config || loadConfig(root);
  const all = [];
  for (const f of fids) {
    const data = readJson(casesFile(root, fids, f.id, config), { cases: [] });
    for (const raw of data.cases || []) all.push(normalizeCase({ ...raw, level: raw.level === 'L2' ? 'L2' : 'L1' }, f.id));
  }
  for (const raw of readJson(P(root).c1, { cases: [] }).cases || []) all.push(normalizeCase({ ...raw, level: 'C1' }, null));
  return all;
}
function stripCase(def) {
  const { defHash: _h, ...rest } = def;
  if (rest.level === 'C1') delete rest.fid;
  return rest;
}
function writeCaseSet(root, fids, config, owner, list) {
  if (owner === 'C1') writeJson(P(root).c1, { cases: list.map(stripCase) });
  else writeJson(casesFile(root, fids, owner, config), { fid: owner, cases: list.map(stripCase) });
}
function nextCaseId(all, level, fid) {
  const prefix = level === 'C1' ? 'C1-' : (level === 'L2' ? 'IT-' : 'TC-') + fid + '-';
  const nums = all.filter((k) => k.id.startsWith(prefix)).map((k) => Number(k.id.slice(prefix.length))).filter((n) => Number.isInteger(n));
  const n = (nums.length ? Math.max(...nums) : 0) + 1;
  return prefix + String(n).padStart(level === 'C1' ? 3 : 2, '0');
}

/** Create or update a case. Editing the content of an approved case sends it back to draft. */
function saveCase(root, raw) {
  const fids = loadFids(root);
  const config = loadConfig(root);
  const tree = rules.buildTree(fids);
  const all = loadCases(root, fids, config);
  const level = raw.level || 'L1';
  if (!raw.id) raw = { ...raw, id: nextCaseId(all, level, raw.fid) };
  const prev = all.find((k) => k.id === raw.id);
  let def = normalizeCase({ ...raw, status: prev ? prev.status : 'draft', approvedBy: prev && prev.approvedBy, approvedAt: prev && prev.approvedAt }, raw.fid);
  const err = rules.validateCase(def, tree);
  if (err) throw new UserError(def.id + ': ' + err);
  if (prev && prev.defHash !== def.defHash && prev.status === 'approved') def = { ...def, status: 'draft', approvedBy: null, approvedAt: null };
  const ownerOf = (k) => (k.level === 'C1' ? 'C1' : k.fid);
  const rest = all.filter((k) => k.id !== def.id);
  const owners = new Set([ownerOf(def)]);
  if (prev) owners.add(ownerOf(prev));
  for (const o of owners) writeCaseSet(root, fids, config, o, [...rest, def].filter((k) => ownerOf(k) === o).sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true })));
  return def;
}
function deleteCase(root, id) {
  const fids = loadFids(root);
  const config = loadConfig(root);
  const all = loadCases(root, fids, config);
  const prev = all.find((k) => k.id === id);
  if (!prev) throw new UserError('Unknown test case ' + id);
  const owner = prev.level === 'C1' ? 'C1' : prev.fid;
  writeCaseSet(root, fids, config, owner, all.filter((k) => k.id !== id && (k.level === 'C1' ? 'C1' : k.fid) === owner));
}
function approveCases(root, ids, actor) {
  if (!actor || !String(actor.name || '').trim()) throw new UserError('Approval needs a name');
  if (actor.kind !== 'human') throw new UserError('Test cases must be approved by a person, not an AI agent');
  const fids = loadFids(root);
  const config = loadConfig(root);
  const all = loadCases(root, fids, config);
  const done = [];
  for (const id of ids) {
    const k = all.find((x) => x.id === id);
    if (!k) throw new UserError('Unknown test case ' + id);
    if (/\bTODO\b/.test([k.title, k.expected, ...k.steps].join(' '))) throw new UserError(id + ' still contains TODO. Finish the steps and expected result before approving.');
    if (!k.steps.length) throw new UserError(id + ' has no steps');
    if (k.status === 'approved') continue;
    k.status = 'approved';
    k.approvedBy = actor.name;
    k.approvedAt = new Date().toISOString();
    done.push(id);
  }
  const owners = new Set(all.filter((k) => done.includes(k.id)).map((k) => (k.level === 'C1' ? 'C1' : k.fid)));
  for (const o of owners) writeCaseSet(root, fids, config, o, all.filter((k) => (k.level === 'C1' ? 'C1' : k.fid) === o));
  return done;
}

/** Draft one case per uncovered acceptance criterion and per failure-table row. Drafts never count until approved. */
function generateDrafts(root, id) {
  const fids = loadFids(root);
  const config = loadConfig(root);
  const f = fids.find((x) => x.id === id);
  if (!f) throw new UserError('Unknown FID ' + id);
  const logic = readLogic(root, fids, id, config);
  const acs = parseAcs(logic);
  const all = loadCases(root, fids, config);
  const mine = all.filter((k) => k.fid === id);
  const covered = new Set(mine.flatMap((k) => k.covers));
  const made = [];
  for (const ac of acs) {
    if (covered.has(ac.id)) continue;
    made.push(saveCase(root, { level: 'L1', fid: id, type: 'functional', title: ac.text, precondition: '', steps: ['TODO: write the exact steps that prove ' + ac.id], expected: ac.text, covers: [ac.id], mode: 'manual' }));
  }
  const titles = new Set(mine.map((k) => k.title.toLowerCase()));
  for (const row of parseFailureRows(logic)) {
    const title = 'Failure: ' + row.scenario;
    if (titles.has(title.toLowerCase())) continue;
    made.push(saveCase(root, { level: 'L1', fid: id, type: 'edge-failure', title, precondition: row.condition, steps: ['TODO: write the steps that trigger: ' + row.scenario], expected: row.expected, covers: [], mode: 'manual' }));
  }
  return { fid: id, acs: acs.length, made };
}

// ---------------------------------------------------------- fingerprints ---
function hashPath(abs, relBase, acc) {
  if (!fs.existsSync(abs)) return;
  const st = fs.statSync(abs);
  if (st.isDirectory()) {
    for (const name of fs.readdirSync(abs).sort()) {
      if (SKIP.has(name)) continue;
      hashPath(path.join(abs, name), relBase, acc);
    }
  } else if (st.isFile()) {
    acc.push(path.relative(relBase, abs).split(path.sep).join('/') + ':' + sha(fs.readFileSync(abs)));
  }
}
function fingerprints(root, fids, config) {
  const byFid = {};
  for (const f of fids) {
    const acc = [];
    const feat = path.join(fidDir(root, fids, f.id, config), 'features');
    if (fs.existsSync(feat)) {
      for (const name of fs.readdirSync(feat).sort()) {
        if (name === 'tests' || SKIP.has(name)) continue; // test files do not invalidate; each case carries its own hash
        hashPath(path.join(feat, name), root, acc);
      }
    }
    for (const p of f.paths || []) hashPath(path.resolve(root, p), root, acc);
    byFid[f.id] = sha(acc.join('\n')).slice(0, 12);
  }
  const shared = [];
  for (const p of config.sharedPaths || []) hashPath(path.resolve(root, p), root, shared);
  const global = sha(fids.map((f) => f.id + '=' + byFid[f.id]).join(',') + '#' + shared.join('\n')).slice(0, 12);
  return { byFid, global };
}

// ---------------------------------------------------------------- events ---
function readEvents(root) {
  const file = P(root).events;
  if (!fs.existsSync(file)) return [];
  const out = [];
  fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
    if (!line.trim()) return;
    try {
      out.push(JSON.parse(line));
    } catch {
      throw new UserError('devtest/events.jsonl line ' + (i + 1) + ' is not valid JSON. The event log is append-only and must not be hand-edited.');
    }
  });
  return out;
}

function structureIssues(root, fids, config) {
  const issues = [];
  const ids = new Set(fids.map((f) => f.id));
  const known = new Set();
  for (const f of fids) {
    const parent = rules.parentOf(f.id);
    if (parent && !ids.has(parent)) {
      issues.push(f.id + ': parent ' + parent + ' is missing from the registry');
      continue;
    }
    const dir = fidDir(root, fids, f.id, config);
    known.add(dir);
    if (!fs.existsSync(dir)) issues.push(f.id + ': directory missing (' + path.relative(root, dir) + ')');
    else {
      if (!fs.existsSync(path.join(dir, 'features', 'LOGIC.md'))) issues.push(f.id + ': features/LOGIC.md is missing');
      if (!fs.existsSync(path.join(dir, 'features', 'tests'))) issues.push(f.id + ': features/tests/ is missing');
    }
    for (const d of f.dependsOn || []) if (!ids.has(d)) issues.push(f.id + ': depends on unknown FID ' + d);
    for (const p of f.paths || []) if (!fs.existsSync(path.resolve(root, p))) issues.push(f.id + ': implementation path not found: ' + p);
  }
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const name of fs.readdirSync(dir)) {
      const abs = path.join(dir, name);
      if (!/^FID\d{2}/.test(name) || !fs.statSync(abs).isDirectory()) continue;
      if (!known.has(abs)) issues.push('Directory not in the FID registry: ' + path.relative(root, abs));
      walk(abs);
    }
  };
  walk(path.join(root, config.fidRoot));
  return issues;
}

function loadState(root) {
  const config = loadConfig(root);
  const fids = loadFids(root);
  const cases = loadCases(root, fids, config);
  const events = readEvents(root);
  const fps = fingerprints(root, fids, config);
  const acs = {};
  const dirs = {};
  for (const f of fids) {
    acs[f.id] = parseAcs(readLogic(root, fids, f.id, config));
    dirs[f.id] = path.relative(root, fidDir(root, fids, f.id, config)).split(path.sep).join('/');
  }
  const issues = structureIssues(root, fids, config);
  const status = rules.compute({ config, fids, cases, events, fps, acs, issues });
  for (const id of status.order) status.fids[id].dir = dirs[id];
  return {
    project: config.project,
    generatedAt: new Date().toISOString(),
    commit: gitCommit(root),
    config: { strictCoverage: config.strictCoverage !== false },
    scenarioTypes: rules.SCENARIO_TYPES,
    gateManual: rules.GATE_MANUAL,
    fingerprint: fps.global,
    issues,
    eventCount: events.length,
    status,
  };
}

/** Validate, stamp and append one event. Returns { event, state }. */
function record(root, input) {
  const state = loadState(root);
  const config = loadConfig(root);
  const e = { ...input, actor: { name: String((input.actor && input.actor.name) || '').trim(), kind: (input.actor && input.actor.kind) || 'human' } };
  if (e.type === 'c2.start') {
    e.attempt = state.status.c2.nextAttempt;
    e.itemIds = state.status.c2.itemsForNew;
    e.fp = state.fingerprint;
  }
  if (e.type === 'c2.result' || e.type === 'c2.abort') {
    if (e.attempt === undefined || e.attempt === null) e.attempt = state.status.c2.current || (state.status.c2.attempts.length ? state.status.c2.attempts[state.status.c2.attempts.length - 1].n : 0);
    e.fp = state.fingerprint;
  }
  if (e.type === 'result') {
    const k = state.status.cases[e.caseId];
    if (k) {
      e.fp = k.scopeFp;
      e.defHash = k.defHash;
      e.level = k.level;
    }
    e.source = e.source === 'automation' ? 'automation' : 'manual';
  }
  const err = rules.validateEvent(e, state.status, config);
  if (err) throw new UserError(err);
  const event = { id: crypto.randomUUID(), ts: new Date().toISOString(), commit: state.commit, ...e };
  fs.mkdirSync(P(root).dir, { recursive: true });
  fs.appendFileSync(P(root).events, JSON.stringify(event) + '\n');
  const next = loadState(root);
  writeOutputs(root, next);
  return { event, state: next };
}

// --------------------------------------------------------------- outputs ---
function bootScript(payload) {
  const json = JSON.stringify(payload).replace(/</g, '\\u003c').split(String.fromCharCode(0x2028)).join('').split(String.fromCharCode(0x2029)).join('');
  return '<script>window.__DEVTEST__=' + json + ';</script>';
}
function renderChecklist(payload) {
  const tpl = fs.readFileSync(path.join(TOOL_ROOT, 'web', 'checklist.html'), 'utf8');
  return tpl.replace('<!--DEVTEST_BOOT-->', () => bootScript(payload));
}

function directoryMd(state) {
  const s = state.status;
  const lines = ['# FID Directory — ' + state.project, '', '> Generated by `fidtrack scan`. Do not edit by hand; change the FID registry and re-run.', '> This is a navigation reference, not a replacement for the Scope Document or Logic Document.', '', '| FID | Feature name | Parent | Directory |', '|---|---|---|---|'];
  for (const id of s.order) {
    const f = s.fids[id];
    lines.push('| ' + '&nbsp;&nbsp;'.repeat(f.depth) + id + ' | ' + f.name + ' | ' + (f.parent || '—') + ' | `' + f.dir + '/` |');
  }
  lines.push('', 'Each directory contains `features/LOGIC.md` and `features/tests/`.', '');
  return lines.join('\n');
}

const ERR_START = '<!-- devtest:auto:start -->';
const ERR_END = '<!-- devtest:auto:end -->';
function errorBlock(root, state) {
  const events = readEvents(root).filter((e) => e.type === 'result');
  const open = {};
  const resolved = [];
  for (const e of events) {
    if (e.result !== 'pass') {
      if (!open[e.caseId]) open[e.caseId] = { first: e, last: e, count: 0 };
      open[e.caseId].last = e;
      open[e.caseId].count++;
    } else if (open[e.caseId]) {
      resolved.push({ ...open[e.caseId], fixed: e });
      delete open[e.caseId];
    }
  }
  const cell = (s) => String(s || '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
  const fidsOf = (id) => {
    const k = state.status.cases[id];
    return k ? rules.affectedFids(k).join(', ') : '?';
  };
  const ref = (e) => 'VF-' + e.id.slice(0, 8);
  const out = [ERR_START, '## Verification failures (generated)', '', 'Maintained by `cortest` from the test record. Every open entry keeps its FIDs "not complete".', '', '### Open', ''];
  const openList = Object.entries(open);
  if (!openList.length) out.push('None.');
  else {
    out.push('| Ref | Test case | Affected FIDs | What happened | First seen | Recorded by | Times failed |', '|---|---|---|---|---|---|---|');
    for (const [id, o] of openList) out.push('| ' + ref(o.first) + ' | ' + id + ' | ' + fidsOf(id) + ' | ' + cell(o.last.note) + ' | ' + o.first.ts.slice(0, 10) + ' | ' + cell(o.last.actor.name) + ' | ' + o.count + ' |');
  }
  out.push('', '### Resolved', '');
  if (!resolved.length) out.push('None.');
  else {
    out.push('| Ref | Test case | Affected FIDs | What happened | Re-verified | Re-verified by |', '|---|---|---|---|---|---|');
    for (const r of resolved) out.push('| ' + ref(r.first) + ' | ' + r.first.caseId + ' | ' + fidsOf(r.first.caseId) + ' | ' + cell(r.last.note) + ' | ' + r.fixed.ts.slice(0, 10) + ' | ' + cell(r.fixed.actor.name) + ' |');
  }
  out.push(ERR_END);
  return out.join('\n');
}
function writeErrorDictionary(root, state) {
  const file = path.join(root, 'ERROR_DICTIONARY.md');
  const block = errorBlock(root, state);
  let text = fs.existsSync(file)
    ? fs.readFileSync(file, 'utf8')
    : '# Error Dictionary — ' + state.project + '\n\nCentral reference for development and verification errors.\nCheck here before creating a new entry.\n\n## Error references\n\n| Code | Description | Cause | Affected FID | Resolution status |\n|---|---|---|---|---|\n\n';
  const a = text.indexOf(ERR_START);
  const b = text.indexOf(ERR_END);
  text = a !== -1 && b > a ? text.slice(0, a) + block + text.slice(b + ERR_END.length) : text.replace(/\s*$/, '\n\n') + block + '\n';
  fs.writeFileSync(file, text);
}

function writeOutputs(root, state) {
  state = state || loadState(root);
  fs.writeFileSync(path.join(root, 'FID_CHECKLIST.html'), renderChecklist({ live: false, state }));
  fs.writeFileSync(path.join(root, 'FID_DIRECTORY.md'), directoryMd(state));
  writeErrorDictionary(root, state);
  return state;
}

// ------------------------------------------------------------------ sync ---
function loadEnv(root) {
  const env = { ...process.env };
  const file = P(root).env;
  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && env[m[1]] === undefined) env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
    }
  }
  return env;
}
function syncTargets(root) {
  const env = loadEnv(root);
  const key = env.DEVTEST_SUPABASE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  return { supabase: env.SUPABASE_URL && key ? { url: env.SUPABASE_URL.replace(/\/+$/, ''), key } : null, webhook: env.DEVTEST_WEBHOOK_URL || null };
}
/** Push events to the configured database endpoint(s). Idempotent: rows are keyed by event id. */
async function pushEvents(root, events) {
  const t = syncTargets(root);
  const project = loadConfig(root).project;
  const report = { supabase: null, webhook: null };
  if (!events.length) return report;
  if (t.supabase) {
    try {
      for (let i = 0; i < events.length; i += 500) {
        const rows = events.slice(i, i + 500).map((e) => ({ id: e.id, project, ts: e.ts, type: e.type, actor_name: e.actor.name, actor_kind: e.actor.kind, commit: e.commit || null, payload: e }));
        const res = await fetch(t.supabase.url + '/rest/v1/devtest_events?on_conflict=id', { method: 'POST', headers: { apikey: t.supabase.key, Authorization: 'Bearer ' + t.supabase.key, 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify(rows) });
        if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + (await res.text()).slice(0, 200));
      }
      report.supabase = { ok: true, count: events.length };
    } catch (err) {
      report.supabase = { ok: false, error: err.message };
    }
  }
  if (t.webhook) {
    try {
      const res = await fetch(t.webhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ project, events }) });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      report.webhook = { ok: true, count: events.length };
    } catch (err) {
      report.webhook = { ok: false, error: err.message };
    }
  }
  return report;
}

// ------------------------------------------------------------- JUnit XML ---
const CASE_ID_RE = /\b(?:TC|IT)-FID\d{2}(?:\.\d+)*-\d+\b|\bC1-\d+\b/g;
/** Read a JUnit XML report and map results onto case ids found in test names. */
function parseJunit(xml) {
  const byId = {};
  const re = /<testcase\b([^>]*?)(?:\/>|>([\s\S]*?)<\/testcase>)/g;
  let m;
  let seen = 0;
  while ((m = re.exec(xml))) {
    seen++;
    const attrs = m[1];
    const body = m[2] || '';
    const name = [(attrs.match(/\bname="([^"]*)"/) || [])[1] || '', (attrs.match(/\bclassname="([^"]*)"/) || [])[1] || ''].join(' ');
    const ids = name.match(CASE_ID_RE);
    if (!ids) continue;
    if (/<skipped\b/.test(body)) continue;
    const failed = /<(failure|error)\b/.test(body);
    const msg = failed ? ((body.match(/<(?:failure|error)\b[^>]*\bmessage="([^"]*)"/) || [])[1] || 'Automated test failed').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').slice(0, 300) : '';
    for (const id of new Set(ids)) {
      const cur = byId[id] || { pass: 0, fail: 0, notes: [] };
      if (failed) {
        cur.fail++;
        cur.notes.push(msg);
      } else cur.pass++;
      byId[id] = cur;
    }
  }
  return { seen, byId };
}

module.exports = {
  TOOL_ROOT, UserError, P, sha, readJson, writeJson, slugify, findRoot, requireRoot, loadConfig, loadFids, saveFids, gitCommit,
  fidDir, ensureFid, addFid, updateFid, parseFeatureLines, extractLogic, adoptLogic, logicTemplate, readLogic, parseAcs, parseFailureRows,
  defHash, loadCases, saveCase, deleteCase, approveCases, generateDrafts, nextCaseId, fingerprints, readEvents, structureIssues,
  loadState, record, renderChecklist, writeOutputs, directoryMd, loadEnv, syncTargets, pushEvents, parseJunit,
};
