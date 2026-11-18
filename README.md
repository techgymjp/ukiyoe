# 浮世絵職人

浮世絵は、何枚もの版木を一色ずつ摺り重ねてできています。
お手本の浮世絵を見て**版（レイヤー）を摺る順番**を見抜き、自分の手で摺り上げるWEBゲームです。

## 遊び方

1. **お手本を見る**：その浮世絵が何枚の版でできているかが示されます。
2. **版を選ぶ**：並んだ版木（順番はばらばら）から、次に摺る版を選びます。
   主版（墨の線）が最初、色は**薄い色→濃い色**の順。
3. **自分で摺る**：摺りモードになり、ばれんで紙をまんべんなくこすると、その版の色が紙に移ります。
4. **摺り上がり**：摺り上がった時に順番が違っていたら**ゲームオーバー**。
   全部正しければクリアで、自動的に**次の浮世絵**へ進みます。ムラなく摺れば「PERFECT!」で満点。

タイトルからは作品を選ばず、次の順に出題されます（やさしい順）。

| 図 | 作品 | 絵師 | ジャンル |
|---|---|---|---|
| 1 | 東海道五拾三次之内 蒲原 夜之雪 | 歌川広重 | 風景画 |
| 2 | 冨嶽三十六景 凱風快晴 | 葛飾北斎 | 風景画 |
| 3 | 婦女人相十品 ポッピンを吹く娘 | 喜多川歌麿 | 美人画 |
| 4 | 冨嶽三十六景 神奈川沖浪裏 | 葛飾北斎 | 風景画 |
| 5 | 三代目大谷鬼次の江戸兵衛 | 東洲斎写楽 | 役者絵（歌舞伎） |
| 6 | 名所江戸百景 大はしあたけの夕立 | 歌川広重 | 風景画 |
| 7 | 寛政三美人 | 喜多川歌麿 | 美人画 |
| 8 | 市川鰕蔵の竹村定之進 | 東洲斎写楽 | 役者絵（歌舞伎） |

摺り上げた作品は画廊に飾られます。BGM（箏と尺八風）と効果音は WebAudio でその場で合成しており、右上で切り替えられます。

## 実行

ビルド不要の静的サイトです。版を作るために画像を解析するので、Webサーバー経由で開いてください（GitHub Pages ならそのまま動きます）。

```bash
python3 -m http.server 8000
```

## GitHub Pages で公開

リポジトリの **Settings → Pages** で Source を `Deploy from a branch`、Branch を `main` / `/ (root)` にして保存します。

## 原画のクレジット

`assets/originals/` の画像は、メトロポリタン美術館（The Metropolitan Museum of Art）の Open Access によるパブリックドメイン（CC0）画像です。

- 歌川広重「東海道五拾三次之内 蒲原 夜之雪」 The Howard Mansfield Collection, Purchase, Rogers Fund, 1936（JP2492）
- 葛飾北斎「冨嶽三十六景 凱風快晴」 Rogers Fund, 1914（JP9）
- 喜多川歌麿「婦女人相十品 ポッピンを吹く娘」 H. O. Havemeyer Collection, Bequest of Mrs. H. O. Havemeyer, 1929（JP1662）
- 葛飾北斎「冨嶽三十六景 神奈川沖浪裏」 H. O. Havemeyer Collection, Bequest of Mrs. H. O. Havemeyer, 1929（JP1847）
- 東洲斎写楽「三代目大谷鬼次の江戸兵衛」 Henry L. Phillips Collection, Bequest of Henry L. Phillips, 1939（JP2822）
- 歌川広重「名所江戸百景 大はしあたけの夕立」 The Howard Mansfield Collection, Purchase, Rogers Fund, 1936（JP2522）
- 喜多川歌麿「寛政三美人」 Fletcher Fund, 1929（JP1528）
- 東洲斎写楽「市川鰕蔵の竹村定之進」 Harris Brisbane Dick Fund and Rogers Fund, 1949（JP3114）

版は `tools/separate.py` で原画を主版（細い墨線）と色版（明るさの順）に色分解して作っています。
さらに `tools/freshen.py` で、紙の黄ばみ・褪色・染み・墨のかすれを修復し、摺りたての色にしています（`assets/fresh/`）。

## 構成

```
index.html          画面構成
asobikata.html      遊び方のページ
css/style.css       スタイル
js/util.js          汎用関数・効果音とBGM（WebAudio）
js/designs.js       顔料の色
js/meisaku.js       出題する作品の一覧（この順に出題）
js/render.js        摺りの描画エンジン（和紙・木目・摺りムラ）
js/game.js          ゲーム本体（版選び・摺り・判定・画廊）
assets/originals/   原画（CC0）
assets/fresh/       摺りたての色に修復した版の色
assets/plates/      原画の色分解ラベル画像
tools/separate.py   原画を主版と色版に色分解するツール
tools/freshen.py    色分解した版を摺りたての色に修復するツール
```
