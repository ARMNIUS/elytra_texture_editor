import { describe, expect, it, vi } from 'vitest'
import { PluginHost, createPluginHost } from '@rawsprite/plugin-api'
import type { EditorPlugin, PluginContext } from '@rawsprite/plugin-api'

function manifest(id: string, apiVersion = 1) {
  return { id, name: id, version: '1.0.0', apiVersion: apiVersion as 1 }
}

describe('PluginHost', () => {
  it('registers contributions, runs commands and exposes a scoped context', async () => {
    let received: unknown[] = []
    let context: PluginContext | undefined
    let activated = 0
    let deactivated = 0
    const plugin: EditorPlugin = {
      manifest: manifest('test.plugin'),
      activate(ctx) {
        activated += 1
        context = ctx
        ctx.commands.register({
          id: 'test.hello',
          label: 'Hello',
          run: (value) => { received.push(value) },
        })
        ctx.menus.register({ id: 'test.menu.late', area: 'file', label: 'Late', order: 20 })
        ctx.menus.register({ id: 'test.menu.early', area: 'file', label: 'Early', order: 10 })
        ctx.panels.register({ id: 'test.panel', title: 'Panel', area: 'right', componentId: 'panel' })
        ctx.overlays.register({ id: 'test.overlay', area: 'canvas', componentId: 'overlay' })
        ctx.previews.register({ id: 'test.preview', title: 'Preview', componentId: 'preview' })
        ctx.documentTypes.register({ id: 'test.doc', label: 'Test', defaultWidth: 16, defaultHeight: 8 })
        ctx.importers.register({
          id: 'test.importer', label: 'Test', filters: [{ name: 'Text', extensions: ['txt'] }],
          import: async () => ({ document: { name: 'x', width: 8, height: 8 } }),
        })
        ctx.exporters.register({
          id: 'test.exporter', label: 'Test', extension: 'txt',
          export: async () => new Uint8Array([1]),
        })
        ctx.events.on('ping', (payload) => { received.push(payload) })
        ctx.storage.set('seen', 42)
      },
      deactivate() { deactivated += 1 },
    }

    const host = createPluginHost()
    expect(await host.activate(plugin)).toEqual({ ok: true })
    expect(activated).toBe(1)
    expect(host.isActive('test.plugin')).toBe(true)
    expect(host.activePlugins.map((item) => item.id)).toEqual(['test.plugin'])
    expect(host.getCommands().map((item) => item.id)).toEqual(['test.hello'])
    expect(host.getMenus('file').map((item) => item.id)).toEqual(['test.menu.early', 'test.menu.late'])
    expect(host.getPanels('right').map((item) => item.id)).toEqual(['test.panel'])
    expect(host.getOverlays('canvas').map((item) => item.id)).toEqual(['test.overlay'])
    expect(host.getPreviews().map((item) => item.id)).toEqual(['test.preview'])
    expect(host.getDocumentTypes().map((item) => item.id)).toEqual(['test.doc'])
    expect(host.getImporters().map((item) => item.id)).toEqual(['test.importer'])
    expect(host.getExporters().map((item) => item.id)).toEqual(['test.exporter'])

    expect(await host.runCommand('test.hello', 'value')).toBe(true)
    context?.events.emit('ping', 'pong')
    expect(received).toEqual(['value', 'pong'])
    expect(context?.storage.get('seen', 0)).toBe(42)

    expect(await host.deactivate('test.plugin')).toBe(true)
    expect(deactivated).toBe(1)
    expect(host.isActive('test.plugin')).toBe(false)
    expect(host.getCommands()).toHaveLength(0)
    expect(host.getMenus()).toHaveLength(0)
    expect(host.getPanels()).toHaveLength(0)
    expect(host.getOverlays()).toHaveLength(0)
    expect(host.getPreviews()).toHaveLength(0)
    expect(host.getDocumentTypes()).toHaveLength(0)
    expect(host.getImporters()).toHaveLength(0)
    expect(host.getExporters()).toHaveLength(0)
    context?.events.emit('ping', 'ignored')
    expect(received).toEqual(['value', 'pong'])
  })

  it('rolls back contributions when activation fails', async () => {
    const host = new PluginHost()
    const plugin: EditorPlugin = {
      manifest: manifest('broken.plugin'),
      activate(ctx) {
        ctx.commands.register({ id: 'broken.command', label: 'Broken', run: () => {} })
        ctx.storage.set('temporary', true)
        throw new Error('activation failed')
      },
    }

    const result = await host.activate(plugin)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.message).toBe('activation failed')
    expect(host.isActive('broken.plugin')).toBe(false)
    expect(host.getCommands()).toHaveLength(0)
  })

  it('rejects mismatched API versions, duplicate ids and duplicate contribution ids', async () => {
    const host = new PluginHost()
    const wrongVersion: EditorPlugin = {
      manifest: manifest('old.plugin', 2),
      activate() {},
    }
    const versionResult = await host.activate(wrongVersion)
    expect(versionResult.ok).toBe(false)
    expect(host.isActive('old.plugin')).toBe(false)

    const first: EditorPlugin = {
      manifest: manifest('first.plugin'),
      activate(ctx) {
        ctx.commands.register({ id: 'shared.command', label: 'Shared', run: () => {} })
      },
    }
    const second: EditorPlugin = {
      manifest: manifest('second.plugin'),
      activate(ctx) {
        ctx.commands.register({ id: 'shared.command', label: 'Shared again', run: () => {} })
      },
    }
    expect((await host.activate(first)).ok).toBe(true)
    const duplicate = await host.activate(second)
    expect(duplicate.ok).toBe(false)
    expect(host.isActive('second.plugin')).toBe(false)
    expect(host.getCommands()).toHaveLength(1)
    expect((await host.activate(first)).ok).toBe(false)
  })

  it('isolates command and event handler errors', async () => {
    const onError = vi.fn()
    const host = new PluginHost({ onError })
    let context: PluginContext | undefined
    const plugin: EditorPlugin = {
      manifest: manifest('throwing.plugin'),
      activate(ctx) {
        context = ctx
        ctx.commands.register({
          id: 'throwing.command',
          label: 'Throw',
          run: () => { throw new Error('command failed') },
        })
        ctx.events.on('boom', () => { throw new Error('handler failed') })
      },
    }
    expect((await host.activate(plugin)).ok).toBe(true)
    expect(await host.runCommand('throwing.command')).toBe(false)
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError.mock.calls[0][1]).toBe('throwing.plugin')

    context?.events.emit('boom')
    expect(onError).toHaveBeenCalledTimes(2)
    expect(onError.mock.calls[1][1]).toBe('throwing.plugin')
    expect(host.activePlugins[0]?.id).toBe('throwing.plugin')
  })

  it('notifies subscribers when plugins activate and deactivate', async () => {
    const host = new PluginHost()
    const listener = vi.fn()
    const subscription = host.subscribe(listener)
    const plugin: EditorPlugin = { manifest: manifest('notify.plugin'), activate: () => {} }
    expect((await host.activate(plugin)).ok).toBe(true)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(await host.deactivate('notify.plugin')).toBe(true)
    expect(listener).toHaveBeenCalledTimes(2)
    subscription.dispose()
    expect((await host.activate(plugin)).ok).toBe(true)
    expect(listener).toHaveBeenCalledTimes(2)
    await host.deactivateAll()
    expect(listener).toHaveBeenCalledTimes(2)
  })
  it('keeps storage namespaced per plugin', async () => {
    const host = new PluginHost()
    const contexts: PluginContext[] = []
    const make = (id: string): EditorPlugin => ({
      manifest: manifest(id),
      activate(ctx) {
        contexts.push(ctx)
        ctx.storage.set('value', id)
      },
    })
    expect((await host.activate(make('a'))).ok).toBe(true)
    expect((await host.activate(make('b'))).ok).toBe(true)
    expect(contexts[0].storage.get('value', '')).toBe('a')
    expect(contexts[1].storage.get('value', '')).toBe('b')
    expect(contexts[0].storage.get('missing', 'fallback')).toBe('fallback')
    contexts[0].storage.remove('value')
    expect(contexts[0].storage.get('value', '')).toBe('')
    expect(contexts[1].storage.get('value', '')).toBe('b')
  })
})
