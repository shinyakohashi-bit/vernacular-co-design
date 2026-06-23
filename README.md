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
}
```

ノードの **地図上の位置・川の形・ラベルの配置** は `nodes.ts` ではなく、デザイン案の SVG（後述）で決まります。`nodes.ts` は各ノードの **本文（概要・問い・気づき・note URL）** と種別を担います。`id` が SVG 側の円の id と一致している必要があります。

### note記事URLの差し込み

`note` フィールドが空のノードは、パネルに「noteリンク未設定」と表示されます。記事公開後に URL を記入してください。該当箇所：

- `posthuman`
- `aizu`
- `syneco`
- `movinggarden`（動いている庭）
- `designothernames`
- `weaving`
- `watershed`

## 川の形・配置（デザイン案の SVG で決まる）

地図のレイアウト（川の蛇行・支流の起点・各ラベルの位置と文言）は、Illustrator で作成した **`src/assets/watershed.svg`** をそのまま使っています。アプリは起動時にこの SVG をパースし、

- `<path>`：水路（本流＋支流）の塗り形状
- `<circle id="...">`：各ノードの位置（`id` が `nodes.ts` の `id` と対応）
- `<text>`：ラベルの文言・位置・改行（最も近いノードに自動で割り当て）

を読み取ります（実装は `src/data/layout.ts`）。配色（washi・テーマカラー）・明朝・パン&ズーム・流れのアニメーションはアプリ側で再適用します。

### レイアウトを変えたいとき

**`src/assets/watershed.svg` を差し替えるだけ**です。Illustrator 側の約束：

- アートボード 1 枚。`viewBox` の座標系がそのままアプリ座標になります。
- 各ノードの円に、`nodes.ts` の `id` と同じ **オブジェクト名（id）** を付ける。
- 新規ノードの円は id 無しでも可（1 つだけなら `movinggarden` に割り当てられます。複数増やす場合は `layout.ts` の `UNNAMED_NODE_ID` 周辺を調整）。
- 書き出しは Object IDs=Layer Names / Minify オフ / パスはアウトライン化しない。

### id が無いノード（動いている庭）

`nodes.ts` に本文を持ち、SVG 側では id 無しの円で配置されています。`layout.ts` が id 無しの円を `movinggarden` に割り当てます。

## 技術スタック

- Vite + React + TypeScript
- デザイン案の SVG を実行時パースして描画（d3 不使用）
- CSS アニメーション（ドリフトのシマー・淵の回転、`prefers-reduced-motion` で停止）
- 依存パッケージは React のみ
