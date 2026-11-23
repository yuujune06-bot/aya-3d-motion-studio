import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { EditorState } from '../stores/editor'
import { ONE_DRIVE_WARNING } from '../../shared/oneDrive'

export function Home({ state }: { state: EditorState }): React.JSX.Element {
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState('')
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameTitle, setRenameTitle] = useState('')
  return (
    <main className="mx-auto w-full max-w-5xl p-8">
      {state.settings?.inOneDrive && (
        <p role="alert" className="mb-6 rounded border border-amber-400 bg-amber-50 p-4">
          {ONE_DRIVE_WARNING}
        </p>
      )}
      <div className="mb-8 flex items-center justify-between">
        <h2 className="text-2xl font-semibold">リール一覧</h2>
        <Button disabled={state.busy || state.closing} onClick={() => setCreating(true)}>
          ＋ 新しいリールを作る
        </Button>
      </div>
      {creating && (
        <form
          className="mb-8 flex items-end gap-3 rounded border p-4"
          onSubmit={(event) => {
            event.preventDefault()
            void state.create(title)
          }}
        >
          <label className="flex flex-1 flex-col gap-2">
            リールの名前
            <input
              autoFocus
              required
              maxLength={200}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="rounded border bg-white p-2"
            />
          </label>
          <Button disabled={state.busy || !title.trim()} type="submit">
            作成する
          </Button>
          <button type="button" onClick={() => setCreating(false)}>
            やめる
          </button>
        </form>
      )}
      {!state.projects.length && !state.broken.length && !state.busy && (
        <h3 className="py-16 text-center text-xl">まだリールがありません</h3>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {state.projects.map((project) => (
          <article key={project.id} className="rounded-lg border bg-white p-5">
            <button
              className="mb-3 text-left text-lg font-semibold underline"
              disabled={state.busy || state.closing}
              onClick={() => void state.open(project.id)}
            >
              {project.title}
            </button>
            <p className="text-sm text-gray-600">
              更新日 {new Date(project.updatedAt).toLocaleString('ja-JP')}
            </p>
            <p className="mt-2 text-sm">
              {project.scenes.length}シーン・画像{' '}
              {project.scenes.filter((scene) => scene.adoptedImageId).length}/
              {project.scenes.length}
            </p>
            <details className="mt-4">
              <summary className="cursor-pointer" aria-label={`${project.title}の操作`}>
                …
              </summary>
              <div className="mt-3 flex flex-wrap gap-4">
                <button
                  disabled={state.busy}
                  onClick={() => {
                    setRenaming(project.id)
                    setRenameTitle(project.title)
                  }}
                >
                  名前を変更
                </button>
                <button
                  disabled={state.busy}
                  onClick={() => void state.manage('duplicate', project.id)}
                >
                  複製する
                </button>
                <button
                  disabled={state.busy}
                  onClick={() => {
                    if (
                      window.confirm(
                        `「${project.title}」1件をゴミ箱に移します。元に戻すには保存先のtrashフォルダーを確認してください。`,
                      )
                    )
                      void state.manage('trash', project.id)
                  }}
                >
                  ゴミ箱へ
                </button>
              </div>
            </details>
            {renaming === project.id && (
              <form
                className="mt-4 flex flex-col gap-3"
                onSubmit={(event) => {
                  event.preventDefault()
                  if (
                    window.confirm(
                      `「${project.title}」を「${renameTitle.trim()}」に変更しますか？`,
                    )
                  )
                    void state
                      .manage('rename', project.id, renameTitle)
                      .then(() => setRenaming(null))
                }}
              >
                <label>
                  新しい名前
                  <input
                    required
                    maxLength={200}
                    value={renameTitle}
                    onChange={(event) => setRenameTitle(event.target.value)}
                    className="mt-2 w-full rounded border p-2"
                  />
                </label>
                <Button disabled={state.busy || !renameTitle.trim()}>変更する</Button>
                <button type="button" onClick={() => setRenaming(null)}>
                  やめる
                </button>
              </form>
            )}
          </article>
        ))}
      </div>
      {state.broken.length > 0 && (
        <section
          className="mt-8 rounded border border-amber-400 bg-amber-50 p-5"
          aria-label="開けないリール"
        >
          <h3 className="text-lg font-semibold">開けないリール</h3>
          {state.broken.map(({ id, hasBackup }) => (
            <div key={id} className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="break-all">開けないリール（{id}）</p>
              {hasBackup && (
                <Button
                  disabled={state.busy || state.closing}
                  onClick={() => {
                    if (
                      window.confirm(
                        'バックアップから戻します。壊れたファイルは別名で残します。よろしいですか？',
                      )
                    )
                      void state.restore(id)
                  }}
                >
                  バックアップから戻す
                </Button>
              )}
            </div>
          ))}
        </section>
      )}
    </main>
  )
}
