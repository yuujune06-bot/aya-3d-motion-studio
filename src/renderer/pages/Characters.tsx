import { useEffect, useRef, useState } from 'react'
import { ulid } from 'ulid'
import type { Character, CharacterEdit, CharacterList } from '../../shared/schema/library'
import { referenceUrl } from '../../shared/library/mediaUrl'
import { actionClass, fieldClass, Pair } from '../components/LibraryFields'
import { Autosave } from '../stores/autosave'
import { registerSave, unwrap, type EditorState } from '../stores/editor'

const appearance = {
  style: '画風',
  face: '顔',
  hair: '髪',
  body: '体格',
  notes: '外見のメモ',
} as const
const clothing = { top: 'トップス', bottom: 'ボトムス', shoes: '靴' } as const
const appearanceKeys = ['style', 'face', 'hair', 'body', 'notes'] as const
const clothingKeys = ['top', 'bottom', 'shoes'] as const

export function Characters({ state }: { state: EditorState }): React.JSX.Element {
  const api = window.api.characters
  const { run } = state
  const [list, setList] = useState<CharacterList>({ characters: [], unreadable: [] })
  const [character, setCharacter] = useState<Character | null>(null)
  const [saveFailed, setSaveFailed] = useState(false)
  const [save] = useState(
    () =>
      new Autosave<Character>(async (draft) => {
        try {
          const saved = await unwrap(api.save(draft.id, draft, {}))
          setCharacter((current) => (current === draft ? saved : current))
          setList((current) => ({
            ...current,
            characters: current.characters.map((item) => (item.id === saved.id ? saved : item)),
          }))
          setSaveFailed(false)
        } catch (error) {
          setSaveFailed(true)
          throw error
        }
      }),
  )
  const refresh = async (): Promise<void> => setList(await unwrap(api.list()))
  const loaded = useRef(false)
  useEffect(() => {
    if (!state.busy && !loaded.current) {
      loaded.current = true
      void run(async () => setList(await unwrap(api.list())))
    }
  }, [api, run, state.busy])
  useEffect(() => registerSave(() => save.flush()), [save])

  const perform = (action: () => Promise<void>): void => {
    void run(async () => {
      await save.flush()
      await action()
    })
  }
  const edit = (change: Partial<CharacterEdit>): void => {
    if (!character || character.locked) return
    const draft = { ...character, ...change }
    setCharacter(draft)
    save.schedule(draft)
  }
  const disabled = state.busy || state.closing
  const empty = { en: '', ja: '' }

  return (
    <main className="grid gap-5 p-6 md:grid-cols-[14rem_minmax(0,1fr)]">
      <aside className="space-y-3">
        <h2 className="text-xl font-semibold">キャラ</h2>
        <button
          className={actionClass}
          disabled={disabled}
          onClick={() =>
            perform(async () => {
              setCharacter(await unwrap(api.create()))
              await refresh()
            })
          }
        >
          キャラを追加
        </button>
        <ul className="space-y-1">
          {list.characters.map((item) => (
            <li key={item.id}>
              <button
                className={actionClass}
                aria-pressed={character?.id === item.id}
                disabled={disabled}
                onClick={() =>
                  perform(async () => {
                    setCharacter(await unwrap(api.get(item.id)))
                  })
                }
              >
                {item.name || '名前のないキャラ'}
                {item.locked && '（固定中）'}
              </button>
            </li>
          ))}
        </ul>
        {list.unreadable.length > 0 && (
          <section>
            <h3>開けないキャラ</h3>
            <ul className="break-all">
              {list.unreadable.map((id) => (
                <li key={id}>{id}</li>
              ))}
            </ul>
          </section>
        )}
      </aside>
      {character && (
        <section className="min-w-0 space-y-4 rounded border p-4">
          <h3 className="text-lg font-semibold">キャラの編集</h3>
          <p>
            版数 {character.revision} ・ 更新日{' '}
            {new Date(character.updatedAt).toLocaleString('ja-JP')}
          </p>
          {saveFailed && (
            <p role="alert">
              キャラを保存できませんでした。
              <button className={actionClass} onClick={() => perform(async () => {})}>
                保存を再試行
              </button>
            </p>
          )}
          <div className="flex gap-2">
            <button
              className={actionClass}
              disabled={disabled}
              onClick={() => {
                if (character.locked && !window.confirm('固定を解除して編集しますか？')) return
                perform(async () => {
                  setCharacter(
                    await unwrap(
                      api.save(
                        character.id,
                        { ...character, locked: !character.locked },
                        { confirmUnlock: character.locked },
                      ),
                    ),
                  )
                  await refresh()
                })
              }}
            >
              {character.locked ? '固定を解除' : '固定する'}
            </button>
            <button
              className={actionClass}
              disabled={disabled}
              onClick={() => {
                const question = character.locked
                  ? '固定中のキャラをゴミ箱へ移動しますか？'
                  : 'キャラをゴミ箱へ移動しますか？'
                if (window.confirm(question))
                  perform(async () => {
                    await unwrap(api.remove(character.id, { confirmUnlock: character.locked }))
                    setCharacter(null)
                    await refresh()
                  })
              }}
            >
              ゴミ箱へ移動
            </button>
          </div>
          <fieldset disabled={disabled} className="space-y-4">
            <label>
              名前
              <input
                className={fieldClass}
                value={character.name}
                readOnly={character.locked}
                onChange={(event) => edit({ name: event.target.value })}
              />
            </label>
            <section>
              <h4 className="text-lg font-semibold">外見</h4>
              {appearanceKeys.map((key) => (
                <Pair
                  key={key}
                  label={appearance[key]}
                  value={character.appearance[key]}
                  onChange={
                    character.locked
                      ? undefined
                      : (value) => edit({ appearance: { ...character.appearance, [key]: value } })
                  }
                />
              ))}
            </section>
            <section className="space-y-3">
              <h4 className="text-lg font-semibold">衣装</h4>
              {character.outfits.map((item, index) => {
                const update = (change: Partial<typeof item>): void =>
                  edit({
                    outfits: character.outfits.map((outfit) =>
                      outfit.id === item.id ? { ...outfit, ...change } : outfit,
                    ),
                  })
                return (
                  <fieldset key={item.id} className="rounded border p-3">
                    <legend>衣装 {index + 1}</legend>
                    <label>
                      衣装の名前
                      <input
                        className={fieldClass}
                        value={item.name}
                        readOnly={character.locked}
                        onChange={(event) => update({ name: event.target.value })}
                      />
                    </label>
                    <label className="my-2 block">
                      <input
                        type="radio"
                        name="default-outfit"
                        checked={item.isDefault}
                        disabled={character.locked}
                        onChange={() =>
                          edit({
                            outfits: character.outfits.map((outfit) => ({
                              ...outfit,
                              isDefault: outfit.id === item.id,
                            })),
                          })
                        }
                      />{' '}
                      既定の衣装
                    </label>
                    {clothingKeys.map((key) => (
                      <Pair
                        key={key}
                        label={clothing[key]}
                        value={item[key]}
                        onChange={
                          character.locked ? undefined : (value) => update({ [key]: value })
                        }
                      />
                    ))}
                    <button
                      className={actionClass}
                      disabled={character.locked}
                      onClick={() => {
                        const outfits = character.outfits.filter((outfit) => outfit.id !== item.id)
                        if (item.isDefault && outfits[0])
                          outfits[0] = { ...outfits[0], isDefault: true }
                        edit({ outfits })
                      }}
                    >
                      衣装を削除
                    </button>
                  </fieldset>
                )
              })}
              <button
                className={actionClass}
                disabled={character.locked}
                onClick={() =>
                  edit({
                    outfits: [
                      ...character.outfits,
                      {
                        id: ulid(),
                        name: '',
                        top: empty,
                        bottom: empty,
                        shoes: empty,
                        isDefault: character.outfits.length === 0,
                      },
                    ],
                  })
                }
              >
                衣装を追加
              </button>
            </section>
            <section className="space-y-3">
              <h4 className="text-lg font-semibold">キャラ画像</h4>
              <button
                className={actionClass}
                disabled={character.locked}
                onClick={() =>
                  perform(async () => {
                    const saved = await unwrap(api.addImage(character.id, {}))
                    if (saved) setCharacter(saved)
                  })
                }
              >
                画像を追加
              </button>
              <ul className="flex flex-wrap gap-4">
                {character.images.map((image, index) => (
                  <li key={image.id} className="space-y-2 rounded border p-2">
                    <img
                      src={referenceUrl(character.id, image.file, true)}
                      className="h-32 w-32 object-contain"
                      alt={`キャラ画像 ${index + 1}`}
                    />
                    <p className="text-sm">
                      {image.width} × {image.height}
                    </p>
                    <button
                      className={actionClass}
                      disabled={character.locked || image.isPrimary}
                      onClick={() =>
                        perform(async () => {
                          setCharacter(await unwrap(api.primaryImage(character.id, image.id, {})))
                        })
                      }
                    >
                      {image.isPrimary ? '★ 代表画像' : '☆ 代表にする'}
                    </button>
                    <button
                      className={actionClass}
                      disabled={character.locked}
                      onClick={() => {
                        if (window.confirm('画像をゴミ箱へ移動しますか？'))
                          perform(async () => {
                            setCharacter(await unwrap(api.removeImage(character.id, image.id, {})))
                          })
                      }}
                    >
                      画像を削除
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </fieldset>
        </section>
      )}
    </main>
  )
}
