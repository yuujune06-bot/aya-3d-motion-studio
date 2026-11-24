export const errorMessages = {
  CHARACTER_LOCKED: 'キャラは固定中です。固定を解除してください。',
  IMAGE_INVALID: '画像を読み込めませんでした。正常なPNG・JPG・WEBP画像を選び直してください。',
  INVALID_INPUT: '入力を確認できませんでした。入力内容を見直してください。',
  UNSAFE_PATH: '安全に扱えない保存場所です。別のフォルダーを選んでください。',
  INVALID_JSON:
    '保存データを読めませんでした。破損や形式の違いが考えられます。アプリを閉じて同じ場所の.bakを保管し、復旧を確認してください。',
  NOT_FOUND: 'ファイルが見つかりません。保存場所を確認してください。',
  STORAGE_FAILED:
    '保存場所を操作できませんでした。空き容量や書き込み権限を確認して、もう一度お試しください。',
} as const
export type ErrorCode = keyof typeof errorMessages
export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    options?: ErrorOptions,
  ) {
    super(errorMessages[code], options)
  }
}
export type ApiResult<T> = { ok: true; data: T } | { ok: false; code: ErrorCode; detail: string }
