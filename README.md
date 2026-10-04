# YuzinA Studio

既存の GitHub Pages サイトです。

公開先: https://kingkazuma1015.github.io/yuzin_A_studio/

## 2026-10-04 の使いやすさ改善

- スマホの作品一覧を通常の横スワイプに変更。7つの作品リンクを保持。
- 画面幅、ポインター、動きを減らす設定の変更に追従。
- デスクトップの自動スクロールに停止・再開操作を追加。フォーカス中、ホバー中、画面外、非表示タブでは停止。
- メール相談をネイティブの dialog に変更。宛先・件名・本文のコピー、失敗時の手動コピー案内、メールアプリでの送信手順を追加。
- 確認済みの料金・初稿納期、伴奏音源と参考音源の違いを明記。
- 欠落していた背景 SVG と SNS 用 PNG（1200×630）を追加。

## 検証

Python 3 と Node.js で実行します。外部パッケージは不要です。

```sh
python3 tests/check_site.py
```

HTML、参照先、画像サイズ、作品リンク、基本的な CSS ブロックと JavaScript 構文を検証します。DOM のテストダブルで画面幅や動き設定の変更、停止・再開、メール操作も検証します。これらは実機ブラウザーでの見た目・タッチ・フォーカストラップの検証を代替しません。

## 変更前への戻し方

変更前の状態は、以下のリモートブランチに保存しています。

- ブランチ: `backup/before-usability-fixes-2026-10-04`
- コミット: `ffd90005e01cc18e6227f649e91220a11dc9ba46`
- ツリー: `85ede95ce343a6aabbb543da86d7faaf05592fa6`
- [GitHub でバックアップを見る](https://github.com/kingkazuma1015/yuzin_A_studio/tree/backup/before-usability-fixes-2026-10-04)

直後に今回の修正だけを取り消すなら、この修正のコミットを `git revert` して通常の push を行えます。後から別の変更が入った場合は差分と競合を確認してください。

サイト全体を保存済みの状態に戻す手順は次のとおりです。作業ツリーがクリーンなことを先に確認し、未コミットの作業がある場合は実行しないでください。この手順はバックアップ後のサイト変更もすべて取り消します。

```sh
git status
git fetch origin
git switch main
git pull --ff-only origin main
git restore --source=origin/backup/before-usability-fixes-2026-10-04 --staged --worktree -- .
git diff --cached --stat
# 差分を確認してから実行
git commit -m "Restore site to pre-usability-fix snapshot"
git push origin main
```

復元も新しいコミットとして残すため、履歴の書き換えや force push は不要です。GitHub Actions の `pages build and deployment` が、復元コミットに対して成功したことと、公開 URL を確認してください。バックアップブランチ自体は削除・上書きせずに保管してください。
