#!/usr/bin/env node
/*
 * Shared content-style linter for ScanGov sites.
 * Enforces the deterministic subset of the `content-style` skill
 * (see https://github.com/ScanGov/skills, content-style plugin):
 * sentence-case headings, Oxford comma, acronym-first-use, and
 * gov-only/website terminology. Reading level and passive voice are
 * heuristic and reported as warnings, not failures.
 *
 * Usage: node check-content.js <file> [file...]
 * Exit code 1 if any `error`-severity violation is found.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ACRONYM_ALLOWLIST = new Set([
  'URL', 'URLS', 'HTML', 'CSS', 'PDF', 'FAQ', 'API', 'SEO', 'DNS',
  'HTTP', 'HTTPS', 'CSV', 'JSON', 'XML', 'ID', 'RSS', 'JS', 'UI', 'UX', 'AI',
  'US', 'IP', 'GET', 'COVID', // near-universal recognition, same tier as AI
  'AA', 'AAA', // WCAG conformance levels, not acronyms in the "spell it out" sense
  'II', // Roman numeral used in ADA Title II / Section 508 references, not an acronym
  'YYYY', 'MM', 'DD', // date-format placeholders, not acronyms
]);

const PROPER_NOUN_ALLOWLIST = new Set([
  'ScanGov', 'Google', 'Chrome', 'Firefox', 'Safari', 'Edge', 'GitHub',
  'WCAG', 'ADA', 'Lighthouse', 'Core', 'Web', 'Vitals', 'JavaScript',
]);

const TERMINOLOGY = [
  { pattern: /\bcitizens?\b/gi, suggestion: 'users', severity: 'error' },
  { pattern: /\bvisitors?\b/gi, suggestion: 'users', severity: 'error' },
  { pattern: /\bgovernment services\b/gi, suggestion: 'services', severity: 'error' },
  { pattern: /\bgovernment records\b/gi, suggestion: 'data (or "confidential data")', severity: 'error' },
  { pattern: /\bwebsites?\b/gi, suggestion: 'digital properties/services (when referring broadly — a specific named site is fine)', severity: 'warn' },
];

function stripTags(line) {
  return line
    .replace(/\{%[\s\S]*?%\}/g, ' ')
    .replace(/\{\{[\s\S]*?\}\}/g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&rsquo;|&apos;/g, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripMarkdown(line) {
  return line
    .replace(/^#{1,6}\s+/, '')
    .replace(/`{1,3}[^`]*`{1,3}/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractHeadings(content, ext) {
  const headings = [];
  const lines = content.split('\n');
  lines.forEach((line, i) => {
    if (ext === '.md') {
      const m = line.match(/^#{1,6}\s+(.+)$/);
      if (m) headings.push({ line: i + 1, text: stripTags(m[1]) });
    } else {
      const re = /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi;
      let m;
      while ((m = re.exec(line))) {
        headings.push({ line: i + 1, text: stripTags(m[1]) });
      }
    }
  });
  return headings;
}

function checkSentenceCase(headings, violations) {
  headings.forEach(({ line, text }) => {
    const words = text.split(/\s+/).filter(Boolean);
    const flagged = [];
    words.forEach((word, i) => {
      if (i === 0) return;
      const clean = word.replace(/[^A-Za-z]/g, '');
      if (!/^[A-Z][a-z]+$/.test(clean)) return;
      if (PROPER_NOUN_ALLOWLIST.has(clean)) return;
      const prevClean = i > 0 ? words[i - 1].replace(/[^A-Za-z]/g, '') : '';
      const nextClean = i < words.length - 1 ? words[i + 1].replace(/[^A-Za-z]/g, '') : '';
      const adjacentCapitalized =
        /^[A-Z][a-z]+$/.test(prevClean) || /^[A-Z][a-z]+$/.test(nextClean);
      if (adjacentCapitalized) return; // likely a multi-word proper noun/name
      flagged.push(word);
    });
    // A single isolated capitalized word is usually a name or proper noun
    // (e.g. "Connect with Aaron", "GovX Awards") rather than a real title-case
    // heading, which typically capitalizes most of its words. Require 2+.
    if (flagged.length < 2) return;
    violations.push({
      line,
      severity: 'error',
      rule: 'sentence-case-headings',
      message: `Heading uses title case (${flagged.map((w) => `"${w}"`).join(', ')}): "${text}"`,
    });
  });
}

function checkOxfordComma(line, lineNo, violations) {
  // Heuristic only: can't tell a real 3-item series ("trends, practices and
  // ideas") from a 2-word compound sharing a list slot ("CMS and
  // integrations") or an appositive ("these two libraries, Bootstrap and
  // Font Awesome"). Warn, don't block.
  const re = /,\s+\w+\s+(and|or)\s+\w+/gi;
  let m;
  while ((m = re.exec(line))) {
    violations.push({
      line: lineNo,
      severity: 'warn',
      rule: 'oxford-comma',
      message: `Possible missing Oxford comma near "...${m[0].trim()}"`,
    });
  }
}

function checkTerminology(line, lineNo, violations) {
  TERMINOLOGY.forEach(({ pattern, suggestion, severity }) => {
    let m;
    pattern.lastIndex = 0;
    while ((m = pattern.exec(line))) {
      violations.push({
        line: lineNo,
        severity,
        rule: 'terminology',
        message: `"${m[0]}" — consider "${suggestion}"`,
      });
    }
  });
}

function findDefinedAcronyms(proseLines) {
  const defined = new Set();
  const re = /\(([A-Z]{2,6})[,)]/g;
  proseLines.forEach((line) => {
    let m;
    while ((m = re.exec(line))) defined.add(m[1]);
  });
  return defined;
}

// Checks whether an acronym is defined anywhere on the page (e.g. via a
// `(ACRONYM)` aside), not strictly before its first use. Templates that
// render frontmatter data (like an `faq:` array via an include) elsewhere
// in the page make strict, in-file-order "first use" unreliable to detect.
function checkAcronyms(line, lineNo, definedAcronyms, seen, violations) {
  const re = /\b([A-Z]{2,6})\b/g;
  let m;
  while ((m = re.exec(line))) {
    const acronym = m[1];
    if (ACRONYM_ALLOWLIST.has(acronym)) continue;
    if (seen.has(acronym)) continue;
    // Part of a domain name (e.g. "CA.gov"), not a prose acronym.
    if (/^\.(gov|com|org|net|io)\b/.test(line.slice(m.index + acronym.length))) continue;
    if (definedAcronyms.has(acronym)) continue;
    violations.push({
      line: lineNo,
      severity: 'error',
      rule: 'acronym-first-use',
      message: `"${acronym}" is never spelled out on this page, e.g. "Full Term (${acronym})"`,
    });
    seen.add(acronym); // only flag the first occurrence
  }
}

function countSyllables(word) {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  const groups = w.match(/[aeiouy]+/g);
  let count = groups ? groups.length : 1;
  if (w.endsWith('e') && count > 1) count -= 1;
  return Math.max(count, 1);
}

function fleschKincaidGrade(text) {
  const sentences = text.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
  const words = text.split(/\s+/).filter(Boolean);
  if (!sentences.length || !words.length) return null;
  const syllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
  return 0.39 * (words.length / sentences.length) + 11.8 * (syllables / words.length) - 15.59;
}

function checkPassiveVoice(line, lineNo, violations) {
  const re = /\b(is|are|was|were|been|being|be)\s+\w+ed\b/gi;
  let m;
  while ((m = re.exec(line))) {
    violations.push({
      line: lineNo,
      severity: 'warn',
      rule: 'passive-voice',
      message: `Possible passive voice: "${m[0]}"`,
    });
  }
}

function lintFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (!['.html', '.njk', '.md'].includes(ext)) return [];

  const content = fs.readFileSync(filePath, 'utf8');
  const violations = [];
  const headings = extractHeadings(content, ext);
  checkSentenceCase(headings, violations);

  const proseLines = []; // { lineNo, plain }
  const lines = content.split('\n');
  const frontmatterOpen = lines[0] && lines[0].trim() === '---';
  let frontmatterClosed = false;
  lines.forEach((rawLine, i) => {
    const lineNo = i + 1;
    if (frontmatterOpen && !frontmatterClosed) {
      if (lineNo > 1 && rawLine.trim() === '---') {
        frontmatterClosed = true;
        return;
      }
      // SEO/meta fields have their own constraints (length, no body markup) and
      // aren't reader-facing body prose — skip them. Everything else in
      // frontmatter (e.g. a `faq:` data array that renders into the page) is
      // real content and still gets checked.
      if (/^(title|description|ogImageAlt|ogTitle):\s/.test(rawLine)) return;
      // Bare single-token list items are taxonomy (topics:, indicators:, tags:),
      // not prose — a real prose list item is more than one word.
      if (/^\s*-\s+\S+\s*$/.test(rawLine)) return;
    }
    const plain = ext === '.md' ? stripMarkdown(stripTags(rawLine)) : stripTags(rawLine);
    if (!plain) return;
    proseLines.push({ lineNo, plain });
    checkOxfordComma(plain, lineNo, violations);
    checkTerminology(plain, lineNo, violations);
    checkPassiveVoice(plain, lineNo, violations);
  });

  const definedAcronyms = findDefinedAcronyms(proseLines.map((p) => p.plain));
  const seenAcronyms = new Set();
  proseLines.forEach(({ lineNo, plain }) => {
    checkAcronyms(plain, lineNo, definedAcronyms, seenAcronyms, violations);
  });

  const grade = fleschKincaidGrade(proseLines.map((p) => p.plain).join(' '));
  if (grade !== null && grade > 9) {
    violations.push({
      line: null,
      severity: 'warn',
      rule: 'reading-level',
      message: `Estimated reading grade level ${grade.toFixed(1)} exceeds the 9th-grade target`,
    });
  }

  return violations;
}

function main(files) {
  if (!files.length) {
    console.log('No content files to check.');
    return 0;
  }

  let hasError = false;
  files.forEach((file) => {
    let violations;
    try {
      violations = lintFile(file);
    } catch (err) {
      console.error(`Could not read ${file}: ${err.message}`);
      return;
    }
    if (!violations.length) return;

    console.log(`\n${file}`);
    violations
      .sort((a, b) => (a.line || 0) - (b.line || 0))
      .forEach((v) => {
        const loc = v.line ? `line ${v.line}` : 'document';
        console.log(`  [${v.severity}] ${loc} (${v.rule}): ${v.message}`);
        if (v.severity === 'error') hasError = true;
      });
  });

  return hasError ? 1 : 0;
}

if (require.main === module) {
  process.exit(main(process.argv.slice(2)));
}

module.exports = { lintFile, main };
