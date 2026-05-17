import { describe, it, expect } from 'vitest'
import { detectConflicts } from './conflicts'

const VEHICLE_KOMBI = {
  vehicleId: 'kombi-1',
  payloadKg: 1000,
  volumeM3: 8,
}
const VEHICLE_KAMION = {
  vehicleId: 'kamion-1',
  payloadKg: 3500,
  volumeM3: 20,
}

function delivery(
  id: string,
  seq: number,
  vehicleId: string | null,
  time: string | null,
  weight = 0,
  volume = 0,
) {
  return {
    id,
    sequenceNumber: seq,
    vehicleId,
    vehicleName: vehicleId ? 'Kombi 1' : null,
    deliveryTime: time,
    weightKg: weight,
    volumeM3: volume,
  }
}

describe('detectConflicts — vehicle time overlap', () => {
  it('does not flag deliveries on different vehicles even with same time', () => {
    const conflicts = detectConflicts(
      [
        delivery('a', 1, 'kombi-1', '08:00–10:00'),
        delivery('b', 2, 'kamion-1', '08:00–10:00'),
      ],
      [VEHICLE_KOMBI, VEHICLE_KAMION],
    )
    expect(conflicts.size).toBe(0)
  })

  it('does not flag back-to-back deliveries (no overlap)', () => {
    const conflicts = detectConflicts(
      [
        delivery('a', 1, 'kombi-1', '08:00–10:00'),
        delivery('b', 2, 'kombi-1', '10:00–12:00'),
      ],
      [VEHICLE_KOMBI],
    )
    expect(conflicts.size).toBe(0)
  })

  it('flags both deliveries when time windows overlap', () => {
    const conflicts = detectConflicts(
      [
        delivery('a', 1, 'kombi-1', '08:00–10:00'),
        delivery('b', 2, 'kombi-1', '09:00–11:00'),
      ],
      [VEHICLE_KOMBI],
    )
    const aConflicts = conflicts.get('a') ?? []
    const bConflicts = conflicts.get('b') ?? []
    expect(aConflicts.some((c) => c.type === 'vehicle_time_overlap')).toBe(true)
    expect(bConflicts.some((c) => c.type === 'vehicle_time_overlap')).toBe(true)
  })

  it('treats single-time entries as 60-minute windows', () => {
    const conflicts = detectConflicts(
      [
        delivery('a', 1, 'kombi-1', '09:00'),
        delivery('b', 2, 'kombi-1', '09:30'),
      ],
      [VEHICLE_KOMBI],
    )
    expect((conflicts.get('a') ?? []).length).toBeGreaterThan(0)
  })

  it('skips overlap detection when one delivery has no time', () => {
    const conflicts = detectConflicts(
      [
        delivery('a', 1, 'kombi-1', '08:00–10:00'),
        delivery('b', 2, 'kombi-1', null),
      ],
      [VEHICLE_KOMBI],
    )
    const aTimeOverlap = (conflicts.get('a') ?? []).some(
      (c) => c.type === 'vehicle_time_overlap',
    )
    expect(aTimeOverlap).toBe(false)
  })
})

describe('detectConflicts — capacity overload', () => {
  it('does not flag a vehicle within capacity', () => {
    const conflicts = detectConflicts(
      [
        delivery('a', 1, 'kombi-1', '08:00–10:00', 500, 4),
        delivery('b', 2, 'kombi-1', '10:00–12:00', 300, 2),
      ],
      [VEHICLE_KOMBI],
    )
    const all = [...conflicts.values()].flat()
    expect(all.some((c) => c.type === 'vehicle_overload')).toBe(false)
  })

  it('flags every delivery on a vehicle when total weight exceeds payload', () => {
    const conflicts = detectConflicts(
      [
        delivery('a', 1, 'kombi-1', null, 700, 1),
        delivery('b', 2, 'kombi-1', null, 700, 1),
      ],
      [VEHICLE_KOMBI],
    )
    const aOverload = (conflicts.get('a') ?? []).find((c) => c.type === 'vehicle_overload')
    const bOverload = (conflicts.get('b') ?? []).find((c) => c.type === 'vehicle_overload')
    expect(aOverload).toBeDefined()
    expect(bOverload).toBeDefined()
    if (aOverload && aOverload.type === 'vehicle_overload') {
      expect(aOverload.weightPct).toBe(140) // 1400 / 1000
    }
  })

  it('flags overload when volume exceeds capacity even if weight is fine', () => {
    const conflicts = detectConflicts(
      [delivery('a', 1, 'kombi-1', null, 100, 9)], // 9m³ > 8m³
      [VEHICLE_KOMBI],
    )
    const overload = (conflicts.get('a') ?? []).find((c) => c.type === 'vehicle_overload')
    expect(overload).toBeDefined()
  })

  it('does not flag deliveries without a vehicle assigned', () => {
    const conflicts = detectConflicts(
      [delivery('a', 1, null, '08:00–10:00', 99999, 99999)],
      [VEHICLE_KOMBI],
    )
    expect(conflicts.size).toBe(0)
  })
})
