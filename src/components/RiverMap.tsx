import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { NODES, MAIN_ORDER, SUBTERRANEAN } from '../data/nodes';
import {
  getNodePosition,
  getMainRiverPolygon,
  getMainRiverPath,
  getTributaryPolygon,
  getTributaryPath,
  getSubterraneanPath,
  getEstuary,
  getSourcePoint,
  getEddy,
  getLabelDir,
  getContentBounds,
} from '../data/geometry';
import { themeColor } from '../utils/theme';
import type { RiverNode } from '../data/nodes';
import './RiverMap.css';

interface Props {
  onSelect: (node: RiverNode | null) => void;
  selectedId: string | null;
}

export default function RiverMap({ onSelect, selectedId }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const dragging = useRef(false);
  const moved = useRef(false);
  const lastPt = useRef({ x: 0, y: 0 });
  const labelsRef = useRef<LabelBox[]>([]);

  const fitToView = useCallback(() => {
    if (!svgRef.current) return;
    const { width, height } = svgRef.current.getBoundingClientRect();
    const b = getContentBounds();
    // 大きなラベルもはみ出さないよう、ラベルのピル箱も含めて枠を取る
    let minX = b.minX, maxX = b.maxX, minY = b.minY, maxY = b.maxY;
    for (const l of labelsRef.current) {
      minX = Math.min(minX, l.pillX);
      maxX = Math.max(maxX, l.pillX + l.w);
      minY = Math.min(minY, l.cy - l.h / 2);
      maxY = Math.max(maxY, l.cy + l.h / 2);
    }
    const pad = 60;
    const cw = maxX - minX + pad * 2;
    const ch = maxY - minY + pad * 2;
    const fit = Math.min(width / cw, height / ch);
    // ノードが小さくなりすぎてタップ不能にならないよう下限を設ける
    const MIN_SCALE = 0.26;
    const s = Math.max(fit, MIN_SCALE);

    if (s <= fit + 1e-6) {
      // 全体が収まる（デスクトップ等）：中央に配置
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      setTransform({ scale: s, x: width / 2 - cx * s, y: height / 2 - cy * s });
    } else {
      // 収まらない（狭い画面）：源流を左上寄りに置き、下流へ辿れるように
      const src = getSourcePoint();
      setTransform({ scale: s, x: width * 0.24 - src.x * s, y: height * 0.14 - src.y * s });
    }
  }, []);

  useEffect(() => { fitToView(); }, [fitToView]);
  useEffect(() => {
    const onResize = () => fitToView();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [fitToView]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as Element).closest('.node-hit')) return;
    dragging.current = true;
    moved.current = false;
    lastPt.current = { x: e.clientX, y: e.clientY };
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - lastPt.current.x;
    const dy = e.clientY - lastPt.current.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) moved.current = true;
    lastPt.current = { x: e.clientX, y: e.clientY };
    setTransform(t => ({ ...t, x: t.x + dx, y: t.y + dy }));
  }, []);

  const onPointerUp = useCallback(() => { dragging.current = false; }, []);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const rect = svgRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    setTransform(t => {
      const ns = Math.max(0.1, Math.min(4, t.scale * factor));
      return {
        scale: ns,
        x: mx - (mx - t.x) * (ns / t.scale),
        y: my - (my - t.y) * (ns / t.scale),
      };
    });
  }, []);

  const subHighlight = selectedId
    ? SUBTERRANEAN.filter(s => s.from === selectedId || s.to === selectedId).flatMap(s => [s.from, s.to])
    : [];

  const estuary = getEstuary();
  const eddy = getEddy();
  const sideTributaries = NODES.filter(n => n.kind === 'tributary');

  // ラベルのレイアウト（測定→縦方向の衝突回避）は配置に依存し選択状態に依存しない
  const labels = useMemo(() => {
    const metas: { node: RiverNode; big: boolean }[] = [
      // MAIN_ORDER は源流（nagomi）＋本流3つを含む
      ...MAIN_ORDER.map(id => ({ node: NODES.find(n => n.id === id)!, big: true })),
      { node: NODES.find(n => n.kind === 'eddy')!, big: false },
      ...NODES.filter(n => n.kind === 'tributary').map(n => ({ node: n, big: false })),
    ];
    return computeLabels(metas);
  }, []);
  labelsRef.current = labels;

  return (
    <svg
      ref={svgRef}
      className="river-map"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onWheel={onWheel}
      style={{ touchAction: 'none' }}
    >
      <defs>
        <pattern id="contour" patternUnits="userSpaceOnUse" width="120" height="64" patternTransform="rotate(-12)">
          <path d="M 0 32 Q 30 22, 60 32 T 120 32" fill="none" stroke="#cbc4b3" strokeWidth="0.5" opacity="0.28" />
        </pattern>
        <linearGradient id="riverGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#90b7c9" />
          <stop offset="55%" stopColor="#6f9bb0" />
          <stop offset="100%" stopColor="#4f7e95" />
        </linearGradient>
        <radialGradient id="seaFade" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#c2d6df" stopOpacity="0.65" />
          <stop offset="100%" stopColor="#c2d6df" stopOpacity="0" />
        </radialGradient>
        <clipPath id="riverClip"><path d={getMainRiverPolygon()} /></clipPath>
      </defs>

      <g transform={`translate(${transform.x},${transform.y}) scale(${transform.scale})`}>
        {/* 等高線テクスチャ（地形の気配） */}
        {(() => {
          const b = getContentBounds();
          return (
            <rect
              x={b.minX - 400} y={b.minY - 400}
              width={b.maxX - b.minX + 800} height={b.maxY - b.minY + 800}
              fill="url(#contour)"
            />
          );
        })()}

        {/* 河口側の海／汀線の気配 */}
        <ellipse cx={estuary.x + 60} cy={estuary.y + 70} rx="320" ry="200" fill="url(#seaFade)" />
        {[0, 1, 2].map(i => (
          <path
            key={`shore-${i}`}
            d={`M ${estuary.x - 220 + i * 30} ${estuary.y + 120 + i * 26} Q ${estuary.x + 80} ${estuary.y + 90 + i * 26}, ${estuary.x + 360} ${estuary.y + 150 + i * 26}`}
            fill="none" stroke="#9fbcc8" strokeWidth="1" opacity={0.18 - i * 0.04}
          />
        ))}

        {/* 支流（可変幅 fill ＋ 細い墨絵的な線） */}
        {sideTributaries.map(n => {
          const poly = getTributaryPolygon(n.id);
          const line = getTributaryPath(n.id);
          if (!line) return null;
          const color = themeColor(n.theme);
          const active = selectedId === n.id;
          return (
            <g key={`trib-${n.id}`}>
              {poly && <path d={poly} fill={color} opacity={active ? 0.4 : 0.26} />}
              <path d={line} fill="none" stroke={color} strokeWidth="1.3" opacity={active ? 0.7 : 0.5} />
            </g>
          );
        })}

        {/* 本流 fill */}
        <path d={getMainRiverPolygon()} fill="url(#riverGrad)" opacity="0.5" />

        {/* シグネチャ＝ドリフト（本流に沿う流れ） */}
        <g clipPath="url(#riverClip)" opacity="0.28">
          {[0, 1, 2, 3].map(i => (
            <path
              key={`flow-${i}`}
              d={getMainRiverPath()}
              fill="none"
              stroke="#cfe0e7"
              strokeWidth={1.4 - i * 0.2}
              strokeDasharray="7 22"
              strokeDashoffset={i * 7}
              className="river-flow-anim"
              style={{
                animation: `flowDown ${22 + i * 6}s linear infinite`,
                transform: `translate(${(i - 1.5) * 6}px, ${(i - 1.5) * 6}px)`,
              }}
            />
          ))}
        </g>
        <path d={getMainRiverPath()} fill="none" stroke="#4f7e95" strokeWidth="0.8" opacity="0.25" />

        {/* 淵（支流6 竹野再訪）＝本流上の渦／よどみ */}
        {eddy && (
          <g>
            <ellipse cx={eddy.pos.x} cy={eddy.pos.y} rx="34" ry="22"
              fill="none" stroke="#8a7a5e" strokeWidth="1.3" opacity="0.4" strokeDasharray="4 7"
              className="river-flow-anim"
              style={{ animation: 'eddySpin 16s linear infinite reverse', transformOrigin: `${eddy.pos.x}px ${eddy.pos.y}px` }}
            />
            <ellipse cx={eddy.pos.x} cy={eddy.pos.y} rx="20" ry="13"
              fill="none" stroke="#8a7a5e" strokeWidth="0.9" opacity="0.28" strokeDasharray="3 5"
              className="river-flow-anim"
              style={{ animation: 'eddySpin 10s linear infinite', transformOrigin: `${eddy.pos.x}px ${eddy.pos.y}px` }}
            />
          </g>
        )}

        {/* 伏流水（地下水脈） */}
        {SUBTERRANEAN.map(s => {
          const active = subHighlight.includes(s.from) || subHighlight.includes(s.to);
          const a = getNodePosition(s.from);
          const b = getNodePosition(s.to);
          const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
          return (
            <g key={`sub-${s.from}-${s.to}`}>
              <path
                d={getSubterraneanPath(s.from, s.to)}
                fill="none" stroke="#6f6a5e" strokeWidth="1"
                strokeDasharray="3 8"
                opacity={active ? 0.5 : 0.13}
                className="subterranean-line"
              />
              {active && (
                <text x={mid.x} y={mid.y} textAnchor="middle"
                  fill="#6f6a5e" fontSize="13" fontFamily="var(--font-serif)" fontStyle="italic" opacity="0.7">
                  {s.label}
                </text>
              )}
            </g>
          );
        })}

        {/* ラベル層（衝突回避済み・ピルで線/川から抜く） */}
        {labels.map(b => (
          <LabelView key={`lbl-${b.node.id}`} box={b} selected={selectedId === b.node.id} />
        ))}

        {/* ノード層（円＋当たり判定） */}
        {labels.map(b => (
          <NodeDot key={`dot-${b.node.id}`} node={b.node} pos={b.pos} big={b.big}
            selected={selectedId === b.node.id} onSelect={onSelect} />
        ))}

        {/* 河口「これから」 */}
        <text x={estuary.x + 40} y={estuary.y + 56} textAnchor="start"
          fill="#5f8aa0" fontSize="22" fontFamily="var(--font-serif)" fontStyle="italic" opacity="0.55">
          これからの実践へ ——
        </text>
      </g>

      {/* 全体表示ボタン */}
      <g className="fit-btn" onClick={fitToView} role="button" tabIndex={0} aria-label="全体を表示">
        <rect x="16" y="16" width="40" height="40" rx="8" fill="#f8f5ec" stroke="#6f6a5e" strokeWidth="0.6" opacity="0.85" />
        <text x="36" y="42" textAnchor="middle" fontSize="18" fill="#6f6a5e">⊞</text>
      </g>
    </svg>
  );
}

