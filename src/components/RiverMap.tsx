import { useRef, useState, useCallback, useEffect } from 'react';
import { NODES, MAIN_ORDER, SUBTERRANEAN } from '../data/nodes';
import {
  getNodePosition,
  getCanvasSize,
  getMainRiverPolygon,
  getMainRiverPath,
  getTributaryPolygon,
  getTributaryPath,
  getSubterraneanPath,
  getEstuary,
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
  const lastPt = useRef({ x: 0, y: 0 });
  const canvas = getCanvasSize();

  useEffect(() => { fitToView(); }, []);

  const fitToView = useCallback(() => {
    if (!svgRef.current) return;
    const { width, height } = svgRef.current.getBoundingClientRect();
    const sx = width / canvas.width;
    const sy = height / canvas.height;
    const s = Math.min(sx, sy) * 0.88;
    setTransform({
      scale: s,
      x: (width - canvas.width * s) / 2,
      y: (height - canvas.height * s) / 2 + 20,
    });
  }, [canvas.width, canvas.height]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as Element).closest('.node-hit')) return;
    dragging.current = true;
    lastPt.current = { x: e.clientX, y: e.clientY };
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - lastPt.current.x;
    const dy = e.clientY - lastPt.current.y;
    lastPt.current = { x: e.clientX, y: e.clientY };
    setTransform(t => ({ ...t, x: t.x + dx, y: t.y + dy }));
  }, []);

  const onPointerUp = useCallback(() => {
    dragging.current = false;
  }, []);


  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const rect = svgRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const factor = e.deltaY > 0 ? 0.92 : 1.08;
    setTransform(t => {
      const ns = Math.max(0.12, Math.min(3, t.scale * factor));
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
  const tributaries = NODES.filter(n => n.kind === 'tributary' || n.kind === 'eddy');
  const sourceNode = NODES.find(n => n.kind === 'source')!;
  const estuary = getEstuary();

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
        <pattern id="contour" patternUnits="userSpaceOnUse" width="80" height="40" patternTransform="rotate(-8)">
          <path d="M 0 20 Q 20 14, 40 20 T 80 20" fill="none" stroke="#c5bfb0" strokeWidth="0.4" opacity="0.25" />
        </pattern>
        <linearGradient id="riverGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8bb3c7" />
          <stop offset="50%" stopColor="#6f9bb0" />
          <stop offset="100%" stopColor="#4f7e95" />
        </linearGradient>
        <radialGradient id="estuaryFade" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#c2d6df" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#c2d6df" stopOpacity="0" />
        </radialGradient>
        <clipPath id="riverClip">
          <path d={getMainRiverPolygon()} />
        </clipPath>
      </defs>

      <g transform={`translate(${transform.x},${transform.y}) scale(${transform.scale})`}>
        {/* Background contour texture */}
        <rect width={canvas.width} height={canvas.height} fill="url(#contour)" />

        {/* Estuary delta fade */}
        <ellipse cx={estuary.x} cy={estuary.y + 20} rx="180" ry="120" fill="url(#estuaryFade)" />

        {/* Tributary fills + strokes */}
        {tributaries.filter(n => n.kind !== 'eddy').map(n => {
          const pathD = getTributaryPath(n.id);
          const poly = getTributaryPolygon(n.id);
          if (!pathD) return null;
          const color = themeColor(n.theme);
          return (
            <g key={`trib-${n.id}`}>
              {poly && <path d={poly} fill={color} opacity={0.25} />}
              <path d={pathD} fill="none" stroke={color} strokeWidth="1.2" opacity="0.5" />
            </g>
          );
        })}

        {/* Main river polygon fill */}
        <path d={getMainRiverPolygon()} fill="url(#riverGrad)" opacity="0.45" />

        {/* Flow animation (the signature drift) */}
        <g clipPath="url(#riverClip)" opacity="0.25">
          {[0, 1, 2, 3].map(i => (
            <path
              key={`flow-${i}`}
              d={getMainRiverPath()}
              fill="none"
              stroke="#c2d6df"
              strokeWidth={1.2 - i * 0.15}
              strokeDasharray="6 18"
              strokeDashoffset={i * 6}
              className="river-flow-anim"
              style={{
                animation: `flowDown ${20 + i * 5}s linear infinite`,
                transform: `translateX(${(i - 1.5) * 10}px)`,
              }}
            />
          ))}
        </g>

        {/* Main river center stroke */}
        <path d={getMainRiverPath()} fill="none" stroke="#4f7e95" strokeWidth="1" opacity="0.3" />

        {/* Eddy — 淵 (takeno / 竹野再訪) */}
        {(() => {
          const pos = getNodePosition('takeno');
          return (
            <g>
              <ellipse cx={pos.x} cy={pos.y} rx="50" ry="32"
                fill="none" stroke="#8a7a5e" strokeWidth="1.2" opacity="0.35"
                strokeDasharray="4 7"
                className="river-flow-anim"
                style={{ animation: 'eddySpin 14s linear infinite', transformOrigin: `${pos.x}px ${pos.y}px` }}
              />
              <ellipse cx={pos.x + 3} cy={pos.y - 2} rx="32" ry="19"
                fill="none" stroke="#8a7a5e" strokeWidth="0.8" opacity="0.2"
                strokeDasharray="3 6"
                className="river-flow-anim"
                style={{ animation: 'eddySpin 9s linear infinite reverse', transformOrigin: `${pos.x + 3}px ${pos.y - 2}px` }}
              />
            </g>
          );
        })()}

        {/* Subterranean (伏流水) */}
        {SUBTERRANEAN.map(s => {
          const active = subHighlight.includes(s.from) || subHighlight.includes(s.to);
          const from = getNodePosition(s.from);
          const to = getNodePosition(s.to);
          const pathD = getSubterraneanPath(s.from, s.to);
          const labelX = (from.x + to.x) / 2 + (s.from === 'minamata' ? 180 : -140);
          const labelY = (from.y + to.y) / 2;
          return (
            <g key={`sub-${s.from}-${s.to}`} className="subterranean-group">
              <path
                d={pathD}
                fill="none"
                stroke="#6f6a5e"
                strokeWidth="0.8"
                strokeDasharray="3 7"
                opacity={active ? 0.45 : 0.12}
                className="subterranean-line"
              />
              <text
                x={labelX} y={labelY}
                fill="#6f6a5e"
                fontSize="10"
                fontFamily="var(--font-serif)"
                fontStyle="italic"
                textAnchor="middle"
                opacity={active ? 0.6 : 0.15}
                className="subterranean-label"
              >
                {s.label}
              </text>
            </g>
          );
        })}

        {/* Watershed (支流11) — vertical thread as map's own water source */}
        {(() => {
          const pos = getNodePosition('watershed');
          return (
            <g opacity="0.2">
              <line x1={pos.x} y1={pos.y + 18} x2={pos.x - 40} y2={canvas.height - 200}
                stroke="#7e9069" strokeWidth="0.5" strokeDasharray="2 10" />
              <line x1={pos.x - 40} y1={canvas.height - 200} x2={pos.x - 80} y2={canvas.height}
                stroke="#7e9069" strokeWidth="0.3" strokeDasharray="2 12" />
            </g>
          );
        })()}

        {/* Source node */}
        <NodeMarker node={sourceNode} selected={selectedId === sourceNode.id} onSelect={onSelect} />

        {/* Main nodes */}
        {mainNodes.map(n => (
          <NodeMarker key={n.id} node={n} selected={selectedId === n.id} onSelect={onSelect} />
        ))}

        {/* Tributary & eddy nodes */}
        {tributaries.map(n => (
          <NodeMarker key={n.id} node={n} selected={selectedId === n.id} onSelect={onSelect} />
        ))}

        {/* Estuary text */}
        <text x={estuary.x} y={estuary.y + 15} textAnchor="middle"
          fill="#6f9bb0" fontSize="13" fontFamily="var(--font-serif)" fontStyle="italic" opacity="0.5">
          これからの実践へ ——
        </text>
      </g>

      {/* Fit button */}
      <g className="fit-btn" onClick={fitToView} role="button" tabIndex={0} aria-label="全体を表示">
        <rect x="16" y="16" width="36" height="36" rx="6" fill="#f8f5ec" stroke="#6f6a5e" strokeWidth="0.5" opacity="0.8" />
        <text x="34" y="39" textAnchor="middle" fontSize="15" fill="#6f6a5e">⊞</text>
      </g>
    </svg>
  );
}

