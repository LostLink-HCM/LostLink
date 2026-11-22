import { useEffect, useId, useState } from 'react'
import {
  dashboardToCsv,
  formatDate,
  formatNumber,
  localDate,
  percentChange,
  rangeError,
} from '../../lib/admin/dashboard'
import { getAdminDashboard } from '../../api/adminDashboard'
import Icon from '../../components/common/Icon'
import { cx, focusRing } from '../../components/backoffice/classes'

const number = formatNumber
const percent = (value) => (value === null ? '—' : `${number(value, 1)}%`)
const areaName = (value, options) =>
  value ? options?.find((area) => area === value) || value : 'Tất cả khu vực'
const emptyKpis = {
  approvedPosts: 0,
  approvedWithSuggestions: 0,
  suggestionRate: null,
  returnedPosts: 0,
  returnRate: null,
  averageReturnDays: null,
  averageApprovalDays: null,
  verificationRequests: 0,
  verificationPassed: 0,
  verificationRate: null,
}

function Change({ value, suffix = '%', inverse = false }) {
  if (value === null) {
    return <span className="text-xs text-[#66778d]">Chưa đủ dữ liệu so sánh</span>
  }

  const good = inverse ? value <= 0 : value >= 0
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 whitespace-nowrap text-[13px] font-medium',
        value === 0 ? 'text-[#66778d]' : good ? 'text-[#27876f]' : 'text-[#b7576c]'
      )}
    >
      <Icon name={value < 0 ? 'trendDown' : 'trendUp'} size={13} />
      {value > 0 ? '+' : ''}
      {number(value, 1)}
      {suffix}
    </span>
  )
}

const statTones = {
  blue: {
    spark: '#3976bd',
    icon: 'bg-[#eef4fd] text-[#3976bd]',
  },
  teal: {
    spark: '#299687',
    icon: 'bg-[#e9f7f3] text-[#299687]',
  },
  amber: {
    spark: '#b4852e',
    icon: 'bg-[#fcf6e9] text-[#b4852e]',
  },
  rose: {
    spark: '#bd6076',
    icon: 'bg-[#fceff2] text-[#bd6076]',
  },
}

