export const ONE_DRIVE_WARNING =
  '保存先がOneDriveの中にあります。同期の影響で保存や移動に失敗することがあります。設定から別の場所に変更してください'

export function isInOneDrive(dataRoot: string, roots: (string | undefined)[]): boolean {
  const normalize = (value: string): string =>
    value.replaceAll('/', '\\').replace(/\\+$/, '').toLowerCase()
  const target = normalize(dataRoot)
  return roots.some((value) => {
    if (!value) return false
    const root = normalize(value)
    return root.length > 0 && (target === root || target.startsWith(root + '\\'))
  })
}
