import { useId, useMemo, useState } from 'react'
import { ADMIN_AREAS, createAdminDashboard } from '../../data/adminDashboard'
import {
  aggregateDashboard,
  dashboardToCsv,
  formatDate,
  formatNumber,
  localDate,
  percentChange,
  rangeError,
} from '../../lib/adminDashboard'
import Icon from '../../components/common/Icon'
import { cx, focusRing } from '../../components/backoffice/classes'

const number = formatNumber
const percent = (value) => (value === null ? '—' : `${number(value, 1)}%`)
const areaName = (id) => ADMIN_AREAS.find((area) => area.id === id)?.label || 'Tất cả khu vực'

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
    border: 'border-t-[#3976bd]',
    background: 'to-[#eef4fd]',
    icon: 'bg-[#eef4fd] text-[#3976bd]',
  },
  teal: {
    border: 'border-t-[#299687]',
    background: 'to-[#e9f7f3]',
    icon: 'bg-[#e9f7f3] text-[#299687]',
  },
  amber: {
    border: 'border-t-[#b4852e]',
    background: 'to-[#fcf6e9]',
    icon: 'bg-[#fcf6e9] text-[#b4852e]',
  },
  rose: {
    border: 'border-t-[#bd6076]',
    background: 'to-[#fceff2]',
    icon: 'bg-[#fceff2] text-[#bd6076]',
  },
}