function RateSparkline({ values, label, tone }) {
  const color = statTones[tone].spark
  const gradientId = useId().replaceAll(':', '')
  const numericValues = values.filter(Number.isFinite)
  if (!numericValues.length) return null
  const minValue = Math.min(...numericValues)
  const maxValue = Math.max(...numericValues)
  const padding = Math.max(3, (maxValue - minValue) * 0.15)
  const domainMin = Math.max(0, minValue - padding)
  const domainMax = Math.min(100, maxValue + padding)
  const domainRange = domainMax - domainMin || 1
  const points = values.map((value, index) => {
    if (!Number.isFinite(value)) return null
    return {
      x: values.length === 1 ? 44 : 4 + (index / (values.length - 1)) * 80,
      y: 30 - ((Math.max(0, Math.min(100, value)) - domainMin) / domainRange) * 24,
      value,
    }
  })
  const validPoints = points.filter(Boolean)

  const segments = []
  let segment = []
  for (const point of points) {
    if (point) segment.push(point)
    else if (segment.length) {
      segments.push(segment)
      segment = []
    }
  }
  if (segment.length) segments.push(segment)

  const first = validPoints[0]
  const last = validPoints[validPoints.length - 1]
  const direction =
    validPoints.length < 2 || first.value === last.value
      ? 'ổn định hoặc chưa đủ dữ liệu'
      : last.value > first.value
        ? 'tăng'
        : 'giảm'

  return (
    <svg
      viewBox="0 0 88 36"
      role="img"
      aria-label={`Xu hướng ${label}: ${direction} trong kỳ`}
      className="h-9 w-[76px] shrink-0 overflow-visible"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.24" />
          <stop offset="100%" stopColor={color} stopOpacity="0.015" />
        </linearGradient>
      </defs>
      <path d="M3 30 H85" fill="none" stroke="#e8eef5" strokeWidth="1" />
      {segments
        .filter((items) => items.length > 1)
        .map((items, index) => {
          const linePath = items
            .map((point, pointIndex) => `${pointIndex ? 'L' : 'M'}${point.x},${point.y}`)
            .join(' ')
          const firstPoint = items[0]
          const lastPoint = items[items.length - 1]
          const areaPath = `${linePath} L${lastPoint.x},30 L${firstPoint.x},30 Z`

          return (
            <g key={index}>
              <path d={areaPath} fill={`url(#${gradientId})`} />
              <path
                d={linePath}
                fill="none"
                stroke={color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          )
        })}
      <title>{`Xu hướng ${label}: ${direction} trong kỳ`}</title>
    </svg>
  )
}

function StatCard({ label, value, icon, tone, note, change, suffix, inverse, trendValues }) {
  const colors = statTones[tone]
  return (
    <article className="min-w-0 rounded-[10px] border border-[#d3dfeb] bg-white px-[19px] pt-[18px] pb-4 shadow-[0_6px_18px_rgba(25,52,82,0.10)] transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-[0_13px_28px_rgba(25,52,82,0.17)]">
      <div className="flex items-center justify-between gap-2 text-[13px] font-medium text-[#40566f]">
        <span>{label}</span>
        <span className={cx('shrink-0 rounded-lg p-2', colors.icon)}>
          <Icon name={icon} size={17} />
        </span>
      </div>
      <div className="mt-2 mb-2 flex items-center justify-between gap-2">
        <strong className="block text-[22px] font-semibold leading-[1.3] tracking-[-0.2px] tabular-nums text-[#183b60]">
          {value}
        </strong>
        {trendValues && <RateSparkline values={trendValues} label={label} tone={tone} />}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[#536982]">
        <Change value={change} suffix={suffix} inverse={inverse} />
        {change !== null && <span>so với kỳ trước</span>}
      </div>
      <p className="mt-3 border-t border-[#d6e0eb] pt-2.5 text-xs leading-[1.55] text-[#536982]">
        {note}
      </p>
    </article>
  )
}

function PostsChart({ daily }) {
  const gradient = useId().replace(/:/g, '')
  const [hoveredDate, setHoveredDate] = useState(null)
  const selected = daily.findIndex((day) => day.date === hoveredDate)
  const active = selected >= 0 ? selected : daily.length - 1
  const day = daily[active]
  const singleDay = daily.length === 1
  const max = Math.max(
    40,
    Math.ceil(Math.max(...daily.map((row) => Math.max(row.lost, row.found))) / 40) * 40
  )
  const width = 680
  const height = 240
  const left = 40
  const right = 14
  const top = 18
  const bottom = 35
  const plotWidth = width - left - right
  const plotHeight = height - top - bottom
  const x = (index) =>
    daily.length === 1 ? left + plotWidth / 2 : left + (index / (daily.length - 1)) * plotWidth
  const y = (value) => top + plotHeight * (1 - value / max)
  const path = (key) =>
    daily.map((row, index) => `${index ? 'L' : 'M'}${x(index)},${y(row[key])}`).join(' ')
  const ticks = [
    ...new Set([
      0,
      Math.floor((daily.length - 1) / 4),
      Math.floor((daily.length - 1) / 2),
      Math.floor(((daily.length - 1) * 3) / 4),
      daily.length - 1,
    ]),
  ]

  return (
    <>
      <div className="mx-[22px] mt-2 flex min-h-[18px] flex-wrap gap-[15px] max-[600px]:mx-[17px] max-[600px]:gap-2.5">
        <span className="flex items-center gap-[5px] text-sm text-[#64758a]">
          {formatDate(day.date)}
        </span>
        <span className="flex items-center gap-[5px] text-sm text-[#64758a]">
          <i className="size-[9px] shrink-0 rounded-[2px] bg-[#b86f56]" />
          Mất đồ <b className="min-w-[22px] font-semibold text-[#5b6f89]">{number(day.lost)}</b>
        </span>
        <span className="flex items-center gap-[5px] text-sm text-[#64758a]">
          <i className="size-[9px] shrink-0 rounded-[2px] bg-[#23a397]" />
          Nhặt được <b className="min-w-[22px] font-semibold text-[#5b6f89]">{number(day.found)}</b>
        </span>
      </div>
      <svg
        className="my-[5px] ml-[14px] block w-[calc(100%-28px)] text-[7.5px] max-[600px]:mx-[6px] max-[600px]:w-[calc(100%-12px)] max-[600px]:text-[26px]"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Biểu đồ tin mất đồ và nhặt được theo ngày"
      >
        <defs>
          <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#b86f56" stopOpacity=".18" />
            <stop offset="100%" stopColor="#b86f56" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3, 4].map((tick) => (
          <g key={tick}>
            <line
              x1={left}
              y1={y((max * tick) / 4)}
              x2={width - right}
              y2={y((max * tick) / 4)}
              stroke="#e9eef4"
              strokeDasharray="4 5"
            />
            <text
              x={left - 12}
              y={y((max * tick) / 4) + 4}
              textAnchor="end"
              className="fill-[#65778f] text-[7.5px] max-[600px]:text-[26px]"
            >
              {number((max * tick) / 4)}
            </text>
          </g>
        ))}
        {singleDay ? (
          ['lost', 'found'].map((key, index) => {
            const barWidth = 56
            const centerOffset = index === 0 ? -40 : 40
            const center = x(0) + centerOffset

            return (
              <g key={key}>
                <rect
                  x={center - barWidth / 2}
                  y={y(day[key])}
                  width={barWidth}
                  height={y(0) - y(day[key])}
                  rx="5"
                  fill={key === 'lost' ? '#b86f56' : '#23a397'}
                />
                <text
                  x={center}
                  y={y(day[key]) - 9}
                  textAnchor="middle"
                  className="fill-[#65778f] text-[7.5px] max-[600px]:text-[26px]"
                >
                  {number(day[key])}
                </text>
              </g>
            )
          })
        ) : (
          <>
            <path
              d={`${path('lost')} L${x(daily.length - 1)},${y(0)} L${x(0)},${y(0)} Z`}
              fill={`url(#${gradient})`}
            />
            <path
              d={path('lost')}
              fill="none"
              stroke="#b86f56"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
            <path
              d={path('found')}
              fill="none"
              stroke="#23a397"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
            <line
              x1={x(active)}
              x2={x(active)}
              y1={top}
              y2={y(0)}
              stroke="#a6b8ce"
              strokeDasharray="3 4"
            />
            {['lost', 'found'].map((key) => (
              <circle
                key={key}
                cx={x(active)}
                cy={y(day[key])}
                r="4.5"
                fill={key === 'lost' ? '#b86f56' : '#23a397'}
                stroke="white"
                strokeWidth="2"
              />
            ))}
          </>
        )}
        {ticks.map((index) => (
          <text
            key={index}
            x={x(index)}
            y={height - 9}
            textAnchor={
              singleDay
                ? 'middle'
                : index === 0
                  ? 'start'
                  : index === daily.length - 1
                    ? 'end'
                    : 'middle'
            }
            className="fill-[#65778f] text-[7.5px] max-[600px]:text-[26px]"
          >
            {formatDate(daily[index].date).slice(0, 5)}
          </text>
        ))}
        <rect
          x={left}
          y={top}
          width={plotWidth}
          height={plotHeight}
          fill="transparent"
          onMouseMove={(event) => {
            const bounds = event.currentTarget.getBoundingClientRect()
            const index = Math.max(
              0,
              Math.min(
                daily.length - 1,
                Math.round(((event.clientX - bounds.left) / bounds.width) * (daily.length - 1))
              )
            )
            setHoveredDate(daily[index].date)
          }}
          onMouseLeave={() => setHoveredDate(null)}
        />
      </svg>
      <details className="border-t border-[#dce5ef] text-sm text-[#7088a3]">
        <summary className="cursor-pointer px-[22px] py-3 max-[600px]:px-[17px]">
          Xem số liệu theo ngày
        </summary>
        <div className="max-h-[230px] overflow-auto">
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">Số tin theo từng ngày trong kỳ</caption>
            <thead className="sticky top-0 bg-[#f7f9fc]">
              <tr>
                <th className="border-b border-[#dce5ef] px-[22px] py-2.5 font-semibold">Ngày</th>
                <th className="border-b border-[#dce5ef] px-[22px] py-2.5 font-semibold">Mất đồ</th>
                <th className="border-b border-[#dce5ef] px-[22px] py-2.5 font-semibold">
                  Nhặt được
                </th>
                <th className="border-b border-[#dce5ef] px-[22px] py-2.5 font-semibold">
                  Tổng tin
                </th>
              </tr>
            </thead>
            <tbody>
              {daily.map((row) => (
                <tr key={row.date}>
                  <th
                    scope="row"
                    className="border-b border-[#dce5ef] px-[22px] py-2.5 font-medium"
                  >
                    {formatDate(row.date)}
                  </th>
                  <td className="border-b border-[#dce5ef] px-[22px] py-2.5">{number(row.lost)}</td>
                  <td className="border-b border-[#dce5ef] px-[22px] py-2.5">
                    {number(row.found)}
                  </td>
                  <td className="border-b border-[#dce5ef] px-[22px] py-2.5">
                    {number(row.lost + row.found)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  )
}

const areaColor = (index, count) => `hsl(${Math.round((index * 360) / Math.max(count, 1))} 52% 46%)`

const donutSegmentPath = (start, end) => {
  const outerRadius = 80
  const innerRadius = 40
  const startAngle = start - Math.PI / 2
  const endAngle = end - Math.PI / 2
  const point = (radius, angle) => ({
    x: 110 + radius * Math.cos(angle),
    y: 110 + radius * Math.sin(angle),
  })
  const outerStart = point(outerRadius, startAngle)
  const outerEnd = point(outerRadius, endAngle)
  const innerEnd = point(innerRadius, endAngle)
  const innerStart = point(innerRadius, startAngle)
  const largeArc = end - start > Math.PI ? 1 : 0

  return [
    `M${outerStart.x},${outerStart.y}`,
    `A${outerRadius},${outerRadius} 0 ${largeArc} 1 ${outerEnd.x},${outerEnd.y}`,
    `L${innerEnd.x},${innerEnd.y}`,
    `A${innerRadius},${innerRadius} 0 ${largeArc} 0 ${innerStart.x},${innerStart.y}`,
    'Z',
  ].join(' ')
}

function AreaRankingDonut({ areas, selectedArea, areaOptions, onSelect }) {
  const [hoveredArea, setHoveredArea] = useState('')
  const totalPosts = areas.reduce((total, row) => total + row.posts, 0)
  const nonEmptyAreas = areas.filter((row) => row.posts > 0)
  const activeArea =
    areas.find((row) => row.name === hoveredArea) || areas.find((row) => row.name === selectedArea)
  const activeAreaName = activeArea ? areaName(activeArea.name, areaOptions) : ''
  const splitDistrictName =
    activeAreaName.startsWith('Quận ') && activeAreaName.slice(5).includes(' ')
  const activeShare = activeArea && totalPosts ? (activeArea.posts / totalPosts) * 100 : 0
  const areaSlices = nonEmptyAreas.reduce((slices, row) => {
    const share = row.posts / totalPosts
    const start = slices.length ? slices[slices.length - 1].end : 0

    return [
      ...slices,
      {
        row,
        index: areas.indexOf(row),
        share,
        start,
        end: start + share * Math.PI * 2,
      },
    ]
  }, [])

  const selectArea = (name) => onSelect(name)
  const hoverProps = (name) => ({
    onMouseEnter: () => setHoveredArea(name),
    onMouseLeave: () => setHoveredArea(''),
    onFocus: () => setHoveredArea(name),
    onBlur: () => setHoveredArea(''),
    onClick: () => selectArea(name),
  })
  const selectByKeyboard = (name) => (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      selectArea(name)
    }
  }

  return (
    <div className="flex flex-col items-center gap-3 px-5 py-4 max-[600px]:px-[17px]">
      <div className="relative mx-auto aspect-square w-full max-w-[210px]">
        <svg
          viewBox="0 0 220 220"
          role="group"
          aria-label="Tỷ lệ bài đăng theo khu vực"
          className="size-full overflow-visible"
        >
          {totalPosts === 0 ? (
            <circle cx="110" cy="110" r="60" fill="none" stroke="#e8eef5" strokeWidth="40" />
          ) : nonEmptyAreas.length === 1 ? (
            <circle
              cx="110"
              cy="110"
              r="60"
              fill="none"
              stroke={areaColor(areas.indexOf(nonEmptyAreas[0]), areas.length)}
              strokeWidth="40"
              {...hoverProps(nonEmptyAreas[0].name)}
              onKeyDown={selectByKeyboard(nonEmptyAreas[0].name)}
              opacity={selectedArea && selectedArea !== nonEmptyAreas[0].name ? 0.22 : 1}
              role="button"
              tabIndex={0}
              aria-label={`${areaName(nonEmptyAreas[0].name, areaOptions)}: ${percent(100)} bài đăng`}
              className="cursor-pointer outline-none"
            >
              <title>{`${areaName(nonEmptyAreas[0].name, areaOptions)} · ${percent(100)} bài đăng`}</title>
            </circle>
          ) : (
            areaSlices.map(({ row, index, share, start, end }) => {
              const selected = row.name === selectedArea
              const color = areaColor(index, areas.length)
              const opacity = selectedArea
                ? selected
                  ? 1
                  : 0.22
                : hoveredArea && hoveredArea !== row.name
                  ? 0.55
                  : 1

              return (
                <path
                  key={row.name}
                  d={donutSegmentPath(start, end)}
                  fill={color}
                  stroke="white"
                  strokeWidth="1.5"
                  opacity={opacity}
                  {...hoverProps(row.name)}
                  onKeyDown={selectByKeyboard(row.name)}
                  role="button"
                  tabIndex={0}
                  aria-label={`${areaName(row.name, areaOptions)}: ${percent(share * 100)} bài đăng`}
                  className="cursor-pointer outline-none"
                >
                  <title>{`${areaName(row.name, areaOptions)} · ${percent(share * 100)} bài đăng`}</title>
                </path>
              )
            })
          )}
        </svg>
        {activeArea && (
          <div className="pointer-events-none absolute inset-[32%] flex flex-col items-center justify-center text-center">
            <span className="max-w-full text-[13px] leading-tight text-black">
              {splitDistrictName ? (
                <>
                  <span className="block">Quận</span>
                  <span className="block whitespace-nowrap">{activeAreaName.slice(5)}</span>
                </>
              ) : (
                activeAreaName
              )}
            </span>
            <strong className="mt-0.5 text-base font-semibold text-black">
              {percent(activeShare)}
            </strong>
          </div>
        )}
      </div>

      <div className="max-h-[220px] w-full overflow-y-auto pr-1">
        {areas.map((row, index) => {
          const share = totalPosts ? (row.posts / totalPosts) * 100 : 0
          const color = areaColor(index, areas.length)
          const selected = row.name === selectedArea

          return (
            <button
              key={row.name}
              type="button"
              className={cx(
                'flex w-full items-center gap-2.5 rounded-md border-b border-[#e5ebf2] px-2 py-2.5 text-left transition-colors last:border-b-0 hover:bg-[#f5f8fc]',
                focusRing,
                selected && 'bg-[#edf4fc]'
              )}
              {...hoverProps(row.name)}
              aria-label={`Lọc theo ${areaName(row.name, areaOptions)}, ${percent(share)} bài đăng`}
              title={`${areaName(row.name, areaOptions)} · ${percent(share)} bài đăng`}
            >
              <span className="w-7 shrink-0 text-xs font-semibold tabular-nums text-[#7388a1]">
                {String(row.rank).padStart(2, '0')}
              </span>
              <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-[#405770]">
                {areaName(row.name, areaOptions)}
              </span>
              <span className="flex shrink-0 flex-col items-end">
                <strong className="text-xs font-semibold text-[#405770]">
                  {number(row.posts)} bài
                </strong>
                <small className="text-[11px] text-[#71849c]">{percent(share)}</small>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Panel({ title, description, icon, headingIcon, badge, children, className = '' }) {
  return (
    <section
      className={cx(
        'min-w-0 overflow-hidden rounded-[10px] border border-[#d3dfeb] bg-white shadow-[0_6px_18px_rgba(25,52,82,0.09)] transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-[0_13px_28px_rgba(25,52,82,0.17)]',
        className
      )}
    >
      <header className="flex items-center justify-between gap-3 border-b border-[#d6e0eb] bg-[#f6f9fd] px-[22px] pt-[19px] pb-[17px] max-[600px]:px-[17px] max-[600px]:pt-4 max-[600px]:pb-[14px]">
        <div>
          <h3
            className={cx(
              'flex items-center gap-2 text-base font-semibold text-[#1f3854]',
              description && 'mb-1.5'
            )}
          >
            {headingIcon && <Icon name={headingIcon} size={18} className="text-[#778da7]" />}
            {title}
          </h3>
          {description && <p className="text-[13px] leading-[1.6] text-[#536982]">{description}</p>}
        </div>
        {badge || (
          <span className="shrink-0 text-[#a0b2c8]">
            <Icon name={icon} size={19} />
          </span>
        )}
      </header>
      {children}
    </section>
  )
}

export default function Dashboard() {
  const [today] = useState(localDate)
  const [filters, setFilters] = useState(() => ({ from: today, to: today, area: '' }))
  const [notice, setNotice] = useState('')
  const [loadedReport, setLoadedReport] = useState(null)
  const [requestError, setRequestError] = useState('')
  const [retryCount, setRetryCount] = useState(0)
  const [areaOptions, setAreaOptions] = useState([])
  const error = rangeError(filters)
  const hasCurrentReport =
    loadedReport?.from === filters.from &&
    loadedReport?.to === filters.to &&
    loadedReport?.area === filters.area
  const report = hasCurrentReport ? loadedReport : null
  const loading = !error && !requestError && !report

  useEffect(() => {
    if (error) return undefined

    let active = true
    getAdminDashboard(filters)
      .then((data) => {
        if (!active) return
        setLoadedReport(data)
        setAreaOptions(data.areaOptions || [])
        setRequestError('')
      })
      .catch((err) => {
        if (active) setRequestError(err.message || 'Không tải được dữ liệu Dashboard.')
      })

    return () => {
      active = false
    }
  }, [filters, error, retryCount])

  const setFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }))
    setNotice('')
    setRequestError('')
  }
  const reset = () => {
    setFilters({ from: today, to: today, area: '' })
    setNotice('')
    setRequestError('')
  }
  const exportReport = () => {
    if (!report?.hasData) return
    const areaLabels = Object.fromEntries(areaOptions.map((area) => [area, area]))
    const url = URL.createObjectURL(
      new Blob([dashboardToCsv(report, filters, areaName(filters.area, areaOptions), areaLabels)], {
        type: 'text/csv;charset=utf-8;',
      })
    )
    const link = document.createElement('a')
    link.href = url
    link.download = `LostLink_Dashboard_${filters.from}_${filters.to}${filters.area ? `_${filters.area}` : ''}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    setNotice(
      `Đã xuất báo cáo CSV · ${formatDate(filters.from)} – ${formatDate(filters.to)} · ${areaName(filters.area, areaOptions)}.`
    )
  }

  const total = report?.totals
  const kpis = { ...emptyKpis, ...report?.kpis }
  const previousKpis = { ...emptyKpis, ...report?.previousKpis }
  const kpiChange = (key, percentagePoints = false) => {
    const current = kpis?.[key]
    const previous = previousKpis?.[key]
    if (
      !report?.canCompare ||
      current === null ||
      current === undefined ||
      previous === null ||
      previous === undefined
    )
      return null
    return percentagePoints ? current - previous : percentChange(current, previous)
  }
  const averageDays = (value) => (value === null ? '—' : `${number(value, 1)} ngày`)
  const areaRanking = report?.areaRanking || report?.areas || []

  return (
    <div className="mx-auto max-w-[1640px] px-8 pb-0 pt-7 max-[1200px]:px-[22px] max-[600px]:px-4 max-[600px]:py-[22px]">
      <section
        className="mb-[22px] grid grid-cols-[minmax(160px,1fr)_minmax(160px,1fr)_minmax(220px,1.35fr)_auto] items-end gap-4 rounded-[10px] border border-[#d3dfeb] bg-white px-[22px] py-5 shadow-[0_6px_18px_rgba(25,52,82,0.08)] max-[1200px]:grid-cols-2 max-[1200px]:gap-4 max-[600px]:mb-4 max-[600px]:gap-x-3 max-[600px]:gap-y-3.5 max-[600px]:p-4"
        aria-label="Bộ lọc Dashboard"
      >
        <label className="flex min-w-0 flex-col gap-2 text-[13px] font-semibold text-[#435970]">
          Từ ngày
          <input
            type="date"
            value={filters.from}
            aria-invalid={!!error}
            aria-describedby={error ? 'admin-date-error' : undefined}
            onChange={(event) => setFilter('from', event.target.value)}
            className={cx(
              'h-[42px] w-full min-w-0 rounded-[7px] border border-[#acbfd6] bg-white px-3 text-sm font-medium text-[#334b67] outline-none [color-scheme:light] focus:border-primary focus:ring-2 focus:ring-primary/15',
              focusRing
            )}
          />
        </label>
        <label className="flex min-w-0 flex-col gap-2 text-[13px] font-semibold text-[#435970]">
          Đến ngày
          <input
            type="date"
            value={filters.to}
            aria-invalid={!!error}
            aria-describedby={error ? 'admin-date-error' : undefined}
            onChange={(event) => setFilter('to', event.target.value)}
            className={cx(
              'h-[42px] w-full min-w-0 rounded-[7px] border border-[#acbfd6] bg-white px-3 text-sm font-medium text-[#334b67] outline-none [color-scheme:light] focus:border-primary focus:ring-2 focus:ring-primary/15',
              focusRing
            )}
          />
        </label>
        <label className="flex min-w-0 flex-col gap-2 text-[13px] font-semibold text-[#435970] max-[600px]:col-span-full">
          Khu vực
          <select
            aria-label="Khu vực"
            value={filters.area}
            onChange={(event) => setFilter('area', event.target.value)}
            className={cx(
              'h-[42px] w-full min-w-0 cursor-pointer rounded-[7px] border border-[#acbfd6] bg-white px-3 text-sm font-medium text-[#334b67] outline-none focus:border-primary focus:ring-2 focus:ring-primary/15',
              focusRing
            )}
          >
            <option value="">Tất cả khu vực</option>
            {areaOptions.map((area) => (
              <option key={area} value={area}>
                {area}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-[9px] max-[1200px]:justify-end max-[600px]:col-span-full">
          <button
            type="button"
            aria-label="Đặt lại bộ lọc Dashboard"
            title="Đặt lại về hôm nay"
            onClick={reset}
            className={cx(
              'inline-flex size-[42px] cursor-pointer items-center justify-center rounded-[7px] border border-[#c6d6e7] bg-white p-0 text-primary hover:bg-primary-subtle',
              focusRing
            )}
          >
            <Icon name="reset" size={17} />
          </button>
          <button
            type="button"
            disabled={!report?.hasData}
            onClick={exportReport}
            className={cx(
              'inline-flex min-h-[42px] cursor-pointer items-center justify-center gap-2 rounded-[7px] border border-primary bg-primary px-3.5 text-[13px] font-semibold whitespace-nowrap text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-45',
              focusRing
            )}
          >
            <Icon name="download" size={17} />
            Xuất CSV
          </button>
        </div>
      </section>

      {notice && (
        <p
          role="status"
          className="mb-5 flex items-center gap-2 rounded-[7px] border border-[#bde3d6] bg-[#effaf5] px-[15px] py-3 text-sm text-[#24775f]"
        >
          <Icon name="check" size={16} />
          {notice}
        </p>
      )}

      {error ? (
        <div
          className="flex flex-col items-center rounded-[10px] border border-dashed border-[#d5e0ed] bg-white px-6 py-[65px] text-center text-[#8a9bb3]"
          role="alert"
          id="admin-date-error"
        >
          <Icon name="calendar" size={36} />
          <h3 className="mt-5 mb-2.5 text-[19px] font-semibold text-[#354e6c]">
            Kiểm tra khoảng thời gian
          </h3>
          <p className="mb-5 max-w-[550px] text-sm leading-[1.9]">{error}</p>
        </div>
      ) : requestError ? (
        <div
          className="flex flex-col items-center rounded-[10px] border border-dashed border-[#d5e0ed] bg-white px-6 py-[65px] text-center text-[#8a9bb3]"
          role="alert"
        >
          <Icon name="dashboard" size={36} />
          <h3 className="mt-5 mb-2.5 text-[19px] font-semibold text-[#354e6c]">
            Không tải được dữ liệu Dashboard
          </h3>
          <p className="mb-5 max-w-[550px] text-sm leading-[1.9]">{requestError}</p>
          <button
            type="button"
            onClick={() => setRetryCount((count) => count + 1)}
            className={cx(
              'inline-flex min-h-10 cursor-pointer items-center justify-center rounded-[7px] border border-[#c6d6e7] bg-white px-3.5 text-[13px] font-semibold text-primary hover:bg-primary-subtle',
              focusRing
            )}
          >
            Thử lại
          </button>
        </div>
      ) : loading ? (
        <div
          className="flex min-h-[260px] items-center justify-center rounded-[10px] border border-[#d5e0ed] bg-white text-sm text-[#71849c]"
          role="status"
        >
          Đang tải số liệu Dashboard...
        </div>
      ) : !report?.hasData ? (
        <div className="flex flex-col items-center rounded-[10px] border border-dashed border-[#d5e0ed] bg-white px-6 py-[65px] text-center text-[#8a9bb3]">
          <Icon name="dashboard" size={36} />
          <h3 className="mt-5 mb-2.5 text-[19px] font-semibold text-[#354e6c]">
            Chưa có dữ liệu trong kỳ này
          </h3>
          <p className="mb-5 max-w-[550px] text-sm leading-[1.9]">
            Chưa có hoạt động trong khoảng thời gian đã chọn. Hãy thử chọn khoảng ngày khác.
          </p>
          <button
            type="button"
            onClick={reset}
            className={cx(
              'inline-flex min-h-10 cursor-pointer items-center justify-center rounded-[7px] border border-[#c6d6e7] bg-white px-3.5 text-[13px] font-semibold text-primary hover:bg-primary-subtle',
              focusRing
            )}
          >
            Về hôm nay
          </button>
        </div>
      ) : (
        <>
          <section aria-label="Chỉ số tổng quan" className="mb-[22px]">
            <div className="mb-[18px]">
              <div className="grid grid-cols-3 gap-4 max-[1000px]:grid-cols-2 max-[600px]:grid-cols-1 max-[600px]:gap-3">
                <StatCard
                  label="Tỷ lệ bài đăng có gợi ý ghép cặp"
                  value={percent(kpis.suggestionRate)}
                  icon="link"
                  tone="teal"
                  trendValues={report.rateTrends?.suggestionRate}
                  note={`${number(kpis.approvedWithSuggestions)} / ${number(kpis.approvedPosts)} bài được duyệt có ít nhất 1 gợi ý`}
                  change={kpiChange('suggestionRate', true)}
                  suffix=" điểm %"
                />
                <StatCard
                  label="Tỷ lệ bài được duyệt đã trao trả"
                  value={percent(kpis.returnRate)}
                  icon="gift"
                  tone="blue"
                  trendValues={report.rateTrends?.returnRate}
                  note={`${number(kpis.returnedPosts)} / ${number(kpis.approvedPosts)} bài được duyệt trong kỳ đã chuyển sang Đã trao trả`}
                  change={kpiChange('returnRate', true)}
                  suffix=" điểm %"
                />
                <StatCard
                  label="Tỷ lệ xác minh thành công"
                  value={percent(kpis.verificationRate)}
                  icon="shield"
                  tone="teal"
                  trendValues={report.rateTrends?.verificationRate}
                  note={`${number(kpis.verificationPassed)} / ${number(kpis.verificationRequests)} lượt đã trả lời xác minh đúng`}
                  change={kpiChange('verificationRate', true)}
                  suffix=" điểm %"
                />
              </div>
            </div>
            <div>
              <div className="grid grid-cols-2 gap-4 max-[700px]:grid-cols-1 max-[600px]:gap-3">
                <StatCard
                  label="Thời gian trung bình đến khi trao trả"
                  value={averageDays(kpis.averageReturnDays)}
                  icon="history"
                  tone="amber"
                  note="Tính từ lần duyệt đầu tiên đến khi bài chuyển sang Đã trao trả"
                  change={kpiChange('averageReturnDays')}
                  inverse
                />
                <StatCard
                  label="Thời gian duyệt bài trung bình"
                  value={averageDays(kpis.averageApprovalDays)}
                  icon="calendar"
                  tone="rose"
                  note="Tính từ lúc đăng đến lần duyệt đầu tiên"
                  change={kpiChange('averageApprovalDays')}
                  inverse
                />
              </div>
            </div>
          </section>

          <Panel title="Số tin theo ngày" icon="activity" className="mb-[22px]">
            <div className="flex items-baseline gap-2 px-[22px] pt-4 pb-1.5 max-[600px]:flex-wrap max-[600px]:px-[17px] max-[600px]:pt-[15px]">
              <strong className="text-[19px] font-semibold tracking-[-0.2px] text-[#183b60]">
                {number(total.posts)}
              </strong>
              <span className="text-sm text-[#536982]">tin đăng</span>
              <div className="ml-auto flex flex-wrap gap-[15px] max-[600px]:gap-2.5">
                <span className="flex items-center gap-[5px] text-sm text-[#536982]">
                  <i className="size-[9px] rounded-[2px] bg-[#b86f56]" />
                  Mất đồ
                </span>
                <span className="flex items-center gap-[5px] text-sm text-[#536982]">
                  <i className="size-[9px] rounded-[2px] bg-[#23a397]" />
                  Nhặt được
                </span>
              </div>
            </div>
            <PostsChart daily={report.daily} />
          </Panel>

          <div className="grid grid-cols-2 items-stretch gap-5 max-[1200px]:grid-cols-1 max-[700px]:gap-4">
            <Panel
              title="Khu vực nổi bật"
              description="Xếp hạng theo số tin đăng trong kỳ"
              headingIcon="pin"
              badge={
                <span className="whitespace-nowrap rounded-[5px] bg-[#f3f6fa] px-2 py-[5px] text-xs text-[#5f7590]">
                  {areaRanking.length} khu vực
                </span>
              }
            >
              <AreaRankingDonut
                areas={areaRanking}
                selectedArea={filters.area}
                areaOptions={areaOptions}
                onSelect={(area) => setFilter('area', area)}
              />
              <p className="flex items-center gap-1.5 border-t border-[#dce5ef] px-[22px] py-3 text-xs leading-[1.8] text-[#65778f] max-[600px]:px-[17px]">
                Chọn một khu vực để xem các chỉ số tương ứng.
              </p>
            </Panel>

            <Panel
              title="Xu hướng danh mục"
              description={`So với ${report.days} ngày liền trước`}
              headingIcon="trendUp"
              badge={
                <span className="whitespace-nowrap rounded-[5px] bg-[#f3f6fa] px-2 py-[5px] text-xs text-[#5f7590]">
                  Theo số tin
                </span>
              }
            >
              <div className="mt-[18px] overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <caption className="sr-only">Số tin và thay đổi theo danh mục</caption>
                  <thead>
                    <tr>
                      <th className="bg-[#edf3fa] px-[22px] py-[11px] text-xs font-medium whitespace-nowrap text-[#64778f]">
                        Danh mục
                      </th>
                      <th className="bg-[#edf3fa] px-[22px] py-[11px] text-center text-xs font-medium whitespace-nowrap text-[#64778f]">
                        Số tin
                      </th>
                      <th className="bg-[#edf3fa] px-[22px] py-[11px] text-right text-xs font-medium whitespace-nowrap text-[#64778f]">
                        Xu hướng
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.categories.map((row, index) => (
                      <tr
                        key={row.name}
                        className="text-sm text-[#4f627c] last:[&>th]:border-b-0 last:[&>td]:border-b-0"
                      >
                        <th
                          scope="row"
                          className="border-b border-[#e0e8f1] px-[22px] py-[13px] text-left font-medium whitespace-nowrap"
                        >
                          <span
                            className={cx(
                              'mr-[9px] inline-block size-[7px] rounded-[2px]',
                              ['bg-[#90aed7]', 'bg-[#96c7bd]', 'bg-[#c0afd9]', 'bg-[#debf89]'][
                                index % 4
                              ]
                            )}
                          />
                          {row.name}
                        </th>
                        <td className="border-b border-[#e0e8f1] px-[22px] py-[13px] text-center whitespace-nowrap">
                          {number(row.posts)}
                        </td>
                        <td className="border-b border-[#e0e8f1] px-[22px] py-[13px] text-right whitespace-nowrap">
                          <Change value={report.canCompare ? row.change : null} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>

          <footer className="mt-[22px] flex flex-wrap justify-between gap-3 text-xs leading-[1.7] text-[#667b94]">
            <span>
              {report.canCompare
                ? `Kỳ so sánh: ${formatDate(report.previousRange.from)} - ${formatDate(report.previousRange.to)}`
                : 'Chưa đủ dữ liệu kỳ trước để so sánh.'}
            </span>
          </footer>
        </>
      )}
    </div>
  )
}
