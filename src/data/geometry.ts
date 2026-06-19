// ─────────────────────────────────────────────────────────────────────────
// 流域ジオメトリ生成
//
// 本流は「左上（源流）→ 右下（河口）」の対角線上に、強さの異なる正弦波と
// 端で減衰する包絡線を重ねた非対称な蛇行として描く。支流は本流を4区間に分け、
// テキスト順を保ったまま、固定シードの擬似乱数で区間内に不等間隔・非対称に散らす。
// シード（LAYOUT_SEED）を差し替えるだけで配置を再ロールできる。
// ─────────────────────────────────────────────────────────────────────────

import { NODES } from './nodes';

export interface Point { x: number; y: number }

// ── 再現性のための擬似乱数（mulberry32）──────────────────────────────────
export const LAYOUT_SEED = 0x5eed_2a17;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── 本流の端点と蛇行 ────────────────────────────────────────────────────
const SOURCE: Point = { x: 280, y: 320 };
const MOUTH: Point = { x: 1900, y: 1480 };
const SAMPLES = 220;

const diag = { x: MOUTH.x - SOURCE.x, y: MOUTH.y - SOURCE.y };
const diagLen = Math.hypot(diag.x, diag.y);
const diagDir = { x: diag.x / diagLen, y: diag.y / diagLen };
const diagPerp = { x: -diagDir.y, y: diagDir.x };

// 対角線に直交する向きへの蛇行量（決定論的・非対称）。
// 端（源流・河口）は包絡線で静め、中間で振らせる。
function meander(u: number): number {
  const env = 0.30 + 0.70 * Math.sin(Math.PI * u);
  return (
    env *
    (158 * Math.sin(1.22 * Math.PI * u + 0.65) +
      82 * Math.sin(2.85 * Math.PI * u + 2.35) -
      44 * Math.sin(5.1 * Math.PI * u + 4.1) +
      26 * Math.sin(8.3 * Math.PI * u + 1.2))
  );
}

const CENTERLINE: Point[] = (() => {
  const pts: Point[] = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const u = i / SAMPLES;
    const bx = SOURCE.x + diag.x * u;
    const by = SOURCE.y + diag.y * u;
    const m = meander(u);
    pts.push({ x: bx + diagPerp.x * m, y: by + diagPerp.y * m });
  }
  return pts;
})();

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

