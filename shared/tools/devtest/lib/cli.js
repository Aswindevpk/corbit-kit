'use strict';
/**
 * Command line for both programs.
 *   fidtrack  development: FID tree, folders, development checklist
 *   cortest   testing: test cases, scenario types, L1 / L2 / C1 / C2, exit gate
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execSync } = require('child_process');
const store = require('./project');
const rules = require('./rules');
const { serve } = require('./server');

const { UserError } = store;
const tty = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code) => (s) => (tty ? '\x1b[' + code + 'm' + s + '\x1b[0m' : String(s));
const c = { green: paint(32), red: paint(31), yellow: paint(33), blue: paint(36), dim: paint(2), bold: paint(1) };
const MARK = { complete: c.green('✔'), failed: c.red('✖'), blocked: c.red('■'), 'needs-retest': c.yellow('↻'), 'in-progress': c.blue('◐'), 'not-started': c.dim('○') };
const TINT = { pass: c.green, fail: c.red, blocked: c.red, stale: c.yellow, pending: c.dim, draft: c.dim, 'no-tests': c.yellow, uncovered: c.yellow, 'no-criteria': c.yellow, 'n/a': c.dim, locked: c.dim, ready: c.blue, running: c.blue };
const tint = (s) => (TINT[s] || ((x) => x))(s);

function parseArgs(argv) {
  const pos = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq !== -1) flags[a.slice(2, eq)] = a.slice(eq + 1);
      else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) flags[a.slice(2)] = argv[++i];
      else flags[a.slice(2)] = true;
    } else pos.push(a);
  }
  return { pos, flags };
}
const list = (v) => (v && v !== true ? String(v).split(',').map((s) => s.trim()).filter(Boolean) : []);

function actor(flags) {
  const name = (flags.by !== true && flags.by) || process.env.DEVTEST_USER || '';
  if (!String(name).trim()) throw new UserError('Say who is doing this: add --by "Your Name" (or set DEVTEST_USER).');
  const kind = flags.agent || process.env.DEVTEST_ACTOR_KIND === 'agent' ? 'agent' : 'human';
  return { name: String(name).trim(), kind };
}
function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (a) => (rl.close(), resolve(a.trim()))));
}
async function readPasted(prompt) {
  console.log(prompt);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: '> ' });
  const lines = [];
  rl.prompt();
  for await (const line of rl) {
    if (!line.trim()) break;
    lines.push(line);
    rl.prompt();
  }
  rl.close();
  return lines.join('\n');
}

// ------------------------------------------------------------- printing ---
function printTree(state, only) {
  const s = state.status;
  for (const id of s.order) {
    if (only && id !== only && !id.startsWith(only + '.')) continue;
    const f = s.fids[id];
    const dev = f.dev.developed ? c.green('dev ✔') : f.dev.logicRead ? c.blue('dev …') : c.dim('dev ○');
    console.log('  '.repeat(f.depth) + MARK[f.state] + ' ' + c.bold(id) + ' ' + f.name + c.dim('  [') + dev + c.dim(' | L1 ') + tint(f.l1.state) + c.dim(' | L2 ') + tint(f.l2.state) + c.dim(']'));
    if (only) for (const r of f.reasons) console.log('  '.repeat(f.depth) + '    ' + c.dim('- ' + r));
  }
}
function printSummary(state) {
  const s = state.status;
  console.log(c.bold(state.project) + c.dim('  ' + s.summary.complete + ' / ' + s.summary.total + ' FIDs complete (' + s.summary.pct + '%)' + (state.commit ? '  commit ' + state.commit : '')));
  console.log('  Stage 2  developed ' + s.stage2.developed + '/' + s.stage2.total + '   individual ' + s.stage2.l1Passed + '/' + s.stage2.total + '   integration ' + s.stage2.completeCount + '/' + s.stage2.total);
  console.log('  Stage 3  C1 ' + tint(s.c1.state) + c.dim(' (' + s.c1.pass + '/' + s.c1.approved + ' cases)') + '   C2 ' + tint(s.c2.state) + c.dim(' (' + s.c2.attempts.length + ' attempt(s))'));
  if (state.issues.length) console.log(c.yellow('  ' + state.issues.length + ' structure issue(s): run "fidtrack scan"'));
}
function printCase(k) {
  console.log('  ' + tint(k.effective).padEnd(tty ? 16 : 8) + ' ' + c.bold(k.id) + '  ' + k.title + c.dim('  [' + k.level + ' ' + k.type + ' ' + k.mode + (k.covers.length ? ' covers ' + k.covers.join(',') : '') + (k.links.length ? ' links ' + k.links.join(',') : '') + ']'));
  if (k.last && k.last.note) console.log('           ' + c.dim(k.last.result + ' by ' + k.last.by + ': ' + k.last.note));
  if (k.last && k.last.staleReason) console.log('           ' + c.yellow('re-test needed: ' + k.last.staleReason));
}
function requireFid(state, id) {
  if (!id) throw new UserError('Give a FID, for example FID01.1');
  if (!state.status.fids[id]) throw new UserError('Unknown FID ' + id + '. Run "fidtrack status" to see the tree.');
  return state.status.fids[id];
}

// --------------------------------------------------------------- shared ---
async function cmdServe(flags) {
  const root = store.requireRoot();
  store.writeOutputs(root);
  const { url } = await serve(root, { port: flags.port !== true && flags.port, host: flags.host === true ? '0.0.0.0' : flags.host });
  const t = store.syncTargets(root);
  console.log(c.bold('FID checklist is live at ') + c.blue(url));
  console.log(c.dim('  project: ' + root));
  console.log(c.dim('  saving to: devtest/events.jsonl' + (t.supabase ? ' + Supabase' : '') + (t.webhook ? ' + webhook' : '')));
  console.log(c.dim('  Ctrl+C to stop'));
  if (flags.open) {
    try {
      execSync((process.platform === 'darwin' ? 'open ' : process.platform === 'win32' ? 'start "" ' : 'xdg-open ') + url, { stdio: 'ignore' });
    } catch {}
  }
  await new Promise(() => {});
}
function cmdStatus(pos) {
  const root = store.requireRoot();
  const state = store.loadState(root);
  if (pos[0]) requireFid(state, pos[0]);
  printSummary(state);
  console.log('');
  printTree(state, pos[0]);
  if (pos[0]) {
    const mine = Object.values(state.status.cases).filter((k) => k.fid === pos[0]);
    if (mine.length) console.log('');
    mine.forEach(printCase);
  }
}

// -------------------------------------------------------------- fidtrack ---
const FIDTRACK_HELP = `fidtrack — development checklist (COR Development Standard, Stage 1 and 2)

  fidtrack init [--name "Project"] [--from features.txt]   set the project up (interactive without --from)
  fidtrack add <FID> <name> [--depends FID,FID] [--paths src/x,src/y]
  fidtrack import <features.txt>        add every "FID01 — Name" line in a file
  fidtrack path <FID>                   the LOGIC.md path for one FID (for an AI prompt or editor)
  fidtrack logic <FID> <file> [--force] adopt a written Logic Document (Phase 4 output) into that FID
  fidtrack extract <master-logic.md>    split a single master Logic Document into every FID's LOGIC.md
  fidtrack set <FID> [--name ..] [--depends ..] [--paths ..]
  fidtrack scan [--fix]                 check folders against the registry, regenerate FID_DIRECTORY.md
  fidtrack status [FID]                 the tree, or one FID with every reason it is not complete
  fidtrack next                         what to develop next
  fidtrack start <FID> --by "Name"      confirm LOGIC.md was read; development begins
  fidtrack done <FID> --by "Name"       development complete (ready for individual testing)
  fidtrack undo <FID> --by "Name"       development is not complete after all
  fidtrack block <FID> --note ".." --by "Name"   |   fidtrack unblock <FID> --by "Name"
  fidtrack serve [--port 4173] [--host] [--open]   the interactive checklist in the browser

AI agents must add --agent to every command.`;

function installInto(root, flags) {
  const dest = path.join(root, 'devtest', 'tool');
  const link = !!flags.link;
  if (!link && path.resolve(dest) !== store.TOOL_ROOT) {
    for (const dir of ['bin', 'lib', 'web', 'supabase', 'templates']) fs.cpSync(path.join(store.TOOL_ROOT, dir), path.join(dest, dir), { recursive: true });
    fs.copyFileSync(path.join(store.TOOL_ROOT, 'package.json'), path.join(dest, 'package.json'));
    fs.copyFileSync(path.join(store.TOOL_ROOT, 'README.md'), path.join(dest, 'README.md'));
  }
  for (const name of ['fidtrack', 'cortest']) {
    const target = link ? path.join(store.TOOL_ROOT, 'bin', name + '.js') : null;
    fs.writeFileSync(path.join(root, name), '#!/bin/sh\nexec node "' + (link ? target : '$(dirname "$0")/devtest/tool/bin/' + name + '.js') + '" "$@"\n', { mode: 0o755 });
    fs.writeFileSync(path.join(root, name + '.cmd'), '@echo off\r\nnode "' + (link ? target : '%~dp0devtest\\tool\\bin\\' + name + '.js') + '" %*\r\n');
  }
}

async function fidInit(pos, flags) {
  const root = path.resolve(pos[0] || process.cwd());
  fs.mkdirSync(root, { recursive: true });
  const p = store.P(root);
  const fresh = !fs.existsSync(p.config);
  let name = flags.name !== true && flags.name;
  let text = flags.from && flags.from !== true ? fs.readFileSync(path.resolve(flags.from), 'utf8') : '';
  const interactive = process.stdin.isTTY && !flags.yes;
  if (fresh && !name) name = (interactive && (await ask('Project name [' + path.basename(root) + ']: '))) || path.basename(root);
  if (fresh && !text && interactive) text = await readPasted('Paste the feature list from the Feature Scope Document, one per line\n(for example "FID01 — User Management", "FID01.1 — Registration"). Empty line to finish:');

  if (fresh) store.writeJson(p.config, { project: name, fidRoot: 'FID', strictCoverage: true, sharedPaths: [], automation: [], port: 4173 });
  if (!fs.existsSync(p.fids)) store.writeJson(p.fids, { fids: [] });
  if (!fs.existsSync(p.c1)) store.writeJson(p.c1, { cases: [] });
  if (!fs.existsSync(p.events)) fs.writeFileSync(p.events, '');
  for (const dir of ['FID', 'assets', 'shared', 'project-wide-rules-and-technical-foundation', 'db_structure', 'global_features']) fs.mkdirSync(path.join(root, dir), { recursive: true });
  installInto(root, flags);

  const agent = path.join(root, 'AGENT.md');
  if (!fs.existsSync(agent)) fs.writeFileSync(agent, fs.readFileSync(path.join(store.TOOL_ROOT, 'templates', 'AGENT.md'), 'utf8').replace(/\{\{PROJECT\}\}/g, store.loadConfig(root).project));
  const gi = path.join(root, '.gitignore');
  const giText = fs.existsSync(gi) ? fs.readFileSync(gi, 'utf8') : '';
  if (!giText.includes('devtest/.env')) fs.writeFileSync(gi, giText.replace(/\s*$/, giText ? '\n' : '') + '# devtest: database keys stay out of git\ndevtest/.env\n');

  const added = importLines(root, text);
  store.writeOutputs(root);
  console.log(c.green('✔ ') + (fresh ? 'Project "' + store.loadConfig(root).project + '" is set up' : 'Project refreshed') + ' in ' + root);
  console.log('  ' + added.added.length + ' FID(s) added' + (added.skipped.length ? ', ' + added.skipped.length + ' already present' : ''));
  console.log('  Created: FID/, AGENT.md, FID_DIRECTORY.md, FID_CHECKLIST.html, ERROR_DICTIONARY.md, devtest/');
  console.log('\nNext:\n  ./fidtrack extract <master-logic.md>   put each FID\'s logic into its LOGIC.md\n  ./fidtrack serve --open                open the checklist');
}
function importLines(root, text) {
  const added = [];
  const skipped = [];
  const existing = new Set(store.loadFids(root).map((f) => f.id));
  for (const f of store.parseFeatureLines(text || '')) {
    if (existing.has(f.id)) {
      skipped.push(f.id);
      continue;
    }
    store.addFid(root, f);
    existing.add(f.id);
    added.push(f.id);
  }
  return { added, skipped };
}

function devEvent(root, id, field, value, flags) {
  const { state } = store.record(root, { type: 'dev', fid: id, field, value, note: flags.note !== true ? flags.note : '', actor: actor(flags) });
  return state;
}

async function fidtrack(argv) {
  const { pos, flags } = parseArgs(argv);
  const cmd = pos.shift();
  if (!cmd || cmd === 'help' || flags.help) return console.log(FIDTRACK_HELP);
  if (cmd === 'init') return fidInit(pos, flags);
  if (cmd === 'serve') return cmdServe(flags);
  if (cmd === 'status') return cmdStatus(pos);
  const root = store.requireRoot();

  if (cmd === 'add') {
    const f = store.addFid(root, { id: pos[0], name: pos.slice(1).join(' '), dependsOn: list(flags.depends), paths: list(flags.paths) });
    store.writeOutputs(root);
    return console.log(c.green('✔ ') + 'Added ' + f.id + ' — ' + f.name);
  }
  if (cmd === 'import') {
    if (!pos[0]) throw new UserError('Give a file of "FID01 — Name" lines');
    const r = importLines(root, fs.readFileSync(path.resolve(pos[0]), 'utf8'));
    store.writeOutputs(root);
    return console.log(c.green('✔ ') + r.added.length + ' FID(s) added, ' + r.skipped.length + ' already present');
  }
  if (cmd === 'path') {
    const id = pos[0];
    requireFid(store.loadState(root), id);
    const fids = store.loadFids(root);
    console.log(path.relative(root, store.fidDir(root, fids, id)).split(path.sep).join('/') + '/features/LOGIC.md');
    return;
  }
  if (cmd === 'logic') {
    const [id, file] = pos;
    if (!id || !file) throw new UserError('Usage: fidtrack logic <FID> <file> [--force]');
    const dest = store.adoptLogic(root, id, file, { force: !!flags.force });
    store.writeOutputs(root);
    return console.log(c.green('✔ ') + 'LOGIC.md adopted for ' + id + c.dim('  → ' + path.relative(root, dest)));
  }
  if (cmd === 'extract') {
    if (!pos[0]) throw new UserError('Give the master Logic Document (markdown)');
    const r = store.extractLogic(root, fs.readFileSync(path.resolve(pos[0]), 'utf8'), { force: !!flags.force });
    store.writeOutputs(root);
    const done = r.written.filter((w) => !w.skipped);
    console.log(c.green('✔ ') + 'LOGIC.md written for ' + done.length + ' FID(s)');
    const skipped = r.written.filter((w) => w.skipped);
    if (skipped.length) console.log(c.yellow('  kept existing (use --force to overwrite): ') + skipped.map((w) => w.id).join(', '));
    if (r.unknown.length) console.log(c.yellow('  in the document but not in the registry: ') + [...new Set(r.unknown)].join(', '));
    return;
  }
  if (cmd === 'set') {
    const patch = {};
    if (flags.name && flags.name !== true) patch.name = flags.name;
    if (flags.depends !== undefined) patch.dependsOn = list(flags.depends);
    if (flags.paths !== undefined) patch.paths = list(flags.paths);
    const f = store.updateFid(root, pos[0], patch);
    store.writeOutputs(root);
    return console.log(c.green('✔ ') + f.id + ' updated' + c.dim('  depends: ' + (f.dependsOn.join(', ') || 'none') + '  paths: ' + (f.paths.join(', ') || 'none')));
  }
  if (cmd === 'scan') {
    if (flags.fix) {
      const fids = store.loadFids(root);
      for (const f of fids) if (!rules.parentOf(f.id) || fids.some((x) => x.id === rules.parentOf(f.id))) store.ensureFid(root, fids, f);
    }
    const state = store.writeOutputs(root);
    if (!state.issues.length) return console.log(c.green('✔ ') + state.status.summary.total + ' FIDs, folders match the registry. FID_DIRECTORY.md regenerated.');
    console.log(c.yellow(state.issues.length + ' issue(s):'));
    state.issues.forEach((i) => console.log('  - ' + i));
    console.log(c.dim('Run "fidtrack scan --fix" to create missing folders.'));
    process.exitCode = 1;
    return;
  }
  if (cmd === 'next') {
    const s = store.loadState(root).status;
    const todo = s.order.map((id) => s.fids[id]).filter((f) => !f.dev.developed && !f.blocked);
    if (!todo.length) return console.log(c.green('✔ ') + 'Every FID is marked developed. Continue with "cortest status".');
    const ready = todo.filter((f) => f.dependsOn.every((d) => s.fids[d] && s.fids[d].dev.developed) && f.children.every((ch) => s.fids[ch].dev.developed));
    const f = ready[0] || todo[0];
    console.log(c.bold('Next: ' + f.id + ' — ' + f.name));
    console.log('  Logic:   ' + f.dir + '/features/LOGIC.md');
    console.log('  Tests:   ' + f.dir + '/features/tests/');
    if (f.dependsOn.length) console.log('  Depends: ' + f.dependsOn.join(', '));
    if (!ready.length) console.log(c.yellow('  Note: its dependencies are not all developed yet.'));
    console.log(c.dim('  ' + todo.length + ' FID(s) left to develop'));
    return;
  }
  if (['start', 'done', 'undo', 'block', 'unblock'].includes(cmd)) {
    const id = pos[0];
    requireFid(store.loadState(root), id);
    let state;
    if (cmd === 'start') state = devEvent(root, id, 'logicRead', true, flags);
    if (cmd === 'done') state = devEvent(root, id, 'developed', true, flags);
    if (cmd === 'undo') state = devEvent(root, id, 'developed', false, flags);
    if (cmd === 'block' || cmd === 'unblock') state = store.record(root, { type: 'block', fid: id, blocked: cmd === 'block', note: flags.note !== true ? flags.note : '', actor: actor(flags) }).state;
    const f = state.status.fids[id];
    console.log(c.green('✔ ') + id + ' ' + { start: 'logic read, development started', done: 'development complete', undo: 'development reopened', block: 'blocked', unblock: 'unblocked' }[cmd] + c.dim('  → ' + f.state));
    if (cmd === 'done' && f.reasons.length) console.log(c.dim('  Still needed: ' + f.reasons.join('; ')));
    return;
  }
  throw new UserError('Unknown command "' + cmd + '". Run "fidtrack help".');
}

// --------------------------------------------------------------- cortest ---
const CORTEST_HELP = `cortest — test cases and verification (Stage 2 testing, Stage 3 C1 and C2)

  Test cases
  cortest types                         the scenario types every FID should be covered by
  cortest generate <FID | --all>        draft cases from LOGIC.md acceptance criteria and failure table
  cortest prompt <FID>                  instructions for an AI agent to write this FID's cases
  cortest add --file cases.json         add or update cases from JSON (one object or an array)
  cortest list [FID] [--level L1|L2|C1] [--state fail|pending|stale|draft]
  cortest approve <case-id ... | FID> --by "Name"     a person approves drafts so they count

  Running
  cortest record <case-id> <pass|fail|blocked> --by "Name" [--note ".."] [--evidence path-or-url]
  cortest ingest <junit.xml ...> [--c2]  record automated results (test names must contain the case id)
  cortest run [--c2]                    run the commands in devtest/config.json "automation", then ingest

  Stage 3
  cortest c2 start --by "Name"          start a fresh one-go attempt (needs C1 passed)
  cortest c2 record <FID | flow-id> <pass|fail> --by "Name" [--note ".."]
  cortest c2 status | cortest c2 abort --note ".." --by "Name"
  cortest gate                          the Development Verification Exit Gate (exit code 1 until ready)
  cortest gate confirm <buildVerified|handoverDocs> --by "Name"

  Other
  cortest status [FID]   cortest report   cortest sync   cortest serve [--port] [--host] [--open]

AI agents must add --agent to every command. An agent cannot pass manual cases or approve test cases.`;

function aiPrompt(root, id) {
  const fids = store.loadFids(root);
  const f = fids.find((x) => x.id === id);
  if (!f) throw new UserError('Unknown FID ' + id);
  const dir = path.relative(root, store.fidDir(root, fids, id)).split(path.sep).join('/');
  const acs = store.parseAcs(store.readLogic(root, fids, id));
  return `Write the test cases for ${f.id} — ${f.name}.

1. Read ${dir}/features/LOGIC.md completely, plus the project-wide rules it references.
2. Write a JSON array to a temporary file and load it with:  ./cortest add --file <file> --agent
3. Every case must look like this:
   {
     "fid": "${f.id}",
     "level": "L1",                      // L1 = this FID alone. L2 = this FID with its children / dependencies (add "links")
     "type": "functional",               // one of: ${rules.SCENARIO_TYPES.map((t) => t.id).join(', ')}
     "title": "What is being proved, in one line",
     "precondition": "State the system must be in before step 1",
     "steps": ["Exact action 1", "Exact action 2"],
     "expected": "The observable result that means pass. Use exact values, field names and messages from LOGIC.md",
     "covers": ["AC-1"],                 // acceptance criteria from section 6 this case proves
     "mode": "manual"                    // "auto" only if you also write an automated test whose name contains the case id
   }
4. Coverage that is required:
   - Every acceptance criterion is covered by at least one case: ${acs.length ? acs.map((a) => a.id).join(', ') : '(none found: LOGIC.md section 6 needs numbered criteria first)'}
   - validation: every validation rule and failure condition in section 2
   - permission: every role that may, and one role that may not
   - edge-failure: every row of the failure and edge-case table in section 5
   - ui-state: each UI state the feature references
   - data-integrity: each create / update / delete in section 4, checked in the database
5. Do not invent behaviour that is not in LOGIC.md. If the logic is unclear, stop and report the gap.
6. Cases you add are drafts. A person approves them with:  ./cortest approve ${f.id} --by "Name"
7. For "auto" cases put the test under ${dir}/features/tests/ and include the case id in the test name,
   for example:  test('TC-${f.id}-01 rejects an expired OTP', ...)
`;
}

function ingestReports(root, files, flags) {
  if (!files.length) throw new UserError('Give at least one JUnit XML report');
  const merged = {};
  let seen = 0;
  for (const file of files) {
    const abs = path.resolve(root, file);
    if (!fs.existsSync(abs)) throw new UserError('Report not found: ' + file);
    const r = store.parseJunit(fs.readFileSync(abs, 'utf8'));
    seen += r.seen;
    for (const [id, v] of Object.entries(r.byId)) {
      const cur = merged[id] || { pass: 0, fail: 0, notes: [] };
      merged[id] = { pass: cur.pass + v.pass, fail: cur.fail + v.fail, notes: [...cur.notes, ...v.notes] };
    }
  }
  const who = { name: 'automation' + (flags.by && flags.by !== true ? ' (' + flags.by + ')' : ''), kind: 'automation' };
  const out = { recorded: [], skipped: [] };
  for (const [id, v] of Object.entries(merged).sort()) {
    const state = store.loadState(root);
    const k = state.status.cases[id];
    if (!k) {
      out.skipped.push(id + ': not a known test case');
      continue;
    }
    if (k.mode !== 'auto') {
      out.skipped.push(id + ': case is manual. Set "mode": "auto" to accept automated results');
      continue;
    }
    const result = v.fail ? 'fail' : 'pass';
    const note = v.fail ? v.notes.filter(Boolean).join(' | ').slice(0, 400) || 'Automated test failed' : '';
    try {
      if (flags.c2) store.record(root, { type: 'c2.result', itemId: id, result, note, source: 'automation', actor: who });
      else store.record(root, { type: 'result', caseId: id, result, note, source: 'automation', evidence: files.join(', '), actor: who });
      out.recorded.push({ id, result });
    } catch (err) {
      if (!(err instanceof UserError)) throw err;
      out.skipped.push(id + ': ' + err.message);
    }
  }
  console.log(seen + ' automated test(s) in the report, ' + Object.keys(merged).length + ' carry a case id');
  for (const r of out.recorded) console.log('  ' + tint(r.result) + '  ' + r.id);
  for (const s of out.skipped) console.log('  ' + c.yellow('skipped') + '  ' + s);
  const auto = Object.values(store.loadState(root).status.cases).filter((k) => k.mode === 'auto' && k.status === 'approved' && !merged[k.id]);
  if (auto.length && !flags.c2) console.log(c.dim('  ' + auto.length + ' approved automated case(s) had no result in this report: ' + auto.map((k) => k.id).slice(0, 8).join(', ') + (auto.length > 8 ? ' …' : '')));
  if (out.recorded.some((r) => r.result === 'fail')) process.exitCode = 1;
  return out;
}

function printC2(state) {
  const c2 = state.status.c2;
  console.log(c.bold('C2 — one-go complete system verification: ') + tint(c2.state));
  if (!c2.attempts.length) console.log(c.dim('  No attempts yet.' + (c2.canStart ? ' Ready: cortest c2 start --by "Name"' : ' C1 must pass and every FID must be complete first.')));
  for (const a of c2.attempts) {
    console.log('  Attempt ' + a.n + '  ' + tint(a.state === 'passed' ? 'pass' : a.state === 'running' ? 'running' : 'fail') + c.dim('  ' + a.state + '  ' + a.done + '/' + a.total + ' items  started ' + a.startedAt.slice(0, 16).replace('T', ' ') + ' by ' + a.by) + (a.reason ? '  ' + c.red(a.reason) : ''));
    if (a.state === 'running') {
      const left = a.itemIds.filter((i) => !a.items[i]);
      console.log(c.dim('    remaining: ' + left.slice(0, 12).join(', ') + (left.length > 12 ? ' … (' + left.length + ')' : '')));
    }
  }
}

async function cortest(argv) {
  const { pos, flags } = parseArgs(argv);
  const cmd = pos.shift();
  if (!cmd || cmd === 'help' || flags.help) return console.log(CORTEST_HELP);
  if (cmd === 'serve') return cmdServe(flags);
  if (cmd === 'status') return cmdStatus(pos);
  if (cmd === 'types') return rules.SCENARIO_TYPES.forEach((t) => console.log('  ' + c.bold(t.id.padEnd(15)) + t.label + c.dim('  ← ' + t.from)));
  const root = store.requireRoot();

  if (cmd === 'generate') {
    const ids = flags.all ? store.loadFids(root).map((f) => f.id) : pos;
    if (!ids.length) throw new UserError('Give a FID or --all');
    let total = 0;
    for (const id of ids) {
      const r = store.generateDrafts(root, id);
      total += r.made.length;
      if (!r.acs) console.log(c.yellow('  ' + id + ': LOGIC.md has no numbered acceptance criteria (section 6)'));
      else if (r.made.length) console.log('  ' + id + ': ' + r.made.length + ' draft(s)  ' + c.dim(r.made.map((k) => k.id).join(', ')));
    }
    store.writeOutputs(root);
    return console.log(c.green('✔ ') + total + ' draft case(s) created. Fill in the steps, then approve them.');
  }
  if (cmd === 'prompt') return console.log(aiPrompt(root, pos[0]));
  if (cmd === 'add') {
    if (!flags.file || flags.file === true) throw new UserError('Use --file cases.json');
    const data = store.readJson(path.resolve(flags.file));
    if (!data) throw new UserError('File not found: ' + flags.file);
    const arr = Array.isArray(data) ? data : data.cases || [data];
    const saved = arr.map((raw) => store.saveCase(root, raw));
    store.writeOutputs(root);
    console.log(c.green('✔ ') + saved.length + ' case(s) saved as drafts where new or changed:');
    return saved.forEach((k) => console.log('  ' + k.id + c.dim('  ' + k.status + '  ' + k.title)));
  }
  if (cmd === 'list') {
    const state = store.loadState(root);
    let ks = Object.values(state.status.cases);
    if (pos[0]) ks = ks.filter((k) => k.fid === pos[0] || (k.links || []).includes(pos[0]));
    if (flags.level && flags.level !== true) ks = ks.filter((k) => k.level === flags.level);
    if (flags.state && flags.state !== true) ks = ks.filter((k) => k.effective === flags.state);
    if (!ks.length) return console.log(c.dim('No matching test cases.'));
    return ks.forEach(printCase);
  }
  if (cmd === 'approve') {
    const state = store.loadState(root);
    let ids = [];
    for (const p of pos) {
      if (state.status.fids[p]) ids.push(...Object.values(state.status.cases).filter((k) => k.fid === p && k.status !== 'approved').map((k) => k.id));
      else if (p === 'C1') ids.push(...Object.values(state.status.cases).filter((k) => k.level === 'C1' && k.status !== 'approved').map((k) => k.id));
      else ids.push(p);
    }
    if (!ids.length) throw new UserError('Nothing to approve. Give case ids, a FID, or C1.');
    const done = store.approveCases(root, ids, actor(flags));
    store.writeOutputs(root);
    return console.log(c.green('✔ ') + done.length + ' case(s) approved' + (done.length ? ': ' + done.join(', ') : ''));
  }
  if (cmd === 'record') {
    const [caseId, result] = pos;
    if (!caseId || !result) throw new UserError('Usage: cortest record <case-id> <pass|fail|blocked> --by "Name" [--note ".."]');
    const { state } = store.record(root, { type: 'result', caseId, result, note: flags.note !== true ? flags.note : '', evidence: flags.evidence !== true ? flags.evidence : '', actor: actor(flags) });
    const k = state.status.cases[caseId];
    console.log(tint(k.effective) + '  ' + caseId + c.dim('  ' + k.title));
    for (const id of rules.affectedFids(k)) console.log(c.dim('  ' + id + ' → ') + state.status.fids[id].state);
    return;
  }
  if (cmd === 'ingest') return void ingestReports(root, pos, flags);
  if (cmd === 'run') {
    const jobs = store.loadConfig(root).automation || [];
    if (!jobs.length) throw new UserError('No automation configured. Add to devtest/config.json:\n  "automation": [{ "name": "unit", "command": "npm test", "junit": "reports/junit.xml" }]');
    const reports = [];
    for (const job of jobs) {
      console.log(c.bold('▶ ' + (job.name || job.command)) + c.dim('  ' + job.command));
      try {
        execSync(job.command, { cwd: root, stdio: 'inherit' });
      } catch {
        console.log(c.yellow('  command exited with an error; reading its report anyway'));
      }
      if (job.junit && fs.existsSync(path.resolve(root, job.junit))) reports.push(job.junit);
      else console.log(c.red('  no JUnit report at ' + job.junit + ': nothing recorded for this job'));
    }
    if (!reports.length) {
      process.exitCode = 1;
      return;
    }
    return void ingestReports(root, reports, flags);
  }
  if (cmd === 'c2') {
    const sub = pos.shift() || 'status';
    if (sub === 'status') return printC2(store.loadState(root));
    if (sub === 'start') {
      const { event, state } = store.record(root, { type: 'c2.start', actor: actor(flags) });
      console.log(c.green('✔ ') + 'C2 attempt ' + event.attempt + ' started: ' + event.itemIds.length + ' items, every one must pass in this attempt.');
      console.log(c.dim('  Do not change code or logic until it finishes, or the attempt is invalidated.'));
      return printC2(state);
    }
    if (sub === 'record') {
      const [itemId, result] = pos;
      if (!itemId || !result) throw new UserError('Usage: cortest c2 record <FID | flow-id> <pass|fail> --by "Name" [--note ".."]');
      const { state } = store.record(root, { type: 'c2.result', itemId, result, note: flags.note !== true ? flags.note : '', actor: actor(flags) });
      return printC2(state);
    }
    if (sub === 'abort') return printC2(store.record(root, { type: 'c2.abort', note: flags.note !== true ? flags.note : '', actor: actor(flags) }).state);
    throw new UserError('Unknown c2 command "' + sub + '"');
  }
  if (cmd === 'gate') {
    if (pos[0] === 'confirm') store.record(root, { type: 'gate', key: pos[1], value: !flags.undo, actor: actor(flags) });
    const state = store.loadState(root);
    console.log(c.bold('Development Verification Exit Gate — ' + state.project));
    for (const ch of state.status.gate.checks) console.log('  ' + (ch.ok ? c.green('✔') : c.red('✖')) + ' ' + ch.label + c.dim('  ' + ch.detail));
    console.log(state.status.gate.ready ? c.green('\nREADY for handover to the formal COR Testing phase.') : c.red('\nNOT READY. Formal handover must not take place.'));
    if (!state.status.gate.ready) process.exitCode = 1;
    return;
  }
  if (cmd === 'report') {
    store.writeOutputs(root);
    return console.log(c.green('✔ ') + 'FID_CHECKLIST.html, FID_DIRECTORY.md and ERROR_DICTIONARY.md regenerated.\n  Open FID_CHECKLIST.html and print it (or save as PDF) for the sign-off sheet.');
  }
  if (cmd === 'sync') {
    const t = store.syncTargets(root);
    if (!t.supabase && !t.webhook) throw new UserError('No database configured. Put SUPABASE_URL and DEVTEST_SUPABASE_KEY (or DEVTEST_WEBHOOK_URL) in devtest/.env. See the README.');
    const events = store.readEvents(root);
    const r = await store.pushEvents(root, events);
    for (const k of ['supabase', 'webhook']) if (r[k]) console.log('  ' + k + ': ' + (r[k].ok ? c.green(r[k].count + ' event(s) in sync') : c.red('failed: ' + r[k].error)));
    if (Object.values(r).some((x) => x && !x.ok)) process.exitCode = 1;
    return;
  }
  throw new UserError('Unknown command "' + cmd + '". Run "cortest help".');
}

function main(program) {
  const run = program === 'fidtrack' ? fidtrack : cortest;
  run(process.argv.slice(2)).catch((err) => {
    if (err instanceof UserError) console.error(c.red('✖ ') + err.message);
    else console.error(err.stack || err);
    process.exit(1);
  });
}

module.exports = { main, fidtrack, cortest, parseArgs };
