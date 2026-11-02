# JLPT 自習アプリ N5〜N1

静的・オフライン対応のJLPT自習Webアプリケーション。

## GitHub Pagesでの公開方法

1. このZIPを展開する
2. 中身（index.html, data/, .nojekyll, README.md）をすべて  
   `https://github.com/karurosuma/jlpt` の **main** ブランチにアップロード
3. リポジトリの **Settings → Pages** を開く
4. Source を **Deploy from a branch** → **main** / **/ (root)** に設定して Save
5. 数分後に以下でアクセスできます：

**https://karurosuma.github.io/jlpt/**

## 含まれるもの
- `index.html` … アプリ本体
- `data/n5.db` ～ `data/n1.db` … 各レベルの学習データ
- `.nojekyll` … GitHub Pages用

オンライン取得先はすでに `https://karurosuma.github.io/jlpt/data/` に設定済みです。
