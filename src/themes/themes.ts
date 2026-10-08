import type { CSSProperties } from 'react'

export type Ambient = 'none' | 'petals' | 'stars' | 'bubbles' | 'leaves' | 'hearts' | 'sparkles' | 'aurora' | 'scanlines' | 'haze' | 'bats' | 'lovebeat' | 'party' | 'embers'

export type ThemeDef = {
  id: string
  name: string
  scheme: 'light' | 'dark'
  ambient: Ambient
  bg: string
  ink: string
  meta: string
  header: string
  sent: [string, string, string]
  sentInk: string
  recv: string
  recvInk: string
  accent: string
  accentInk: string
  composer: string
  composerInk: string
  mono?: boolean
}

export const THEMES: ThemeDef[] = [
  {
    id: 'goofy', name: 'goofy', scheme: 'light', ambient: 'none',
    bg: 'radial-gradient(circle at 1px 1px, rgba(23,19,31,.075) 1px, transparent 0) 0 0/22px 22px, #FBF5EC',
    ink: '#17131F', meta: 'rgba(23,19,31,.48)', header: 'rgba(251,245,236,.84)',
    sent: ['#FFC83D', '#FF9A3D', '#FF6F61'], sentInk: '#17131F',
    recv: '#FFFFFF', recvInk: '#17131F', accent: '#FF5C39', accentInk: '#FFFFFF',
    composer: '#FFFFFF', composerInk: '#17131F',
  },
  {
    id: 'cherry', name: 'cherry blossom', scheme: 'light', ambient: 'petals',
    bg: 'radial-gradient(120% 80% at 100% 0%, #FFDDE8 0%, transparent 60%), radial-gradient(100% 70% at 0% 100%, #FFD3E1 0%, transparent 55%), #FFF6F9',
    ink: '#4A1E2E', meta: 'rgba(74,30,46,.5)', header: 'rgba(255,240,245,.82)',
    sent: ['#FF8FB3', '#EC5C91', '#C93B76'], sentInk: '#FFFFFF',
    recv: '#FFFFFF', recvInk: '#4A1E2E', accent: '#E04482', accentInk: '#FFFFFF',
    composer: '#FFFFFF', composerInk: '#4A1E2E',
  },
  {
    id: 'midnight', name: 'midnight', scheme: 'dark', ambient: 'stars',
    bg: 'radial-gradient(90% 60% at 80% 0%, #1D2A5E 0%, transparent 60%), linear-gradient(180deg, #0B1026 0%, #06080F 100%)',
    ink: '#E6EAFF', meta: 'rgba(230,234,255,.5)', header: 'rgba(11,16,38,.8)',
    sent: ['#4C8DFF', '#3263FF', '#4B45E8'], sentInk: '#FFFFFF',
    recv: '#1A2142', recvInk: '#E6EAFF', accent: '#4F7DFF', accentInk: '#FFFFFF',
    composer: '#151B36', composerInk: '#E6EAFF',
  },
  {
    id: 'matcha', name: 'matcha latte', scheme: 'light', ambient: 'leaves',
    bg: 'radial-gradient(90% 60% at 0% 0%, #DCE8C4 0%, transparent 60%), radial-gradient(80% 60% at 100% 100%, #EFE6D2 0%, transparent 60%), #F2F2E4',
    ink: '#2D3A1F', meta: 'rgba(45,58,31,.5)', header: 'rgba(242,242,228,.84)',
    sent: ['#9CC064', '#76A143', '#5A852E'], sentInk: '#FFFFFF',
    recv: '#FFFDF6', recvInk: '#2D3A1F', accent: '#6E9A3B', accentInk: '#FFFFFF',
    composer: '#FFFDF6', composerInk: '#2D3A1F',
  },
  {
    id: 'lagoon', name: 'lagoon', scheme: 'light', ambient: 'bubbles',
    bg: 'linear-gradient(180deg, #E2F8F6 0%, #BDEBE9 100%)',
    ink: '#0E3B40', meta: 'rgba(14,59,64,.52)', header: 'rgba(226,248,246,.84)',
    sent: ['#35CDBE', '#17A3A2', '#0E7F8A'], sentInk: '#FFFFFF',
    recv: '#FFFFFF', recvInk: '#0E3B40', accent: '#139A9C', accentInk: '#FFFFFF',
    composer: '#FFFFFF', composerInk: '#0E3B40',
  },
  {
    id: 'lavender', name: 'lavender haze', scheme: 'light', ambient: 'haze',
    bg: 'radial-gradient(70% 50% at 20% 20%, #E7DAFF 0%, transparent 70%), radial-gradient(60% 50% at 90% 80%, #D9E1FF 0%, transparent 70%), #F6F1FF',
    ink: '#2F2450', meta: 'rgba(47,36,80,.5)', header: 'rgba(246,241,255,.84)',
    sent: ['#B09AFF', '#8B7AF5', '#6D6FE6'], sentInk: '#FFFFFF',
    recv: '#FFFFFF', recvInk: '#2F2450', accent: '#7D6BF0', accentInk: '#FFFFFF',
    composer: '#FFFFFF', composerInk: '#2F2450',
  },
  {
    id: 'terminal', name: 'terminal', scheme: 'dark', ambient: 'scanlines', mono: true,
    bg: 'radial-gradient(90% 70% at 50% 40%, #0E1A10 0%, #060A06 100%)',
    ink: '#7CFF9B', meta: 'rgba(124,255,155,.5)', header: 'rgba(6,10,6,.86)',
    sent: ['#123D20', '#0F3319', '#0C2914'], sentInk: '#8DFFAA',
    recv: '#142414', recvInk: '#CFFFDA', accent: '#39FF6A', accentInk: '#052A0F',
    composer: '#0C130C', composerInk: '#9CFFB3',
  },
  {
    id: 'bubblegum', name: 'bubblegum', scheme: 'light', ambient: 'hearts',
    bg: 'radial-gradient(80% 60% at 0% 0%, #FFD0EC 0%, transparent 60%), radial-gradient(80% 60% at 100% 100%, #CBEAFF 0%, transparent 60%), #FFF3FA',
    ink: '#3B1740', meta: 'rgba(59,23,64,.5)', header: 'rgba(255,243,250,.84)',
    sent: ['#FF6FC4', '#D982F2', '#62B9FF'], sentInk: '#FFFFFF',
    recv: '#FFFFFF', recvInk: '#3B1740', accent: '#FF4FB2', accentInk: '#FFFFFF',
    composer: '#FFFFFF', composerInk: '#3B1740',
  },
  {
    id: 'citrus', name: 'lemonade', scheme: 'light', ambient: 'sparkles',
    bg: 'radial-gradient(80% 60% at 100% 0%, #FFF2A0 0%, transparent 60%), radial-gradient(70% 60% at 0% 100%, #E6F7A8 0%, transparent 60%), #FFFBE2',
    ink: '#2E2A05', meta: 'rgba(46,42,5,.5)', header: 'rgba(255,251,226,.86)',
    sent: ['#FFE44D', '#D9F04A', '#9FE05D'], sentInk: '#232205',
    recv: '#FFFFFF', recvInk: '#2E2A05', accent: '#2E2A05', accentInk: '#FFE44D',
    composer: '#FFFFFF', composerInk: '#2E2A05',
  },
  {
    id: 'aurora', name: 'aurora', scheme: 'dark', ambient: 'aurora',
    bg: 'linear-gradient(180deg, #06121A 0%, #050B10 100%)',
    ink: '#E3FFF5', meta: 'rgba(227,255,245,.5)', header: 'rgba(6,18,26,.78)',
    sent: ['#46F2B4', '#22CBC2', '#1E9FCB'], sentInk: '#032018',
    recv: '#13222B', recvInk: '#E3FFF5', accent: '#3DF2B0', accentInk: '#032018',
    composer: '#0F1B22', composerInk: '#E3FFF5',
  },
  {
    id: 'forest', name: 'forest', scheme: 'dark', ambient: 'leaves',
    bg: 'radial-gradient(90% 60% at 50% 0%, #1F4A35 0%, transparent 70%), #0D1D15',
    ink: '#E3F2E7', meta: 'rgba(227,242,231,.5)', header: 'rgba(13,29,21,.82)',
    sent: ['#8BE39A', '#53C77F', '#2FA76D'], sentInk: '#06170D',
    recv: '#18332A', recvInk: '#E3F2E7', accent: '#53C77F', accentInk: '#06170D',
    composer: '#132A20', composerInk: '#E3F2E7',
  },
  {
    id: 'y2k', name: 'y2k chrome', scheme: 'light', ambient: 'sparkles',
    bg: 'linear-gradient(135deg, #EDF1F7 0%, #CBD5E5 22%, #F7F9FC 48%, #C3CDDF 74%, #ECF0F6 100%)',
    ink: '#1B2233', meta: 'rgba(27,34,51,.5)', header: 'rgba(237,241,247,.82)',
    sent: ['#8ED6FF', '#B8A8FF', '#FF9FE0'], sentInk: '#1B2233',
    recv: '#FFFFFF', recvInk: '#1B2233', accent: '#3E6BFF', accentInk: '#FFFFFF',
    composer: '#FFFFFF', composerInk: '#1B2233',
  },
]

