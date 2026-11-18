# 浮世絵職人

浮世絵は、何枚もの版木を一色ずつ摺り重ねてできています。
お手本の浮世絵を見て**版（レイヤー）を摺る順番**を見抜き、自分の手で摺り上げるWEBゲームです。

## 遊び方

1. **お手本を見る**：その浮世絵が何枚の版でできているかが示されます。
2. **版を選ぶ**：並んだ版木（順番はばらばら）から、次に摺る版を選びます。
   主版（墨の線）が最初。色版は**ほかの版の下に敷かれる版から**先に摺る（下地を後から摺ると上の色が隠れる）。
3. **自分で摺る**：摺りモードになり、ばれんで紙をまんべんなくこすると、その版の色が紙に移ります。
4. **摺り上がり**：摺り上がった時に順番が違っていたら**ゲームオーバー**。
   全部正しければクリアで、自動的に**次の浮世絵**へ進みます。ムラなく摺れば「PERFECT!」で満点。

タイトルからは作品を選ばず、次の順に出題されます（版の少ない、やさしい順）。

| 図 | 作品 | 絵師 | ジャンル |
|---|---|---|---|
| 1 | 日傘をさす女（婦女人相十品） | 喜多川歌麿 | 美人画 |
| 2 | 蒲原 夜之雪（東海道五拾三次） | 歌川広重 | 風景画 |
| 3 | 凱風快晴（冨嶽三十六景） | 葛飾北斎 | 風景画 |
| 4 | ポッピンを吹く娘（婦女人相十品） | 喜多川歌麿 | 美人画 |
| 5 | 甲州石班沢（冨嶽三十六景） | 葛飾北斎 | 風景画 |
| 6 | 庄野 白雨（東海道五拾三次） | 歌川広重 | 風景画 |
| 7 | 風の中の二人の娘 | 鈴木春信 | 美人画 |
| 8 | 尾州不二見原（冨嶽三十六景） | 葛飾北斎 | 風景画 |
| 9 | 二代目沢村淀五郎の川つら法眼と坂東善次の鬼佐渡坊 | 東洲斎写楽 | 役者絵（歌舞伎） |
| 10 | 日本橋 朝之景（東海道五拾三次） | 歌川広重 | 風景画 |
| 11 | 木曽路ノ奥阿弥陀ヶ滝（諸国瀧廻り） | 葛飾北斎 | 風景画 |
| 12 | 浅草田甫酉の町詣（名所江戸百景） | 歌川広重 | 風景画 |
| 13 | 大はしあたけの夕立（名所江戸百景） | 歌川広重 | 風景画 |
| 14 | 神奈川沖浪裏（冨嶽三十六景） | 葛飾北斎 | 風景画 |
| 15 | 三代目大谷鬼次の江戸兵衛 | 東洲斎写楽 | 役者絵（歌舞伎） |
| 16 | 山下白雨（冨嶽三十六景） | 葛飾北斎 | 風景画 |
| 17 | 寛政三美人 | 喜多川歌麿 | 美人画 |
| 18 | 深川洲崎十万坪（名所江戸百景） | 歌川広重 | 風景画 |
| 19 | 三代目沢村宗十郎の名護屋山三と三代目瀬川菊之丞の傾城かつらぎ | 東洲斎写楽 | 役者絵（歌舞伎） |
| 20 | 市川鰕蔵の竹村定之進 | 東洲斎写楽 | 役者絵（歌舞伎） |

摺り上げた作品は画廊に飾られます。BGM（箏と尺八風）と効果音は WebAudio でその場で合成しており、右上で切り替えられます。

## 実行

Web 版はビルド不要の静的サイトです。版を作るために画像を解析するので、Webサーバー経由で開いてください（GitHub Pages ならそのまま動きます）。

```bash
python3 -m http.server 8000
```

## Android アプリ