// ── ラベルレイアウト ─────────────────────────────────────────────────────
interface LabelBox {
  node: RiverNode;
  pos: { x: number; y: number };
  dir: { x: number; y: number };
  big: boolean;
  r: number;
  lx: number;          // ラベルの取り付け点X（固定）
  cy: number;          // ピル中心Y（衝突回避で動く）
  anchor: 'start' | 'end';
  isSource: boolean;
  titleSize: number;
  eyeSize: number;
  lineH: number;
  lines: string[];
  w: number;
  h: number;
  pillX: number;
  padX: number;
  padY: number;
  color: string;
}

const charW = (s: string, fs: number) =>
  [...s].reduce((sum, ch) => sum + (/[\x00-\xff]/.test(ch) ? fs * 0.56 : fs), 0);

// タイトルを単位幅で折り返す（CJK=1／英数=0.5）。読点・中黒の後で切れやすくする。
function wrapTitle(text: string, maxUnits: number): string[] {
  const lines: string[] = [];
  let cur = '', units = 0;
  for (const ch of text) {
    const w = /[\x00-\xff]/.test(ch) ? 0.5 : 1;
    cur += ch; units += w;
    const breakable = /[、。，・／」）]/.test(ch) || ch === ' ';
    if (units >= maxUnits && breakable) { lines.push(cur); cur = ''; units = 0; }
  }
  if (cur) lines.push(cur);
  const out: string[] = [];
  for (const ln of lines) {
    let u = 0, seg = '';
    for (const ch of ln) {
      const w = /[\x00-\xff]/.test(ch) ? 0.5 : 1;
      if (u + w > maxUnits + 2.5 && seg) { out.push(seg); seg = ''; u = 0; }
      seg += ch; u += w;
    }
    if (seg) out.push(seg);
  }
  return out.length ? out : [text];
}

