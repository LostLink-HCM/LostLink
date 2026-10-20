// Icon danh mục, nét vẽ theo currentColor

const paths = {
  'Tất cả': (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </>
  ),
  'Giấy tờ & thẻ': (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8" cy="10.5" r="1.8" />
      <path d="M13 9.5h5M13 13h5M6 15.5h6" />
    </>
  ),
  'Ví & tiền': (
    <>
      <path d="M4 7a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
      <path d="M16 11h3.5a1 1 0 0 1 1 1v1.5a1 1 0 0 1-1 1H16a1.75 1.75 0 0 1 0-3.5z" />
    </>
  ),
  'Túi & balo': (
    <>
      <path d="M6 8h12l1 12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z" />
      <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
    </>
  ),
  'Thiết bị điện tử': (
    <>
      <rect x="6.5" y="3" width="11" height="18" rx="2.5" />
      <path d="M10.5 18h3" />
    </>
  ),
  'Chìa khóa & xe cộ': (
    <>
      <circle cx="8" cy="8" r="4" />
      <path d="M10.8 10.8 20 20M17 17l2-2M15 15l2-2" />
    </>
  ),
  'Trang sức & phụ kiện': (
    <>
      <path d="M6 4h12l3 5-9 11L3 9z" />
      <path d="M3 9h18M9 4 7.5 9 12 20 16.5 9 15 4" />
    </>
  ),
  'Thú cưng': (
    <>
      <ellipse cx="12" cy="16" rx="3.5" ry="3" />
      <circle cx="6.5" cy="11.5" r="1.6" />
      <circle cx="17.5" cy="11.5" r="1.6" />
      <circle cx="9.5" cy="7.5" r="1.6" />
      <circle cx="14.5" cy="7.5" r="1.6" />
    </>
  ),
  Khác: (
    <>
      <path d="M4 8 12 4l8 4-8 4z" />
      <path d="M4 8v8l8 4 8-4V8M12 12v8" />
    </>
  ),
}

export default function CategoryIcon({ name, size = 18, className }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {paths[name] || paths['Khác']}
    </svg>
  )
}
