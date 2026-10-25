export type FileFilter = { name: string; extensions: string[] }

export type BrowserFileHandle = {
  name: string
  createWritable: () => Promise<{ write: (data: Blob) => Promise<void>; close: () => Promise<void> }>
}

type FilePickerWindow = Window & {
  showSaveFilePicker?: (options: {
    suggestedName?: string
    types?: Array<{ description?: string; accept: Record<string, string[]> }>
  }) => Promise<BrowserFileHandle>
}

export type BrowserSaveResult = { saved: boolean; handle: BrowserFileHandle | null }

export function isDesktopRuntime(): boolean {
  if (typeof window === 'undefined') return false
  const candidate = window as Window & { isTauri?: boolean }
  return Boolean(candidate.isTauri) || '__TAURI_INTERNALS__' in window || '__TAURI__' in window
}

export function basename(path: string): string {
  const parts = path.split(/[\\/]/)
  return parts[parts.length - 1] || path
}

export function ensureExtension(path: string, extension: string): string {
  const suffix = extension.startsWith('.') ? extension : `.${extension}`
  return path.toLowerCase().endsWith(suffix.toLowerCase()) ? path : `${path}${suffix}`
}

export function toProjectName(name: string, extension = 'mts'): string {
  const base = name.replace(/\.(png|mts|rsp|json)$/i, '').trim()
  return `${base || 'untitled'}.${extension}`
}

export function toPngName(name: string): string {
  const base = name.replace(/\.(png|mts|json)$/i, '').trim()
  return `${base || 'untitled'}.png`
}

/** Native save dialog. Returns null when the user cancels. */
export async function pickSavePath(defaultPath: string, filters: FileFilter[], title: string): Promise<string | null> {
  const { save } = await import('@tauri-apps/plugin-dialog')
  const selected = await save({ title, defaultPath, filters })
  return typeof selected === 'string' ? selected : null
}

/** Native open dialog. Returns null when the user cancels. */
export async function pickOpenPath(filters: FileFilter[], title: string): Promise<string | null> {
  const { open } = await import('@tauri-apps/plugin-dialog')
  const selected = await open({ title, multiple: false, directory: false, filters })
  return typeof selected === 'string' ? selected : null
}

export async function writeTextFile(path: string, contents: string): Promise<void> {
  const { invoke } = await import('@tauri-apps/api/core')
  await invoke('write_text_file', { path, contents })
}

export async function writeBinaryFile(path: string, contents: Uint8Array): Promise<void> {
  const { invoke } = await import('@tauri-apps/api/core')
  await invoke('write_binary_file', { path, contents: Array.from(contents) })
}

export async function readTextFile(path: string): Promise<string> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<string>('read_text_file', { path })
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function writeHandle(handle: BrowserFileHandle, blob: Blob): Promise<void> {
  const writable = await handle.createWritable()
  await writable.write(blob)
  await writable.close()
}

function isAbort(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'name' in error && (error as { name?: unknown }).name === 'AbortError'
}

/**
 * Browser fallback: use the File System Access API when Chromium provides it,
 * otherwise download the blob so `npm run dev` remains usable in every browser.
 */
export async function saveBlobInBrowser(
  blob: Blob,
  suggestedName: string,
  options: { handle?: BrowserFileHandle | null; accept?: Record<string, string[]> } = {},
): Promise<BrowserSaveResult> {
  if (options.handle) {
    await writeHandle(options.handle, blob)
    return { saved: true, handle: options.handle }
  }
  const picker = (window as FilePickerWindow).showSaveFilePicker
  if (picker) {
    try {
      const handle = await picker({
        suggestedName,
        types: options.accept ? [{ description: 'Файл', accept: options.accept }] : undefined,
      })
      await writeHandle(handle, blob)
      return { saved: true, handle }
    } catch (error) {
      if (isAbort(error)) return { saved: false, handle: null }
      // Fall back to a regular download if the picker is unavailable or blocked.
    }
  }
  downloadBlob(blob, suggestedName)
  return { saved: true, handle: null }
}