// 全ラベルを測定し、縦方向の重なりを反復的に解消する
function computeLabels(metas: { node: RiverNode; big: boolean }[]): LabelBox[] {
  const boxes: LabelBox[] = metas.map(({ node, big }) => {
    const pos = getNodePosition(node.id);
    const dir = getLabelDir(node.id);
    const r = big ? 11 : 7;
    const gap = r + 22;
    const lx = pos.x + dir.x * gap;
    const cy = pos.y + dir.y * gap;
    const anchor: 'start' | 'end' = dir.x >= 0 ? 'start' : 'end';
    const isSource = node.kind === 'source';
    const titleSize = big ? 56 : 48;
    const eyeSize = 34;
    const lineH = titleSize * 1.16;
    const lines = wrapTitle(node.title.replace('\n', ' '), 8);
    const padX = 18, padY = 14;
    const maxLineW = Math.max(...lines.map(l => charW(l, titleSize)));
    const eyeW = isSource ? charW('源流', eyeSize) : 0;
    const w = Math.max(maxLineW, eyeW) + padX * 2;
    const h = (isSource ? eyeSize + 8 : 0) + lines.length * lineH + padY * 2;
    const pillX = anchor === 'start' ? lx - 10 : lx - w + 10;
    return {
      node, pos, dir, big, r, lx, cy, anchor, isSource,
      titleSize, eyeSize, lineH, lines, w, h, pillX, padX, padY,
      color: themeColor(node.theme),
    };
  });

  // 反復分離（縦方向のみ。横位置＝岸の左右は保持）
  for (let pass = 0; pass < 12; pass++) {
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i], b = boxes[j];
        const ox = Math.min(a.pillX + a.w, b.pillX + b.w) - Math.max(a.pillX, b.pillX);
        const oy = Math.min(a.cy + a.h / 2, b.cy + b.h / 2) - Math.max(a.cy - a.h / 2, b.cy - b.h / 2);
        if (ox > -8 && oy > 0) {
          const push = oy / 2 + 3;
          if (a.cy <= b.cy) { a.cy -= push; b.cy += push; }
          else { a.cy += push; b.cy -= push; }
        }
      }
    }
  }
  return boxes;
}

