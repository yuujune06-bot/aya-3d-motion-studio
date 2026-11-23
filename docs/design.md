# AYA 3D Motion Studio 段階1 設計書 v0.1

Nov 23, 2026 · @ゆうき

## 0. 概要

段階1は「キャラと固定プロンプトを登録し、場面ごとの英語プロンプト（日本語訳つき）を作り、Klingに渡す素材と生成結果をまとめて管理する」ところまで。動画の加工（顔ぼかし）は段階2で、段階1では扱わない。アプリの価値は生成費の節約ではなく、プライバシーを守る手順、プロンプト作り、素材管理の省力化に置く。

### 決定事項（引き継ぎ資料より）

- 独立したWindowsデスクトップアプリ。Klingは公式サイト（年間プラン）を使い、API連携はしない
- プロンプトは毎回「固定プロンプト＋場面別の動作・表情」。Klingに貼れる英語の完成版と、確認用の日本語訳を出す
- 表情は毎回笑顔に固定しない
- 外部への動画送信は、利用者の明示的な操作だけ。加工前の実写は外に出さない
- 将来AYA Reel Editorへ動画と制作メタデータ（JSON）を渡せるようにする

### 未確定事項と推奨案

| # | 項目 | 選択肢 | 推奨案（この設計書の仮決め） |
| --- | --- | --- | --- |
| Q1 | 正式名称 | 仮称のまま／別名 | 仮称「AYA 3D Motion Studio」で進め、段階1の終わりまでに決める |
| Q2 | 日本語→英語の変換 | A. 英日ペアの部品を選ぶ／B. 自由入力を外部AIで翻訳／C. 自由入力は英語で書く | **A＋C**。場面の要素は英日ペアの部品から選び、部品にない細かい指定だけ英語で追記。日本語で書きたい場合は「翻訳用にコピー」でChatGPT等に渡し、英訳を貼り戻す。アプリから外部AIには送らない |
| Q3 | プロンプト生成方式 | 完全ローカルのテンプレート／AI連携 | 段階1は完全ローカル。AI連携は差し込み口（Provider）だけ用意 |
| Q4 | 保存方式 | JSONファイル／SQLite | JSONファイル。Reel Editorと同じ仕組みを使い回す |
| Q5 | 保存先 | ドキュメント／ユーザーフォルダ直下 | `C:\Users\<名前>\AYA 3D Motion Studio`。Reel Editorで判明したとおり、OneDriveの中は動画の保存・移動に向かない |
| Q6 | Klingへの導線 | ブラウザを開く＋コピー／サイト自動操作 | ブラウザでKlingを開く＋プロンプトをコピー＋添付する2ファイルをエクスプローラーで示す。自動操作は規約と安定性の両面でしない |
| Q7 | Klingのプロンプト文字数上限 | — | 不明（要確認）。設定値にして、超えたら警告だけ出す |
| Q8 | 加工前の実写動画を段階1で取り込むか | 取り込む／取り込まない | **取り込まない**。段階1で登録できる参照動画は、CapCut等で加工済みのものだけ。原本の管理は段階2で、別フォルダに分けて始める |
| Q9 | 配布方式 | インストーラー／開発用起動のみ | 段階1は `npm run dev` での利用。インストーラーは段階3の終わりに検討 |

### 役割分担

| 担当 | 作業の大きさ | 内容 |
| --- | --- | --- |
| Codex | 重い | 各ステップの実装とテスト（郵便屋さん方式で依頼） |
| Claude | 中くらい | 設計書、固定プロンプトと英日ペア部品の文案、コードレビュー、修正指示 |
| Claude | 小さい | 文言・文案の差し替え、設計書の更新、数行で済む修正（PCのフォルダを直接編集） |
| 利用者 | — | ブランチ作成・コミット・手動確認・プッシュ・PR・マージ。仕様の判断 |

## 1. 目的とスコープ

目的は、今は毎回手で書いている英語プロンプトと、バラバラに保存している素材を、「ショット」単位でまとめること。ショット＝Klingで1回生成する単位（参照動画1本＋キャラ画像1枚＋プロンプト1つ → 生成動画）。複数のショットを「制作」（1本のリールぶん）で束ねる。

### 用語

| 用語 | 意味 |
| --- | --- |
| キャラ | 3D版のrui。外見の設定、衣装、キャラ画像（Klingに渡す静止画）を持つ |
| 固定プロンプト | 毎回必ず入れる文。英語と日本語訳のペア。版を管理する |
| 制作 | 1本のリール。複数のショットを持つ |
| ショット | Kling 1回ぶんの生成。場面別の指定と素材と結果を持つ |
| 参照動画 | 動きの手本になる実写。段階1では「顔ぼかし加工済み」のものだけ登録できる |
| 生成動画 | Klingが作ったMP4。1ショットに複数可（作り直しぶん） |

