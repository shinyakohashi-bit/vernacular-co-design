import { useRef, useState, useCallback, useEffect } from 'react';
import { NODES, MAIN_ORDER } from '../data/nodes';
import {
  getNodePosition,
  getNodeColor,
  getLabel,
  getWaterPaths,
  getContentBounds,
  getEddyPos,
  getSourcePos,
} from '../data/layout';
import type { RiverNode } from '../data/nodes';
import './RiverMap.css';

interface Props {
  onSelect: (node: RiverNode | null) => void;
  selectedId: string | null;
}

const WATER_PATHS = getWaterPaths();

// ドリフトのシマー（流れる光）が辿るレーン。源流側（左上）→下流側へ漂わせる。
const DRIFT_BLOBS = [
  { y: 175, dur: 19, delay: 0 },
  { y: 245, dur: 24, delay: -6 },
  { y: 300, dur: 21, delay: -12 },
  { y: 360, dur: 26, delay: -3 },
  { y: 410, dur: 22, delay: -16 },
  { y: 460, dur: 28, delay: -9 },
];

const SCALE_MIN = 0.4;
const SCALE_MAX = 6;
type TForm = { x: number; y: number; scale: number };

export default function RiverMap({ onSelect, selectedId }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [transform, setTransform] = useState<TForm>({ x: 0, y: 0, scale: 1 });
  const transformRef = useRef(transform);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const moved = useRef(false);
  const lastPt = useRef({ x: 0, y: 0 });
  // マルチタッチ管理（地図上だけでピンチズーム／2本指パン）
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; mid: { x: number; y: number }; start: TForm } | null>(null);

  const setT = useCallback((u: TForm | ((t: TForm) => TForm)) => {
    setTransform(prev => {
      const next = typeof u === 'function' ? (u as (t: TForm) => TForm)(prev) : u;
      transformRef.current = next;
      return next;
    });
  }, []);

  const localPoint = useCallback((cx: number, cy: number) => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: cx - r.left, y: cy - r.top };
  }, []);

  const fitToView = useCallback(() => {
    if (!svgRef.current) return;
    const { width, height } = svgRef.current.getBoundingClientRect();
    setSize({ w: width, h: height });
    const b = getContentBounds();
    const pad = 40;
    const cw = b.maxX - b.minX + pad * 2;
    const ch = b.maxY - b.minY + pad * 2;
    const fit = Math.min(width / cw, height / ch);
    const MIN_SCALE = 0.9;
    const s = Math.max(fit, MIN_SCALE);

    if (s <= fit + 1e-6) {
      const cx = (b.minX + b.maxX) / 2;
      const cy = (b.minY + b.maxY) / 2;
      setT({ scale: s, x: width / 2 - cx * s, y: height / 2 - cy * s });
    } else {
      // 収まらない狭い画面：源流（左上）を起点に置き、下流へ辿れるように
      const src = getSourcePos();
      setT({ scale: s, x: width * 0.22 - src.x * s, y: height * 0.18 - src.y * s });
    }
  }, [setT]);

  useEffect(() => { fitToView(); }, [fitToView]);
  useEffect(() => {
    const onResize = () => fitToView();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [fitToView]);

  // iOS Safari のページ・ピンチズーム（モーダルごと拡大）を地図上で抑止
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const prevent = (e: Event) => e.preventDefault();
    el.addEventListener('gesturestart', prevent);
    el.addEventListener('gesturechange', prevent);
    el.addEventListener('gestureend', prevent);
    return () => {
      el.removeEventListener('gesturestart', prevent);
      el.removeEventListener('gesturechange', prevent);
      el.removeEventListener('gestureend', prevent);
    };
  }, []);

  const beginPinch = useCallback(() => {
    const pts = [...pointers.current.values()];
    if (pts.length < 2) return;
    const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    const mid = localPoint((pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2);
    pinch.current = { dist, mid, start: { ...transformRef.current } };
  }, [localPoint]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as Element).closest('.node-hit')) return;
    try { svgRef.current?.setPointerCapture(e.pointerId); } catch { /* noop */ }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) {
      moved.current = false;
      lastPt.current = { x: e.clientX, y: e.clientY };
    } else if (pointers.current.size === 2) {
      beginPinch();
    }
  }, [beginPinch]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size >= 2 && pinch.current) {
      const pts = [...pointers.current.values()].slice(0, 2);
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const mid = localPoint((pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2);
      const p = pinch.current;
      const ns = Math.max(SCALE_MIN, Math.min(SCALE_MAX, p.start.scale * (dist / (p.dist || 1))));
      // ピンチ開始時に中心の下にあったワールド座標を、現在の中心へ合わせる（ズーム＋2本指パン）
      const wx = (p.mid.x - p.start.x) / p.start.scale;
      const wy = (p.mid.y - p.start.y) / p.start.scale;
      moved.current = true;
      setT({ scale: ns, x: mid.x - wx * ns, y: mid.y - wy * ns });
      return;
    }

    if (pointers.current.size === 1) {
      const dx = e.clientX - lastPt.current.x;
      const dy = e.clientY - lastPt.current.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) moved.current = true;
      lastPt.current = { x: e.clientX, y: e.clientY };
      setT(t => ({ ...t, x: t.x + dx, y: t.y + dy }));
    }
  }, [localPoint, setT]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 1) {
      const [p] = [...pointers.current.values()];
      lastPt.current = { x: p.x, y: p.y };
    }
  }, []);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const { x: mx, y: my } = localPoint(e.clientX, e.clientY);
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    setT(t => {
      const ns = Math.max(SCALE_MIN, Math.min(SCALE_MAX, t.scale * factor));
      return {
        scale: ns,
        x: mx - (mx - t.x) * (ns / t.scale),
        y: my - (my - t.y) * (ns / t.scale),
      };
    });
  }, [localPoint, setT]);

  const mainSet = new Set<string>(MAIN_ORDER);
  const eddyPos = getEddyPos();

  return (
    <svg
      ref={svgRef}
      className="river-map"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
      style={{ touchAction: 'none' }}
    >
      <defs>
        <pattern id="contour" patternUnits="userSpaceOnUse" width="90" height="48" patternTransform="rotate(-10)">
          <path d="M 0 24 Q 22 17, 45 24 T 90 24" fill="none" stroke="#cbc4b3" strokeWidth="0.4" opacity="0.3" />
        </pattern>
        <linearGradient id="riverGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#8fb5c8" />
          <stop offset="55%" stopColor="#6f9bb0" />
          <stop offset="100%" stopColor="#4f7e95" />
        </linearGradient>
        <clipPath id="waterClip">
          {WATER_PATHS.map((d, i) => <path key={i} d={d} />)}
        </clipPath>
        <filter id="softBlur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
      </defs>

      <g transform={`translate(${transform.x},${transform.y}) scale(${transform.scale})`}>
        {/* 地形の気配（等高線） */}
        {(() => {
          const b = getContentBounds();
          return (
            <rect x={b.minX - 200} y={b.minY - 200}
              width={b.maxX - b.minX + 400} height={b.maxY - b.minY + 400}
              fill="url(#contour)" />
          );
        })()}

        {/* 水路（デザイン案の塗り形状をそのまま描画） */}
        <g>
          {WATER_PATHS.map((d, i) => (
            <path key={i} d={d} fill="url(#riverGrad)" opacity="0.62"
              stroke="#4f7e95" strokeWidth="0.4" strokeOpacity="0.25" />
          ))}
        </g>

        {/* シグネチャ＝ドリフト：水面の中をゆっくり流れる光 */}
        <g clipPath="url(#waterClip)" opacity="0.55">
          {DRIFT_BLOBS.map((b, i) => (
            <ellipse key={i} cx={0} cy={b.y} rx="60" ry="20"
              fill="#d6e6ed" filter="url(#softBlur)"
              className="drift-blob"
              style={{ animationDuration: `${b.dur}s`, animationDelay: `${b.delay}s` }} />
          ))}
        </g>

        {/* 淵（竹野・再訪）＝本流上の渦 */}
        <g>
          <ellipse cx={eddyPos.x} cy={eddyPos.y} rx="13" ry="8"
            fill="none" stroke="#7a6c52" strokeWidth="0.9" opacity="0.5" strokeDasharray="3 4"
            className="river-flow-anim"
            style={{ animation: 'eddySpin 14s linear infinite reverse', transformOrigin: `${eddyPos.x}px ${eddyPos.y}px` }} />
          <ellipse cx={eddyPos.x} cy={eddyPos.y} rx="7" ry="4.5"
            fill="none" stroke="#7a6c52" strokeWidth="0.7" opacity="0.35" strokeDasharray="2 3"
            className="river-flow-anim"
            style={{ animation: 'eddySpin 9s linear infinite', transformOrigin: `${eddyPos.x}px ${eddyPos.y}px` }} />
        </g>

        {/* ノード＋ラベル */}
        {NODES.map(n => (
          <NodeMarker
            key={n.id}
            node={n}
            big={mainSet.has(n.id) || n.kind === 'source'}
            selected={selectedId === n.id}
            onSelect={onSelect}
          />
        ))}
      </g>

      {/* 全体表示ボタン（右下：タイトル・凡例と重ならないように） */}
      <g className="fit-btn" onClick={fitToView} role="button" tabIndex={0} aria-label="全体を表示"
        transform={`translate(${Math.max(16, size.w - 56)}, ${Math.max(16, size.h - 56)})`}>
        <rect x="0" y="0" width="40" height="40" rx="8" fill="#f8f5ec" stroke="#6f6a5e" strokeWidth="0.6" opacity="0.85" />
        <text x="20" y="26" textAnchor="middle" fontSize="18" fill="#6f6a5e">⊞</text>
      </g>
    </svg>
  );
}

