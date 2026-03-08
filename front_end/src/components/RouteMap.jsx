import { useEffect, useMemo } from 'react'
import { MapContainer, Polyline, TileLayer, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

function decodePolyline(encoded) {
  let index = 0
  const len = encoded.length
  let lat = 0
  let lng = 0
  const coordinates = []

  while (index < len) {
    let b
    let shift = 0
    let result = 0
    do {
      b = encoded.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    const dlat = (result & 1) ? ~(result >> 1) : result >> 1
    lat += dlat

    shift = 0
    result = 0
    do {
      b = encoded.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    const dlng = (result & 1) ? ~(result >> 1) : result >> 1
    lng += dlng

    coordinates.push([lat / 1e5, lng / 1e5])
  }

  return coordinates
}

function FitBounds({ points }) {
  const map = useMap()

  useEffect(() => {
    if (!points?.length) return
    if (points.length === 1) {
      map.setView(points[0], 14)
      return
    }
    map.fitBounds(points, { padding: [18, 18] })
  }, [map, points])

  return null
}

export default function RouteMap({ polyline, height = 220 }) {
  const points = useMemo(() => {
    if (!polyline) return []
    try {
      return decodePolyline(polyline)
    } catch {
      return []
    }
  }, [polyline])

  const center = points[0] || [33.8938, 35.5018]

  return (
    <div style={{ height, borderRadius: 18, overflow: 'hidden', border: '1px solid rgba(11, 18, 32, 0.14)' }}>
      <MapContainer
        center={center}
        zoom={13}
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%' }}
        attributionControl={false}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {points.length ? (
          <>
            <Polyline positions={points} pathOptions={{ color: '#fc4c02', weight: 4, opacity: 0.95 }} />
            <FitBounds points={points} />
          </>
        ) : null}
      </MapContainer>
    </div>
  )
}
