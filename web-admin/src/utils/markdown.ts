export function findUnclosedCodeFence(markdown = '') {
  const lines = String(markdown).split(/\r?\n/)
  let openedFence: { line: number; char: string; length: number } | null = null

  lines.forEach((line, index) => {
    const match = line.match(/^\s{0,3}(`{3,}|~{3,})/)
    if (!match) return
    const marker = match[1]
    if (!openedFence) {
      openedFence = { line: index + 1, char: marker[0], length: marker.length }
      return
    }
    if (marker[0] === openedFence.char && marker.length >= openedFence.length) {
      openedFence = null
    }
  })

  return openedFence
}
