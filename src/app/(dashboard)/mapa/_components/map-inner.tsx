'use client'

import { useEffect } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import type { DeliveryStatus } from '@/lib/schemas/delivery'
import type { MapDelivery } from './mapa-client'

type Props = {
  center: [number, number]
  deliveries: MapDelivery[]
  selectedId: string | null
  onSelect: (id: string) => void
  statusColors: Record<DeliveryStatus, string>
  statusLabels: Record<DeliveryStatus, string>
}

export function MapInner({
  center,
  deliveries,
  selectedId,
  onSelect,
  statusColors,
  statusLabels,
}: Props) {
  return (
    <MapContainer
      center={center}
      zoom={12}
      className="h-full w-full"
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds deliveries={deliveries} />
      {deliveries.map((d) => (
        <CircleMarker
          key={d.id}
          center={[d.latitude!, d.longitude!]}
          radius={selectedId === d.id ? 11 : 8}
          pathOptions={{
            color: statusColors[d.status],
            fillColor: statusColors[d.status],
            fillOpacity: selectedId === d.id ? 0.95 : 0.75,
            weight: selectedId === d.id ? 3 : 2,
          }}
          eventHandlers={{
            click: () => onSelect(d.id),
          }}
        >
          <Popup>
            <div className="space-y-1 text-sm">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-xs text-slate-500">#{d.sequenceNumber}</span>
                <span className="font-semibold">{d.customerName}</span>
              </div>
              <div className="text-xs text-slate-600">{d.branchLabel}</div>
              {d.customerAddress ? (
                <div className="text-xs text-slate-700">{d.customerAddress}</div>
              ) : null}
              {d.deliveryTime ? (
                <div className="text-xs text-slate-700">Termin: {d.deliveryTime}</div>
              ) : null}
              {d.vehicleName ? (
                <div className="text-xs text-slate-700">Vozilo: {d.vehicleName}</div>
              ) : null}
              <div className="text-xs text-slate-700">Artikli: {d.itemsCount}</div>
              <div className="text-xs">
                <span
                  className="inline-block rounded px-1.5 py-0.5 text-white"
                  style={{ backgroundColor: statusColors[d.status] }}
                >
                  {statusLabels[d.status]}
                </span>
              </div>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  )
}

function FitBounds({ deliveries }: { deliveries: MapDelivery[] }) {
  const map = useMap()
  useEffect(() => {
    if (deliveries.length === 0) return
    const points = deliveries.map(
      (d) => [d.latitude!, d.longitude!] as [number, number],
    )
    if (points.length === 1) {
      map.setView(points[0], 14)
      return
    }
    const lats = points.map((p) => p[0])
    const lngs = points.map((p) => p[1])
    const bounds: [[number, number], [number, number]] = [
      [Math.min(...lats), Math.min(...lngs)],
      [Math.max(...lats), Math.max(...lngs)],
    ]
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 })
  }, [deliveries, map])
  return null
}