THEMES.push(
  {
    id: 'batman', name: 'batman', scheme: 'dark', ambient: 'bats',
    bg: 'radial-gradient(70% 45% at 50% 0%, rgba(255,214,0,.13) 0%, transparent 70%), linear-gradient(180deg, #171A22 0%, #0C0E13 60%, #07080B 100%)',
    ink: '#EEF0F4', meta: 'rgba(238,240,244,.5)', header: 'rgba(10,11,15,.84)',
    sent: ['#FFE24D', '#FFD000', '#F0B400'], sentInk: '#0B0B0E',
    recv: '#1C1F27', recvInk: '#EEF0F4', accent: '#FFD000', accentInk: '#0B0B0E',
    composer: '#171A21', composerInk: '#EEF0F4',
  },
  {
    id: 'love', name: 'love', scheme: 'light', ambient: 'lovebeat',
    bg: 'radial-gradient(90% 55% at 50% 115%, #FFB0C4 0%, transparent 62%), radial-gradient(70% 45% at 0% 0%, #FFD9E3 0%, transparent 60%), radial-gradient(60% 40% at 100% 20%, #FFE3EA 0%, transparent 60%), #FFF2F5',
    ink: '#5B0F25', meta: 'rgba(91,15,37,.5)', header: 'rgba(255,242,245,.84)',
    sent: ['#FF6B91', '#F0285A', '#C70F40'], sentInk: '#FFFFFF',
    recv: '#FFFFFF', recvInk: '#5B0F25', accent: '#F0285A', accentInk: '#FFFFFF',
    composer: '#FFFFFF', composerInk: '#5B0F25',
  },
  {
    id: 'bff', name: 'bff', scheme: 'light', ambient: 'party',
    bg: 'radial-gradient(60% 40% at 0% 0%, #FFE98A 0%, transparent 65%), radial-gradient(60% 45% at 100% 30%, #FFC4EA 0%, transparent 65%), radial-gradient(70% 45% at 30% 100%, #BFE3FF 0%, transparent 65%), #FFF8EC',
    ink: '#2A1A4A', meta: 'rgba(42,26,74,.5)', header: 'rgba(255,248,236,.84)',
    sent: ['#8A6BFF', '#FF5CB8', '#FF9F43'], sentInk: '#FFFFFF',
    recv: '#FFFFFF', recvInk: '#2A1A4A', accent: '#7C5CFF', accentInk: '#FFFFFF',
    composer: '#FFFFFF', composerInk: '#2A1A4A',
  },
  {
    id: 'lust', name: 'lust', scheme: 'dark', ambient: 'embers',
    bg: 'radial-gradient(85% 55% at 50% 105%, rgba(190,0,45,.5) 0%, transparent 70%), radial-gradient(60% 40% at 100% 0%, rgba(130,0,95,.38) 0%, transparent 70%), radial-gradient(50% 35% at 0% 30%, rgba(90,0,40,.35) 0%, transparent 70%), #0E0508',
    ink: '#FFE4EB', meta: 'rgba(255,228,235,.5)', header: 'rgba(14,5,8,.84)',
    sent: ['#FF3D63', '#C4002F', '#7E0031'], sentInk: '#FFFFFF',
    recv: '#23101A', recvInk: '#FFE4EB', accent: '#FF2D55', accentInk: '#FFFFFF',
    composer: '#1B0A12', composerInk: '#FFE4EB',
  },
)

export const THEME_IDS = THEMES.map((t) => t.id)
const byId = new Map(THEMES.map((t) => [t.id, t]))

export function getTheme(id: string | null | undefined): ThemeDef {
  return (id && byId.get(id)) || THEMES[0]
}

export function themeVars(t: ThemeDef): CSSProperties {
  return {
    '--theme-bg': t.bg,
    '--theme-ink': t.ink,
    '--theme-meta': t.meta,
    '--theme-header': t.header,
    '--theme-sent-1': t.sent[0],
    '--theme-sent-2': t.sent[1],
    '--theme-sent-3': t.sent[2],
    '--theme-sent-ink': t.sentInk,
    '--theme-recv': t.recv,
    '--theme-recv-ink': t.recvInk,
    '--theme-accent': t.accent,
    '--theme-accent-ink': t.accentInk,
    '--theme-composer': t.composer,
    '--theme-composer-ink': t.composerInk,
    '--theme-font': t.mono ? 'var(--font-mono)' : 'var(--font-text)',
    colorScheme: t.scheme,
  } as CSSProperties
}
