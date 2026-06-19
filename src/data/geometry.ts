import { NODES, MAIN_ORDER } from './nodes';

export interface Point { x: number; y: number }

const CANVAS = { width: 2000, height: 2800 };

const MAIN_SPINE: Record<string, Point> = {
  nagomi:     { x: 920, y: 240 },
  assemblage: { x: 800, y: 820 },
  drift:      { x: 940, y: 1500 },
  weaving:    { x: 840, y: 2160 },
};

const ESTUARY: Point = { x: 870, y: 2600 };

const TRIBUTARY_POSITIONS: Record<string, Point> = {
  watershed:        { x: 1380, y: 120 },
  gardener:         { x: 420, y: 380 },
  posthuman:        { x: 1260, y: 540 },
  aizu:             { x: 440, y: 780 },
  syneco:           { x: 480, y: 1140 },
  toolview:         { x: 1340, y: 1260 },
  takeno:           { x: 940, y: 1500 },
  minamata:         { x: 460, y: 1780 },
  designothernames: { x: 1340, y: 1820 },
  resourceful:      { x: 1380, y: 2020 },
  fudo:             { x: 420, y: 2060 },
};

export function getNodePosition(id: string): Point {
  return MAIN_SPINE[id] ?? TRIBUTARY_POSITIONS[id] ?? { x: 900, y: 1200 };
}

export function getCanvasSize() { return CANVAS; }
export function getEstuary() { return ESTUARY; }

export function getMainRiverPath(): string {
  const pts = [...MAIN_ORDER.map(id => MAIN_SPINE[id]), ESTUARY];
  let d = `M ${pts[0].x} ${pts[0].y}`;
  const controls: [Point, Point][] = [
    [{ x: 860, y: 400 }, { x: 760, y: 660 }],
    [{ x: 860, y: 1000 }, { x: 1000, y: 1280 }],
    [{ x: 970, y: 1700 }, { x: 880, y: 1960 }],
    [{ x: 830, y: 2340 }, { x: 860, y: 2500 }],
  ];
  for (let i = 0; i < pts.length - 1; i++) {
    const [cp1, cp2] = controls[i];
    const b = pts[i + 1];
    d += ` C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${b.x} ${b.y}`;
  }
  return d;
}

export function getMainRiverPolygon(): string {
  const path = getMainRiverPath();
  const pts = samplePath(path, 120);
  const widths = pts.map((_, i) => {
    const t = i / (pts.length - 1);
    const base = 5 + t * 52;
    const c1 = gaussBump(t, 0.30, 0.035) * 8;
    const c2 = gaussBump(t, 0.54, 0.035) * 12;
    const c3 = gaussBump(t, 0.78, 0.035) * 14;
    return base + c1 + c2 + c3;
  });
  return buildPolygon(pts, widths);
}

function gaussBump(t: number, center: number, sigma: number): number {
  return Math.exp(-((t - center) ** 2) / (2 * sigma * sigma));
}

function buildPolygon(pts: Point[], widths: number[]): string {
  const left: Point[] = [];
  const right: Point[] = [];
  for (let i = 0; i < pts.length; i++) {
    const w = widths[i];
    const [px, py] = perp(pts, i);
    left.push({ x: pts[i].x + px * w, y: pts[i].y + py * w });
    right.push({ x: pts[i].x - px * w, y: pts[i].y - py * w });
  }
  const all = [...left, ...right.reverse()];
  return all.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') + ' Z';
}

function perp(pts: Point[], i: number): [number, number] {
  let nx: number, ny: number;
  if (i === 0) { nx = pts[1].x - pts[0].x; ny = pts[1].y - pts[0].y; }
  else if (i === pts.length - 1) { nx = pts[i].x - pts[i - 1].x; ny = pts[i].y - pts[i - 1].y; }
  else { nx = pts[i + 1].x - pts[i - 1].x; ny = pts[i + 1].y - pts[i - 1].y; }
  const len = Math.sqrt(nx * nx + ny * ny) || 1;
  return [-ny / len, nx / len];
}

type CubicSeg = [Point, Point, Point, Point];

function samplePath(d: string, n: number): Point[] {
  const segs = parseCubicBeziers(d);
  const segLens = segs.map(s => approxLen(s));
  const totalLen = segLens.reduce((a, b) => a + b, 0);
  const pts: Point[] = [];
  let segIdx = 0, segStart = 0;
  for (let i = 0; i <= n; i++) {
    const target = (i / n) * totalLen;
    while (segIdx < segs.length - 1 && segStart + segLens[segIdx] < target) {
      segStart += segLens[segIdx]; segIdx++;
    }
    const t = Math.min(1, (target - segStart) / (segLens[segIdx] || 1));
    pts.push(evalCubic(segs[segIdx], t));
  }
  return pts;
}

