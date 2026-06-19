import { useRef, useState, useCallback, useEffect } from 'react';
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

  const fitToView = useCallback(() => {
    if (!svgRef.current) return;
    const { width, height } = svgRef.current.getBoundingClientRect();
    const b = getContentBounds();
    const pad = 120;
    const cw = b.maxX - b.minX + pad * 2;
    const ch = b.maxY - b.minY + pad * 2;
    const fit = Math.min(width / cw, height / ch);
    // ノードが小さくなりすぎてタップ不能にならないよう下限を設ける
    const MIN_SCALE = 0.3;
    const s = Math.max(fit, MIN_SCALE);

    if (s <= fit + 1e-6) {
      // 全体が収まる（デスクトップ等）：中央に配置
      const cx = (b.minX + b.maxX) / 2;
      const cy = (b.minY + b.maxY) / 2;
      setTransform({ scale: s, x: width / 2 - cx * s, y: height / 2 - cy * s });
    } else {
      // 収まらない（狭い画面）：源流を左上寄りに置き、下流へ辿れるように
      const src = getSourcePoint();
      setTransform({ scale: s, x: width * 0.22 - src.x * s, y: height * 0.16 - src.y * s });
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

  const mainNodes = MAIN_ORDER.map(id => NODES.find(n => n.id === id)!);
  const sideTributaries = NODES.filter(n => n.kind === 'tributary');
  const sourceNode = NODES.find(n => n.kind === 'source')!;
  const eddyNode = NODES.find(n => n.kind === 'eddy')!;
  const estuary = getEstuary();
  const source = getSourcePoint();
  const eddy = getEddy();

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

        {/* ノード（支流→本流→源流→淵の順で重ね、本流を前面に） */}
        {sideTributaries.map(n => (
          <NodeMarker key={n.id} node={n} pos={getNodePosition(n.id)} dir={getLabelDir(n.id)}
            selected={selectedId === n.id} onSelect={onSelect} />
        ))}
        <NodeMarker node={eddyNode} pos={getNodePosition('takeno')} dir={getLabelDir('takeno')}
          selected={selectedId === 'takeno'} onSelect={onSelect} />
        {mainNodes.map(n => (
          <NodeMarker key={n.id} node={n} pos={getNodePosition(n.id)} dir={getLabelDir(n.id)}
            selected={selectedId === n.id} onSelect={onSelect} big />
        ))}
        <NodeMarker node={sourceNode} pos={source} dir={getLabelDir('nagomi')}
          selected={selectedId === 'nagomi'} onSelect={onSelect} big />

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

interface MarkerProps {
  node: RiverNode;
  pos: { x: number; y: number };
  dir: { x: number; y: number };
  selected: boolean;
  big?: boolean;
  onSelect: (n: RiverNode | null) => void;
}

function NodeMarker({ node, pos, dir, selected, big, onSelect }: MarkerProps) {
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

  // ラベルは外向きに逃がす。水平成分で左右、垂直成分で上下を決める。
  const gap = r + 14;
  const lx = pos.x + dir.x * gap;
  const ly = pos.y + dir.y * gap;
  const anchor: 'start' | 'end' = dir.x >= 0 ? 'start' : 'end';

  const titleText = node.title.replace('\n', ' ');
  const noSize = big ? 15 : 13;
  const titleSize = big ? 16 : 13;

  // washi ピルの寸法見積り（CJKは約 fontSize 幅／英数は約 0.55）
  const charW = (s: string, fs: number) =>
    [...s].reduce((sum, ch) => sum + (/[\x00-\xff]/.test(ch) ? fs * 0.56 : fs), 0);
  const noW = charW(node.no, noSize);
  const titleW = charW(titleText, titleSize);
  const pillW = Math.max(noW, titleW) + 20;
  const pillH = noSize + titleSize + 20;
  const pillX = anchor === 'start' ? lx - 8 : lx - pillW + 8;
  const pillY = ly - pillH / 2;

  return (
    <g className="node-hit">
      {selected && (
        <circle cx={pos.x} cy={pos.y} r={r + 11} fill={color} opacity="0.14" className="node-halo" />
      )}

      {/* ラベル（washi ピルで線・川から抜く） */}
      <g opacity={selected ? 1 : 0.96} pointerEvents="none">
        <rect x={pillX} y={pillY} width={pillW} height={pillH} rx="7"
          fill="#f1ede3" opacity={selected ? 0.96 : 0.82} />
        <text x={anchor === 'start' ? pillX + 10 : pillX + pillW - 10} y={pillY + noSize + 4}
          textAnchor={anchor} fontSize={noSize} fontFamily="var(--font-sans)"
          fill={color} fontWeight="700" letterSpacing="0.5px">
          {node.no}
        </text>
        <text x={anchor === 'start' ? pillX + 10 : pillX + pillW - 10} y={pillY + noSize + titleSize + 10}
          textAnchor={anchor} fontSize={titleSize} fontFamily="var(--font-serif)"
          fill="#2c2a26">
          {titleText}
        </text>
      </g>

      {/* 連結線（ノード→ラベル） */}
      <line x1={pos.x + dir.x * r} y1={pos.y + dir.y * r} x2={lx} y2={ly}
        stroke={color} strokeWidth="0.8" opacity="0.35" pointerEvents="none" />

      {/* 当たり判定（透明・大きめ） */}
      <circle ref={hitRef} cx={pos.x} cy={pos.y} r={big ? 26 : 20}
        fill="transparent" stroke="none" style={{ cursor: 'pointer' }}
        tabIndex={0} role="button" aria-label={`${node.no} ${titleText}`} pointerEvents="all" />

      {/* ノード本体 */}
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