### 段階1で作るもの

| ID | 機能 | 要件 |
| --- | --- | --- |
| M1 | キャラ登録 | 名前・外見（英日）・衣装（複数、既定1つ）・キャラ画像（複数、代表1枚）を登録・編集。固定（ロック）と版数 |
| M2 | 固定プロンプト | 英日ペアのブロックを並べて保存。版数を上げ、過去の版も残す |
| M3 | 場面別入力 | 動作・表情・顔の部位・時間変化・シーンを、英日ペアの部品＋英語の自由追記で入力 |
| M4 | プロンプト生成 | 英語の完成版と日本語訳を並べて表示。英語だけコピー。文字数を表示し上限超過で警告 |
| M5 | 素材の紐づけ | 参照動画（加工済み）と生成動画をショットに登録・再生。取り込み時にプロジェクトへコピーし、元ファイルは触らない |
| M6 | Klingへ渡す | 「送信前チェック」→ プロンプトをコピー → Klingをブラウザで開く → 添付する2ファイルをエクスプローラーで表示 |
| M7 | 生成結果の記録 | 生成動画ごとに、使ったプロンプトの写し・評価（採用／保留／不採用）・メモ・消費クレジットを残す |

### 段階1で作らないもの

- 動画の加工（トリミング、音声削除、顔の自動検出・追従ぼかし）→ 段階2
- 加工前の実写動画の取り込み・保管 → 段階2
- Kling API、Klingサイトの自動操作、外部AIによる翻訳
- AYA Reel Editorへの受け渡し機能（形式の取り決めだけ第10章で行う）
- クレジット残高の自動取得（手入力の記録だけ）
- インストーラー配布

## 2. ユーザーフロー

段階1でアプリが受け持つのは、加工済みの参照動画を受け取ってから、生成結果を記録するまで。顔ぼかしは今どおりCapCutで行い、段階2でアプリに取り込む。

（図: ユーザーフロー · 撮影から生成結果の記録まで。原本のドキュメントを参照）

点線の箱はアプリの外。Klingへは「送信前チェック」を通った後に、利用者が手でアップロードする。

## 3. 画面一覧とワイヤーフレーム案

画面は7つ。中心は「ショット編集」で、左に入力、右に完成プロンプト（英語と日本語訳）を並べ、入力するとその場で右が変わる。

| ID | 画面 | 主な目的 | ステップ |
| --- | --- | --- | --- |
| S1 | ホーム（制作一覧） | 制作の作成・一覧・名前変更・ゴミ箱へ | 1 |
| S2 | キャラ一覧・編集 | 外見・衣装・キャラ画像・固定 | 2 |
| S3 | 固定プロンプト | 英日ペアのブロック編集、版の履歴 | 2 |
| S4 | 制作（ショット一覧） | ショットの追加・並べ替え・状態の確認 | 3 |
| S5 | ショット編集 | 場面別の入力と完成プロンプト | 3 |
| S6 | 素材と生成結果 | 参照動画・生成動画の登録、再生、評価 | 4 |
| S7 | Klingへ渡す（送信前チェック） | 確認→コピー→Klingを開く→添付ファイルを表示 | 4 |

### S5 ショット編集

```text
┌──────────────────────────────────────────────────────────────────┐
│ 海辺のお散歩 > ショット2「縁を歩き、指先を動かす」   [素材][Klingへ渡す →] │
├────────────────────────────────┬─────────────────────────────────┤
│ キャラ [rui ▼] 衣装 [恐竜柄＋デニム ▼]  │ 完成プロンプト（英語）  812 / 上限 ? 文字 │
│ 靴 [黒いスニーカー ▼]              │ ┌───────────────────────────────┐ │
│                                  │ │ Use the 3D character image...  │ │
│ ▼ 動作                           │ │ Reproduce the free hand's ...  │ │
│  [✓大人と手をつなぐ] [✓指先の細かい動き] │ └───────────────────────────────┘ │
│  [✓手首の回転] [ ジャンプ]  ＋英語で追記 │ 日本語訳（確認用・コピーされない）    │
│ ▼ 表情  [控えめな微笑み ▼]           │ ┌───────────────────────────────┐ │
│ ▼ 顔の部位 視線[指先を見下ろす ▼] 口[少し開く▼] │ │ 3Dキャラ画像を顔・体格・服装の… │ │
│ ▼ 時間変化  1. [開始時] …  ＋追加      │ └───────────────────────────────┘ │
│ ▼ シーン  場所[海沿いの縁▼] 光[自然光▼]  │ ⚠ 参照動画に大人の手が写ります。     │
│        画角[全身・縦長 ▼]             │   キャラ画像と構図が合うか確認して。 │
│                                  │ [英語をコピー] [日本語を翻訳用にコピー] │
└────────────────────────────────┴─────────────────────────────────┘
```

