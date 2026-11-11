#!/usr/bin/env node
'use strict';
/**
 * Start a new Corbit project: clone a platform template, then set up fidtrack/cortest
 * (shared/tools/devtest) against the feature list, in one step.
 *
 *   node new-project.js <dest> --name "Client Project" --from features.txt [--platform supabase]
 *
 * features.txt is the feature list from the approved Feature Scope Document, one per
 * line ("FID01 — User Management", "FID01.1 — Registration", ...). Without --from,
 * run it without --yes and it asks interactively (same as `fidtrack init`).
 *
 * What it does:
 *   1. Copies platforms/<platform>/template into <dest> (not a git clone — a plain copy,
 *      so the new project gets its own history).
 *   2. Runs `fidtrack init` inside <dest>: creates the FID tree from the feature list,
 *      AGENT.md, FID_CHECKLIST.html, and the fidtrack/cortest launchers.
 *   3. `git init` in <dest> if git is available and it isn't already a repo.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const KIT_ROOT = __dirname;
const SKIP = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.turbo', '.DS_Store']);

function fail(msg) {
  console.error('✖ ' + msg);
  process.exit(1);
}
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
function copyTemplate(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    if (SKIP.has(name)) continue;
    const s = path.join(src, name);
    const d = path.join(dest, name);
    if (fs.statSync(s).isDirectory()) copyTemplate(s, d);
    else fs.copyFileSync(s, d);
  }
}
function isNonEmptyDir(p) {
  return fs.existsSync(p) && fs.statSync(p).isDirectory() && fs.readdirSync(p).length > 0;
}

function main() {
  const { pos, flags } = parseArgs(process.argv.slice(2));
  if (!pos[0] || flags.help) {
    console.log('Usage: node new-project.js <dest> --name "Client Project" --from features.txt [--platform supabase]');
    console.log('\nAvailable platform templates:');
    for (const p of fs.readdirSync(path.join(KIT_ROOT, 'platforms'))) {
      const t = path.join(KIT_ROOT, 'platforms', p, 'template');
      console.log('  ' + p + (isNonEmptyDir(t) ? '' : '  (not built yet)'));
    }
    return;
  }

  const dest = path.resolve(pos[0]);
  const platform = flags.platform && flags.platform !== true ? flags.platform : 'supabase';
  const templateDir = path.join(KIT_ROOT, 'platforms', platform, 'template');
  if (!isNonEmptyDir(templateDir)) fail('No template at platforms/' + platform + '/template. Run with --help to see what exists. Only "supabase" is complete today.');
  if (isNonEmptyDir(dest)) fail(dest + ' already exists and is not empty. Pick an empty or new folder.');

  console.log('▶ Copying platforms/' + platform + '/template → ' + dest);
  copyTemplate(templateDir, dest);

  if (!fs.existsSync(path.join(dest, '.git'))) {
    try {
      execFileSync('git', ['init', '-q'], { cwd: dest, stdio: 'ignore' });
      console.log('▶ git initialized');
    } catch {
      console.log('  (git not available — skipped "git init"; set up version control yourself)');
    }
  }

  console.log('▶ Setting up fidtrack / cortest from the feature list');
  const fidtrackBin = path.join(KIT_ROOT, 'shared', 'tools', 'devtest', 'bin', 'fidtrack.js');
  const initArgs = ['init', dest];
  if (flags.name && flags.name !== true) initArgs.push('--name', flags.name);
  if (flags.from && flags.from !== true) initArgs.push('--from', path.resolve(flags.from));
  if (!process.stdin.isTTY || flags.yes) initArgs.push('--yes');
  execFileSync(process.execPath, [fidtrackBin, ...initArgs], { stdio: 'inherit' });

  console.log('\n✔ Project ready at ' + dest);
  console.log(`
Next:
  cd ${path.relative(process.cwd(), dest) || '.'}
  cp .env.example .env.local                 # fill in your Supabase project's URL and anon key
  npm install
  npm run db:reset                            # applies migrations, generates src/types/database.types.ts
  ./fidtrack serve --open                      # the live FID checklist

Then, per the workflow (shared/workflow/README.md):
  Phase 3 (foundation docs)  → project-wide-rules-and-technical-foundation/ and db_structure/
  Phase 4 (one FID's logic)  → ./fidtrack path FID01.1   (shows where to write it)
                                ./fidtrack logic FID01.1 <file>   (adopts it once approved)
  Phase 5 (build a FID)      → AGENT.md (process) + AGENTS.md (code rules) guide the agent;
                                ./fidtrack start / done tracks it
  Phase 6 (test a FID)       → ./cortest generate / approve / record (see devtest/tool/GUIDE.md)
`);
}

main();
