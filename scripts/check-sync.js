#!/usr/bin/env node
// Reports drift between components' shared files and each sibling site
// repo's own copy. components has no build step of its own — every site
// gets its CSS/_includes via manual `cp` (see README.md) — so nothing
// currently catches a sibling falling behind after a components edit.
// Run: node scripts/check-sync.js

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const siblings = ['docs', 'scangov', 'standards', 'scangov-com', 'my.scangov.com', 'data'];

// Files/siblings that are deliberately out of sync with components — verified
// by hand, not drift. Keyed by relFile -> Set of sibling names to skip.
const knownDrift = {
  '_includes/js.html': new Set(['scangov']), // full domain-search autocomplete widget, Jekyll-style templating
  '_includes/header.html': new Set(['docs', 'scangov', 'standards', 'scangov-com', 'data']), // JSON-LD schema differs per site type; og:image intentionally shared across sites
  '_includes/footer.html': new Set(['scangov-com']), // marketing CTA section
  '_includes/feedback.html': new Set(['scangov-com']), // marketing-page-specific logic
  '_includes/breadcrumb-profile.html': new Set(['scangov']), // status-color dot tied to scangov's domain data
  '_includes/actions.html': new Set(['data']), // intentionally drops scangov.org from its share list
  '_includes/404.html': new Set(['data']), // adds a "ScanGov Data" breadcrumb link
  '_includes/audio.html': new Set(['standards']), // audio block deliberately disabled
  '_includes/jumbotron-default.html': new Set(['docs', 'standards', 'scangov-com']), // #lunrsearchresults div, search-only sites
  '_includes/jumbotron.html': new Set(['docs', 'scangov', 'scangov-com']), // fully custom homepage heroes
  '_includes/layouts/docs.html': new Set(['standards']), // standards-specific breadcrumb/related blocks
  '_includes/search.html': new Set(['docs', 'scangov', 'standards', 'scangov-com']), // Lunr vs domain-search markup
  '_includes/details.html': new Set(['scangov']), // adds a Sites: {{ siteCount }} counter tied to its directory pages
  '_includes/style.html': new Set(['docs', 'standards', 'scangov-com', 'data']), // docs/standards add plyr.css (audio)+code.css (syntax highlighting); scangov-com inlines CSS at build time; data adds data.css (copy-button styles)
};

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
  ...walk(path.join(root, 'public/assets/img/favicon')).map((f) => path.join('public/assets/img/favicon', f)),
];

let outOfSync = 0;
let checked = 0;

for (const relFile of trackedFiles) {
  const sourcePath = path.join(root, relFile);
  const sourceContent = readFileSync(sourcePath);

  for (const sibling of siblings) {
    const siblingPath = path.join(root, '..', sibling, relFile);
    if (!existsSync(siblingPath)) continue; // sibling doesn't use this file — not a drift
    if (knownDrift[relFile]?.has(sibling)) continue; // verified intentional, see knownDrift above
    checked++;
    const siblingContent = readFileSync(siblingPath);
    if (!siblingContent.equals(sourceContent)) {
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
