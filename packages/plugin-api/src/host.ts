import { PLUGIN_API_VERSION } from './version'
import type {
  CommandContribution,
  Disposable,
  DocumentKind,
  EditorPlugin,
  ExporterContribution,
  ImporterContribution,
  MenuArea,
  MenuContribution,
  OverlayContribution,
  PanelContribution,
  PluginContext,
  PluginManifest,
  PreviewContribution,
} from './index'

export type PluginActivationResult = { ok: true } | { ok: false; error: Error }

export type PluginHostOptions = {
  /** Called for isolated plugin errors instead of letting them crash the editor. */
  onError?: (error: Error, pluginId: string) => void
}

type ActivePlugin = {
  plugin: EditorPlugin
  scope: DisposalScope
}

type EventEntry = { pluginId: string; handler: (payload: unknown) => void }

class DisposalScope {
  private callbacks: Array<() => void> = []
  private disposed = false

  add(callback: () => void): void {
    if (this.disposed) {
      callback()
      return
    }
    this.callbacks.push(callback)
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    while (this.callbacks.length) {
      const callback = this.callbacks.pop()
      try {
        callback?.()
      } catch {
        // A broken registration cleanup must not prevent the rest from running.
      }
    }
  }
}

type RegistryEntry<T> = { pluginId: string; value: T }

class ContributionRegistry<T extends { id: string }> {
  private readonly entries = new Map<string, RegistryEntry<T>>()

  constructor(private readonly label: string) {}

  register(pluginId: string, value: T, scope: DisposalScope): Disposable {
    if (!value || typeof value.id !== 'string' || value.id.trim() === '') {
      throw new Error(`${this.label} id is required`)
    }
    if (this.entries.has(value.id)) {
      throw new Error(`${this.label} "${value.id}" is already registered`)
    }
    const entry = { pluginId, value }
    this.entries.set(value.id, entry)
    const remove = () => {
      if (this.entries.get(value.id) === entry) this.entries.delete(value.id)
    }
    scope.add(remove)
    return { dispose: remove }
  }

  get(id: string): T | undefined {
    return this.entries.get(id)?.value
  }

  owner(id: string): string | undefined {
    return this.entries.get(id)?.pluginId
  }

  list(pluginId?: string): T[] {
    const values: T[] = []
    for (const entry of this.entries.values()) {
      if (pluginId === undefined || entry.pluginId === pluginId) values.push(entry.value)
    }
    return values
  }
}

function byOrder<T extends { id: string; order?: number }>(first: T, second: T): number {
  const delta = (first.order ?? 0) - (second.order ?? 0)
  return delta !== 0 ? delta : first.id.localeCompare(second.id)
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}

/**
 * Framework-agnostic plugin host for API v1.
 *
 * The host owns registries and lifecycle. A plugin only receives its own
 * `PluginContext`; every registration is rolled back when activation fails or
 * the plugin is deactivated. UI wiring (menus, panels, previews) is the
 * editor's responsibility and reads the lists exposed here.
 */
export class PluginHost {
  private readonly active = new Map<string, ActivePlugin>()
  private readonly commands = new ContributionRegistry<CommandContribution>('Command')
  private readonly menus = new ContributionRegistry<MenuContribution>('Menu item')
  private readonly panels = new ContributionRegistry<PanelContribution>('Panel')
  private readonly overlays = new ContributionRegistry<OverlayContribution>('Overlay')
  private readonly previews = new ContributionRegistry<PreviewContribution>('Preview')
  private readonly documentTypes = new ContributionRegistry<DocumentKind>('Document type')
  private readonly importers = new ContributionRegistry<ImporterContribution>('Importer')
  private readonly exporters = new ContributionRegistry<ExporterContribution>('Exporter')
  private readonly eventHandlers = new Map<string, Set<EventEntry>>()
  private readonly pluginStorage = new Map<string, Map<string, unknown>>()
  private readonly listeners = new Set<() => void>()

  constructor(private readonly options: PluginHostOptions = {}) {}

  get apiVersion(): number {
    return PLUGIN_API_VERSION
  }

  /** Notifies the editor when the set of active plugins changes. */
  subscribe(listener: () => void): Disposable {
    this.listeners.add(listener)
    return { dispose: () => { this.listeners.delete(listener) } }
  }

  get activePlugins(): PluginManifest[] {
    return [...this.active.values()].map((entry) => entry.plugin.manifest)
  }

  isActive(pluginId: string): boolean {
    return this.active.has(pluginId)
  }

  getCommands(): CommandContribution[] {
    return this.commands.list()
  }

  getMenus(area?: MenuArea): MenuContribution[] {
    const items = this.menus.list().filter((item) => area === undefined || item.area === area)
    return items.sort(byOrder)
  }

  getPanels(area?: PanelContribution['area']): PanelContribution[] {
    const items = this.panels.list().filter((item) => area === undefined || item.area === area)
    return items.sort(byOrder)
  }

  getOverlays(area?: OverlayContribution['area']): OverlayContribution[] {
    const items = this.overlays.list().filter((item) => area === undefined || item.area === area)
    return items.sort(byOrder)
  }

  getPreviews(): PreviewContribution[] {
    return this.previews.list().sort(byOrder)
  }

  getDocumentTypes(): DocumentKind[] {
    return this.documentTypes.list()
  }

  getImporters(): ImporterContribution[] {
    return this.importers.list()
  }

  getExporters(): ExporterContribution[] {
    return this.exporters.list()
  }