- 部品は日本語のラベルで選ぶ。右側には英語と日本語訳が同じ順に並ぶ
- 「英語で追記」は各セクションに1つ。日本語訳の欄には「（英語の追記）」と入力した英文をそのまま出す
- 「日本語を翻訳用にコピー」は、日本語で書いたメモをChatGPT等で英訳したいとき用。アプリは外に送らない
- 表情の初期値は「未選択」。未選択のままだと「表情を選んでください」と注意を出す（笑顔に固定しないため）
- 注意の自動表示：「大人と手をつなぐ」など他者との接触を選んだとき、「キャラ画像と構図が合うか」を注意表示

### そのほかの画面

- **S2 キャラ**: 外見の各項目は「英語（Klingに入る文）」と「日本語（確認用）」を並べて入力。衣装は「トップス」「ボトムス」「靴」を分けて登録し、ショットで靴だけ差し替えられる。キャラ画像は複数登録し、代表を★で選ぶ。固定中の編集は確認を出す
- **S3 固定プロンプト**: ブロック単位で英日を並べて編集。「この版で保存」で版数が上がり、右に版の履歴（日時・変更メモ）。過去の版は読み取り専用で表示できる
- **S4 制作**: ショットをカードで縦に並べる。カードにはタイトル、状態（下書き／Klingに渡した／採用あり）、参照動画と採用動画のサムネイル。ドラッグで並べ替え、複製できる（複製時は素材と結果を引き継がない）
- **S6 素材と生成結果**: 左に参照動画（1本）、右に生成動画の一覧。参照動画を登録するときは「顔をぼかした加工済みの動画ですか？」の確認を必ず通す。生成動画ごとに評価・メモ・消費クレジットを入力し、「使ったプロンプトを表示」で当時の全文を見られる
- **S7 Klingへ渡す**: チェックリスト（第7章）にすべてチェックするまで「コピーしてKlingを開く」を押せない。押すと①英語プロンプトをコピー ②既定ブラウザでKlingを開く ③参照動画とキャラ画像を入れた「送信用フォルダ」をエクスプローラーで開く。この時点のプロンプト全文を「渡した記録」として保存する

## 4. データモデルと保存形式

保存はJSONファイル。「ライブラリ（キャラ・固定プロンプト・部品）」と「制作」を分け、制作は1フォルダで完結させる。保存の仕組み（一時ファイル→置換、.bak、Zod検証、schemaVersion、保存先の外へのアクセス拒否、OneDrive対策の移動）はAYA Reel Editorの段階1と同じものを使う。

### 4.1 フォルダ構成

```text
%APPDATA%\AYA 3D Motion Studio\
  settings.json                 … データ保存先、KlingのURL、プロンプト文字数の上限（設定値）

<データ保存先>\               … 既定: %USERPROFILE%\AYA 3D Motion Studio（OneDriveの外）
  library\
    characters\<id>\character.json
    characters\<id>\images\<imageId>.png
    templates\fixed-prompt.json  … 固定プロンプト（全版を含む）
    phrases\phrases.json         … 英日ペアの部品辞書（初期値はアプリ同梱、編集分を保存）
  productions\<id>\
    production.json
    reference\<videoId>.mp4      … 加工済み参照動画だけ（段階1）
    generated\<videoId>.mp4      … Klingの生成動画
    outgoing\<shotId>\           … Klingに添付するファイルの写し（毎回作り直す）
  trash\

段階2で追加（別フォルダ、外部に渡す操作の対象外）:
  productions\<id>\originals\    … 加工前の実写
```

### 4.2 主なデータ型

