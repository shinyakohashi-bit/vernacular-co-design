import type { RiverNode } from '../data/nodes';
import { themeColor, themeLabel } from '../utils/theme';
import './DetailPanel.css';

interface Props {
  node: RiverNode | null;
  onClose: () => void;
}

export default function DetailPanel({ node, onClose }: Props) {
  if (!node) return null;

  const color = themeColor(node.theme);

  return (
    <div className="detail-overlay" onClick={onClose}>
      <aside
        className="detail-panel"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-label={node.title}
      >
        <button className="detail-close" onClick={onClose} aria-label="閉じる">×</button>

        <div className="detail-header">
          <span className="detail-no" style={{ color }}>{node.no}</span>
          <span className="detail-tag" style={{ background: color }}>{themeLabel(node.theme)}</span>
        </div>

        <h2 className="detail-title">{node.title}</h2>
        <p className="detail-sub">{node.sub}</p>

        <p className="detail-summary">{node.summary}</p>

        {node.question && (
          <blockquote className="detail-question">
            <span className="detail-label">問い</span>
            {node.question}
          </blockquote>
        )}

        {node.insight && (
          <blockquote className="detail-insight">
            <span className="detail-label">気づき</span>
            {node.insight}
          </blockquote>
        )}

        <div className="detail-note">
          {node.note ? (
            <a href={node.note} target="_blank" rel="noopener noreferrer" className="note-link" style={{ borderColor: color }}>
              note記事を読む →
            </a>
          ) : (
            <span className="note-empty">noteリンク未設定</span>
          )}
        </div>
      </aside>
    </div>
  );
}
