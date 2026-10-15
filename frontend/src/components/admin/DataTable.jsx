import { cx } from '../moderator/classes'

export default function DataTable({
  caption,
  columns,
  minWidth = 'min-w-0',
  ariaLabel,
  empty,
  children,
}) {
  return (
    <div
      className="overflow-x-auto rounded-xl border border-[#b4c6db] bg-surface shadow-[0_3px_10px_#16233a05]"
      tabIndex={0}
      role="region"
      aria-label={ariaLabel}
    >
      <table className={cx('w-full border-collapse text-left', minWidth)}>
        <caption className="sr-only">{caption}</caption>
        <colgroup>
          {columns.map(([label, width]) => (
            <col key={label} className={width} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {columns.map(([label]) => (
              <th
                key={label}
                scope="col"
                className="border-b border-line-strong bg-[#eaf1f9] px-4 py-[17px] text-small font-semibold text-[#4d6785]"
              >
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
