export default function Notice({ children }) {
  return (
    <p
      role="status"
      className="mb-3.5 rounded-lg border border-primary-soft bg-primary-subtle px-4 py-3 text-small leading-relaxed text-primary [overflow-wrap:anywhere]"
    >
      {children}
    </p>
  )
}
