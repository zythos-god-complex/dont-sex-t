// One RealtimeClient per tab. Presence + broadcast over a single websocket.
import { RealtimeClient, type RealtimeChannel } from '@supabase/realtime-js'
import { REALTIME_URL, SUPABASE_KEY } from './env'

export type SocketEvent = 'open' | 'close' | 'error'

let client: RealtimeClient | null = null
const listeners = new Set<(e: SocketEvent) => void>()
let refSeq = 0

function emit(e: SocketEvent) {
  for (const l of listeners) {
    try {
      l(e)
    } catch {
      /* ignore */
    }
  }
}

/** Fast reconnect: 250ms, 500ms, 1s, 2s, then 3s. */
function reconnectAfterMs(tries: number): number {
  return [250, 500, 1000, 2000][tries - 1] ?? 3000
}

export function getRealtime(): RealtimeClient {
  if (client) return client
  client = new RealtimeClient(REALTIME_URL, {
    params: { apikey: SUPABASE_KEY },
    heartbeatIntervalMs: 15000,
    reconnectAfterMs,
    timeout: 10000,
  })
  const cbs = client.stateChangeCallbacks
  cbs.open.push([`gat${++refSeq}`, () => emit('open')])
  cbs.close.push([`gat${++refSeq}`, () => emit('close')])
  cbs.error.push([`gat${++refSeq}`, () => emit('error')])
  client.connect()
  return client
}

export function onSocket(cb: (e: SocketEvent) => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function isSocketOpen(): boolean {
  return !!client && client.isConnected()
}

/** Public channel. Pass `presence` to enable presence (key = presence key, '' lets the server pick). */
export function channel(topic: string, opts?: { presence?: { key: string } }): RealtimeChannel {
  const rt = getRealtime()
  return rt.channel(topic, {
    config: {
      broadcast: { self: false, ack: false },
      presence: opts?.presence ? { key: opts.presence.key, enabled: true } : { key: '', enabled: false },
      private: false,
    },
  })
}

export async function removeChannel(ch: RealtimeChannel | null | undefined): Promise<void> {
  if (!ch || !client) return
  try {
    await client.removeChannel(ch)
  } catch {
    /* ignore */
  }
}

export function canPush(ch: RealtimeChannel | null | undefined): boolean {
  return !!ch && ch.state === 'joined' && isSocketOpen()
}

export function reconnectNow(): void {
  if (!client) return
  if (!client.isConnected() && !client.isConnecting()) client.connect()
}
