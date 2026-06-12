# 情報科学基礎 クイズ

画像から作成した情報科学基礎のクイズアプリです。

## 使い方

`index.html` をブラウザで開くと利用できます。

- ランダム版: 各問題番号から1問ずつ出題
- 全問版: 収録されている全48問を出題
- 理解度テスト: 貼り付けテキストから作成した107問から、10問・20問・50問・全問を選んでランダム出題
- 回答すると自動で次の問題へ進みます
- 途中で「ホームへ戻る」から中断できます
- 最後に成績と回答確認を表示します
- 成績画面から間違えた問題だけ再挑戦できます

## Supabaseで成績を保存する

Supabaseを使うと、回答終了時の成績をオンラインにも記録できます。

1. Supabaseのプロジェクトを開く
2. SQL Editorで `supabase-schema.sql` の内容を実行する
3. Project Settings > API から `Project URL` と `anon public` key を確認する
4. `data/supabase-config.js` に以下のように入力する

```js
globalThis.QUIZ_SUPABASE_CONFIG = {
  url: "https://xxxxx.supabase.co",
  anonKey: "xxxxx",
  table: "quiz_attempts",
};
```

この設定では、公開ページからは成績の追加だけを許可し、成績一覧の読み取りは許可していません。ランキングや全員の成績はSupabaseのTable Editorで確認します。

## ファイル

- `index.html`: 画面
- `styles.css`: デザイン
- `app.js`: クイズの進行ロジック
- `data/questions.js`: アプリが読み込む問題データ
- `data/questions.json`: 編集用の問題データ
- `data/comprehension.js`: 理解度テスト用の問題データ
- `data/comprehension.json`: 理解度テスト用の編集データ
- `data/supabase-config.js`: Supabase接続設定
- `supabase-schema.sql`: Supabaseに作成する成績テーブルと権限設定