// ラベル本体（衝突回避済みの座標で描画。クリックは受けない）
function LabelView({ box, selected }: { box: LabelBox; selected: boolean }) {
  const { pos, dir, r, lx, cy, anchor, isSource, titleSize, eyeSize, lineH, lines, w, h, pillX, padX, padY, color } = box;
  const pillY = cy - h / 2;
  const textX = anchor === 'start' ? pillX + padX : pillX + w - padX;
  const eyeBaseline = pillY + padY + eyeSize;
  const linesTop = pillY + padY + (isSource ? eyeSize + 8 : 0);
  const lineBaselines = lines.map((_, i) => linesTop + i * lineH + titleSize * 0.82);

  return (
    <g pointerEvents="none" opacity={selected ? 1 : 0.97}>
      {/* 連結線（ノード→ラベル） */}
      <line x1={pos.x + dir.x * r} y1={pos.y + dir.y * r} x2={lx} y2={cy}
        stroke={color} strokeWidth="1" opacity="0.28" />
      <rect x={pillX} y={pillY} width={w} height={h} rx="10"
        fill="#f1ede3" opacity={selected ? 0.98 : 0.86} />
      {isSource && (
        <text x={textX} y={eyeBaseline} textAnchor={anchor} fontSize={eyeSize}
          fontFamily="var(--font-sans)" fill={color} fontWeight="700" letterSpacing="3px">
          源流
        </text>
      )}
      {lines.map((ln, i) => (
        <text key={i} x={textX} y={lineBaselines[i]} textAnchor={anchor} fontSize={titleSize}
          fontFamily="var(--font-serif)" fill="#2c2a26" fontWeight="500">
          {ln}
        </text>
      ))}
    </g>
  );
}

// ノードの円＋当たり判定
function NodeDot({ node, pos, big, selected, onSelect }: {
  node: RiverNode; pos: { x: number; y: number }; big: boolean;
  selected: boolean; onSelect: (n: RiverNode | null) => void;
}) {
  const color = themeColor(node.theme);
  const r = big ? 11 : 7;
  const hitRef = useRef<SVGCircleElement>(null);

  useEffect(() => {
    const el = hitRef.current;
    if (!el) return;
    const onClick = (e: Event) => { e.stopPropagation(); onSelect(selected ? null : node); };
    const onKeyDown = (e: Event) => {
      const ke = e as KeyboardEvent;
      if (ke.key === 'Enter' || ke.key === ' ') { ke.preventDefault(); onSelect(selected ? null : node); }
    };
    el.addEventListener('click', onClick);
    el.addEventListener('keydown', onKeyDown);
    return () => { el.removeEventListener('click', onClick); el.removeEventListener('keydown', onKeyDown); };
  }, [selected, node, onSelect]);

  return (
    <g className="node-hit">
      {selected && (
        <circle cx={pos.x} cy={pos.y} r={r + 11} fill={color} opacity="0.14" className="node-halo" />
      )}
      <circle ref={hitRef} cx={pos.x} cy={pos.y} r={big ? 30 : 24}
        fill="transparent" stroke="none" style={{ cursor: 'pointer' }}
        tabIndex={0} role="button" aria-label={`${node.no} ${node.title.replace('\n', ' ')}`} pointerEvents="all" />
      <circle cx={pos.x} cy={pos.y} r={r} fill="#f8f5ec" stroke={color} strokeWidth={big ? 2.4 : 1.6} pointerEvents="none" />
      {node.kind === 'source' && (
        <>
          <circle cx={pos.x} cy={pos.y} r={r + 5} fill="none" stroke="#c2954a" strokeWidth="1.4" opacity="0.7" pointerEvents="none" />
          <circle cx={pos.x} cy={pos.y} r={4} fill="#c2954a" pointerEvents="none" />
        </>
      )}
      {node.kind === 'eddy' && (
        <circle cx={pos.x} cy={pos.y} r={3} fill="#8a7a5e" pointerEvents="none" />
      )}
    </g>
  );
}
