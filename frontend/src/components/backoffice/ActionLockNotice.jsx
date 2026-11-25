export default function ActionLockNotice({ message }) {
  if (!message) return null

  return (
    <p role="status" aria-live="polite" className="mb-3 text-body font-semibold text-warning">
      {message}
    </p>
  )
}
