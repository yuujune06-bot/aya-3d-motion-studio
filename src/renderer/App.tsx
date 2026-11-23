import { useEffect } from 'react'
import { useStore } from 'zustand'
import { createEditorStore } from './stores/editor'
import { Home } from './pages/Home'
import { Settings } from './pages/Settings'
import { ProjectFrame } from './pages/ProjectFrame'
import { errorMessages } from '../shared/errors'
import { LibraryPage } from './pages/LibraryPage'

const editor = createEditorStore(window.api)
export function App(): React.JSX.Element {
  const state = useStore(editor)
  useEffect(() => {
    void editor.getState().init()
    return window.api.onBeforeClose(() => {
      void editor.getState().close()
    })
  }, [])
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="flex items-center justify-between border-b px-8 py-5">
        <h1 className="text-lg font-semibold">AYA Reel Editor</h1>
        <nav className="flex gap-5" aria-label="画面">
          {state.project && state.screen !== 'project' && (
            <button
              disabled={state.busy || state.closing}
              onClick={() => void state.navigate('project')}
            >
              リールに戻る
            </button>
          )}
          <button disabled={state.busy || state.closing} onClick={() => void state.showLibrary()}>
            ライブラリ
          </button>
          <button
            disabled={state.busy || state.closing}
            onClick={() => void state.navigate('home')}
          >
            ホーム
          </button>
          <button
            disabled={state.busy || state.closing}
            onClick={() => void state.navigate('settings')}
          >
            設定
          </button>
        </nav>
      </header>
      {state.settings?.resetToDefaults && (
        <p role="status" className="m-5 rounded border bg-amber-50 p-4">
          設定を初期値に戻しました
        </p>
      )}
      {state.closeConfirmation && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="close-question"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
        >
          <div className="rounded-lg bg-white p-6 shadow-lg">
            <p id="close-question">保存できませんでした。保存せずに閉じますか？</p>
            <div className="mt-5 flex justify-end gap-5">
              <button onClick={() => void state.discardClose()}>保存せずに閉じる</button>
              <button autoFocus onClick={() => void state.cancelClose()}>
                戻る
              </button>
            </div>
          </div>
        </div>
      )}
      {state.error && (
        <div role="alert" className="m-5 rounded border border-red-400 bg-red-50 p-4 text-red-900">
          <p>{errorMessages[state.error.code]}</p>
          <details className="mt-2">
            <summary>詳細</summary>
            <pre className="whitespace-pre-wrap">{state.error.detail}</pre>
          </details>
          <button
            className="mr-5 mt-2 underline"
            onClick={() => {
              void navigator.clipboard.writeText(
                `${errorMessages[state.error!.code]}\n${state.error!.detail}`,
              )
            }}
          >
            詳細をコピー
          </button>
          <button onClick={state.clearError}>閉じる</button>
        </div>
      )}
      {state.screen === 'home' && <Home state={state} />}
      {state.screen === 'library' && <LibraryPage state={state} />}
      {state.screen === 'settings' && <Settings state={state} />}
      {state.screen === 'project' && state.project && <ProjectFrame state={state} />}
      <footer role="status" className="mt-auto border-t px-8 py-3 text-sm text-gray-600">
        {state.status === 'saving'
          ? '保存中…'
          : state.status === 'pending'
            ? '変更あり・保存待ち'
            : state.status === 'error'
              ? '保存できませんでした'
              : state.savedAt
                ? `保存済み ${new Date(state.savedAt).toLocaleTimeString('ja-JP')}`
                : '変更は自動で保存されます'}
      </footer>
    </div>
  )
}
