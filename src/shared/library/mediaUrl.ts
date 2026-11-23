export function referenceUrl(characterId: string, file: string, thumbnail = false): string {
  return `aya-media://data/${encodeURIComponent(`library/characters/${characterId}/${file}`)}${thumbnail ? '?thumb=1' : ''}`
}
