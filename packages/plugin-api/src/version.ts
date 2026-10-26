/** Version of the plugin API implemented by the host. Bump on breaking changes. */
export const PLUGIN_API_VERSION = 1 as const

export type PluginApiVersion = typeof PLUGIN_API_VERSION