interface MarkerProps {
  node: RiverNode;
  big: boolean;
  selected: boolean;
  onSelect: (n: RiverNode | null) => void;
}

const LABEL_FS = 9.5;

function NodeMarker({ node, big, selected, onSelect }: MarkerProps) {
  const color = getNodeColor(node.id);
  const pos = getNodePosition(node.id);
  const label = getLabel(node.id);
  const r = node.kind === 'source' ? 6.5 : big ? 5.5 : 4.2;
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

  // ラベルの寸法見積り（washi ピルで線・水面から抜く）
  const charW = (s: string) =>
    [...s].reduce((sum, ch) => sum + (/[\x00-\xff]/.test(ch) ? LABEL_FS * 0.56 : LABEL_FS), 0);

  let pill: { x: number; y: number; w: number; h: number } | null = null;
  if (label) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const sp of label.spans) {
      const x0 = label.tx + sp.x;
      const y0 = label.ty + sp.y;
      minX = Math.min(minX, x0);
      maxX = Math.max(maxX, x0 + charW(sp.text));
      minY = Math.min(minY, y0 - LABEL_FS);
      maxY = Math.max(maxY, y0 + LABEL_FS * 0.28);
    }
    const padX = 4, padY = 3;
    pill = { x: minX - padX, y: minY - padY, w: maxX - minX + padX * 2, h: maxY - minY + padY * 2 };
  }

  return (
    <g className="node-hit">
      {selected && (
        <circle cx={pos.x} cy={pos.y} r={r + 7} fill={color} opacity="0.14" className="node-halo" />
      )}

      {/* ラベル */}
      {label && pill && (
        <g opacity={selected ? 1 : 0.97} pointerEvents="none">
          <rect x={pill.x} y={pill.y} width={pill.w} height={pill.h} rx="3.5"
            fill="#f1ede3" opacity={selected ? 0.95 : 0.8} />
          {label.spans.map((sp, i) => (
            <text key={i} x={label.tx + sp.x} y={label.ty + sp.y}
              fontSize={LABEL_FS} fontFamily="var(--font-sans)" fill="#2c2a26"
              fontWeight={big ? 600 : 500}>
              {sp.text}
            </text>
          ))}
        </g>
      )}

      {/* 当たり判定（透明・大きめ） */}
      <circle ref={hitRef} cx={pos.x} cy={pos.y} r={Math.max(r + 7, 12)}
        fill="transparent" stroke="none" style={{ cursor: 'pointer' }}
        tabIndex={0} role="button"
        aria-label={node.title} pointerEvents="all" />

      {/* 源流：起点を示す同色の外輪 */}
      {node.kind === 'source' && (
        <circle cx={pos.x} cy={pos.y} r={r + 3.2} fill="none" stroke={color} strokeWidth="1.1" opacity="0.55" pointerEvents="none" />
      )}

      {/* ノード本体（SVGの色を踏襲した塗り＋白フチ＝凡例と一致） */}
      <circle cx={pos.x} cy={pos.y} r={r} fill={color} stroke="#fff"
        strokeWidth={big ? 1.4 : 1.1} pointerEvents="none" />
      {node.kind === 'eddy' && (
        <circle cx={pos.x} cy={pos.y} r={1.6} fill="#fff" opacity="0.8" pointerEvents="none" />
      )}
    </g>
  );
}
