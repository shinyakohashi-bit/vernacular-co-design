export type NodeKind = 'source' | 'main' | 'tributary' | 'eddy';
export type Theme = 'source' | 'main' | 'theory' | 'field' | 'reflexive' | 'watershed';

export interface RiverNode {
  id: string;
  kind: NodeKind;
  theme: Theme;
  no: string;
  title: string;
  sub: string;
  summary: string;
  question?: string;
  insight?: string;
  note?: string;
  joinsAt?: string;
}

export const MAIN_ORDER = ['nagomi', 'assemblage', 'drift', 'weaving'] as const;

export const SUBTERRANEAN: { from: string; to: string; label: string }[] = [
  { from: 'minamata', to: 'nagomi', label: '翻訳の原点' },
  { from: 'gardener', to: 'weaving', label: 'Doing → Being' },
];

export const NODES: RiverNode[] = [
  {
    id: 'nagomi', kind: 'source', theme: 'source', no: '源流1',
    title: 'なごみの灯りの衝撃', sub: '兵庫県豊岡市・竹野 ／ 源流',
    summary: '専門デザイナー不在のまま生まれた、流木と和紙の灯り。兵庫・竹野でのこの出会いが、「専門家がいなくても優れたデザインは生まれる。ではデザイナーとは何者か」という、すべての問いの源流となった。',
    question: '専門家が介在しない「土着的なコ・デザイン」はどのように生まれてくるのだろうか？ そして、そのエコシステムに対して、我々のような「専門家」としてのデザイナーはどのように関与すべきなのだろうか？',
    note: 'https://note.com/kohakocher/n/nabfd163a736d',
  },
  {
    id: 'gardener', kind: 'tributary', theme: 'theory', no: '支流1', joinsAt: 'assemblage',
    title: '「庭師」としてのデザイナー', sub: '支流 ／ 考察',
    summary: '「建築家ではなく庭師のように考えよう」というイーノの言葉を起点に、庭師的なデザイナーが現場で実際にどうふるまっているのかを問う。目的主導の建築家に対し、場所に応答し偶発から意味を紡ぐあり方を、実践のレベルで捉えようとする。',
    question: '「庭師」的なデザイナーは、実際に現場でどのようなふるまいをしているのか？',
    note: 'https://note.com/kohakocher/n/ncc2660c25434',
  },
  {
    id: 'posthuman', kind: 'tributary', theme: 'theory', no: '支流2', joinsAt: 'assemblage',
    title: 'ポストヒューマニズムデザイン', sub: '支流 ／ 先行研究（R. Wakkary）',
    summary: 'ロン・ワッカリーの議論を手がかりに、人間中心を超えてデザインを捉え直す。設計の主体を人だけに置かず、モノや非人間アクターと共につくる「人間以上（More-than-Human）」の世界へと視点を開く理論的支流。',
  },
  {
    id: 'aizu', kind: 'tributary', theme: 'field', no: '支流3', joinsAt: 'assemblage',
    title: '会津でのフィールドワーク', sub: '支流 ／ 福島県・会津',
    summary: '神代欅の位牌と石高プロジェクト（米×Web3.0）の現場。千年埋もれた木や、米を価値の単位とする経済など、自然と歴史が生んだ「不規則なアクター」の翻訳に出会い、「土着的なデザイン＝アクターの意味を翻訳し直すこと」という定義が立ち上がった。',
  },
  {
    id: 'assemblage', kind: 'main', theme: 'main', no: '本流1',
    title: '人間とモノのアッサンブラージュ', sub: '本流 ／ 最初の考察',
    summary: '「土着的なコ・デザイン」とは、身のまわりを構成する人間／非人間のアクターに意識を向け、その意味を再解釈し、媒介し直すこと。デザインを人だけの営みから、モノや場との編み合わせへと開く最初の気づき。',
    insight: '「土着的なコ・デザイン」とは…身のまわりを構成する人間／非人間の「アクター」に意識を向け、意味を再解釈し、媒介し直すこと。',
    note: 'https://note.com/kohakocher/n/n96dff8a41115',
  },
  {
    id: 'syneco', kind: 'tributary', theme: 'field', no: '支流4', joinsAt: 'drift',
    title: '協生農法 & シネコポータル', sub: '支流 ／ 実践（作庭）',
    summary: '混成密生で生態系そのものを育てる協生農法と、その小さな実践キット「シネコポータル」。自宅ベランダで制御できない生態系と日々関わることで、「庭師」のふるまいを読むのではなく身体で確かめる実践。',
  },
  {
    id: 'toolview', kind: 'tributary', theme: 'theory', no: '支流7', joinsAt: 'drift',
    title: 'デザインを「道具観」から考える', sub: '支流 ／ 考察',
    summary: 'つくる主体と、つくられる道具・素材との関係を組み替える視点。モノを受け身の対象ではなく、応答し働きかけてくる相手として捉え直すことで、庭師的なふるまいの足場を「道具観」の側から照らす。',
    note: 'https://note.com/kohakocher/n/n30f858b4b89c',
  },
  {
    id: 'takeno', kind: 'eddy', theme: 'reflexive', no: '支流6', joinsAt: 'drift',
    title: '竹野フィールドワーク（再訪）', sub: '淵（よどみ）／ 反省的ブレイクダウン',
    summary: '源流の地・竹野を再び訪ね、自らの語りがいつのまにか「美化された物語」になっていたことに気づく。流れを一度せき止め澱ませる〈淵〉のような再訪が、線形な美談への回収を内側から問い直した。',
    note: 'https://note.com/kohakocher/n/n4623cfaf3fc1',
  },
  {
    id: 'minamata', kind: 'tributary', theme: 'field', no: '支流5', joinsAt: 'drift',
    title: '水俣フィールドワーク', sub: '支流 ／ 熊本県・水俣',
    summary: '汚染された海を埋め立てた地に立つ水俣で、原料を種から育てる紙漉き工房に出会う。「アクターの翻訳」だけでは近代と土着を分けられない——その原点をブラックボックス化せず〈つなぎとめる〉ことこそが両者を分かつ、という気づきが生まれた。',
    question: '「アクターの翻訳」という観点だけでは、庭師的なデザインと建築家的なデザインの本質を説明しきれない。',
    note: 'https://note.com/kohakocher/n/n5607569c7da4',
  },
  {
    id: 'drift', kind: 'main', theme: 'main', no: '本流2',
    title: '「ドリフト」というデザインプラクティス', sub: '本流 ／ デザインプラクティスの類型',
    summary: '意味（目的）と手立て（手段）がともに動的に変化していく実践のかたち。手段の変更が時間をかけてシステム全体を、そして当初の目的すらも変えてしまう——設計でもブリコラージュでもない、漂流するデザイン。',
    question: '「庭師としてのデザイナー」を単なる「実践」や「ふるまい」（＝Doing）ではなく、デザイナーのあり方（＝Being）として捉え直す必要があるのではないか？',
    note: 'https://note.com/kohakocher/n/n04485937b97e',
  },
  {
    id: 'designothernames', kind: 'tributary', theme: 'theory', no: '支流8', joinsAt: 'weaving',
    title: 'Design with other Names', sub: '支流 ／ 先行研究',
    summary: 'カルデロン＝サラザールとグティエレス＝ボレロの議論。「デザイン」という語の独占を超え、そう名づけられてこなかった営みを「もうひとつのデザイン」として捉え、非デザイナーを「多数世界」の担い手として見直す視座。',
  },
  {
    id: 'resourceful', kind: 'tributary', theme: 'theory', no: '支流9', joinsAt: 'weaving',
    title: '「資源的人」', sub: '支流 ／ 先行研究（塚本由晴）',
    summary: '近代の「人的資源（Human Resources）」への対概念として塚本由晴が提唱する「資源的人（Resourceful Men）」。漁師や農家を、土地の資源を読み使いこなす存在＝庭師的なデザイナーとして捉え直す視点。',
  },
  {
    id: 'fudo', kind: 'tributary', theme: 'theory', no: '支流10', joinsAt: 'weaving',
    title: '風土学', sub: '支流 ／ 先行研究（和辻哲郎・オギュスタン・ベルク）',
    summary: '和辻哲郎の「風土」と、それをメソロジー（mésologie）として展開したオギュスタン・ベルク。自然と主体の〈あいだ〉に立ち上がる関係として土地を捉える視座が、土着的なデザインの存在論的な土台となる。',
  },
  {
    id: 'weaving', kind: 'main', theme: 'main', no: '本流3',
    title: '「建築家」と「庭師」の\n存在論的編み合わせ', sub: '本流 ／ Ontological Weaving',
    summary: 'デザイナーの「役割（Doing）」から「あり方（Being）」へ。一人の中に建築家（目的主導・計画と制御）と庭師（場所主導・応答とケア）のモードが動的に共存し、状況に応じて織りなされる存在として捉え直す。',
  },
  {
    id: 'watershed', kind: 'tributary', theme: 'watershed', no: '支流11', joinsAt: 'estuary',
    title: '流域思考', sub: '支流 ／ 先行研究（岸由二）',
    summary: '岸由二が提唱する、足もとの大地を行政区ではなく「流域」という集水地形＝生態系の単位で捉え直す思想。このリサーチ全体を「流域」として描く見立てそのものの源泉であり、入れ子状に編み合う水の構造を与える。',
  },
];
