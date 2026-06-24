# ScanGov components

Shared Eleventy templates and includes used across ScanGov sites.

## Usage

Copy templates to each site's `content/` directory. Copy `_includes/` files to each site's `_includes/` directory.

All templates require `layout: false` in front matter to prevent directory-level layout defaults from wrapping non-HTML output.

## Templates

### `robots.njk`

Outputs `/robots.txt`. Allows all crawlers and references the sitemap.

Requires in `site.json`:
- `url` — site base URL

### `security.njk` + `security-root.njk`

Outputs `/.well-known/security.txt` (canonical) and `/security.txt` (convenience copy). Standard security disclosure file per [securitytxt.org](https://securitytxt.org/). Both files serve identical content; the Canonical field in both points to `/.well-known/security.txt`. Two files are required because GitHub Pages is static and cannot redirect between paths.

Requires in `site.json`:
- `url` — site base URL
- `org-url` — organization URL (used for Contact and Policy fields)
- `securityExpires` — ISO 8601 expiry date (e.g. `2027-01-01T00:00:00.000Z`)

### `sitemap.njk`

Outputs `/sitemap.xml`. Includes all Eleventy collection pages except those with `sitemap: false` in front matter. Uses `modified` date when available, falls back to `date`.

Requires in `site.json`:
- `url` — site base URL

## Includes

| File | Description |
|------|-------------|
| `analytics.html` | Google Analytics script (requires `site.gaId`) |
| `favicon.html` | Favicon link tags |
| `footer.html` | Site footer |
| `header.html` | Site `<head>` with meta, OG, schema |
| `jumbotron.html` | Page hero/banner |
| `jumbotron-default.html` | Default page hero |
| `nav.html` | Site navigation |
| `related.html` | Related content links |
| `search.html` | Search UI |
| `sidenav.html` | Sidebar navigation |
| `style.html` | CSS link tags |
| `js.html` | JS script tags |
| `toc.html` | Table of contents |
| `toc-mobile.html` | Mobile table of contents |
| `actions.html` | Action buttons |
| `audio.html` | Audio player |
| `connect.html` | Social/connect links |
| `details.html` | Expandable details |
| `feedback.html` | Feedback form |
| `filter-pill.html` | Filter pill UI |
| `image.html` | Responsive image |
| `post-badges.html` | Post metadata badges |
| `post-links.html` | Post navigation links |
| `scangov.html` | ScanGov branding |
| `schema-docs.html` | JSON-LD schema for docs pages |
| `404.html` | 404 error page |
