/* Wires up report charts rendered by _includes/report-chart.html.
   Mirrors the styling approach my.scangov.com's Pulse feature uses
   (public/js/scorechart.js): read theme via the data-bs-theme attribute,
   pull grid/text color from the same --bs-* custom properties scangov.css
   already defines, and use Chart.js's own built-in Legend plugin
   (position: 'bottom') rather than hand-built HTML — Chart.js has no
   separate "attribution" concept, so ScanGov credit is a plain HTML line
   in the include, not a canvas plugin.

   Bar/muted colors still come from --report-chart-bar/--report-chart-muted
   on :root (see scangov.css) — colors are read once at load; a live theme
   toggle after that won't recolor an already-rendered chart.

   Chart data comes from the canvas's own `data-rows` attribute, not a
   sibling <script type="application/json">. markdown-it doesn't treat a
   bare <canvas> as block-level HTML, so it wraps it in a stray <p>, which
   puts a JSON sibling script outside that <p> instead of next to the
   canvas — nextElementSibling silently found nothing, and no chart ever
   rendered. Keeping the data on the canvas itself sidesteps DOM
   adjacency entirely. */
document.addEventListener('DOMContentLoaded', () => {
  if (typeof Chart === 'undefined') return;

  const rootStyle = getComputedStyle(document.documentElement);
  const barColor = rootStyle.getPropertyValue('--report-chart-bar').trim() || '#2a78d6';
  const mutedColor = rootStyle.getPropertyValue('--report-chart-muted').trim() || '#8a8986';
  const textColor = rootStyle.getPropertyValue('--bs-secondary-color').trim();
  const gridColor = rootStyle.getPropertyValue('--bs-border-color').trim();

  document.querySelectorAll('canvas[data-report-chart]').forEach((canvas) => {
    if (!canvas.dataset.rows) return;

    let payload;
    try {
      payload = JSON.parse(canvas.dataset.rows);
    } catch (err) {
      return;
    }

    const rows = payload.rows || [];
    const total = payload.total || rows.reduce((sum, row) => sum + row.value, 0);
    const mainLabel = payload.mainLabel || '';
    const mutedLabel = payload.mutedLabel || '';

    new Chart(canvas, {
      type: 'bar',
      data: {
        labels: rows.map((row) => row.label),
        datasets: [{
          data: rows.map((row) => row.value),
          backgroundColor: rows.map((row) => (row.muted ? mutedColor : barColor)),
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        plugins: {
          legend: {
            display: !!(mainLabel || mutedLabel),
            position: 'bottom',
            labels: {
              color: textColor,
              boxWidth: 12,
              generateLabels: () => {
                // Chart.js's legend draws each item's text using that
                // item's own `fontColor` — it does NOT fall back to the
                // shared `labels.color` option for custom-generated items.
                // Omitting it left the canvas default (black) regardless
                // of theme.
                const items = [];
                if (mainLabel) items.push({ text: mainLabel, fillStyle: barColor, strokeStyle: barColor, fontColor: textColor });
                if (mutedLabel) items.push({ text: mutedLabel, fillStyle: mutedColor, strokeStyle: mutedColor, fontColor: textColor });
                return items;
              },
            },
          },
          tooltip: {
            callbacks: {
              label(ctx) {
                const pct = total ? ((ctx.parsed.x / total) * 100).toFixed(1) : 0;
                return `${ctx.parsed.x.toLocaleString()} (${pct}%)`;
              },
            },
          },
        },
        scales: {
          x: { beginAtZero: true, ticks: { color: textColor }, grid: { color: gridColor } },
          y: { ticks: { color: textColor }, grid: { color: gridColor } },
        },
      },
    });
  });
});