function pointAt(u: number): Point {
  u = clamp(u, 0, 1);
  const f = u * SAMPLES;
  const i = Math.floor(f);
  const t = f - i;
  const a = CENTERLINE[i];
  const b = CENTERLINE[Math.min(SAMPLES, i + 1)];
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function tangentAt(u: number): Point {
  const du = 0.004;
  const a = pointAt(u - du);
  const b = pointAt(u + du);
  const dx = b.x - a.x, dy = b.y - a.y;
  const l = Math.hypot(dx, dy) || 1;
  return { x: dx / l, y: dy / l };
}

// ── 本流ノードの位置（媒介変数 u）と区間 ─────────────────────────────────
const MAIN_U: Record<string, number> = {
  nagomi: 0.02,
  assemblage: 0.30,
  drift: 0.57,
  weaving: 0.83,
};
const MOUTH_U = 1;

// 区間 A: 源流→本流1 / B: 本流1→本流2 / C: 本流2→本流3 / D: 本流3→河口
const REGIONS: Record<string, [number, number]> = {
  A: [MAIN_U.nagomi, MAIN_U.assemblage],
  B: [MAIN_U.assemblage, MAIN_U.drift],
  C: [MAIN_U.drift, MAIN_U.weaving],
  D: [MAIN_U.weaving, MOUTH_U],
};

// テキスト順（上流→下流）。eddy（竹野再訪）は本流上の渦として扱う。
const TRIB_ORDER: { id: string; region: keyof typeof REGIONS; eddy?: boolean }[] = [
  { id: 'gardener', region: 'A' },
  { id: 'posthuman', region: 'A' },
  { id: 'aizu', region: 'A' },
  { id: 'syneco', region: 'B' },
  { id: 'minamata', region: 'B' },
  { id: 'takeno', region: 'B', eddy: true },
  { id: 'toolview', region: 'B' },
  { id: 'designothernames', region: 'C' },
  { id: 'resourceful', region: 'C' },
  { id: 'fudo', region: 'C' },
  { id: 'watershed', region: 'D' },
];

interface TribLayout {
  id: string;
  eddy: boolean;
  joinU: number;
  join: Point;
  head: Point;
  side: number;            // +1 / -1（岸）
  outward: Point;          // ラベルを置く外向き単位ベクトル
  path: string;            // 支流の中心線（描画用）
  polygon: string;         // 可変幅 fill
}

// ── 区間内に支流をテキスト順で配置（不等間隔・非対称、シード固定）─────────
const rng = mulberry32(LAYOUT_SEED);

const TRIBS: Record<string, TribLayout> = {};

(() => {
  // 区間ごとにメンバーを集める
  const byRegion: Record<string, typeof TRIB_ORDER> = { A: [], B: [], C: [], D: [] };
  for (const t of TRIB_ORDER) byRegion[t.region].push(t);

  for (const region of Object.keys(byRegion)) {
    const members = byRegion[region];
    const [u0, u1] = REGIONS[region];
    const span = u1 - u0;
    const margin = span * 0.16;
    const lo = u0 + margin;
    const hi = u1 - margin;
    const count = members.length;

    members.forEach((m, k) => {
      // テキスト順は保持。区間内の位置だけジッターで散らす。
      const center = count === 1 ? 0.5 : (k + 0.5) / count;
      const jitter = (rng() - 0.5) * (0.7 / count);
      const u = clamp(lo + (hi - lo) * clamp(center + jitter, 0.02, 0.98), 0.01, 0.99);

      const join = pointAt(u);
      const tan = tangentAt(u);
      const perp = { x: -tan.y, y: tan.x };

      // 岸は交互にしない（シード任せ／同じ側が連続してよい）
      const side = rng() < 0.5 ? -1 : 1;
      const outward = { x: perp.x * side, y: perp.y * side };

      // 支流ごとに長さ・進入角・湾曲を散らす
      const sideDist = 200 + rng() * 180;   // 本流から離す距離
      const upDist = 130 + rng() * 170;      // 上流方向へのオフセット（浅い進入角を作る）
      const curve = 0.30 + rng() * 0.55;

      // 源頭（支流ノード）は上流側かつ岸の外側に置く
      const head: Point = {
        x: join.x + outward.x * sideDist - tan.x * upDist,
        y: join.y + outward.y * sideDist - tan.y * upDist,
      };

      // 合流点での接線が本流の下流向き（tan）に近づくよう制御点を取る
      const handle = upDist * (0.55 + curve * 0.4);
      const cp2 = { x: join.x - tan.x * handle, y: join.y - tan.y * handle };
      const cp1 = {
        x: head.x + (join.x - head.x) * 0.32 + outward.x * sideDist * 0.18 * curve,
        y: head.y + (join.y - head.y) * 0.32 + outward.y * sideDist * 0.18 * curve,
      };

      const path = `M ${head.x.toFixed(1)} ${head.y.toFixed(1)} C ${cp1.x.toFixed(1)} ${cp1.y.toFixed(1)}, ${cp2.x.toFixed(1)} ${cp2.y.toFixed(1)}, ${join.x.toFixed(1)} ${join.y.toFixed(1)}`;
      const polygon = tributaryPolygon([head, cp1, cp2, join]);

      TRIBS[m.id] = {
        id: m.id,
        eddy: !!m.eddy,
        joinU: u,
        join,
        head,
        side,
        outward,
        path,
        polygon,
      };
    });
  }
})();

// ── 可変幅ポリゴンのユーティリティ ───────────────────────────────────────
type Cubic = [Point, Point, Point, Point];

function evalCubic([p0, p1, p2, p3]: Cubic, t: number): Point {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  };
}

function buildRibbon(pts: Point[], widths: number[]): string {
  const left: Point[] = [];
  const right: Point[] = [];
  for (let i = 0; i < pts.length; i++) {
    const w = widths[i] / 2;
    let nx: number, ny: number;
    if (i === 0) { nx = pts[1].x - pts[0].x; ny = pts[1].y - pts[0].y; }
    else if (i === pts.length - 1) { nx = pts[i].x - pts[i - 1].x; ny = pts[i].y - pts[i - 1].y; }
    else { nx = pts[i + 1].x - pts[i - 1].x; ny = pts[i + 1].y - pts[i - 1].y; }
    const l = Math.hypot(nx, ny) || 1;
    const px = -ny / l, py = nx / l;
    left.push({ x: pts[i].x + px * w, y: pts[i].y + py * w });
    right.push({ x: pts[i].x - px * w, y: pts[i].y - py * w });
  }
  const all = [...left, ...right.reverse()];
  return all.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') + ' Z';
}

function tributaryPolygon(cubic: Cubic): string {
  const n = 34;
  const pts: Point[] = [];
  const widths: number[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push(evalCubic(cubic, t));
    // 源頭は細く、合流部に向けて太らせて本流になじませる
    widths.push(2.4 + 6.2 * t);
  }
  return buildRibbon(pts, widths);
}