  /**
   * Activates a plugin. On failure all contributions registered during this
   * activation are removed, so a broken plugin cannot leave half a UI behind.
   */
  async activate(plugin: EditorPlugin): Promise<PluginActivationResult> {
    const manifest = plugin?.manifest
    if (!manifest || typeof manifest.id !== 'string' || manifest.id.trim() === '') {
      return { ok: false, error: new Error('Plugin manifest id is required') }
    }
    if (typeof manifest.name !== 'string' || typeof manifest.version !== 'string') {
      return { ok: false, error: new Error('Plugin manifest name and version are required') }
    }
    if (manifest.apiVersion !== PLUGIN_API_VERSION) {
      return {
        ok: false,
        error: new Error(
          `Plugin "${manifest.id}" targets API ${String(manifest.apiVersion)}, host supports ${PLUGIN_API_VERSION}`,
        ),
      }
    }
    if (this.active.has(manifest.id)) {
      return { ok: false, error: new Error(`Plugin "${manifest.id}" is already active`) }
    }
    if (typeof plugin.activate !== 'function') {
      return { ok: false, error: new Error(`Plugin "${manifest.id}" has no activate() function`) }
    }

    const scope = new DisposalScope()
    const context = this.createContext(plugin, scope)
    const storageBefore = this.pluginStorage.get(manifest.id)
    try {
      await plugin.activate(context)
    } catch (error) {
      scope.dispose()
      this.removeEventsFor(manifest.id)
      if (storageBefore) this.pluginStorage.set(manifest.id, storageBefore)
      else this.pluginStorage.delete(manifest.id)
      return { ok: false, error: toError(error) }
    }

    this.active.set(manifest.id, { plugin, scope })
    this.notify()
    return { ok: true }
  }

  async deactivate(pluginId: string): Promise<boolean> {
    const active = this.active.get(pluginId)
    if (!active) return false
    this.active.delete(pluginId)
    try {
      await active.plugin.deactivate?.()
    } catch (error) {
      this.reportError(toError(error), pluginId)
    }
    active.scope.dispose()
    this.removeEventsFor(pluginId)
    this.notify()
    return true
  }

  async deactivateAll(): Promise<void> {
    for (const pluginId of [...this.active.keys()]) {
      await this.deactivate(pluginId)
    }
  }

  /** Runs a registered command; plugin errors are isolated and reported. */
  async runCommand(id: string, ...args: unknown[]): Promise<boolean> {
    const command = this.commands.get(id)
    if (!command) return false
    try {
      await command.run(...args)
      return true
    } catch (error) {
      this.reportError(toError(error), this.commands.owner(id) ?? 'unknown')
      return false
    }
  }

  private createContext(plugin: EditorPlugin, scope: DisposalScope): PluginContext {
    const pluginId = plugin.manifest.id
    return {
      manifest: plugin.manifest,
      commands: { register: (command) => this.commands.register(pluginId, command, scope) },
      menus: { register: (item) => this.menus.register(pluginId, item, scope) },
      panels: { register: (panel) => this.panels.register(pluginId, panel, scope) },
      overlays: { register: (overlay) => this.overlays.register(pluginId, overlay, scope) },
      previews: { register: (preview) => this.previews.register(pluginId, preview, scope) },
      documentTypes: { register: (kind) => this.documentTypes.register(pluginId, kind, scope) },
      importers: { register: (importer) => this.importers.register(pluginId, importer, scope) },
      exporters: { register: (exporter) => this.exporters.register(pluginId, exporter, scope) },
      events: {
        on: (event, handler) => this.onEvent(pluginId, event, handler),
        emit: (event, payload) => this.emitEvent(event, payload),
      },
      storage: {
        get: <T>(key: string, fallback: T): T => {
          const values = this.pluginStorage.get(pluginId)
          return values?.has(key) ? (values.get(key) as T) : fallback
        },
        set: (key: string, value: unknown): void => {
          const values = this.pluginStorage.get(pluginId) ?? new Map<string, unknown>()
          values.set(key, value)
          this.pluginStorage.set(pluginId, values)
        },
        remove: (key: string): void => {
          this.pluginStorage.get(pluginId)?.delete(key)
        },
      },
    }
  }

  private onEvent(pluginId: string, event: string, handler: (payload: unknown) => void): Disposable {
    if (typeof event !== 'string' || event === '') throw new Error('Event name is required')
    if (typeof handler !== 'function') throw new Error('Event handler is required')
    const entry: EventEntry = { pluginId, handler }
    const handlers = this.eventHandlers.get(event) ?? new Set<EventEntry>()
    handlers.add(entry)
    this.eventHandlers.set(event, handlers)
    const dispose = () => {
      handlers.delete(entry)
      if (!handlers.size && this.eventHandlers.get(event) === handlers) this.eventHandlers.delete(event)
    }
    return { dispose }
  }

  private emitEvent(event: string, payload?: unknown): void {
    const handlers = this.eventHandlers.get(event)
    if (!handlers) return
    for (const entry of [...handlers]) {
      try {
        entry.handler(payload)
      } catch (error) {
        this.reportError(toError(error), entry.pluginId)
      }
    }
  }

  private removeEventsFor(pluginId: string): void {
    for (const [event, handlers] of this.eventHandlers) {
      for (const entry of [...handlers]) {
        if (entry.pluginId === pluginId) handlers.delete(entry)
      }
      if (!handlers.size) this.eventHandlers.delete(event)
    }
  }

  private notify(): void {
    for (const listener of [...this.listeners]) {
      try {
        listener()
      } catch (error) {
        this.reportError(toError(error), 'host')
      }
    }
  }

  private reportError(error: Error, pluginId: string): void {
    if (this.options.onError) this.options.onError(error, pluginId)
    else console.error(`[plugin:${pluginId}]`, error)
  }
}

export function createPluginHost(options: PluginHostOptions = {}): PluginHost {
  return new PluginHost(options)
}
