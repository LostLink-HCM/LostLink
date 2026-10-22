import { cx } from './classes'

export const cell = 'border-b border-line px-2.5 py-3 align-middle [overflow-wrap:anywhere]'

const variants = {
  default: {
    container: 'rounded-xl border-line-strong shadow-card',
    table: 'table-fixed',
    heading: 'border-line-strong bg-surface-muted px-2.5 py-3 text-caption text-ink-muted',
  },
  admin: {
    container: 'border-[#b4c6db] shadow-[0_3px_10px_#16233a05]',
    table: '',
    heading: 'border-line-strong bg-[#eaf1f9] px-4 py-[17px] text-small text-[#4d6785]',
  },
}

export default function DataTable({
  caption,
  columns,
  minWidth,
  ariaLabel,
  variant = 'default',
  empty,
  children,
}) {
  const styles = variants[variant] || variants.default

  return (
    <div
      className={cx('overflow-x-auto rounded-xl border bg-surface', styles.container)}
      tabIndex={ariaLabel ? 0 : undefined}
      role={ariaLabel ? 'region' : undefined}
      aria-label={ariaLabel}
    >
      <table className={cx('w-full border-collapse text-left', styles.table, minWidth)}>
        <caption className="sr-only">{caption}</caption>
        <colgroup>
          {columns.map(([label, width]) => (
            <col key={label} className={width} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {columns.map(([label]) => (
              <th key={label} scope="col" className={cx('border-b font-semibold', styles.heading)}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&_tr:last-child_td]:border-b-0">{children}</tbody>
      </table>
      {empty}
    </div>
  )
}