```ts
type Id = string            // ULID
type Bilingual = { en: string; ja: string }

interface Character {
  schemaVersion: 1; id: Id; name: string; locked: boolean; revision: number
  appearance: { style: Bilingual; face: Bilingual; hair: Bilingual; body: Bilingual; notes: Bilingual }
  outfits: { id: Id; name: string; top: Bilingual; bottom: Bilingual; shoes: Bilingual; isDefault: boolean }[]
  images: { id: Id; file: string; note: string; isPrimary: boolean; width: number; height: number }[]
  createdAt: string; updatedAt: string
}

interface FixedPromptTemplate {
  schemaVersion: 1
  current: number                                  // 使用中の版
  versions: { version: number; blocks: { id: string; title: string; text: Bilingual }[];
              note: string; createdAt: string }[]   // 過去の版は変更しない
}

interface Phrase {                                 // 英日ペアの部品
  id: string; category: PhraseCategory; label: string   // labelは画面の選択肢
  text: Bilingual; tags?: ('contact' | 'needs-full-body')[]  // contactは他者との接触
  builtIn: boolean; hidden?: boolean
}
type PhraseCategory = 'motion' | 'hands' | 'expression' | 'gaze' | 'eyes' | 'brows' | 'mouth'
  | 'head' | 'location' | 'lighting' | 'props' | 'camera' | 'avoid'

interface Production {
  schemaVersion: 1; id: Id; title: string; createdAt: string; updatedAt: string
  shots: Shot[]; videos: VideoAsset[]
}

interface Shot {
  id: Id; title: string
  characterId?: Id; characterImageId?: Id; outfitId?: Id; shoesOverride?: Bilingual
  selections: Record<PhraseCategory, string[]>      // 選んだ Phrase.id（順序どおり）
  extra: Partial<Record<'motion' | 'expression' | 'face' | 'scene', string>>  // 英語の自由追記
  timeline: { at: 'start' | 'middle' | 'end' | 'custom'; atText?: string; change: Bilingual }[]
  referenceVideoId?: Id
  handoffs: { at: string; fixedVersion: number; characterRevision: number;
              promptEn: string; promptJa: string }[] // Klingに渡した記録（全文の写し）
}

interface VideoAsset {
  id: Id; kind: 'reference' | 'generated'; file: string; originalName: string
  durationSec?: number; width?: number; height?: number; importedAt: string
  shotId?: Id
  processedConfirmedAt?: string                    // referenceのみ必須：加工済み確認の日時
  result?: { handoffAt?: string; rating: 'adopted' | 'hold' | 'rejected' | 'unrated';
             credits?: number; note: string }      // generatedのみ
}
```

### 4.3 保存ルール（Reel Editorとの差分だけ）

| ルール | 内容 |
| --- | --- |
| 参照動画の登録 | processedConfirmedAt がない参照動画は保存しない（スキーマで必須） |
| 動画の形式 | mp4 / mov / webm。長さ・解像度は画面の video 要素で読み取る（段階1ではFFmpeg不要） |
| 大きなファイル | コピーはストリームで行い、途中で失敗したら作りかけを消す |
| outgoing | Klingへ渡すたびに中身を空にして、そのショットの参照動画とキャラ画像の2つだけを置く |
| キャラ・固定プロンプトの更新 | 渡した記録の版と現在の版が違えば、S5で「前回渡したときから設定が変わっています」と表示 |

## 5. プロンプト生成仕様

英語と日本語訳は、同じ部品（英日ペア）を同じ順に並べて作る。翻訳処理は使わないので、日本語訳は英語の内容と必ず一致する（英語の自由追記だけは英文のまま日本語欄に出す）。生成は純粋関数で、同じ入力からは必ず同じ文字列になる。

### 5.1 組み立ての順番

1. 固定プロンプト（F1〜F4）
2. キャラの衣装（衣装＋靴の差し替え）
3. シーン（場所・照明・小物・画角）
4. 動作（動作・手と指＋英語の追記）
5. 表情と顔（表情・視線・目・眉・口・頭の向き＋英語の追記）
6. 時間変化（あるときだけ）
7. 避けること（固定F5＋選んだ「避ける」部品）

各項目は1段落。段落の間は空行1つ。空の項目は段落ごと省く。

### 5.2 固定プロンプト 初版（案）

| ブロック | 英語（Klingに入る文） | 日本語訳 |
| --- | --- | --- |
| F1 素材の役割 | Use the provided 3D character image as the primary reference for the character's face, body proportions, and outfit. Use the reference video only as a guide for posture, gait, body movement, weight shifts, and the motion of the head, arms, wrists, and fingers. | 3Dキャラ画像を、顔・体の比率・服装の主な参照にする。参照動画は、姿勢・歩き方・体の動き・重心移動と、頭・腕・手首・指の動きの参考にだけ使う。 |
| F2 ぼかし | The face in the reference video is intentionally blurred for privacy. Do not reproduce the blur, smudging, or any distortion on the character's face; render a clear, detailed face that matches the character image. | 参照動画の顔はプライバシーのため意図的にぼかしている。ぼかしやにじみ、歪みをキャラの顔に再現しない。キャラ画像と同じ、はっきりした顔を描く。 |
| F3 外見の維持 | Keep the character consistent throughout: a semi-realistic 3D doll (about 65% realistic and 35% collectible figure) with the same facial features, natural double eyelids, short dark hair, and a stable head-to-body ratio and body proportions. | 最初から最後まで同じキャラを保つ。実写65％・フィギュア35％程度のセミリアル3Dドールで、同じ顔立ち、自然な二重まぶた、短い暗色の髪、安定した頭身と体の比率。 |
| F4 人体 | Maintain natural human anatomy: exactly five fingers on each hand, no extra or missing fingers, no deformed limbs or unnatural joints, and no sudden changes to the face or outfit. | 自然な人体構造を保つ。各手の指は5本ちょうど。指の過不足、手足の変形、不自然な関節、顔や服装の突然の変化を起こさない。 |
| F5 避けること | Avoid unnecessary lip movement or talking, exaggerated smiles, unnatural blinking, and abrupt camera movements. | 不要な口パクや発話、大げさな笑顔、不自然なまばたき、カメラの急な動きを避ける。 |

