# content-lint

Shared, dependency-free content-style checks for ScanGov site pull requests. Enforces the deterministic subset of the `content-style` skill ([ScanGov/skills](https://github.com/ScanGov/skills)): sentence-case headings, acronym-first-use, and gov-only terminology block the PR. Oxford comma, broad "website" usage, reading level, and passive voice are reported as warnings — they're heuristic and can false-positive (e.g. Oxford comma can't tell a real 3-item series from a 2-word compound sharing a list slot).

## Usage

```sh
node check-content.js content/index.html content/about.md
```

Exits `1` if any `error`-severity violation is found; `warn`-severity findings print but don't fail the run.

## Used by

Each site's `.github/workflows/content-lint.yml` checks out this repo alongside its own and runs this script against the PR's changed `content/`, `_includes/`, and `*.md` files.
