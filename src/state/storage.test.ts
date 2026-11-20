import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FocusOnItState } from '../types'
import { defaultState, isEmpty, normalize, rollOver } from './storage'

// Local noon avoids any timezone edge around midnight.
const DAY_1 = new Date(2026, 10, 19, 12, 0, 0) // 2026-11-19
const DAY_2 = new Date(2026, 10, 20, 12, 0, 0) // 2026-11-20

function state(overrides: Partial<FocusOnItState> = {}): FocusOnItState {
  return {
    horizon: { text: 'ship v1', updatedAt: '2026-11-01T10:00:00.000Z' },
    now: { text: 'write tests', date: '2026-11-19' },
    plan: { text: 'open the PR', date: '2026-11-19' },
    history: [],
    ...overrides,
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(DAY_1)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('normalize', () => {
  it.each([
    ['undefined', undefined],
    ['null', null],
    ['empty string', ''],
    ['number', 42],
    ['boolean', true],
    ['string', 'not json'],
  ])('returns the default state for %s', (_label, raw) => {
    expect(normalize(raw)).toEqual(defaultState())
  })

  it('returns the default state for an empty object', () => {
    expect(normalize({})).toEqual(defaultState())
  })

  it('keeps a valid state unchanged', () => {
    const s = state({ history: [{ text: 'old focus', date: '2026-11-18' }] })
    expect(normalize(structuredClone(s))).toEqual(s)
  })

  it('replaces fields of the wrong type with defaults', () => {
    const result = normalize({
      horizon: { text: 123, updatedAt: null },
      now: { text: ['x'], date: 20261119 },
      plan: 'not an object',
      history: 'not an array',
    })
    expect(result).toEqual(defaultState())
  })

  it('keeps valid fields while fixing broken siblings', () => {
    const result = normalize({
      horizon: { text: 'keep me', updatedAt: 7 },
      now: { text: 'today', date: '2026-11-19' },
    })
    expect(result.horizon.text).toBe('keep me')
    expect(result.horizon.updatedAt).toBe(defaultState().horizon.updatedAt)
    expect(result.now).toEqual({ text: 'today', date: '2026-11-19' })
    expect(result.plan).toEqual({ text: '', date: '2026-11-19' })
  })

  it('drops malformed history entries and keeps valid ones in order', () => {
    const result = normalize({
      history: [
        { text: 'a', date: '2026-11-18' },
        null,
        'string entry',
        { text: 'missing date' },
        { date: '2026-11-10' },
        { text: 5, date: '2026-11-09' },
        { text: 'b', date: '2026-11-17' },
      ],
    })
    expect(result.history).toEqual([
      { text: 'a', date: '2026-11-18' },
      { text: 'b', date: '2026-11-17' },
    ])
  })

  it('drops unknown fields from old or foreign schemas', () => {
    const result = normalize({ ...state(), version: 0, focus: 'legacy', extra: { a: 1 } })
    expect(Object.keys(result).sort()).toEqual(['history', 'horizon', 'now', 'plan'])
  })
})

describe('rollOver', () => {
  it('returns the same object when "now" is already today', () => {
    const s = state()
    expect(rollOver(s)).toBe(s)
  })

  it('moves a past day\'s "now" into history and resets "now" for today', () => {
    const s = state({ history: [{ text: 'older', date: '2026-11-18' }] })
    vi.setSystemTime(DAY_2)

    const result = rollOver(s)

    expect(result.now).toEqual({ text: '', date: '2026-11-20' })
    expect(result.history).toEqual([
      { text: 'write tests', date: '2026-11-19' },
      { text: 'older', date: '2026-11-18' },
    ])
  })

  it('leaves horizon and plan untouched', () => {
    const s = state()
    vi.setSystemTime(DAY_2)

    const result = rollOver(s)

    expect(result.horizon).toEqual(s.horizon)
    expect(result.plan).toEqual(s.plan)
  })

  it('does not mutate the input state', () => {
    const s = state()
    const snapshot = structuredClone(s)
    vi.setSystemTime(DAY_2)

    rollOver(s)

    expect(s).toEqual(snapshot)
  })

  it('does not add an empty or whitespace-only "now" to history', () => {
    vi.setSystemTime(DAY_2)
    for (const text of ['', '   ', '\n\t']) {
      const result = rollOver(state({ now: { text, date: '2026-11-19' } }))
      expect(result.history).toEqual([])
      expect(result.now).toEqual({ text: '', date: '2026-11-20' })
    }
  })

  it('does not duplicate a day that is already in history', () => {
    const s = state({ history: [{ text: 'already saved', date: '2026-11-19' }] })
    vi.setSystemTime(DAY_2)

    const result = rollOver(s)

    expect(result.history).toEqual([{ text: 'already saved', date: '2026-11-19' }])
  })

  it('is a no-op when called again on the same day', () => {
    vi.setSystemTime(DAY_2)
    const once = rollOver(state())
    const twice = rollOver(once)

    expect(twice).toBe(once)
    expect(twice.history).toHaveLength(1)
  })

  it('handles a gap of several days as a single rollover', () => {
    vi.setSystemTime(new Date(2026, 10, 25, 12, 0, 0))

    const result = rollOver(state())

    expect(result.now.date).toBe('2026-11-25')
    expect(result.history).toEqual([{ text: 'write tests', date: '2026-11-19' }])
  })

  it('rolls over right after local midnight', () => {
    const s = state()
    vi.setSystemTime(new Date(2026, 10, 19, 23, 59, 59))
    expect(rollOver(s)).toBe(s)

    vi.setSystemTime(new Date(2026, 10, 20, 0, 0, 0))
    expect(rollOver(s).now.date).toBe('2026-11-20')
  })
})

describe('isEmpty', () => {
  it('is true for the default state', () => {
    expect(isEmpty(defaultState())).toBe(true)
  })

  it.each([
    ['horizon', { horizon: { text: 'x', updatedAt: '' } }],
    ['now', { now: { text: 'x', date: '2026-11-19' } }],
    ['plan', { plan: { text: 'x', date: '2026-11-19' } }],
    ['history', { history: [{ text: 'x', date: '2026-11-18' }] }],
  ])('is false when %s has content', (_field, patch) => {
    expect(isEmpty({ ...defaultState(), ...patch })).toBe(false)
  })

  it('treats whitespace as content (never discards typed text)', () => {
    expect(isEmpty({ ...defaultState(), now: { text: ' ', date: '2026-11-19' } })).toBe(false)
  })
})
