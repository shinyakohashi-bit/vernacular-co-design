// ─────────────────────────────────────────────────────────────────────────
// デザイン案（Illustratorで作成し SVG 書き出し）を実行時にパースして、
// 川の形状・ノード位置・色・ラベル（文言/位置/改行）・タイトル・凡例を取得する。
// レイアウトや色を変えたいときは src/assets/watershed.svg を差し替えるだけでよい。
// ─────────────────────────────────────────────────────────────────────────

import rawSvg from '../assets/watershed.svg?raw';

export interface Pt { x: number; y: number }
export interface Tspan { text: string; x: number; y: number }
export interface LabelGeo { nodeId: string; tx: number; ty: number; spans: Tspan[] }
export interface LegendEntry { color: string; label: string }

const doc = new DOMParser().parseFromString(rawSvg, 'image/svg+xml');
const svgEl = doc.querySelector('svg');

const vb = (svgEl?.getAttribute('viewBox') ?? '0 0 841.89 595.28')
  .trim().split(/[\s,]+/).map(Number);
export const VIEWBOX = { x: vb[0], y: vb[1], width: vb[2], height: vb[3] };

// ── スタイル定義（.cls-N → fill 色）を解析 ───────────────────────────────
const classFill: Record<string, string> = {};
{
  const styleText = doc.querySelector('style')?.textContent ?? '';
  const re = /\.(cls-\d+)\s*\{[^}]*?fill:\s*(#[0-9a-fA-F]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(styleText))) classFill[m[1]] = m[2];
}
function fillOf(el: Element): string {
  const cls = (el.getAttribute('class') ?? '').trim().split(/\s+/)[0];
  return classFill[cls] ?? '#6f6a5e';
}

// 凡例グループ（data-name 付きの円を含む <g>）。ノード/ラベルからは除外する。
const legendCircle = doc.querySelector('circle[data-name]');
const legendGroup = legendCircle ? legendCircle.parentElement : null;
const inLegend = (el: Element) => !!legendGroup && legendGroup.contains(el);

// ── 水路（本流＋すべての支流）の塗りパス ─────────────────────────────────
export const WATER_PATHS: string[] = Array.from(doc.querySelectorAll('path'))
  .map(p => p.getAttribute('d') ?? '')
  .filter(Boolean);

// ── ノード（円・id付き／凡例の円は除外）──────────────────────────────────
interface NodeGeo { x: number; y: number; r: number; color: string }
const NODE_GEO: Record<string, NodeGeo> = {};
for (const c of Array.from(doc.querySelectorAll('circle'))) {
  if (c.hasAttribute('data-name') || inLegend(c)) continue;
  const id = c.getAttribute('id');
  if (!id) continue;
  NODE_GEO[id] = {
    x: parseFloat(c.getAttribute('cx') ?? '0'),
    y: parseFloat(c.getAttribute('cy') ?? '0'),
    r: parseFloat(c.getAttribute('r') ?? '3.5'),
    color: fillOf(c),
  };
}

function parseTranslate(t: string | null): Pt {
  const m = t?.match(/translate\(\s*([-\d.]+)[\s,]+([-\d.]+)\s*\)/);
  return m ? { x: parseFloat(m[1]), y: parseFloat(m[2]) } : { x: 0, y: 0 };
}

// ── ノードラベル（cls-3・凡例外）→ 最も近いノードへ割り当て ─────────────
const LABEL_BY_NODE: Record<string, LabelGeo> = {};
for (const t of Array.from(doc.querySelectorAll('text'))) {
  if (inLegend(t)) continue;
  if (!(t.getAttribute('class') ?? '').includes('cls-3')) continue; // cls-2 はタイトル
  const { x: tx, y: ty } = parseTranslate(t.getAttribute('transform'));
  const spans: Tspan[] = Array.from(t.querySelectorAll('tspan')).map(s => ({
    text: s.textContent ?? '',
    x: parseFloat(s.getAttribute('x') ?? '0'),
    y: parseFloat(s.getAttribute('y') ?? '0'),
  }));
  if (spans.length === 0) spans.push({ text: t.textContent ?? '', x: 0, y: 0 });

  let best = '';
  let bestDist = Infinity;
  for (const id of Object.keys(NODE_GEO)) {
    const n = NODE_GEO[id];
    const dx = n.x - tx, dy = n.y - ty;
    const d = dx * dx + dy * dy;
    if (d < bestDist) { bestDist = d; best = id; }
  }
  if (best) LABEL_BY_NODE[best] = { nodeId: best, tx, ty, spans };
}

// ── タイトル（cls-2）────────────────────────────────────────────────────
export const TITLE = (doc.querySelector('text.cls-2')?.textContent ?? '').trim();

// ── 凡例（左下のグループ：色付き円＋ラベル）─────────────────────────────
export const LEGEND: LegendEntry[] = (() => {
  if (!legendGroup) return [];
  const texts = Array.from(legendGroup.querySelectorAll('text')).map(t => ({
    y: parseTranslate(t.getAttribute('transform')).y,
    label: (t.textContent ?? '').trim(),
  }));
  const entries = Array.from(legendGroup.querySelectorAll('circle')).map(c => {
    const cy = parseFloat(c.getAttribute('cy') ?? '0');
    let label = '';
    let bestDy = Infinity;
    for (const t of texts) {
      const dy = Math.abs(t.y - cy);
      if (dy < bestDy) { bestDy = dy; label = t.label; }
    }
    return { color: fillOf(c), label, cy };
  });
  entries.sort((a, b) => a.cy - b.cy);
  return entries.map(e => ({ color: e.color, label: e.label }));
})();

// ── 公開アクセサ ──────────────────────────────────────────────────────────
export function getNodePosition(id: string): Pt {
  const n = NODE_GEO[id];
  return n ? { x: n.x, y: n.y } : { x: 0, y: 0 };
}
export function getNodeRadius(id: string): number {
  return NODE_GEO[id]?.r ?? 3.5;
}
export function getNodeColor(id: string): string {
  return NODE_GEO[id]?.color ?? '#6f6a5e';
}
export function getLabel(id: string): LabelGeo | undefined {
  return LABEL_BY_NODE[id];
}
export function getWaterPaths(): string[] {
  return WATER_PATHS;
}
export function getEddyPos(): Pt {
  return getNodePosition('takeno');
}
export function getSourcePos(): Pt {
  return getNodePosition('nagomi');
}
export function getContentBounds() {
  return {
    minX: VIEWBOX.x,
    minY: VIEWBOX.y,
    maxX: VIEWBOX.x + VIEWBOX.width,
    maxY: VIEWBOX.y + VIEWBOX.height,
  };
}
