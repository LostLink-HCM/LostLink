import { cx } from './classes'

// Class cho ô dữ liệu, các trang dùng trong <td className={cell}>
export const cell = 'border-b border-line px-2.5 py-3 align-middle [overflow-wrap:anywhere]'

// columns: [[tiêu đề, class độ rộng]], vd [['ID', 'w-[10%]']]. children là các <tr>
export default function DataTable({ caption, columns, minWidth, empty, children }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line-strong bg-surface shadow-card">
      <table className={cx('w-full table-fixed border-collapse text-left', minWidth)}>
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
                className="border-b border-line-strong bg-surface-muted px-2.5 py-3 text-caption font-semibold text-ink-muted"
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
