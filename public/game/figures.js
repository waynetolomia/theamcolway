/** Drawn question figures: an instrument gauge and a vessel's lights at night (SVG, no assets). */
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LIGHT = { white: '#fffbe8', red: '#ff4b3e', green: '#3dff8a' };
const fmt = n => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** A 270° dial from `min` to `max`, a tick every `step`, labels on major ticks, and the needle at `value`. */
function gauge({ label, unit, min, max, step, value }) {
  const steps = Math.round((max - min) / step);
  const labelEvery = [2, 4, 5, 10].find(n => steps / n <= 10 && steps % n === 0) || Math.ceil(steps / 10);
  const angle = v => -225 + (v - min) / (max - min) * 270; // degrees, 0 = pointing right
  const at = (deg, r) => { const rad = deg * Math.PI / 180; return [100 + r * Math.cos(rad), 100 + r * Math.sin(rad)]; };
  let ticks = '';
  for (let i = 0; i <= steps; i++) {
    const v = min + i * step, major = i % labelEvery === 0, [x1, y1] = at(angle(v), major ? 70 : 76), [x2, y2] = at(angle(v), 84);
    ticks += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#0f2a4a" stroke-width="${major ? 2.4 : 1.2}"/>`;
    if (major) { const [tx, ty] = at(angle(v), 56); ticks += `<text x="${tx.toFixed(1)}" y="${(ty + 4).toFixed(1)}" text-anchor="middle" font-size="11" fill="#0f2a4a">${fmt(+v.toFixed(2))}</text>`; }
  }
  const [nx, ny] = at(angle(value), 74);
  return `<svg class="question-figure gauge-figure" viewBox="0 0 200 200" role="img" aria-label="${esc(label)} gauge, scale ${fmt(min)} to ${fmt(max)} ${esc(unit)}">
    <circle cx="100" cy="100" r="94" fill="#f7f9fc" stroke="#0f2a4a" stroke-width="4"/>${ticks}
    <text x="100" y="140" text-anchor="middle" font-size="12" font-weight="700" fill="#0f2a4a">${esc(unit)}</text>
    <text x="100" y="156" text-anchor="middle" font-size="9" fill="#5f6f86">${esc(label)}</text>
    <line x1="100" y1="100" x2="${nx.toFixed(1)}" y2="${ny.toFixed(1)}" stroke="#b5483f" stroke-width="3.2" stroke-linecap="round"/>
    <circle cx="100" cy="100" r="6" fill="#0f2a4a"/></svg>`;
}

/** Lights against a night sky; the hull is too dark to see, as at sea. */
function lights({ lights: points = [] }) {
  const dots = points.map(({ color, x, y }) => `<circle cx="${x * 2}" cy="${y * 1.4}" r="13" fill="${LIGHT[color] || '#fff'}" opacity=".22"/><circle cx="${x * 2}" cy="${y * 1.4}" r="5.5" fill="${LIGHT[color] || '#fff'}"/>`).join('');
  const names = points.map(point => point.color).join(', ');
  return `<svg class="question-figure lights-figure" viewBox="0 0 200 140" role="img" aria-label="Night view showing lights: ${esc(names)}">
    <rect width="200" height="140" rx="12" fill="#06101f"/><line x1="0" y1="112" x2="200" y2="112" stroke="#16304f" stroke-width="2"/>${dots}</svg>`;
}

export function figureMarkup(figure) {
  if (!figure || typeof figure !== 'object') return '';
  if (figure.kind === 'gauge') return gauge(figure);
  if (figure.kind === 'lights') return lights(figure);
  return '';
}
