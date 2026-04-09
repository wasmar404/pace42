import { useEffect, useMemo } from 'react'
import { MapContainer, Polyline, TileLayer, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

const TILESETS = {
  clean: {
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    subdomains: 'abcd',
    route: '#fc4c02',
  },
  ink: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    subdomains: 'abcd',
    route: '#ff6b2c',
  },
  osm: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    subdomains: 'abc',
    route: '#fc4c02',
  },
}

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

export default function RouteMap({ polyline, height = 220, variant = 'clean' }) {
  const points = useMemo(() => {
    if (!polyline) return []
    try {
      return decodePolyline(polyline)
    } catch {
      return []
    }
  }, [polyline])

  const center = points[0] || [33.8938, 35.5018]

  const tile = TILESETS[variant] || TILESETS.clean

  return (
    <div
      style={{
        height,
        borderRadius: 18,
        overflow: 'hidden',
        border: '1px solid rgba(11, 18, 32, 0.14)',
        background: 'rgba(255,255,255,0.55)',
        position: 'relative',
        zIndex: 0,
        isolation: 'isolate',
      }}
    >
      <MapContainer
        center={center}
        zoom={13}
        scrollWheelZoom={false}
        dragging={false}
        doubleClickZoom={false}
        touchZoom={false}
        zoomControl={false}
        keyboard={false}
        style={{ height: '100%', width: '100%', position: 'relative', zIndex: 0 }}
        attributionControl={false}
      >
        <TileLayer url={tile.url} subdomains={tile.subdomains} />
        {points.length ? (
          <>
            <Polyline
              positions={points}
              pathOptions={{ color: 'rgba(11, 18, 32, 0.70)', weight: 7, opacity: 0.28, lineCap: 'round', lineJoin: 'round' }}
            />
            <Polyline
              positions={points}
              pathOptions={{ color: tile.route, weight: 4, opacity: 0.96, lineCap: 'round', lineJoin: 'round' }}
            />
            <FitBounds points={points} />
          </>
        ) : null}
      </MapContainer>
    </div>
  )
}
