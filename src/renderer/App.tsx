import { useEffect } from 'react'
import { useStore } from 'zustand'
import { createEditorStore } from './stores/editor'
import { Home } from './pages/Home'
import { Settings } from './pages/Settings'
import { errorMessages } from '../shared/errors'

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
        <h1 className="text-lg font-semibold">AYA 3D Motion Studio</h1>
        <nav className="flex gap-5" aria-label="画面">
          <button
            disabled={state.busy || state.closing}
            aria-current={state.screen === 'home' ? 'page' : undefined}
            onClick={() => state.navigate('home')}
          >
            ホーム
          </button>
          <button
            disabled={state.busy || state.closing}
            aria-current={state.screen === 'settings' ? 'page' : undefined}
            onClick={() => state.navigate('settings')}
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
            <p id="close-question">終了できませんでした。もう一度試しますか？</p>
            <div className="mt-5 flex justify-end gap-5">
              <button onClick={() => void state.retryClose()}>閉じる</button>
              <button autoFocus onClick={() => state.cancelClose()}>
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
          <button onClick={state.clearError}>閉じる</button>
        </div>
      )}
      {state.screen === 'home' && <Home state={state} />}
      {state.screen === 'settings' && <Settings state={state} />}
      <footer role="status" className="mt-auto border-t px-8 py-3 text-sm text-gray-600">
        {state.busy ? '処理中…' : state.settings ? '準備完了' : '設定を利用できません'}
      </footer>
    </div>
  )
}
