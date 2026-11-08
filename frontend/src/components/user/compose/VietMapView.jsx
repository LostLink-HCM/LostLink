import vietmapgl from '@vietmap/vietmap-gl-js/dist/vietmap-gl.js'
import '@vietmap/vietmap-gl-js/dist/vietmap-gl.css'
import './VietMapView.css'
import { useEffect, useRef, useState } from 'react'
import Icon from '../../common/Icon'
import { cx, focusRing } from '../classes'

const STREET_STYLE = import.meta.env.VITE_VIETMAP_STYLE_URL
const TILE_KEY = (() => {
  try {
    return new URL(STREET_STYLE).searchParams.get('apikey')
  } catch {
    return null
  }
})()
const SATELLITE_STYLE =
  TILE_KEY && `https://maps.vietmap.vn/maps/styles/hm/style.json?apikey=${TILE_KEY}`
const MAX_BOUNDS = [
  [106.2, 10.25],
  [107.2, 11.3],
]
const CENTER = [106.698, 10.7725]
const FOCUS_ZOOM = 16
const PRIMARY = '#2563eb'
const DANGER = '#dc2626'
const EMPTY = { type: 'FeatureCollection', features: [] }

// Lăn chuột, vuốt một ngón để cuộn trang; Ctrl + lăn chuột hoặc hai ngón mới thao tác bản đồ
const LOCALE = {
  'CooperativeGesturesHandler.WindowsHelpText': 'Giữ Ctrl và lăn chuột để phóng to bản đồ',
  'CooperativeGesturesHandler.MacHelpText': 'Giữ ⌘ và lăn chuột để phóng to bản đồ',
  'CooperativeGesturesHandler.MobileHelpText': 'Dùng hai ngón tay để di chuyển bản đồ',
}

const toLngLat = ({ lat, lng }) => [lng, lat]
const fromLngLat = ({ lat, lng }) => ({ lat, lng })

// Phải thêm lại mỗi lần đổi style
function addOverlayLayers(map) {
  map.addSource('road', { type: 'geojson', data: EMPTY })
  map.addLayer({
    id: 'road-line',
    type: 'line',
    source: 'road',
    layout: { 'line-cap': 'round' },
    paint: { 'line-color': ['get', 'color'], 'line-width': 6, 'line-opacity': 0.85 },
  })
}

// Đầu mút đoạn đường: chấm tròn kéo được
function endpointElement() {
  const element = document.createElement('div')
  element.className = 'size-4 cursor-grab rounded-full border-[3px] bg-white shadow-md'
  return element
}