この5ブロックを初期値（版数 1）として同梱する。英文は実際にKlingで数回試してから確定する（未検証）。

### 5.3 英日ペアの部品（例）

| 分類 | 画面のラベル | 英語 | 日本語訳 |
| --- | --- | --- | --- |
| 動作 | 縁を歩く | Walk carefully along a narrow ledge, closely following the reference video's footsteps, balance, and weight shifts. | 参照動画の足運び・バランス・重心移動に忠実に、狭い縁の上を慎重に歩く。 |
| 動作 | 大人と手をつなぐ（contact） | Hold hands with an adult on the right side of the frame. | 画面右側の大人と手をつなぐ。 |
| 手と指 | 空いた手の細かい指の動き | With the free hand, reproduce the delicate finger movements, finger bending, and wrist rotation from the reference video as faithfully as possible. | つないでいない方の手で、参照動画の繊細な指の動き、指の曲げ方、手首の回転をできる限り忠実に再現する。 |
| 表情 | 控えめな微笑み | A soft, subtle smile; do not laugh or grin widely. | やわらかく控えめな微笑み。声を出して笑ったり、大きく笑ったりしない。 |
| 表情 | 夢中 | An absorbed, focused expression. | 夢中で集中している表情。 |
| 視線 | 指先を見下ろす | Gaze down at the fingertips. | 指先を見下ろす。 |
| 目 | リラックスした目元 | Relaxed eyes with natural blinking. | リラックスした目元で、自然にまばたきする。 |
| 口 | 少し開く | Lips slightly parted, without speaking or lip-syncing. | 口を少し開ける。話したり口パクしたりしない。 |
| 場所 | 海沿いのコンクリートの縁 | A concrete ledge along the sea, with the ocean, distant mountains, and sky in the background. | 海沿いのコンクリートの縁。背景に海、遠くの山、空。 |
| 照明 | 自然光 | Soft natural daylight. | やわらかい自然光。 |
| 画角 | 全身・縦長 | Vertical 9:16 framing with the character's full body in view. | 縦長の9:16で、キャラの全身が画面に入る。 |

初期辞書は各分類3〜12個、合計82個（2026-11-23 作成済み）をClaudeが作って `resources/phrases.default.json` として置く。利用者は画面から追加・編集・非表示にできる（同梱分は削除できず、非表示だけ）。

### 5.4 海辺の実例（完成プロンプト）

```text
Use the provided 3D character image as the primary reference for the character's face, body proportions, and outfit. Use the reference video only as a guide for posture, gait, body movement, weight shifts, and the motion of the head, arms, wrists, and fingers. The face in the reference video is intentionally blurred for privacy. Do not reproduce the blur, smudging, or any distortion on the character's face; render a clear, detailed face that matches the character image. Keep the character consistent throughout: a semi-realistic 3D doll (about 65% realistic and 35% collectible figure) with the same facial features, natural double eyelids, short dark hair, and a stable head-to-body ratio and body proportions. Maintain natural human anatomy: exactly five fingers on each hand, no extra or missing fingers, no deformed limbs or unnatural joints, and no sudden changes to the face or outfit.

Outfit: a white long-sleeve top with a small, colorful dinosaur print, light blue denim pants, and black sneakers.

Scene: A concrete ledge along the sea, with the ocean, distant mountains, and sky in the background. Soft natural daylight. Vertical 9:16 framing with the character's full body in view.

Motion: Walk carefully along a narrow ledge, closely following the reference video's footsteps, balance, and weight shifts. Hold hands with an adult on the right side of the frame. With the free hand, reproduce the delicate finger movements, finger bending, and wrist rotation from the reference video as faithfully as possible.

Expression and face: A soft, subtle smile; do not laugh or grin widely. Gaze down at the fingertips. Relaxed eyes with natural blinking. Lips slightly parted, without speaking or lip-syncing.

Avoid: Avoid unnecessary lip movement or talking, exaggerated smiles, unnatural blinking, and abrupt camera movements.
```

このショットでは「大人と手をつなぐ」（contact）を選んでいるので、S5とS7に「キャラ画像に大人の手がないと、手の接触が崩れることがあります」と注意を出す。

## 6. アーキテクチャと技術構成

