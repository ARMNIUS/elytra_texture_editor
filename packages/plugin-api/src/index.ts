/**
 * RawSprite plugin API v1.
 *
 * The editor core exposes registries and slots; a plugin contributes commands,
 * panels, document types, overlays, previews and file handlers. The API is
 * intentionally framework-agnostic: no React or three.js types leak into it.
 */

import type { PluginApiVersion } from './version'

export * from './version'

export type Disposable = {
  dispose(): void
}

export type PluginManifest = {
  id: string
  name: string
  version: string
  apiVersion: PluginApiVersion
  description?: string
  author?: string
}

export type DocumentDescriptor = {
  id: string
  name: string
  width: number
  height: number
  /** Opaque, plugin-owned data persisted with the document. */
  extensions: Record<string, unknown>
}

export type DocumentKind = {
  id: string
  label: string
  /** Default canvas size for a new document of this kind. */
  defaultWidth: number
  defaultHeight: number
  extensions?: Record<string, unknown>
}

export type CommandHandler = (...args: unknown[]) => void | Promise<void>

export type CommandContribution = {
  id: string
  label: string
  shortcut?: string
  enabled?: () => boolean
  run: CommandHandler
}

export type MenuArea = 'file' | 'edit' | 'view' | 'image' | 'layer' | 'tools' | 'settings' | 'help'
export type MenuContribution = {
  id: string
  area: MenuArea
  label: string
  commandId?: string
  shortcut?: string
  separatorBefore?: boolean
  order?: number
}

export type PanelArea = 'left' | 'right' | 'bottom' | 'document-tabs'
export type PanelContribution = {
  id: string
  title: string
  area: PanelArea
  order?: number
  /** Rendered by the host from the plugin's own UI module. */
  componentId: string
  visible?: () => boolean
}

export type OverlayArea = 'canvas' | 'preview'
export type OverlayContribution = {
  id: string
  area: OverlayArea
  order?: number
  componentId: string
  visible?: () => boolean
}

export type PreviewContribution = {
  id: string
  title: string
  componentId: string
  order?: number
}

export type FileFilter = {
  name: string
  extensions: string[]
}

export type ImportRequest = {
  data: Uint8Array
  fileName: string
  document?: DocumentDescriptor
}

export type ExportRequest = {
  document: DocumentDescriptor
}

export type ImportResult = {
  document: {
    name: string
    width: number
    height: number
    extensions?: Record<string, unknown>
  }
  /** Raw layer data is provided by the core's document API; v1 keeps import minimal. */
  payload?: unknown
}

export type ImporterContribution = {
  id: string
  label: string
  filters: FileFilter[]
  import: (request: ImportRequest) => Promise<ImportResult>
}

export type ExporterContribution = {
  id: string
  label: string
  extension: string
  export: (request: ExportRequest) => Promise<Uint8Array>
}

export interface CommandRegistry {
  register(command: CommandContribution): Disposable
}

export interface MenuRegistry {
  register(item: MenuContribution): Disposable
}

export interface PanelRegistry {
  register(panel: PanelContribution): Disposable
}

export interface OverlayRegistry {
  register(overlay: OverlayContribution): Disposable
}

export interface PreviewRegistry {
  register(preview: PreviewContribution): Disposable
}

export interface DocumentTypeRegistry {
  register(kind: DocumentKind): Disposable
}

export interface ImporterRegistry {
  register(importer: ImporterContribution): Disposable
}

export interface ExporterRegistry {
  register(exporter: ExporterContribution): Disposable
}

export interface PluginStorage {
  get<T>(key: string, fallback: T): T
  set(key: string, value: unknown): void
  remove(key: string): void
}

export interface PluginEventBus {
  on(event: string, handler: (payload: unknown) => void): Disposable
  emit(event: string, payload?: unknown): void
}

export interface PluginContext {
  manifest: PluginManifest
  commands: CommandRegistry
  menus: MenuRegistry
  panels: PanelRegistry
  overlays: OverlayRegistry
  previews: PreviewRegistry
  documentTypes: DocumentTypeRegistry
  importers: ImporterRegistry
  exporters: ExporterRegistry
  events: PluginEventBus
  storage: PluginStorage
}

export interface EditorPlugin {
  manifest: PluginManifest
  /** Called once when the plugin is enabled. */
  activate(context: PluginContext): void | Promise<void>
  /** Called when the plugin is disabled or the app shuts down. */
  deactivate?(): void
}

export type PluginFactory = () => EditorPlugin

export * from './host'
