// ─────────────────────────────────────────────────────────────────────────
// デザイン案（Illustratorで作成し SVG 書き出し）を実行時にパースして、
// 川の形状・ノード位置・ラベル（文言/位置/改行）をそのまま使う。
// レイアウトを変えたいときは src/assets/watershed.svg を差し替えるだけでよい。
// ─────────────────────────────────────────────────────────────────────────

import rawSvg from '../assets/watershed.svg?raw';

export interface Pt { x: number; y: number }

export interface NodeGeo { id: string; x: number; y: number; r: number }
export interface Tspan { text: string; x: number; y: number }
export interface LabelGeo { nodeId: string; tx: number; ty: number; spans: Tspan[] }

// id を持たない円（デザイン上の新規ノード）はこの id に割り当てる
const UNNAMED_NODE_ID = 'movinggarden';

const doc = new DOMParser().parseFromString(rawSvg, 'image/svg+xml');
const svgEl = doc.querySelector('svg');

const vb = (svgEl?.getAttribute('viewBox') ?? '0 0 798.8 545.78')
  .trim().split(/[\s,]+/).map(Number);

export const VIEWBOX = { x: vb[0], y: vb[1], width: vb[2], height: vb[3] };

// 水路（本流＋すべての支流）の塗りパス
export const WATER_PATHS: string[] = Array.from(doc.querySelectorAll('path'))
  .map(p => p.getAttribute('d') ?? '')
  .filter(Boolean);

// ノード（円）
const NODE_GEO: Record<string, NodeGeo> = {};
for (const c of Array.from(doc.querySelectorAll('circle'))) {
  const id = c.getAttribute('id') || UNNAMED_NODE_ID;
  NODE_GEO[id] = {
    id,
    x: parseFloat(c.getAttribute('cx') ?? '0'),
    y: parseFloat(c.getAttribute('cy') ?? '0'),
    r: parseFloat(c.getAttribute('r') ?? '3.5'),
  };
}

function parseTranslate(t: string | null): Pt {
  const m = t?.match(/translate\(\s*([-\d.]+)[\s,]+([-\d.]+)\s*\)/);
  return m ? { x: parseFloat(m[1]), y: parseFloat(m[2]) } : { x: 0, y: 0 };
}

// テキストラベル → 最も近いノードに割り当てる（ラベルはノード id を持たないため）
const LABEL_BY_NODE: Record<string, LabelGeo> = {};
for (const t of Array.from(doc.querySelectorAll('text'))) {
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

// ── 公開アクセサ ──────────────────────────────────────────────────────────
export function getNodePosition(id: string): Pt {
  const n = NODE_GEO[id];
  return n ? { x: n.x, y: n.y } : { x: 0, y: 0 };
}

export function getNodeRadius(id: string): number {
  return NODE_GEO[id]?.r ?? 3.5;
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