AYA Reel Editorと同じ構成（Electron ＋ React ＋ TypeScript ＋ electron-vite）にし、実際に動いている部品をそのまま持ち込む。別リポジトリ `aya-3d-motion-studio` で独立して管理する。

### 6.1 Reel Editorから持ち込む部品

| 部品 | 元の場所（aya-reel-editor） | このアプリでの扱い |
| --- | --- | --- |
| 土台一式 | 段階0（設定ファイル、CI、安全設定、E2Eの仕組み） | コピーして名前を変える |
| 保存 | `StorageService` `StorageMove` `StorageVerification` `OperationQueue` | そのままコピー。テストも一緒に持ち込む |
| 設定 | `SettingsService`（破損時の復旧、OneDriveの警告） | 既定の保存先名だけ変える |
| 自動保存・終了処理 | `Autosave`、終了前の保存と確認ダイアログ | そのまま |
| 画像の表示窓口 | `aya-media://`（保存先の中だけ読める） | 動画も扱うため `mp4 / mov / webm` を追加し、動画のシークに必要な Range 要求に対応する |
| 画像の検証 | `validateImage`（sharp） | そのまま |
| キャラの固定・版数 | `LibraryService` の考え方 | データ型が違うので考え方だけ流用 |

将来、共通部品が増えたら共有パッケージに切り出す。段階1では「コピーして使う」を優先する（仕組みを増やさない）。

### 6.2 層の分け方

| 層 | 場所 | 役割 |
| --- | --- | --- |
| 画面 | `src/renderer/` | React画面。ファイルや外部には直接触れない |
| 橋渡し | `src/preload/` | `window.api` を型付きで最小限だけ公開 |
| 処理 | `src/main/services/` | 保存、素材の取り込み、送信用フォルダの準備、クリップボード、外部リンク |
| 差し替え口 | `src/main/providers/` | `VideoGenerationProvider`（段階1は `ManualKlingProvider` だけ）、将来の `TranslationProvider` |
| 共通ロジック | `src/shared/` | データ型とZodスキーマ、プロンプト生成（`buildKlingPrompt`）などの純粋関数 |

### 6.3 安全設定（Reel Editorと同じ）

- `contextIsolation: true` / `nodeIntegration: false` / `sandbox: true`。IPCの入力はメイン側でZod検証
- 外部URLはKlingのURLだけ（設定値だが `https://` で始まる `klingai.com` のドメインに限る。実際のURLは利用者の環境で要確認）。画面から任意のURLを渡せない
- アプリからのネット通信はしない。ブラウザを開くことだけ
- 将来のAPIキーは `safeStorage`（DPAPI）で保管し、画面に渡さない

## 7. プライバシー設計

段階1の基本方針は、加工前の実写をアプリに入れないこと、外に出す素材を「送信用フォルダ」の2ファイルに限定すること、渡す前に人の目で確認させること。顔のぼかしはリスクを下げるもので、完全な匿名化ではないと画面にも明記する。

### 7.1 守ること

| 場面 | 仕組み |
| --- | --- |
| 参照動画の登録 | 「顔をぼかした加工済みの動画ですか？」に「はい、加工済みです」を選ばないと登録できない。確認日時を processedConfirmedAt に残す |
| 送信前チェック（S7） | 次の項目をすべてチェックするまで「コピーしてKlingを開く」を押せない |
| 送るファイル | outgoing フォルダには、そのショットの参照動画とキャラ画像の2つだけ。毎回空にしてから作る |
| プロンプト | 実名や学校名などを入れないよう、キャラ名はプロンプトに入れない（「the character」と書く） |
| 外部通信 | アプリ自身はネットに接続しない。翻訳もアプリからはしない |
| 削除 | 自動削除はしない。削除はすべてアプリ内のゴミ箱への移動 |
| 保存先 | OneDriveなどのクラウド同期フォルダの中だと警告する（同期で実写素材がクラウドに上がるため） |

### 7.2 送信前チェックリスト（S7）

- [ ] 参照動画を最初から最後まで見て、顔がぼかしから外れたフレームがない
- [ ] 音声（声・名前の呼びかけ）が入っていない、または問題ない
- [ ] 背景に住所・学校・看板・車のナンバーなど、場所がわかるものが写っていない
- [ ] ほかの人（家族以外を含む）の顔が写っていない、またはぼかしてある
- [ ] 添付するキャラ画像は3DのCG画像で、実写ではない

音声の項目は、動画に音声トラックがあるときに「この動画には音声が入っています」と強調表示する（音声の有無は video 要素で判定できない場合があるため、判定できないときは常に表示）。音声の削除は段階2。

### 7.3 段階2以降に引き継ぐこと

- 加工前の実写は `originals` に分け、送信用フォルダやReel Editorへの受け渡しの対象にならないよう、コード上で経路を分ける
- 顔の自動ぼかしの後も、人が全フレームを確認する手順を必須にする

