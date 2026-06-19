import type { Theme } from '../data/nodes';

const COLORS: Record<Theme, string> = {
  source: '#c2954a',
  main: '#4f7e95',
  theory: '#6d8a54',
  field: '#478a7e',
  reflexive: '#8a7a5e',
  watershed: '#7a9a64',
};

const LABELS: Record<Theme, string> = {
  source: '源流',
  main: '本流',
  theory: '理論・考察',
  field: 'フィールド',
  reflexive: '反省的',
  watershed: '流域思考',
};

export function themeColor(theme: Theme): string {
  return COLORS[theme];
}

export function themeLabel(theme: Theme): string {
  return LABELS[theme];
}
