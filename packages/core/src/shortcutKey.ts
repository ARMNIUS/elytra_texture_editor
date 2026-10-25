const CODE_KEYS: Record<string, string> = {
  Comma: ',', Period: '.', Semicolon: ';', Quote: "'", BracketLeft: '[', BracketRight: ']',
  Backslash: '\\', Slash: '/', Minus: '-', Equal: '=', Backquote: '`', Space: ' ',
  NumpadAdd: '+', NumpadSubtract: '-', NumpadMultiply: '*', NumpadDivide: '/',
}

// Physical ЙЦУКЕН keys in the Latin order used by the shortcut labels.
const CYRILLIC_KEYS: Record<string, string> = {
  й: 'Q', ц: 'W', у: 'E', к: 'R', е: 'T', н: 'Y', г: 'U', ш: 'I', щ: 'O', з: 'P', х: '[', ъ: ']',
  ф: 'A', ы: 'S', в: 'D', а: 'F', п: 'G', р: 'H', о: 'J', л: 'K', д: 'L', ж: ';', э: "'",
  я: 'Z', ч: 'X', с: 'C', м: 'V', и: 'B', т: 'N', ь: 'M', б: ',', ю: '.', ё: '`',
}

/**
 * Returns a layout-independent shortcut key.
 *
 * Cyrillic characters are translated to the Latin key at the same physical
 * position, so Ctrl+S still matches when the Russian layout produces "ы".
 * Latin layouts keep their logical keys (AZERTY/Dvorak included); `event.code`
 * is only a fallback for dead keys and layouts that produce no character.
 */
export function shortcutKey(event: Pick<KeyboardEvent, 'key'> & { code?: string }): string {
  const key = event.key
  if (key.length === 1) {
    const lower = key.toLowerCase()
    const cyrillic = CYRILLIC_KEYS[lower]
    if (cyrillic) return cyrillic
    return /[a-z]/i.test(key) ? key.toUpperCase() : key
  }
  if (key && key !== 'Unidentified') return key

  const code = event.code ?? ''
  if (/^Key[A-Z]$/.test(code)) return code.slice(3)
  if (/^Digit[0-9]$/.test(code)) return code.slice(5)
  if (/^Numpad[0-9]$/.test(code)) return code.slice(6)
  return CODE_KEYS[code] ?? code
}