function StatCard({ label, value, icon, tone, note, change, suffix, inverse }) {
  const colors = statTones[tone]
  return (
    <article
      className={cx(
        'min-w-0 rounded-[10px] border border-[#b4c6db] border-t-[3px] bg-linear-to-br from-white via-white px-[19px] pt-[18px] pb-4 shadow-[0_3px_10px_#16233a08]',
        colors.border,
        colors.background
      )}
    >
      <div className="flex items-center justify-between gap-2 text-sm font-medium text-[#6e7d90]">
        <span>{label}</span>
        <span className={cx('shrink-0 rounded-lg p-[9px]', colors.icon)}>
          <Icon name={icon} size={19} />
        </span>
      </div>
      <strong className="mt-[7px] mb-[11px] block text-[36px] font-[650] leading-[1.3] tracking-[-1px] tabular-nums text-[#213650]">
        {value}
      </strong>
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#6b7b90]">
        <Change value={change} suffix={suffix} inverse={inverse} />
        {change !== null && <span>so với kỳ trước</span>}
      </div>
      <p className="mt-[13px] border-t border-[#e0e8f1] pt-[11px] text-xs leading-[1.6] text-[#65768c]">
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
        <span className="flex items-center gap-[5px] text-xs text-[#64758a]">
          {formatDate(day.date)}
        </span>
        <span className="flex items-center gap-[5px] text-xs text-[#64758a]">
          <i className="size-[7px] shrink-0 rounded-full bg-[#3976c6]" />
          Mất đồ <b className="min-w-[22px] font-semibold text-[#5b6f89]">{number(day.lost)}</b>
        </span>
        <span className="flex items-center gap-[5px] text-xs text-[#64758a]">
          <i className="size-[7px] shrink-0 rounded-full bg-[#23a397]" />
          Nhặt được <b className="min-w-[22px] font-semibold text-[#5b6f89]">{number(day.found)}</b>
        </span>
      </div>
      <svg
        className="my-[5px] ml-[14px] block w-[calc(100%-28px)] text-[13px] max-[600px]:mx-[6px] max-[600px]:w-[calc(100%-12px)]"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Biểu đồ tin mất đồ và nhặt được theo ngày"
      >
        <defs>
          <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3e7bce" stopOpacity=".18" />
            <stop offset="100%" stopColor="#3e7bce" stopOpacity="0" />
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
              className="fill-[#65778f] text-[13px]"
            >
              {number((max * tick) / 4)}
            </text>
          </g>
        ))}
        {singleDay ? (
          ['lost', 'found'].map((key, index) => (
            <g key={key}>
              <rect
                x={x(0) + (index === 0 ? -102 : 18)}
                y={y(day[key])}
                width="84"
                height={y(0) - y(day[key])}
                rx="5"
                fill={key === 'lost' ? '#3976c6' : '#23a397'}
              />
              <text
                x={x(0) + (index === 0 ? -60 : 60)}
                y={y(day[key]) - 9}
                textAnchor="middle"
                className="fill-[#65778f] text-[13px]"
              >
                {number(day[key])}
              </text>
            </g>
          ))
        ) : (
          <>
            <path
              d={`${path('lost')} L${x(daily.length - 1)},${y(0)} L${x(0)},${y(0)} Z`}
              fill={`url(#${gradient})`}
            />
            <path
              d={path('lost')}
              fill="none"
              stroke="#3976c6"
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
                fill={key === 'lost' ? '#3976c6' : '#23a397'}
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
            className="fill-[#65778f] text-[13px]"
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
      <details className="border-t border-[#dce5ef] text-[13px] text-[#7088a3]">
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

function Panel({ title, description, icon, headingIcon, badge, children, className = '' }) {
  return (
    <section
      className={cx(
        'min-w-0 overflow-hidden rounded-[10px] border border-[#b4c6db] bg-white shadow-[0_3px_10px_#16233a08]',
        className
      )}
    >
      <header className="flex items-center justify-between gap-3 px-[22px] pt-[21px] max-[600px]:px-[17px] max-[600px]:pt-[18px]">
        <div>
          <h3 className="mb-1.5 flex items-center gap-2 text-base font-semibold text-[#253850]">
            {headingIcon && <Icon name={headingIcon} size={18} className="text-[#778da7]" />}
            {title}
          </h3>
          <p className="text-[13px] leading-[1.6] text-[#62758c]">{description}</p>
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
  const [dataset] = useState(() => createAdminDashboard(today))
  const [filters, setFilters] = useState(() => ({ from: today, to: today, area: '' }))
  const [notice, setNotice] = useState('')
  const error = rangeError(filters)
  const report = useMemo(
    () => aggregateDashboard(dataset.rows, filters, dataset.coverage),
    [dataset, filters]
  )
  const setFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }))
    setNotice('')
  }
  const reset = () => {
    setFilters({ from: today, to: today, area: '' })
    setNotice('')
  }
  const exportReport = () => {
    if (!report?.hasData || !report.complete) return
    const areaLabels = Object.fromEntries(
      ADMIN_AREAS.map((area) => [area.id, `${area.label} · ${area.city}`])
    )
    const url = URL.createObjectURL(
      new Blob([dashboardToCsv(report, filters, areaName(filters.area), areaLabels)], {
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
      `Đã xuất báo cáo CSV · ${formatDate(filters.from)} – ${formatDate(filters.to)} · ${areaName(filters.area)}.`
    )
  }

  const total = report?.totals
  const comparison = (key) =>
    report?.canCompare ? percentChange(total[key], report.previous[key]) : null
  const rateChange =
    report?.canCompare && total.rate !== null && report.previous.rate !== null
      ? total.rate - report.previous.rate
      : null

  return (
    <div className="mx-auto max-w-[1640px] px-8 pb-0 pt-7 max-[1200px]:px-[22px] max-[600px]:px-4 max-[600px]:py-[22px]">
      <section
        className="grid grid-cols-[minmax(160px,1fr)_minmax(160px,1fr)_minmax(220px,1.35fr)_auto] items-end gap-4 rounded-[10px] border border-[#b4c6db] bg-white px-[22px] py-5 shadow-[0_3px_10px_#16233a08] max-[1200px]:grid-cols-2 max-[1200px]:gap-4 max-[600px]:gap-x-3 max-[600px]:gap-y-3.5 max-[600px]:p-4"
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
            {ADMIN_AREAS.map((area) => (
              <option key={area.id} value={area.id}>
                {area.label}
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
            disabled={!report?.hasData || !report.complete}
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

      <div className="my-[17px] mb-[22px] flex flex-wrap gap-2.5 text-xs text-[#647990]">
        <span className="flex flex-wrap items-center gap-2">
          <Icon name="calendar" size={16} />
          {error
            ? 'Chọn khoảng thời gian hợp lệ để xem báo cáo'
            : filters.from === today && filters.to === today
              ? `Hôm nay: ${formatDate(today)}`
              : `${formatDate(filters.from)} - ${formatDate(filters.to)}`}
          <span className="mx-[5px] text-[#9cacbf]">/</span>
          {areaName(filters.area)}
        </span>
      </div>

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
      ) : !report?.hasData || !report.complete ? (
        <div className="flex flex-col items-center rounded-[10px] border border-dashed border-[#d5e0ed] bg-white px-6 py-[65px] text-center text-[#8a9bb3]">
          <Icon name="dashboard" size={36} />
          <h3 className="mt-5 mb-2.5 text-[19px] font-semibold text-[#354e6c]">
            {report?.hasData ? 'Chưa đủ dữ liệu cho cả kỳ' : 'Chưa có dữ liệu trong kỳ này'}
          </h3>
          <p className="mb-5 max-w-[550px] text-sm leading-[1.9]">
            Vui lòng chọn khoảng thời gian từ {formatDate(dataset.coverage.from)} đến{' '}
            {formatDate(dataset.coverage.to)} để xem và xuất báo cáo.
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
          <section
            aria-label="Chỉ số tổng quan"
            className="mb-[22px] grid grid-cols-4 gap-[17px] max-[1200px]:grid-cols-2 max-[1200px]:gap-4 max-[360px]:grid-cols-1 max-[600px]:mb-4 max-[600px]:gap-2.5"
          >
            <StatCard
              label="Tổng tin đăng"
              value={number(total.posts)}
              icon="list"
              tone="blue"
              note={`Trung bình ${number(report.average, 1)} tin / ngày`}
              change={comparison('posts')}
            />
            <StatCard
              label="Tỷ lệ match thành công"
              value={percent(total.rate)}
              icon="link"
              tone="teal"
              note={`${number(total.successful)} / ${number(total.matches)} cặp ghép đã trao trả`}
              change={rateChange}
              suffix=" điểm %"
            />
            <StatCard
              label="Report phát sinh"
              value={number(total.reports)}
              icon="flag"
              tone="amber"
              note="Số báo cáo được tạo trong kỳ"
              change={comparison('reports')}
              inverse
            />
            <StatCard
              label="Lượt khóa tài khoản"
              value={number(total.locks)}
              icon="lock"
              tone="rose"
              note="Số thao tác khóa phát sinh trong kỳ"
              change={comparison('locks')}
              inverse
            />
          </section>

          <div className="mb-[22px] grid grid-cols-[minmax(0,1.9fr)_minmax(270px,1fr)] items-stretch gap-5 max-[1200px]:grid-cols-[minmax(0,1.6fr)_minmax(280px,1fr)] max-[700px]:grid-cols-1 max-[700px]:gap-4">
            <Panel
              title="Số tin theo ngày"
              description="Nhịp hoạt động của cộng đồng trong kỳ"
              icon="activity"
            >
              <div className="flex items-baseline gap-2 px-[22px] pt-4 pb-1.5 max-[600px]:flex-wrap max-[600px]:px-[17px] max-[600px]:pt-[15px]">
                <strong className="text-[28px] font-[650] tracking-[-0.5px] text-[#253850]">
                  {number(total.posts)}
                </strong>
                <span className="text-[13px] text-[#65778e]">tin đăng</span>
                <div className="ml-auto flex flex-wrap gap-[15px] max-[600px]:gap-2.5">
                  <span className="flex items-center gap-[5px] text-xs text-[#64758a]">
                    <i className="size-[7px] rounded-full bg-[#3976c6]" />
                    Mất đồ
                  </span>
                  <span className="flex items-center gap-[5px] text-xs text-[#64758a]">
                    <i className="size-[7px] rounded-full bg-[#23a397]" />
                    Nhặt được
                  </span>
                </div>
              </div>
              <PostsChart daily={report.daily} />
            </Panel>

            <Panel
              title="Hiệu quả kết nối"
              description="Từ cặp ghép đến trao trả thành công"
              icon="link"
              className="flex flex-col"
            >
              <div className="relative mx-auto my-[23px] size-[186px] rotate-[-90deg]">
                <svg
                  viewBox="0 0 186 186"
                  className="size-full"
                  role="img"
                  aria-label={`${number(total.successful)} trên ${number(total.matches)} cặp ghép thành công, tỷ lệ ${percent(total.rate)}`}
                >
                  <circle
                    cx="93"
                    cy="93"
                    r="78"
                    fill="none"
                    stroke="#edf2f6"
                    strokeWidth="30"
                    pathLength="100"
                  />
                  <circle
                    cx="93"
                    cy="93"
                    r="78"
                    fill="none"
                    stroke="#2d9b8b"
                    strokeWidth="30"
                    strokeLinecap="round"
                    pathLength="100"
                    strokeDasharray={`${total.rate || 0} 100`}
                  />
                </svg>
                <div className="absolute inset-[15px] flex rotate-90 flex-col items-center justify-center gap-[5px] rounded-full bg-white text-center">
                  <Icon name="check" size={21} className="mb-px text-[#69b2a3]" />
                  <strong className="text-[32px] font-[650] tracking-[-0.7px] text-[#253d51]">
                    {percent(total.rate)}
                  </strong>
                  <span className="text-xs text-[#64778f]">ghép thành công</span>
                </div>
              </div>
              <div className="mx-6 mb-[21px] flex flex-col gap-[11px]">
                <span className="flex items-center gap-2 text-[13px] text-[#5d728b]">
                  <i className="size-[7px] rounded-full bg-[#23a397]" />
                  Đã trao trả
                  <strong className="ml-auto font-semibold text-[#455974]">
                    {number(total.successful)}
                  </strong>
                </span>
                <span className="flex items-center gap-2 text-[13px] text-[#5d728b]">
                  <i className="size-[7px] rounded-full bg-[#e8eff4]" />
                  Chưa xác nhận trao trả
                  <strong className="ml-auto font-semibold text-[#455974]">
                    {number(total.matches - total.successful)}
                  </strong>
                </span>
              </div>
              <p className="mt-auto flex items-start gap-1.5 border-t border-[#dce5ef] px-[22px] py-3 text-xs leading-[1.8] text-[#65778f] max-[600px]:px-[17px]">
                <Icon name="info" size={14} className="mt-px shrink-0" />
                Tính trên các cặp ghép được tạo trong kỳ đã chọn; mỗi cặp chỉ được tính một lần.
              </p>
            </Panel>
          </div>

          <div className="grid grid-cols-2 items-start gap-5 max-[1200px]:grid-cols-1 max-[700px]:gap-4">
            <Panel
              title="Khu vực nổi bật"
              description="Xếp hạng theo số tin đăng trong kỳ"
              headingIcon="pin"
              badge={
                <span className="whitespace-nowrap rounded-[5px] bg-[#f3f6fa] px-2 py-[5px] text-xs text-[#5f7590]">
                  {report.areas.length} khu vực
                </span>
              }
            >
              <div className="px-[22px] pt-2 pb-3 max-[600px]:px-[17px]">
                {report.areas.map((row, index) => (
                  <button
                    key={row.name}
                    type="button"
                    className={cx(
                      'flex w-full items-center gap-[13px] border-b border-[#e0e8f1] py-[17px] text-left last:border-b-0 hover:bg-[#fbfcfe]',
                      focusRing
                    )}
                    onClick={() => setFilter('area', row.name)}
                    aria-label={`Lọc theo ${areaName(row.name)}`}
                    title={`Xem Dashboard tại ${areaName(row.name)}`}
                  >
                    <span
                      className={cx(
                        'grid size-[27px] shrink-0 place-items-center rounded-[6px] text-[13px] font-semibold',
                        index === 0 ? 'bg-[#edf3fc] text-[#497cba]' : 'bg-[#f5f7fa] text-[#8a9aaf]'
                      )}
                    >
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-baseline gap-[7px]">
                        <strong className="text-sm font-medium text-[#405770]">
                          {areaName(row.name)}
                        </strong>
                        <small className="text-[11px] text-[#6d7f95]">
                          {ADMIN_AREAS.find((area) => area.id === row.name)?.city}
                        </small>
                      </span>
                      <svg
                        viewBox="0 0 100 4"
                        preserveAspectRatio="none"
                        aria-hidden="true"
                        className="mt-2.5 block h-1 w-full overflow-hidden rounded-[3px] bg-[#f0f4f8]"
                      >
                        <rect
                          width={(row.posts / report.areas[0].posts) * 100}
                          height="4"
                          rx="2"
                          fill={index === 0 ? '#3976c6' : '#80a5d2'}
                        />
                      </svg>
                    </span>
                    <span className="flex min-w-[72px] flex-col gap-[5px] text-right">
                      <strong className="text-sm font-semibold text-[#405770]">
                        {number(row.posts)}
                      </strong>
                      <small className="text-[11px] text-[#6a7d96]">
                        {percent(total.posts ? (row.posts / total.posts) * 100 : null)}
                      </small>
                    </span>
                    <Icon name="next" size={14} className="text-[#b0bdd0]" />
                  </button>
                ))}
              </div>
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
                      <th className="bg-[#edf3fa] px-[22px] py-[11px] text-right text-xs font-medium whitespace-nowrap text-[#64778f]">
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
                        <td className="border-b border-[#e0e8f1] px-[22px] py-[13px] text-right whitespace-nowrap">
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
            <span className="flex items-center gap-[7px]">
              <Icon name="eye" size={15} />
              Thống kê report và khóa tài khoản chỉ để theo dõi.
            </span>
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
