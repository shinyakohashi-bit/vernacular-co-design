# 土着的なコ・デザイン — 流域の地図

研究プロジェクト「土着的なコ・デザイン」の問いと活動の変遷を、ひとつの**流域（watershed）**として辿れるインタラクティブなWebアプリ。

## ローカル起動

```bash
npm install
npm run dev
```

http://localhost:5173 で開きます。

## ビルド・デプロイ

```bash
npm run build
```

`dist/` に静的ファイルが出力されます。Vercel / Netlify / GitHub Pages 等にそのままデプロイできます。

## データの編集

コンテンツは **`src/data/nodes.ts`** に集約されています。

### ノードの追加・編集

`NODES` 配列の各オブジェクトが 1 つのノード（源流・本流・支流・淵）に対応します。

```ts
{
  id: 'mynode',           // 一意のID（英数字）
  kind: 'tributary',      // 'source' | 'main' | 'tributary' | 'eddy'
  theme: 'field',         // 'source' | 'main' | 'theory' | 'field' | 'reflexive' | 'watershed'
  no: '支流N',            // 表示用ラベル
  title: 'タイトル',
  sub: '支流 ／ フィールド',
  summary: '概要文…',
  question: '問い（任意）',
  insight: '気づき（任意）',
  note: 'https://note.com/...',  // note記事URL（任意、空なら「未設定」表示）
  joinsAt: 'assemblage',         // 合流先の本流ノードID
}
```

### note記事URLの差し込み

`note` フィールドが空のノードは、パネルに「noteリンク未設定」と表示されます。記事公開後に URL を記入してください。該当箇所：

- `posthuman`（支流2）
- `aizu`（支流3）
- `syneco`（支流4）
- `designothernames`（支流8）
- `resourceful`（支流9）
- `fudo`（支流10）
- `weaving`（本流3）
- `watershed`（支流11）

### 伏流水（地下水脈）の追加

`SUBTERRANEAN` 配列に `{ from, to, label }` を追加すると、2 ノード間に点線が描かれます。

### ノードの位置

ノードの描画位置は `src/data/geometry.ts` の `MAIN_SPINE`（本流）と `TRIBUTARY_POSITIONS`（支流）で管理しています。支流の曲線は `TRIBUTARY_CURVES` で制御できます。

## 技術スタック

- Vite + React + TypeScript
- SVG によるレンダリング（d3 不使用）
- CSS アニメーション（水流・淵の回転）
- 依存パッケージは React のみ
