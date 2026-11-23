# AYA 3D Motion Studio（仮称）

Kling AI公式サイトで3Dキャラクター動画を作るための、Windowsローカルの制作支援アプリです。
キャラと固定プロンプトを登録し、場面ごとの英語プロンプト（日本語訳つき）を作り、参照動画と生成動画をまとめて管理します。

現在は「段階1 ステップ1-0 土台」の作業中です。仕様は `docs/design.md`、開発ルールは `AGENTS.md` を参照してください。

## 開発の始め方

必要なもの: Windows 10 / 11（64bit）、Node.js 22 LTS（22.13以上）、npm、Git

```powershell
npm install
npm run dev
```

## コマンド

| コマンド | 内容 |
| --- | --- |
| `npm run dev` | 開発用ウィンドウを開く |
| `npm run build` | 型チェックとビルド |
| `npm run lint` | ESLintとPrettierの検査 |
| `npm run typecheck` | TypeScriptの型チェック |
| `npm run test` | 単体テスト |
| `npm run test:e2e` | ビルド後、Electronを起動して画面を確認（Windowsのデスクトップで実行） |

## データの保存場所

既定は `C:\Users\<名前>\AYA 3D Motion Studio` です（OneDriveの外）。
加工前の実写動画はこのアプリに入れません。参照動画は、顔をぼかした加工済みのものだけを登録します。