## 8. 受け入れ基準とテスト計画

段階1の合格条件は、海辺の実例と同じショットをアプリだけで作り、Klingで生成して結果を記録するまでを、10分以内（Klingの生成待ちを除く）で迷わずできること。

### 8.1 自動テスト（Codexが実装）

| ID | 対象 | 確認内容 |
| --- | --- | --- |
| U-01 | 保存部品 | Reel Editorから持ち込んだテストがすべて通る（原子的保存、パス制限、移動の失敗時の復旧） |
| U-02 | buildKlingPrompt | 5.4 の海辺の実例と一字一句同じ英文ができる（基準テスト） |
| U-03 | buildKlingPrompt | 日本語訳が英文と同じ順・同じ段落数。空の項目は省かれる。英語の追記は日本語側に英文のまま出る |
| U-04 | buildKlingPrompt | キャラ名がプロンプトに含まれない。靴の差し替えが反映される |
| U-05 | 注意の判定 | contact の部品を選ぶと接触の注意が出る。表情が未選択なら表情の注意が出る。文字数が上限を超えると警告 |
| U-06 | 固定プロンプト | 保存すると新しい版が増え、過去の版の中身は変わらない |
| U-07 | 参照動画の登録 | 加工済み確認なしでは IPC 側でも拒否される。元ファイルは変更されない |
| U-08 | 送信用フォルダ | 前回のファイルが消え、参照動画とキャラ画像の2つだけになる。参照動画が未登録なら作らない |
| U-09 | 外部リンク | Klingのドメイン以外のURLを拒否。画面からURLを渡せない |
| U-10 | 動画の表示窓口 | Range 要求に正しく応答する。保存先の外・対応外の拡張子を拒否 |
| E-01 | E2E | キャラ登録 → 制作作成 → ショットで部品を選ぶ → 英文がクリップボードに入る → 再起動後も残る |

### 8.2 手動の受け入れテスト（利用者が確認）

| ID | 操作 | 合格条件 |
| --- | --- | --- |
| A-01 | ruiを登録（外見の英日、衣装2種、靴の差分、キャラ画像2枚）して固定 | 再起動後も残る。固定中の編集で確認が出る |
| A-02 | 固定プロンプトを書き換えて保存 | 版数が上がり、過去の版を開ける |
| A-03 | 海辺のショットを部品だけで作る | 英文が5.4と同じ内容になり、日本語訳で内容を確認できる。接触の注意が出る |
| A-04 | CapCutでぼかした参照動画を登録して再生 | 加工済み確認が出る。アプリ内で再生・シークできる |
| A-05 | S7でチェック → 「コピーしてKlingを開く」 | Klingが開き、送信用フォルダに2ファイルだけがあり、英文を貼って生成できる |
| A-06 | 生成したMP4を登録して評価・クレジット・メモを入力 | 「使ったプロンプト」で渡したときの全文が見られる |
| A-07 | 生成結果の確認 | 顔にぼかしが出ていない。指が5本。表情が指定に近い（Klingの結果なので、合否ではなく固定プロンプト改善の材料として記録） |

## 9. 開発ステップとCodexへの実装指示

段階1を5ステップに分ける。各ステップの終わりに `npm run dev` で動かして確認できる。重い実装はCodex、文案や準備はClaudeが担当する。

| ステップ | 作るもの | 担当 | 完成の確認 |
| --- | --- | --- | --- |
| 1-0 土台 | フォルダとリポジトリ、Reel Editorの土台・保存部品の持ち込み、不要な機能の削除、空のホーム | Claude（ファイルのコピー）→ 利用者（GitHubリポジトリと最初のコミット）→ Codex（整理とテスト） | アプリが起動し、U-01が通る |
| 1-1 キャラと固定プロンプト | S2・S3、部品辞書の読み込みと編集 | Claude（固定プロンプト初版と部品辞書のJSON）→ Codex（実装） | A-01・A-02、U-06 |
| 1-2 制作とショット編集 | S1・S4・S5、buildKlingPrompt、注意表示 | Codex | A-03、U-02〜U-05、E-01 |
| 1-3 素材とKlingへの受け渡し | S6・S7、動画の取り込みと再生、送信用フォルダ、渡した記録、生成結果の記録 | Codex | A-04〜A-06、U-07〜U-10 |
| 1-4 仕上げ | 文言の整理、README、初回の使い方の案内 | Claude（小さな修正は直接） | A-07、段階1の受け入れ基準 |

### 9.1 進め方（郵便屋さん方式）

