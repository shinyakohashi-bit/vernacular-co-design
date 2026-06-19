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

### 川のジオメトリ・支流の配置

描画位置は `src/data/geometry.ts` が自動生成します。座標を手で置くのではなく、トポロジー（`joinsAt`）と固定シードの擬似乱数から、川らしい蛇行・合流・ばらつきを計算します。

- **本流の流路**：源流（左上 `SOURCE`）から河口（右下 `MOUTH`）への対角線に、`meander()` の非対称な蛇行を重ねた中心線。可変幅の塗りで下流ほど拡幅し、合流点で膨らみ、河口で三角州状にフェードします。
- **本流ノードの位置**：`MAIN_U`（媒介変数 0=源流〜1=河口）で指定。
- **支流の区間**：本流を A/B/C/D の 4 区間に分け、`TRIB_ORDER`（テキスト順）に従って各支流を区間内へ配置。位置・岸の左右・進入角・長さ・湾曲は **`LAYOUT_SEED`** による擬似乱数で不等間隔・非対称に散らします。
- **配置を変えたいとき**：`LAYOUT_SEED` の値を差し替えるだけで、順序は保ったまま別の配置に再ロールできます（リロードしても同じ配置）。
- **淵（支流6 竹野再訪）**：側方支流ではなく本流上の渦として描画します。

## 技術スタック

- Vite + React + TypeScript
- SVG によるレンダリング（d3 不使用）
- CSS アニメーション（水流・淵の回転）
- 依存パッケージは React のみ
