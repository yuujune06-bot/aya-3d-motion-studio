# AYA 3D Motion Studio — 開発ルール

## 概要
Kling AI公式サイトで3Dキャラクター動画を作るための、Windowsローカルの制作支援アプリ。
キャラ・固定プロンプトの管理、場面別の英語プロンプト（日本語訳つき）の生成、参照動画と生成動画の管理を行う。
仕様は docs/design.md が正。仕様と実装が食い違うときは実装を止め、違いを報告する。

## 技術
Electron + React + TypeScript(strict) + electron-vite / Zustand / Zod / Tailwind + shadcn/ui /
sharp / Vitest / Playwright / electron-builder。
土台と保存部品は AYA Reel Editor から持ち込んだもの。これ以外の依存を足すときは理由を報告に書く。

## 絶対に守ること（プライバシー）
- 子どもの実写素材を扱う。アプリからネットワーク通信をしない（外部リンクはKlingのドメインを既定ブラウザで開くことだけ）
- 加工前の実写動画は段階1では扱わない。参照動画は「加工済み確認（processedConfirmedAt）」がなければ保存しない
- Klingに渡す送信用フォルダ（outgoing）には、そのショットの参照動画とキャラ画像の2つだけを置く
- プロンプトにキャラ名を入れない（キャラごとの「呼び方」promptLabel、例 "the child" / "the woman" を使う）
- 翻訳などで外部AIを呼ばない。英語と日本語訳は、英日ペアの部品から組み立てる

## 絶対に守ること（安全・データ）
- contextIsolation:true / nodeIntegration:false / sandbox:true を変えない
- IPCの入力はメイン側でZod検証する。rendererから任意パスの読み書きや任意URLを渡させない
- ファイル操作は StorageService.resolveInRoot を通す。JSON保存は writeJsonAtomic のみ
- ユーザーの元ファイル（取り込み元の画像・動画）を変更・削除しない。削除はアプリ内の trash への移動
- 自動削除はしない
- 画面の文言は日本語で、専門用語を避ける。エラーは src/shared/errors.ts のコードで扱う

## コードの置き場
- 純粋なロジック（プロンプト生成、注意の判定など）は src/shared/ に置き、必ず単体テストを書く
- 副作用（ファイル・クリップボード・外部リンク）は src/main/services/ に閉じ込める
- 外部生成の差し替え口は src/main/providers/（段階1は ManualKlingProvider のみ）

## 完了の条件
- npm run lint / typecheck / test / build がすべて通る
- 指示されたステップの範囲だけを実装し、先のステップの機能を先取りしない
- 報告に: 実装したこと / 仕様から変えたことと理由 / 手動確認の手順 / 未解決の課題
- コミットするときは Conventional Commits（feat: / fix: / test: / chore:）
