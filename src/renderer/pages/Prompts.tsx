import { useEffect, useRef, useState } from 'react'
import {
  categorySchema,
  type FixedPromptEdit,
  type FixedPromptTemplate,
  type Phrase,
  type PhraseEdit,
} from '../../shared/schema/library'
import { actionClass, fieldClass, Pair } from '../components/LibraryFields'
import { registerSave, unwrap, type EditorState } from '../stores/editor'
import { Autosave } from '../stores/autosave'

const categories = {
  motion: '動作',
  hands: '手と指',
  expression: '表情',
  gaze: '視線',
  eyes: '目',
  brows: '眉',
  mouth: '口',
  head: '頭の向き',
  location: '場所',
  lighting: '照明',
  props: '小物',
  camera: '画角',
  avoid: '避けること',
} as const

export function Prompts({ state }: { state: EditorState }): React.JSX.Element {
  const [tab, setTab] = useState<'fixed' | 'phrases'>('fixed')
  const [openedPhrases, setOpenedPhrases] = useState(false)
  const [template, setTemplate] = useState<FixedPromptTemplate | null>(null)
  const [selected, setSelected] = useState(1)
  const [draft, setDraft] = useState<FixedPromptEdit | null>(null)
  const { run } = state
  const loaded = useRef(false)
  const disabled = state.busy || state.closing
  function openTemplate(data: FixedPromptTemplate): void {
    const current = data.versions.find((item) => item.version === data.current)!
    setTemplate(data)
    setSelected(data.current)
    setDraft({ blocks: current.blocks, note: '' })
  }
  useEffect(() => {
    if (!state.busy && !loaded.current) {
      loaded.current = true
      void run(async () => openTemplate(await unwrap(window.api.fixedPrompt.get())))
    }
  }, [run, state.busy])

  const historical = template?.versions.find((item) => item.version === selected)
  const editCurrent = selected === template?.current
  const visible = editCurrent ? draft : historical
  return (
    <main className="space-y-4 p-6">
      <h2 className="text-xl font-semibold">プロンプト</h2>
      <div className="flex gap-2" role="tablist" aria-label="プロンプトの種類">
        <button
          id="fixed-tab"
          role="tab"
          aria-controls="fixed-panel"
          aria-selected={tab === 'fixed'}
          className={actionClass}
          disabled={disabled}
          onClick={() => setTab('fixed')}
        >
          固定プロンプト
        </button>
        <button
          id="phrases-tab"
          role="tab"
          aria-controls="phrases-panel"
          aria-selected={tab === 'phrases'}
          className={actionClass}
          disabled={disabled}
          onClick={() => {
            setOpenedPhrases(true)
            setTab('phrases')
          }}
        >
          部品
        </button>
      </div>
      <div id="fixed-panel" role="tabpanel" aria-labelledby="fixed-tab" hidden={tab !== 'fixed'}>
        {template && visible && (
          <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_15rem]">
            <fieldset disabled={disabled} className="space-y-3 rounded border p-4">
              <h3 className="text-lg font-semibold">
                版数 {selected}
                {!editCurrent && '（閲覧のみ）'}
              </h3>
              {visible.blocks.map((block) => (
                <Pair
                  key={block.id}
                  label={block.title}
                  value={block.text}
                  onChange={
                    editCurrent
                      ? (text) =>
                          setDraft(
                            (current) =>
                              current && {
                                ...current,
                                blocks: current.blocks.map((item) =>
                                  item.id === block.id ? { ...item, text } : item,
                                ),
                              },
                          )
                      : undefined
                  }
                />
              ))}
              <label>
                変更メモ
                <textarea
                  className={fieldClass}
                  readOnly={!editCurrent}
                  value={visible.note}
                  onChange={(event) => setDraft({ ...visible, note: event.target.value })}
                />
              </label>
              {editCurrent && (
                <button
                  className={actionClass}
                  onClick={() =>
                    void run(async () => {
                      openTemplate(await unwrap(window.api.fixedPrompt.save(visible)))
                    })
                  }
                >
                  この版で保存
                </button>
              )}
            </fieldset>
            <aside className="space-y-2">
              <h3 className="text-lg font-semibold">版の履歴</h3>
              <ul className="space-y-2">
                {[...template.versions]
                  .sort((a, b) => b.version - a.version)
                  .map((item) => (
                    <li key={item.version}>
                      <button
                        className={actionClass + ' w-full text-left'}
                        disabled={disabled}
                        aria-pressed={selected === item.version}
                        onClick={() => setSelected(item.version)}
                      >
                        <span className="block font-medium">
                          版 {item.version}
                          {item.version === template.current && '（現在）'}
                        </span>
                        <time className="block text-sm" dateTime={item.createdAt}>
                          {new Date(item.createdAt).toLocaleString('ja-JP')}
                        </time>
                        {item.note && (
                          <span className="block whitespace-pre-wrap break-words text-sm">
                            {item.note}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
              </ul>
            </aside>
          </div>
        )}
      </div>
      <div
        id="phrases-panel"
        role="tabpanel"
        aria-labelledby="phrases-tab"
        hidden={tab !== 'phrases'}
      >
        {openedPhrases && <Phrases state={state} />}
      </div>
    </main>
  )
}

function Phrases({ state }: { state: EditorState }): React.JSX.Element {
  const { run } = state
  const api = window.api.phrases
  const [items, setItems] = useState<Phrase[]>([])
  const [category, setCategory] = useState<Phrase['category']>('motion')
  const [draft, setDraft] = useState<{ id: string | null; edit: PhraseEdit } | null>(null)
  const [saveFailed, setSaveFailed] = useState(false)
  const [autosave] = useState(
    () =>
      new Autosave<{ id: string; edit: PhraseEdit }>(async ({ id, edit }) => {
        try {
          const saved = await unwrap(api.save(id, edit))
          setItems((current) => current.map((item) => (item.id === id ? saved : item)))
          setSaveFailed(false)
        } catch (error) {
          setSaveFailed(true)
          throw error
        }
      }),
  )
  useEffect(() => registerSave(() => autosave.flush()), [autosave])

  function editDraft(edit: PhraseEdit): void {
    if (!draft) return
    setDraft({ ...draft, edit })
    if (draft.id && edit.label.trim()) autosave.schedule({ id: draft.id, edit })
  }
  const loaded = useRef(false)
  const disabled = state.busy || state.closing
  useEffect(() => {
    if (!state.busy && !loaded.current) {
      loaded.current = true
      void run(async () => setItems(await unwrap(api.list())))
    }
  }, [api, run, state.busy])

  function change(action: () => Promise<unknown>): void {
    void run(async () => {
      await autosave.flush()
      await action()
      setItems(await unwrap(api.list()))
    })
  }
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <label>
          分類{' '}
          <select
            className={actionClass}
            value={category}
            disabled={disabled}
            onChange={(event) => setCategory(categorySchema.parse(event.target.value))}
          >
            {categorySchema.options.map((key) => (
              <option key={key} value={key}>
                {categories[key]}
              </option>
            ))}
          </select>
        </label>
        <button
          className={actionClass}
          disabled={disabled || !!draft}
          onClick={() =>
            setDraft({
              id: null,
              edit: { category, label: '', text: { en: '', ja: '' } },
            })
          }
        >
          部品を追加
        </button>
      </div>
      {draft && (
        <form
          className="space-y-3 rounded border p-4"
          onSubmit={(event) => {
            event.preventDefault()
            change(async () => {
              if (!draft.id) await unwrap(api.save(null, draft.edit))
              setCategory(draft.edit.category)
              setDraft(null)
            })
          }}
        >
          <fieldset disabled={disabled} className="space-y-3">
            <legend className="font-semibold">{draft.id ? '部品を編集' : '部品を追加'}</legend>
            <label>
              ラベル
              <input
                required
                className={fieldClass}
                value={draft.edit.label}
                onChange={(event) => editDraft({ ...draft.edit, label: event.target.value })}
              />
            </label>
            <label>
              部品の分類{' '}
              <select
                className={actionClass}
                value={draft.edit.category}
                onChange={(event) =>
                  editDraft({ ...draft.edit, category: categorySchema.parse(event.target.value) })
                }
              >
                {categorySchema.options.map((key) => (
                  <option key={key} value={key}>
                    {categories[key]}
                  </option>
                ))}
              </select>
            </label>
            <Pair
              label="部品の文"
              value={draft.edit.text}
              onChange={(text) => editDraft({ ...draft.edit, text })}
            />
            <div className="flex gap-2">
              <button className={actionClass} type="submit" disabled={!draft.edit.label.trim()}>
                {draft.id ? '編集を完了' : '保存'}
              </button>
              {!draft.id && (
                <button className={actionClass} type="button" onClick={() => setDraft(null)}>
                  取り消す
                </button>
              )}
              {saveFailed && (
                <p role="alert">
                  部品を保存できませんでした。編集を完了して、もう一度保存をお試しください。
                </p>
              )}
            </div>
          </fieldset>
        </form>
      )}
      <ul className="space-y-2">
        {items
          .filter((item) => item.category === category)
          .map((item) => (
            <li key={item.id} className="space-y-2 rounded border p-3">
              <h3 className="font-semibold">
                {item.label}{' '}
                <span className="text-sm font-normal">
                  （{item.builtIn ? '同梱' : '利用者が追加'}
                  {item.hidden && '・非表示'}）
                </span>
              </h3>
              <div className="grid grid-cols-2 gap-3 whitespace-pre-wrap break-words">
                <p lang="en">{item.text.en}</p>
                <p>{item.text.ja}</p>
              </div>
              <div className="flex gap-2">
                {item.builtIn ? (
                  <>
                    <button
                      className={actionClass}
                      disabled={disabled}
                      onClick={() => change(() => unwrap(api.setHidden(item.id, !item.hidden)))}
                    >
                      {item.hidden ? '再表示' : '非表示'}
                    </button>
                    <button
                      className={actionClass}
                      disabled={disabled || !!draft}
                      onClick={() => setDraft({ id: null, edit: item })}
                    >
                      コピーして追加
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className={actionClass}
                      disabled={disabled || !!draft}
                      onClick={() => setDraft({ id: item.id, edit: item })}
                    >
                      編集
                    </button>
                    <button
                      className={actionClass}
                      disabled={disabled || !!draft}
                      onClick={() => {
                        if (window.confirm('この部品を削除しますか？'))
                          change(() => unwrap(api.remove(item.id)))
                      }}
                    >
                      削除
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
      </ul>
    </section>
  )
}