[Capacitor](https://capacitorjs.com/) で Android アプリにしています（パッケージ名 `jp.techgym.ukiyoe`）。ゲームのファイルはアプリに同梱しているので、オフラインでも遊べます。

- 動作確認用 APK（デバッグ署名・テスト広告）は、既定ブランチへの push のたびに GitHub Actions が作り、Release に載せます
  - リリース画面：https://github.com/techgymjp/ukiyoe/releases/tag/android-latest
  - APK 直接：https://github.com/techgymjp/ukiyoe/releases/latest/download/ukiyoe.apk
  - スマホのカメラで読み取る QR コード（リリース画面）：

    ![リリース画面の QR コード](docs/apk-qr.png)

- Google Play 用の署名付き AAB は、GitHub Secrets（`ANDROID_KEYSTORE_BASE64` など 4 つ）を登録すると Actions の Artifact に `ukiyoe-release-aab` として出ます
- 広告（AdMob）：バナーはタイトル・遊び方・一時停止・結果の画面だけ。全画面広告はプレイ開始・タイトルへ戻る・再開・次の図へ のたび。リワード広告を見ると、順番をまちがえた版を摺る前に戻ってやり直せます（1 ゲーム 5 回まで）
- ローカルでの準備：

```bash
npm ci
```

```bash
npm run android:sync
```

## ライセンス

著作権はテックジム株式会社に帰属します（All rights reserved）。許可なく複製・改変・再配布すること、Web サイトやアプリとして公開・販売すること、名前・ロゴ・アイコン・画像を使用することを禁止します。
テックジムの受講生が学習目的で複製・改変することは許可しますが、アプリストアでの公開・広告の掲載・販売などの商用利用は禁止です。詳しくは [LICENSE](LICENSE) をご覧ください。
浮世絵の原画はメトロポリタン美術館のパブリックドメイン（CC0）画像です。

## GitHub Pages で公開

リポジトリの **Settings → Pages** で Source を `Deploy from a branch`、Branch を `main` / `/ (root)` にして保存します。

## 原画のクレジット

`assets/originals/` の画像は、メトロポリタン美術館（The Metropolitan Museum of Art）の Open Access によるパブリックドメイン（CC0）画像です（括弧内は所蔵番号）。

- 喜多川歌麿「婦女人相十品 日傘をさす女」 The Howard Mansfield Collection, Purchase, Rogers Fund, 1936（JP2730）
- 歌川広重「東海道五拾三次之内 蒲原 夜之雪」 The Howard Mansfield Collection, Purchase, Rogers Fund, 1936（JP2492）
- 葛飾北斎「冨嶽三十六景 凱風快晴」 Rogers Fund, 1914（JP9）
- 喜多川歌麿「婦女人相十品 ポッピンを吹く娘」 H. O. Havemeyer Collection, Bequest of Mrs. H. O. Havemeyer, 1929（JP1662）
- 葛飾北斎「冨嶽三十六景 甲州石班沢」 The Howard Mansfield Collection, Purchase, Rogers Fund, 1936（JP2581）
- 歌川広重「東海道五拾三次之内 庄野 白雨」 Rogers Fund, 1914（JP41）
- 鈴木春信「風の中の二人の娘（Two Women in a Storm）」 The Howard Mansfield Collection, Purchase, Rogers Fund, 1936（JP2440）
- 葛飾北斎「冨嶽三十六景 尾州不二見原」 Rogers Fund, 1914（JP19）
- 東洲斎写楽「二代目沢村淀五郎の川つら法眼と坂東善次の鬼佐渡坊」 Harris Brisbane Dick Fund and Rogers Fund, 1949（JP3115）
- 歌川広重「東海道五拾三次之内 日本橋 朝之景」 Rogers Fund, 1918（JP471）
- 葛飾北斎「諸国瀧廻り 木曽路ノ奥阿弥陀ヶ滝」 Museum Accession（JP1085）
- 歌川広重「名所江戸百景 浅草田甫酉の町詣」 Rogers Fund, 1914（JP60）
- 歌川広重「名所江戸百景 大はしあたけの夕立」 The Howard Mansfield Collection, Purchase, Rogers Fund, 1936（JP2522）
- 葛飾北斎「冨嶽三十六景 神奈川沖浪裏」 H. O. Havemeyer Collection, Bequest of Mrs. H. O. Havemeyer, 1929（JP1847）
- 東洲斎写楽「三代目大谷鬼次の江戸兵衛」 Henry L. Phillips Collection, Bequest of Henry L. Phillips, 1939（JP2822）
- 葛飾北斎「冨嶽三十六景 山下白雨」 Rogers Fund, 1914（JP11）
- 喜多川歌麿「寛政三美人」 Fletcher Fund, 1929（JP1528）
- 歌川広重「名所江戸百景 深川洲崎十万坪」 The Howard Mansfield Collection, Purchase, Rogers Fund, 1936（JP2520）
- 東洲斎写楽「三代目沢村宗十郎の名護屋山三と三代目瀬川菊之丞の傾城かつらぎ」 Harris Brisbane Dick Fund and Rogers Fund, 1949（JP3122）
- 東洲斎写楽「市川鰕蔵の竹村定之進」 Harris Brisbane Dick Fund and Rogers Fund, 1949（JP3114）

版は `tools/separate.py` で原画を主版（細い墨線）と色版（明るさの順）に色分解し、`tools/layers.py` で下地の版を上の版の下まで広げて「重なる層」にしています。どの版がどの版の下に敷かれるか（摺る順番の決まり）も同じツールで求め、決まりどおりに重ねると色分けと完全に一致し、決まりを破ると絵が崩れることを検証しています。
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
js/game.js          ゲーム本体（版選び・摺り・判定・画廊・一時停止・戻るボタン）
js/ads.js           AdMob 広告（Android アプリのときだけ動く）
scripts/build-web.js  www/ にまとめるビルド（--app でアプリ用）
android/            Android プロジェクト（Capacitor）
assets/originals/   原画（CC0）
assets/fresh/       摺りたての色に修復した版の色
assets/plates/      原画の色分解ラベル画像
tools/separate.py   原画を主版と色版に色分解するツール
tools/freshen.py    色分解した版を摺りたての色に修復するツール
```
