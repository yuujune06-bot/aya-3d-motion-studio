import { Button } from '@/components/ui/button'
import type { EditorState } from '../stores/editor'
import { ONE_DRIVE_WARNING } from '../../shared/oneDrive'

export function Home({ state }: { state: EditorState }): React.JSX.Element {
  return (
    <main className="mx-auto w-full max-w-5xl p-8">
      {state.settings?.inOneDrive && (
        <p role="alert" className="mb-6 rounded border border-amber-400 bg-amber-50 p-4">
          {ONE_DRIVE_WARNING}
        </p>
      )}
      <div className="flex justify-end">
        <Button type="button" disabled={state.busy || state.closing}>
          ＋ 新しい制作を作る
        </Button>
      </div>
      <h2 className="py-16 text-center text-xl">まだ制作がありません</h2>
    </main>
  )
}
