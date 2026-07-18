#!/usr/bin/env node
// Reports drift between components' shared files and each sibling site
// repo's own copy. components has no build step of its own — every site
// gets its CSS/_includes via manual `cp` (see README.md) — so nothing
// currently catches a sibling falling behind after a components edit.
// Run: node scripts/check-sync.js

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const siblings = ['docs', 'scangov', 'standards', 'scangov-com', 'my.scangov.com'];

function walk(dir, base = dir) {
  let files = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      files = files.concat(walk(full, base));
    } else {
      files.push(path.relative(base, full));
    }
  }
  return files;
}

const trackedFiles = [
  'public/css/scangov.css',
  ...walk(path.join(root, '_includes')).map((f) => path.join('_includes', f)),
];

let outOfSync = 0;
let checked = 0;

for (const relFile of trackedFiles) {
  const sourcePath = path.join(root, relFile);
  const sourceContent = readFileSync(sourcePath, 'utf8');

  for (const sibling of siblings) {
    const siblingPath = path.join(root, '..', sibling, relFile);
    if (!existsSync(siblingPath)) continue; // sibling doesn't use this file — not a drift
    checked++;
    const siblingContent = readFileSync(siblingPath, 'utf8');
    if (siblingContent !== sourceContent) {
      outOfSync++;
      console.log(`OUT OF SYNC: ${relFile} in ${sibling}`);
    }
  }
}

if (outOfSync === 0) {
  console.log(`check-sync: all ${checked} file/repo pairs in sync.`);
} else {
  console.log(`check-sync: ${outOfSync} of ${checked} file/repo pairs out of sync.`);
  process.exit(1);
}
