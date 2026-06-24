import { useState, useCallback, useEffect } from 'react';
import RiverMap from './components/RiverMap';
import DetailPanel from './components/DetailPanel';
import { TITLE, LEGEND } from './data/layout';
import type { RiverNode } from './data/nodes';
import './App.css';

export default function App() {
  const [selected, setSelected] = useState<RiverNode | null>(null);

  const handleSelect = useCallback((node: RiverNode | null) => {
    setSelected(node);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="app">
      <RiverMap onSelect={handleSelect} selectedId={selected?.id ?? null} />

      {TITLE && <h1 className="map-title">{TITLE}</h1>}

      {LEGEND.length > 0 && (
        <ul className="map-legend">
          {LEGEND.map(e => (
            <li key={e.label}>
              <span className="map-legend-swatch" style={{ background: e.color }} />
              {e.label}
            </li>
          ))}
        </ul>
      )}

      <DetailPanel node={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
