export type Conflict =
  | { type: 'vehicle_time_overlap'; vehicleName: string; otherSeq: number }
  | { type: 'vehicle_overload'; vehicleName: string; weightPct: number; volumePct: number }

type Input = {
  id: string
  sequenceNumber: number
  vehicleId: string | null
  vehicleName: string | null
  deliveryTime: string | null
  weightKg: number
  volumeM3: number
}

type VehicleCapacity = {
  vehicleId: string
  payloadKg: number
  volumeM3: number
}

type Interval = { fromMin: number; toMin: number }

const TIME_RANGE = /^(\d{2}):(\d{2})\s*[–-]\s*(\d{2}):(\d{2})$/
const TIME_SINGLE = /^(\d{2}):(\d{2})$/

function parseTime(value: string | null): Interval | null {
  if (!value) return null
  const trimmed = value.trim()
  const range = trimmed.match(TIME_RANGE)
  if (range) {
    const fromMin = Number(range[1]) * 60 + Number(range[2])
    const toMin = Number(range[3]) * 60 + Number(range[4])
    if (Number.isFinite(fromMin) && Number.isFinite(toMin) && toMin >= fromMin) {
      return { fromMin, toMin }
    }
    return null
  }
  const single = trimmed.match(TIME_SINGLE)
  if (single) {
    const fromMin = Number(single[1]) * 60 + Number(single[2])
    if (Number.isFinite(fromMin)) {
      // Single time = 60-minute window
      return { fromMin, toMin: fromMin + 60 }
    }
  }
  return null
}

function intervalsOverlap(a: Interval, b: Interval): boolean {
  return a.fromMin < b.toMin && b.fromMin < a.toMin
}

export function detectConflicts(
  deliveries: Input[],
  vehicleCapacities: VehicleCapacity[],
): Map<string, Conflict[]> {
  const result = new Map<string, Conflict[]>()
  const push = (id: string, c: Conflict) => {
    const arr = result.get(id) ?? []
    arr.push(c)
    result.set(id, arr)
  }

  // Group by vehicle
  const byVehicle = new Map<string, (Input & { interval: Interval | null })[]>()
  for (const d of deliveries) {
    if (!d.vehicleId) continue
    const arr = byVehicle.get(d.vehicleId) ?? []
    arr.push({ ...d, interval: parseTime(d.deliveryTime) })
    byVehicle.set(d.vehicleId, arr)
  }

  // Time overlaps within a vehicle
  for (const [, arr] of byVehicle) {
    for (let i = 0; i < arr.length; i++) {
      const a = arr[i]
      if (!a.interval) continue
      for (let j = i + 1; j < arr.length; j++) {
        const b = arr[j]
        if (!b.interval) continue
        if (intervalsOverlap(a.interval, b.interval)) {
          push(a.id, {
            type: 'vehicle_time_overlap',
            vehicleName: a.vehicleName ?? '?',
            otherSeq: b.sequenceNumber,
          })
          push(b.id, {
            type: 'vehicle_time_overlap',
            vehicleName: b.vehicleName ?? '?',
            otherSeq: a.sequenceNumber,
          })
        }
      }
    }
  }

  // Capacity overload — if a vehicle exceeds payload or volume on the day,
  // mark every delivery on that vehicle.
  const capacityById = new Map(vehicleCapacities.map((v) => [v.vehicleId, v]))
  for (const [vehicleId, arr] of byVehicle) {
    const cap = capacityById.get(vehicleId)
    if (!cap) continue
    let totalWeight = 0
    let totalVolume = 0
    for (const d of arr) {
      totalWeight += d.weightKg
      totalVolume += d.volumeM3
    }
    const weightPct = cap.payloadKg > 0 ? totalWeight / cap.payloadKg : 0
    const volumePct = cap.volumeM3 > 0 ? totalVolume / cap.volumeM3 : 0
    if (weightPct > 1 || volumePct > 1) {
      const conflict: Conflict = {
        type: 'vehicle_overload',
        vehicleName: arr[0].vehicleName ?? '?',
        weightPct: Math.round(weightPct * 100),
        volumePct: Math.round(volumePct * 100),
      }
      for (const d of arr) push(d.id, conflict)
    }
  }

  return result
}
