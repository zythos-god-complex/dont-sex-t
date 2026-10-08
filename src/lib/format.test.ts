import { describe, expect, it } from 'vitest'
import {
  activeAgo,
  clockTime,
  daySeparator,
  emojiOnlyCount,
  hereFor,
  linkify,
  messagePreview,
  needsSeparator,
  relTime,
  sameGroup,
} from './format'

// Local-time fixtures so the tests are timezone independent.
const at = (y: number, mo: number, d: number, h = 0, mi = 0, s = 0) => new Date(y, mo - 1, d, h, mi, s).getTime()
const NOW = at(2026, 10, 8, 21, 41) // thu 8 oct 2026, 9:41 pm

describe('relTime', () => {
  it('formats short durations', () => {
    expect(relTime(NOW - 10_000, NOW)).toBe('now')
    expect(relTime(NOW - 5 * 60_000, NOW)).toBe('5m')
    expect(relTime(NOW - 2 * 3_600_000, NOW)).toBe('2h')
  })
  it('uses weekdays within a week, then dates', () => {
    expect(relTime(at(2026, 10, 6, 12), NOW)).toBe('tue')
    expect(relTime(at(2026, 3, 12, 12), NOW)).toBe('12 mar')
    expect(relTime(at(2025, 3, 12, 12), NOW)).toBe('12 mar 2025')
  })
  it('accepts ISO strings and handles junk', () => {
    expect(relTime(new Date(NOW - 60_000).toISOString(), NOW)).toBe('1m')
    expect(relTime(null, NOW)).toBe('')
    expect(relTime('nope', NOW)).toBe('')
  })
})

describe('activeAgo / hereFor', () => {
  it('reads naturally', () => {
    expect(activeAgo(NOW - 5 * 60_000, NOW)).toBe('active 5m ago')
    expect(activeAgo(NOW - 5_000, NOW)).toBe('active 1m ago')
    expect(activeAgo(NOW - 3 * 86_400_000, NOW)).toBe('active 3d ago')
    expect(activeAgo(null, NOW)).toBe('')
    expect(hereFor(NOW - 4 * 60_000, NOW)).toBe('here 4m')
    expect(hereFor(NOW - 1_000, NOW)).toBe('here now')
  })
})

describe('daySeparator / clockTime', () => {
  it('formats separators', () => {
    expect(clockTime(at(2026, 10, 8, 21, 41))).toBe('9:41 pm')
    expect(clockTime(at(2026, 10, 8, 0, 5))).toBe('12:05 am')
    expect(daySeparator(at(2026, 10, 8, 9, 3), NOW)).toBe('today 9:03 am')
    expect(daySeparator(at(2026, 10, 7, 21, 41), NOW)).toBe('yesterday 9:41 pm')
    expect(daySeparator(at(2026, 10, 6, 21, 41), NOW)).toBe('tue 9:41 pm')
    expect(daySeparator(at(2026, 3, 12, 21, 41), NOW)).toBe('12 mar 9:41 pm')
  })
  it('never contains em or en dashes', () => {
    const all = [relTime(at(2026, 3, 12), NOW), daySeparator(at(2025, 1, 1), NOW), activeAgo(0, NOW)].join(' ')
    expect(all).not.toMatch(/[–—]/)
  })
})

describe('grouping', () => {
  const m = (sender: string, t: number, kind: 'text' | 'theme' = 'text') => ({ sender_id: sender, created_at: new Date(t).toISOString(), kind })
  it('groups same sender within 3 minutes', () => {
    expect(sameGroup(m('a', NOW), m('a', NOW + 60_000))).toBe(true)
    expect(sameGroup(m('a', NOW), m('a', NOW + 4 * 60_000))).toBe(false)
    expect(sameGroup(m('a', NOW), m('b', NOW + 1))).toBe(false)
    expect(sameGroup(m('a', NOW, 'theme'), m('a', NOW + 1))).toBe(false)
  })
  it('separators after 30 minutes', () => {
    expect(needsSeparator(null, m('a', NOW))).toBe(true)
    expect(needsSeparator(m('a', NOW), m('a', NOW + 31 * 60_000))).toBe(true)
    expect(needsSeparator(m('a', NOW), m('a', NOW + 29 * 60_000))).toBe(false)
  })
})

describe('messagePreview', () => {
  it('prefixes mine and handles theme events', () => {
    expect(messagePreview({ sender_id: 'me', kind: 'text', body: 'lol  ok\n' }, 'me')).toBe('you: lol ok')
    expect(messagePreview({ sender_id: 'p', kind: 'text', body: 'hey' }, 'me')).toBe('hey')
    expect(messagePreview({ sender_id: 'p', kind: 'theme', body: 'cherry' }, 'me')).toBe('changed the theme')
    expect(messagePreview(null, 'me')).toBe('')
  })
})

describe('emojiOnlyCount', () => {
  it('detects 1 to 3 emoji', () => {
    expect(emojiOnlyCount('👋')).toBe(1)
    expect(emojiOnlyCount('😂😂😂')).toBe(3)
    expect(emojiOnlyCount('👍🏽 ❤️')).toBe(2)
    expect(emojiOnlyCount('👨‍👩‍👧')).toBe(1)
    expect(emojiOnlyCount('🇰🇷')).toBe(1)
  })
  it('rejects text and more than 3', () => {
    expect(emojiOnlyCount('hi 👋')).toBe(0)
    expect(emojiOnlyCount('😂😂😂😂')).toBe(0)
    expect(emojiOnlyCount('123')).toBe(0)
    expect(emojiOnlyCount('')).toBe(0)
  })
})

describe('linkify', () => {
  it('splits links', () => {
    const parts = linkify('see https://x.com/a, and www.y.io!')
    expect(parts.filter((p) => p.href).map((p) => p.href)).toEqual(['https://x.com/a', 'https://www.y.io'])
    expect(parts.map((p) => p.text).join('')).toBe('see https://x.com/a, and www.y.io!')
  })
})