function NodeMarker({ node, selected, onSelect }: { node: RiverNode; selected: boolean; onSelect: (n: RiverNode | null) => void }) {
  const pos = getNodePosition(node.id);
  const color = themeColor(node.theme);
  const isMain = node.kind === 'main' || node.kind === 'source';
  const r = isMain ? 10 : 7;
  const labelSide = pos.x > 950 ? 'left' : 'right';
  const labelX = labelSide === 'right' ? pos.x + r + 12 : pos.x - r - 12;
  const anchor = labelSide === 'right' ? 'start' : 'end';

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(selected ? null : node);
  }, [selected, node, onSelect]);

  const handleKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(selected ? null : node);
    }
  }, [selected, node, onSelect]);

  return (
    <g className={`node-hit ${selected ? 'selected' : ''}`} pointerEvents="bounding-box">
      {selected && (
        <circle cx={pos.x} cy={pos.y} r={r + 10} fill={color} opacity="0.12" className="node-halo" />
      )}
      {/* Invisible hit area */}
      <circle
        cx={pos.x} cy={pos.y} r={isMain ? 24 : 18}
        fill="transparent"
        stroke="none"
        style={{ cursor: 'pointer' }}
        onClick={handleClick}
        onKeyDown={handleKey}
        tabIndex={0}
        role="button"
        aria-label={`${node.no} ${node.title}`}
      />
      <circle cx={pos.x} cy={pos.y} r={r}
        fill="#f8f5ec" stroke={color} strokeWidth={isMain ? 2 : 1.5} pointerEvents="none" />
      {node.kind === 'source' && (
        <circle cx={pos.x} cy={pos.y} r={3.5} fill="#c2954a" pointerEvents="none" />
      )}
      <text x={labelX} y={pos.y - 3} textAnchor={anchor}
        fontSize={isMain ? '14' : '12'} fontFamily="var(--font-sans)"
        fill={color} fontWeight="600" letterSpacing="0.5px"
        pointerEvents="none">
        {node.no}
      </text>
      <text x={labelX} y={pos.y + 15} textAnchor={anchor}
        fontSize={isMain ? '14' : '11'} fontFamily="var(--font-serif)"
        fill="#2c2a26" opacity="0.8" pointerEvents="none">
        {node.title.replace('\n', ' ')}
      </text>
    </g>
  );
}
