import { describe, it, expect } from 'vitest'
import { asString, asNumber, asBool, asInt } from './csv-coerce'

describe('asString', () => {
  it('trims whitespace', () => {
    expect(asString('  hi  ')).toBe('hi')
  })
  it('returns empty string for null/undefined', () => {
    expect(asString(null)).toBe('')
    expect(asString(undefined)).toBe('')
  })
})

describe('asNumber', () => {
  it('returns null for empty input', () => {
    expect(asNumber('')).toBeNull()
    expect(asNumber('  ')).toBeNull()
  })
  it('parses integers and decimals', () => {
    expect(asNumber('42')).toBe(42)
    expect(asNumber('3.14')).toBe(3.14)
  })
  it('accepts comma decimals (European format)', () => {
    expect(asNumber('1,5')).toBe(1.5)
  })
  it('returns NaN for non-numeric strings', () => {
    expect(Number.isNaN(asNumber('abc'))).toBe(true)
  })
})

describe('asBool', () => {
  it('recognizes truthy values', () => {
    for (const v of ['1', 'true', 'TRUE', 'da', 'DA', 'yes', 'y', 'x']) {
      expect(asBool(v)).toBe(true)
    }
  })
  it('returns false for everything else', () => {
    for (const v of ['', '0', 'false', 'ne', 'no', 'maybe', null, undefined]) {
      expect(asBool(v)).toBe(false)
    }
  })
})

describe('asInt', () => {
  it('returns fallback for empty input', () => {
    expect(asInt('', 1)).toBe(1)
  })
  it('truncates decimals', () => {
    expect(asInt('2.7', 0)).toBe(2)
  })
  it('returns NaN for non-numeric', () => {
    expect(Number.isNaN(asInt('abc', 0))).toBe(true)
  })
})