// mode 'point': một ghim kéo được; 'road': hai đầu đoạn đường kéo được.
// onMapClick nhận { lat, lng } khi bấm bản đồ hoặc nút đặt điểm ở giữa bản đồ
export default function VietMapView({
  mode,
  point,
  pointOutside,
  road = [],
  roadOutside,
  satellite,
  onMapClick,
  onPointDrag,
  onRoadDrag,
}) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const pointMarkerRef = useRef(null)
  const endpointRefs = useRef([])
  const appliedStyleRef = useRef(null)
  // Tăng mỗi lần style tải xong để vẽ lại lớp đoạn đường
  const [styleVersion, setStyleVersion] = useState(0)
  const [failed, setFailed] = useState(!STREET_STYLE)

  // Map gắn sự kiện một lần, đọc hàm xử lý mới nhất qua ref
  const handlersRef = useRef({ onMapClick, onPointDrag, onRoadDrag })
  useEffect(() => {
    handlersRef.current = { onMapClick, onPointDrag, onRoadDrag }
  })

  const roadDone = mode === 'road' && road.length === 2
  const pickable = !roadDone

  useEffect(() => {
    if (!STREET_STYLE) return undefined
    const map = new vietmapgl.Map({
      container: containerRef.current,
      style: STREET_STYLE,
      center: CENTER,
      zoom: 12,
      minZoom: 9,
      maxBounds: MAX_BOUNDS,
      attributionControl: { compact: true },
      cooperativeGestures: true,
      locale: LOCALE,
      dragRotate: false,
      pitchWithRotate: false,
    })
    appliedStyleRef.current = STREET_STYLE
    map.touchZoomRotate.disableRotation()
    map.addControl(new vietmapgl.NavigationControl({ showCompass: false }), 'bottom-right')
    mapRef.current = map

    let loaded = false
    map.on('load', () => {
      loaded = true
    })
    map.on('style.load', () => {
      addOverlayLayers(map)
      setStyleVersion((version) => version + 1)
    })
    // Lỗi trước khi tải xong style thì báo không có bản đồ; ô bị huỷ tải khi kéo là bình thường
    map.on('error', (event) => {
      if (event.error?.name === 'AbortError') return
      console.error('VietMap:', event.error?.message ?? event.error)
      if (!loaded) setFailed(true)
    })
    map.on('click', (e) => handlersRef.current.onMapClick?.(fromLngLat(e.lngLat)))

    return () => {
      pointMarkerRef.current = null
      endpointRefs.current = []
      mapRef.current = null
      map.remove()
    }
  }, [])

  // Chỉ đổi khi khác style đang dùng (StrictMode chạy effect hai lần);
  // diff: false để style.load chạy lại và thêm lại lớp vẽ
  useEffect(() => {
    const map = mapRef.current
    const url = satellite && SATELLITE_STYLE ? SATELLITE_STYLE : STREET_STYLE
    if (!map || appliedStyleRef.current === url) return
    appliedStyleRef.current = url
    map.setStyle(url, { diff: false })
  }, [satellite])

  useEffect(() => {
    const map = mapRef.current
    if (map) map.getCanvas().style.cursor = pickable ? 'crosshair' : ''
  }, [pickable, styleVersion])

  // Ghim: luôn kéo được. Ngoài TP.HCM thì tô đỏ
  useEffect(() => {
    const map = mapRef.current
    if (!map || !styleVersion) return
    const showPoint = mode === 'point' && point

    const color = pointOutside ? DANGER : PRIMARY
    if (pointMarkerRef.current && (!showPoint || pointMarkerRef.current.color !== color)) {
      pointMarkerRef.current.marker.remove()
      pointMarkerRef.current = null
    }
    if (!showPoint) return

    if (!pointMarkerRef.current) {
      const marker = new vietmapgl.Marker({ color, draggable: true })
      marker.on('dragend', () => handlersRef.current.onPointDrag?.(fromLngLat(marker.getLngLat())))
      pointMarkerRef.current = { marker, color }
    }
    pointMarkerRef.current.marker.setLngLat(toLngLat(point)).addTo(map)

    // Điểm nằm ngoài khung đang xem thì bay tới
    if (map.getZoom() < 13 || !map.getBounds().contains(toLngLat(point))) {
      map.flyTo({ center: toLngLat(point), zoom: FOCUS_ZOOM })
    }
  }, [point, pointOutside, mode, styleVersion])

  // Đoạn đường: đường nối và hai đầu kéo được
  useEffect(() => {
    const map = mapRef.current
    if (!map?.getSource('road')) return
    const points = mode === 'road' ? road : []
    const color = roadOutside ? DANGER : PRIMARY

    map.getSource('road').setData(
      points.length === 2
        ? {
            type: 'Feature',
            properties: { color },
            geometry: { type: 'LineString', coordinates: points.map(toLngLat) },
          }
        : EMPTY
    )

    endpointRefs.current.slice(points.length).forEach((marker) => marker.remove())
    endpointRefs.current = endpointRefs.current.slice(0, points.length)
    points.forEach((item, index) => {
      let marker = endpointRefs.current[index]
      if (!marker) {
        marker = new vietmapgl.Marker({ element: endpointElement(), draggable: true })
        marker.on('dragend', () =>
          handlersRef.current.onRoadDrag?.(index, fromLngLat(marker.getLngLat()))
        )
        endpointRefs.current[index] = marker
      }
      marker.getElement().style.borderColor = color
      marker.setLngLat(toLngLat(item)).addTo(map)
    })
  }, [road, roadOutside, mode, styleVersion])

  // Cho người dùng bàn phím: đặt điểm ở giữa bản đồ
  const pickCenter = () => {
    const center = mapRef.current?.getCenter()
    if (center) onMapClick?.(fromLngLat(center))
  }

  if (failed) {
    return (
      <div className="grid h-72 place-items-center rounded-2xl border border-line bg-surface-muted p-6 text-center sm:h-96">
        <p className="m-0 max-w-sm text-small text-ink-secondary">
          {STREET_STYLE
            ? 'Không tải được bản đồ. Bạn vẫn có thể tìm địa chỉ hoặc dùng vị trí của bạn.'
            : 'Bản đồ chưa được cấu hình (thiếu VITE_VIETMAP_STYLE_URL).'}
        </p>
      </div>
    )
  }

  return (
    <div className="relative h-72 overflow-hidden rounded-2xl border border-line sm:h-96">
      <div
        ref={containerRef}
        role="region"
        aria-label="Bản đồ chọn vị trí, dùng phím mũi tên để di chuyển bản đồ"
        className="size-full"
      />

      {pickable && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ink/50"
        />
      )}

      {pickable && styleVersion > 0 && (
        <button
          type="button"
          onClick={pickCenter}
          className={cx(
            'absolute bottom-3 left-3 inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-caption font-semibold text-primary shadow-card hover:bg-primary-subtle',
            focusRing
          )}
        >
          <Icon name="pin" size={14} />
          {mode === 'road'
            ? road.length === 0
              ? 'Đặt điểm đầu ở giữa bản đồ'
              : 'Đặt điểm cuối ở giữa bản đồ'
            : 'Đặt ghim ở giữa bản đồ'}
        </button>
      )}
    </div>
  )
}
