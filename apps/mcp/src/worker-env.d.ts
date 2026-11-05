declare namespace Cloudflare {
  interface Env {
    BRIDGE_ROOM: DurableObjectNamespace<import('./bridge-room').BridgeRoom>
    ALLOWED_ORIGINS: string
  }

  interface GlobalProps {
    mainModule: typeof import('./index')
    durableNamespaces: 'BridgeRoom'
  }
}