function parseCubicBeziers(d: string): CubicSeg[] {
  const segs: CubicSeg[] = [];
  const parts = d.trim().split(/(?=[MC])/);
  let cur: Point = { x: 0, y: 0 };
  for (const part of parts) {
    const cmd = part[0];
    const nums = part.slice(1).trim().split(/[\s,]+/).map(Number);
    if (cmd === 'M') { cur = { x: nums[0], y: nums[1] }; }
    else if (cmd === 'C') {
      const end = { x: nums[4], y: nums[5] };
      segs.push([cur, { x: nums[0], y: nums[1] }, { x: nums[2], y: nums[3] }, end]);
      cur = end;
    }
  }
  return segs;
}

function evalCubic([p0, p1, p2, p3]: CubicSeg, t: number): Point {
  const u = 1 - t;
  return {
    x: u*u*u*p0.x + 3*u*u*t*p1.x + 3*u*t*t*p2.x + t*t*t*p3.x,
    y: u*u*u*p0.y + 3*u*u*t*p1.y + 3*u*t*t*p2.y + t*t*t*p3.y,
  };
}

function approxLen(seg: CubicSeg): number {
  let len = 0, prev = seg[0];
  for (let i = 1; i <= 20; i++) {
    const p = evalCubic(seg, i / 20);
    len += Math.sqrt((p.x - prev.x) ** 2 + (p.y - prev.y) ** 2);
    prev = p;
  }
  return len;
}

interface TribCurve { cp1: Point; cp2: Point }

const TRIBUTARY_CURVES: Record<string, TribCurve> = {
  gardener:         { cp1: { x: 380, y: 540 },  cp2: { x: 620, y: 720 } },
  posthuman:        { cp1: { x: 1200, y: 640 }, cp2: { x: 1000, y: 780 } },
  aizu:             { cp1: { x: 520, y: 800 },  cp2: { x: 680, y: 820 } },
  syneco:           { cp1: { x: 540, y: 1300 }, cp2: { x: 760, y: 1440 } },
  toolview:         { cp1: { x: 1280, y: 1380 }, cp2: { x: 1080, y: 1470 } },
  minamata:         { cp1: { x: 420, y: 1940 }, cp2: { x: 640, y: 2080 } },
  designothernames: { cp1: { x: 1280, y: 1960 }, cp2: { x: 1040, y: 2100 } },
  resourceful:      { cp1: { x: 1300, y: 2100 }, cp2: { x: 1020, y: 2140 } },
  fudo:             { cp1: { x: 460, y: 2140 },  cp2: { x: 660, y: 2160 } },
  watershed:        { cp1: { x: 1300, y: 160 },  cp2: { x: 1060, y: 220 } },
};

export function getTributaryPath(id: string): string | null {
  const node = NODES.find(n => n.id === id);
  if (!node?.joinsAt || node.kind === 'eddy') return null;
  const from = getNodePosition(id);
  const to = getNodePosition(node.joinsAt);
  const curve = TRIBUTARY_CURVES[id];
  if (curve) {
    return `M ${from.x} ${from.y} C ${curve.cp1.x} ${curve.cp1.y}, ${curve.cp2.x} ${curve.cp2.y}, ${to.x} ${to.y}`;
  }
  const dx = to.x - from.x, dy = to.y - from.y;
  return `M ${from.x} ${from.y} C ${from.x + dx * 0.3} ${from.y + dy * 0.6}, ${from.x + dx * 0.7} ${from.y + dy * 0.85}, ${to.x} ${to.y}`;
}

export function getTributaryPolygon(id: string): string | null {
  const pathD = getTributaryPath(id);
  if (!pathD) return null;
  const pts = samplePath(pathD, 40);
  const widths = pts.map((_, i) => {
    const t = i / (pts.length - 1);
    return 2 + (1 - t) * 5;
  });
  return buildPolygon(pts, widths);
}

export function getSubterraneanPath(fromId: string, toId: string): string {
  const a = getNodePosition(fromId);
  const b = getNodePosition(toId);
  if (fromId === 'minamata' && toId === 'nagomi') {
    return `M ${a.x} ${a.y} C ${a.x + 260} ${a.y - 400}, ${b.x + 300} ${b.y + 500}, ${b.x} ${b.y}`;
  }
  if (fromId === 'gardener' && toId === 'weaving') {
    return `M ${a.x} ${a.y} C ${a.x - 140} ${a.y + 600}, ${b.x - 200} ${b.y - 500}, ${b.x} ${b.y}`;
  }
  const midX = Math.max(a.x, b.x) + 150;
  const midY = (a.y + b.y) / 2;
  return `M ${a.x} ${a.y} Q ${midX} ${midY}, ${b.x} ${b.y}`;
}
