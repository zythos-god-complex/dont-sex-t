import { SUPABASE_URL, SUPABASE_KEY } from '../../lib/env'
import { api } from '../../lib/api'
import { getToken } from '../../lib/engine'

// A voice note travels as a message body: [[voice:<public url>|<seconds>|<peaks>]]
// peaks = 40 bar heights, one base36 char each (0..z).
const RE = /^\[\[voice:(https:\/\/[^|\]]+)\|(\d+(?:\.\d+)?)\|([0-9a-z]{0,64})\]\]$/
export type VoiceNote = { url: string; dur: number; peaks: number[] }

export function voiceOf(body: string | null | undefined): VoiceNote | null {
  const m = body ? RE.exec(body) : null
  if (!m) return null
  return { url: m[1], dur: +m[2], peaks: [...m[3]].map((c) => parseInt(c, 36) / 35) }
}
export function voiceBody(url: string, dur: number, peaks: number[]): string {
  const p = peaks.map((v) => Math.max(0, Math.min(35, Math.round(v * 35))).toString(36)).join('')
  return `[[voice:${url}|${dur.toFixed(1)}|${p}]]`
}

export function pickMime(): string {
  const opts = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus']
  if (typeof MediaRecorder === 'undefined') return ''
  return opts.find((t) => MediaRecorder.isTypeSupported?.(t)) ?? ''
}

export async function uploadVoice(blob: Blob, _userId: string): Promise<string> {
  const type = (blob.type || 'audio/webm').split(';')[0]
  const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm'
  // the server hands out the file name (and enforces the daily quota); storage refuses any other name
  const tok = getToken()
  if (!tok) throw new Error('no session')
  const path = await api.uploadTicket(tok, 'gat-voice', ext)
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/gat-voice/${path}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'content-type': type },
    body: blob,
  })
  if (!r.ok) throw new Error('upload failed')
  return `${SUPABASE_URL}/storage/v1/object/public/gat-voice/${path}`
}

/** Downsample live analyser levels collected while recording into N bars (0..1). */
export function toPeaks(levels: number[], n = 40): number[] {
  if (!levels.length) return Array(n).fill(0.15)
  const out: number[] = []
  for (let i = 0; i < n; i++) {
    const a = Math.floor((i / n) * levels.length)
    const b = Math.max(a + 1, Math.floor(((i + 1) / n) * levels.length))
    let m = 0
    for (let j = a; j < b; j++) m = Math.max(m, levels[j])
    out.push(m)
  }
  const top = Math.max(...out, 0.05)
  return out.map((v) => Math.max(0.08, v / top))
}

export function fmtDur(s: number): string {
  const t = Math.max(0, Math.round(s))
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`
}
