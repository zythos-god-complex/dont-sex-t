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

const BY_EXT: Record<string, string> = { mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', ogg: 'audio/ogg', opus: 'audio/ogg', wav: 'audio/wav', webm: 'audio/webm' }
const EXT: Record<string, string> = { 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/aac': 'aac', 'audio/ogg': 'ogg', 'audio/wav': 'wav', 'audio/webm': 'webm' }

/** Normalised audio type for a recording or a picked file, or null when it isn't audio we take (videos included). */
export function audioType(blob: Blob, name = ''): string | null {
  let type = (blob.type || '').split(';')[0].toLowerCase()
  if (!type.startsWith('audio/')) type = BY_EXT[(name.split('.').pop() ?? '').toLowerCase()] ?? (blob.type ? '' : 'audio/webm')
  if (type === 'audio/x-m4a' || type === 'audio/m4a') type = 'audio/mp4'
  if (type === 'audio/mp3') type = 'audio/mpeg'
  if (type === 'audio/x-wav' || type === 'audio/wave') type = 'audio/wav'
  return EXT[type] ? type : null
}

/** Length and 40 waveform bars of an audio file (flat bars when the phone can't decode it). */
export async function readAudioFile(file: Blob): Promise<{ dur: number; peaks: number[] }> {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new AC()
    const buf = await ctx.decodeAudioData(await file.arrayBuffer())
    void ctx.close()
    const d = buf.getChannelData(0)
    const step = Math.max(1, Math.floor(d.length / 40))
    const raw = Array.from({ length: 40 }, (_, i) => {
      let m = 0
      for (let j = i * step; j < Math.min(d.length, (i + 1) * step); j += 32) m = Math.max(m, Math.abs(d[j]))
      return m
    })
    const max = Math.max(0.01, ...raw)
    return { dur: buf.duration, peaks: raw.map((v) => v / max) }
  } catch {
    const url = URL.createObjectURL(file)
    const dur = await new Promise<number>((res) => {
      const a = new Audio()
      a.preload = 'metadata'
      a.onloadedmetadata = () => res(Number.isFinite(a.duration) ? a.duration : 0)
      a.onerror = () => res(0)
      a.src = url
    })
    URL.revokeObjectURL(url)
    return { dur, peaks: Array(40).fill(0.5) }
  }
}

export async function uploadVoice(blob: Blob, _userId: string, name = ''): Promise<string> {
  const type = audioType(blob, name) ?? 'audio/webm'
  const ext = EXT[type]
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
