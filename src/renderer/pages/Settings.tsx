import { Button } from '@/components/ui/button'
import type { EditorState } from '../stores/editor'
import { ONE_DRIVE_WARNING } from '../../shared/oneDrive'

export function Settings({ state }: { state: EditorState }): React.JSX.Element {
  return (
    <main className="mx-auto w-full max-w-3xl p-8">
      <h2 className="mb-8 text-2xl font-semibold">設定</h2>
      {state.settings?.inOneDrive && (
        <p role="alert" className="mb-6 rounded border border-amber-400 bg-amber-50 p-4">
          {ONE_DRIVE_WARNING}
        </p>
      )}
      <h3 className="font-semibold">データの保存先</h3>
      <p className="my-4 break-all rounded border bg-white p-4">
        {state.settings?.dataRoot ?? '読み込み中…'}
      </p>
      <p className="mb-5 text-sm leading-7">
        保存先を変更しても、今あるリールは移動しません。新しい場所で始めるか、元の保存先を選び直すと、その場所のリールが表示されます。
      </p>
      <div className="flex gap-5">
        <Button
          disabled={state.busy || state.closing || !state.settings}
          onClick={() => {
            if (
              window.confirm(
                '保存先を変更します。既存のリールは移動しません。新しい場所で始めますか？',
              )
            )
              void state.changeRoot()
          }}
        >
          新しい場所で始める
        </Button>
        <button disabled={state.busy || !state.settings} onClick={() => void state.openRoot()}>
          フォルダーを開く
        </button>
      </div>
    </main>
  )
}