1. 利用者がブランチを作る（例 `git switch -c step/1-1-character`）
2. Claudeが `_codex-bridge/inbox/` に指示ファイルを置く（下のテンプレート）
3. Codexが実装とテスト → Claudeが結果と差分をレビューし、必要なら修正を送る（数行で済む修正はClaudeが直接直す）
4. 利用者がコミット → `npm run test:e2e` と手動確認 → プッシュ → PR → マージ

郵便屋さんのCodexは `.git` を書き換えられず、Electronも起動できない（AYA Reel Editorで確認済み）。ブランチ作成・コミット・E2Eは利用者側で行う。

### 9.2 指示ファイルのテンプレート

```text
folder: aya-3d-motion-studio
AYA 3D Motion Studio の「ステップ<1-N> <名前>」を実装してください。
作業ブランチ <ブランチ名> は作成・切り替え済みです。

【前提】
- 最初に AGENTS.md と docs/design.md を読むこと
- 仕様は docs/design.md の「9. 開発ステップ」のステップ<1-N>と、そこから参照する章

【作業】
- ステップ<1-N>の範囲をすべて実装する。先のステップには手を付けない
- 「8.1 自動テスト」の <ID一覧> と、追加した関数の単体テストを書く

【作業後】
- npm run lint / typecheck / test / build を実行して結果を報告する（test:e2e は不要。E2Eのコードは書く）
- 変更・追加したファイルの一覧と、「8.2 手動の受け入れテスト」<ID一覧> の手順を報告する

【ルール】
- ファイルの削除・git commit / push・ブランチ操作・パッケージの追加更新はしない（必要なら報告だけ）
- このフォルダの外は触らない
- テストを消す・スキップする・チェックを緩めることはしない
- 仕様が曖昧な点や判断が必要な点は、勝手に決めずに報告する
```

### 9.3 ステップ1-0の具体的な進め方

1. **Claude**: `Documents\Codex\aya-3d-motion-studio` を作り、aya-reel-editor から土台と保存部品（第6.1の表）をコピーする。`node_modules`・`.git`・ユーザーデータはコピーしない。この設計書を `docs/design.md`、このアプリ用の `AGENTS.md` を置く
2. **利用者**: GitHubに非公開リポジトリ `aya-3d-motion-studio` を作り、`git init` → 最初のコミット → プッシュ（コマンドはClaudeが用意）。続けて `step/1-0-foundation` ブランチを作る
3. **Codex**: アプリ名・保存先名・appIdを変え、Reel Editor固有の画面・機能（台本、シーン、画風ライブラリ、指示文）を外し、空のホームと保存部品だけが動く状態にする。不要なファイルの削除は一覧だけ報告し、利用者が削除する（郵便屋さんのルール）
4. **利用者**: コミット、`npm run dev` で起動確認、プッシュ → PR → マージ

## 10. 段階2以降の概要とReel Editor連携

段階2以降は方向だけを決め、詳細は段階1の完了後に設計する。

| 段階 | 主な内容 | 今のうちに決めておくこと |
| --- | --- | --- |
| 2 動画前処理 | 原本の取り込み、トリミング、音声削除（FFmpeg）、顔の自動検出と追従ぼかし、手動補正、全フレームの確認 | 原本は `originals` に分ける。加工後の動画だけが参照動画になる。顔検出はローカルで動くものに限る（候補の選定は段階2の設計で実測して決める） |
| 3 制作管理 | 生成履歴の検索・絞り込み、ショットの再利用（テンプレート化）、クレジットの集計、インストーラー | 渡した記録と生成結果は段階1から全部残しておく |
| 4 将来拡張 | Kling API（利用可否・料金・規約を導入時に再確認）、Reel Editorへの受け渡し、統合 | `VideoGenerationProvider` の差し込み口、受け渡し形式（下記） |

### 10.1 Reel Editorへの受け渡し形式（案 v0）

最初はMP4ファイルだけを渡し、次に下のJSONを添える。受け渡し用のフォルダには「採用」にした生成動画とこのJSONだけを置き、参照動画・原本・キャラ画像は含めない。

```json
{
  "format": "aya-motion-handoff",
  "version": 0,
  "exportedAt": "2026-12-01T10:00:00Z",
  "production": { "title": "海辺のお散歩" },
  "clips": [
    {
      "file": "clips/01.mp4",
      "order": 1,
      "shotTitle": "縁を歩き、指先を動かす",
      "durationSec": 5.0,
      "width": 1080,
      "height": 1920,
      "notes": ""
    }
  ]
}
```

- プロンプト全文やキャラの設定は含めない（Reel Editorでは不要。含めるなら利用者が選んだときだけ）
- Reel Editor側では、このJSONを読んで「シーンの素材に動画を使う」機能が必要になる。Reel Editorは今のところ静止画のシーンだけを扱う設計なので、動画シーンの対応は双方の段階が進んだ後に設計する（未確定）