// ── 本流の幅（合流＝ガウス膨らみ、淵＝局所拡幅、河口＝三角州）─────────────
const confluenceUs = Object.values(TRIBS).filter(t => !t.eddy).map(t => t.joinU);
const eddyU = TRIBS['takeno']?.joinU ?? MAIN_U.drift;

function mainWidth(u: number): number {
  let w = 6 + 70 * Math.pow(u, 1.18);
  for (const cu of confluenceUs) {
    const z = (u - cu) / 0.02;
    w += 7 * Math.exp(-(z * z));
  }
  // 淵：局所的に膨らませる
  const ze = (u - eddyU) / 0.014;
  w += 14 * Math.exp(-(ze * ze));
  // 河口の三角州的な広がり
  if (u > 0.93) w += (u - 0.93) / 0.07 * 40;
  return w;
}

// ── 公開API ──────────────────────────────────────────────────────────────
export function getMainRiverPath(): string {
  return CENTERLINE.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
}

export function getMainRiverPolygon(): string {
  const widths = CENTERLINE.map((_, i) => mainWidth(i / SAMPLES));
  return buildRibbon(CENTERLINE, widths);
}

export function getNodePosition(id: string): Point {
  if (id in MAIN_U) return pointAt(MAIN_U[id]);
  if (id === 'estuary') return { ...MOUTH };
  const t = TRIBS[id];
  if (t) {
    if (t.eddy) {
      // 淵ノードは渦のすぐ脇（ラベルが川と重ならないよう外側へ少し）
      return { x: t.join.x + t.outward.x * 46, y: t.join.y + t.outward.y * 46 };
    }
    return t.head;
  }
  return { x: 700, y: 1000 };
}

// ラベルを置く外向き方向（単位ベクトル）。本流ノードは上流寄りの外側へ。
export function getLabelDir(id: string): Point {
  const t = TRIBS[id];
  if (t) return t.outward;
  // 本流／源流／河口：流れの左手側（上側）に逃がす
  const u = id === 'estuary' ? MOUTH_U : (MAIN_U[id] ?? 0.5);
  const tan = tangentAt(u);
  return { x: -tan.y, y: tan.x };
}

export function getEddy(): { pos: Point; tan: Point } | null {
  const t = TRIBS['takeno'];
  if (!t) return null;
  return { pos: t.join, tan: tangentAt(t.joinU) };
}

export function getTributaryPath(id: string): string | null {
  const t = TRIBS[id];
  return t && !t.eddy ? t.path : null;
}

export function getTributaryPolygon(id: string): string | null {
  const t = TRIBS[id];
  return t && !t.eddy ? t.polygon : null;
}

export function getEstuary(): Point { return { ...MOUTH }; }

export function getSourcePoint(): Point { return pointAt(MAIN_U.nagomi); }

// 伏流水（地下水脈）：直接合流しない響き合いを地表下の弧で結ぶ
export function getSubterraneanPath(fromId: string, toId: string): string {
  const a = getNodePosition(fromId);
  const b = getNodePosition(toId);
  // 地下を大きく回り込む弧
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  // 流れの外側（下側）へ膨らませる
  const bulge = 0.32 * len;
  const nx = -dy / len, ny = dx / len;
  const sign = (a.y + b.y) / 2 > 1000 ? -1 : 1;
  const c1 = { x: a.x + dx * 0.25 + nx * bulge * sign, y: a.y + dy * 0.25 + ny * bulge * sign };
  const c2 = { x: a.x + dx * 0.75 + nx * bulge * sign, y: a.y + dy * 0.75 + ny * bulge * sign };
  return `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} C ${c1.x.toFixed(1)} ${c1.y.toFixed(1)}, ${c2.x.toFixed(1)} ${c2.y.toFixed(1)}, ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
}

// ── 全コンテンツを内包するバウンディングボックス（fit用）──────────────────
export function getContentBounds() {
  const xs: number[] = [SOURCE.x, MOUTH.x];
  const ys: number[] = [SOURCE.y, MOUTH.y];
  for (const n of NODES) {
    const p = getNodePosition(n.id);
    xs.push(p.x); ys.push(p.y);
  }
  // 蛇行の振れも含める
  for (const p of CENTERLINE) { xs.push(p.x); ys.push(p.y); }
  return {
    minX: Math.min(...xs), maxX: Math.max(...xs),
    minY: Math.min(...ys), maxY: Math.max(...ys),
  };
}

export function getCanvasSize() {
  const b = getContentBounds();
  return { width: b.maxX - b.minX + 600, height: b.maxY - b.minY + 600 };
}
