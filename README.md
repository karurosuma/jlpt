# JLPT 自習アプリ N5〜N1

静的・オフライン対応のJLPT自習Webアプリケーション。

**iOS 26 Liquid Glass スタイルにリデザイン済み** (2026-11-16)

## GitHub Pagesでの公開方法

1. このZIPを展開する
2. 中身（index.html, app.js, style.css, data/, .nojekyll, README.md, アイコン類）をすべて  
   `https://github.com/karurosuma/jlpt` の **main** ブランチにアップロード
3. リポジトリの **Settings → Pages** を開く
4. Source を **Deploy from a branch** → **main** / **/ (root)** に設定して Save
5. 数分後に以下でアクセスできます：

**https://karurosuma.github.io/jlpt/**

## 含まれるもの
- `index.html` … アプリ本体（Liquid Glass UI）
- `app.js` … ロジック（動的タブバー対応）
- `style.css` … iOS 26 スタイル
- `data/data.db` … 学習データ
- `.nojekyll` … GitHub Pages用
- アイコン類

キャッシュバスティング: style.css / app.js に `?v=20261116ios26` を使用。
