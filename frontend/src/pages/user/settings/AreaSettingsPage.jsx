import { useState } from 'react'
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom'
import Icon from '../../../components/common/Icon'
import Button from '../../../components/user/Button'
import Dialog from '../../../components/user/Dialog'
import IconButton from '../../../components/user/IconButton'
import Switch from '../../../components/user/Switch'
import AreaEditor from '../../../components/user/settings/AreaEditor'
import SettingsCard from '../../../components/user/settings/SettingsCard'
import { DEFAULT_RADIUS, formatRadius, validateArea } from '../../../lib/user/settings'

const NEW_AREA = { name: '', point: null, radius: DEFAULT_RADIUS }

let nextAreaId = 0

// Mục Khu vực để ý: bật/tắt và thêm vùng chỉ lưu khi bấm "Lưu thay đổi", xóa thì lưu ngay
export default function AreaSettingsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { watchAreas, setWatchAreas, notify } = useOutletContext()
  const [draft, setDraft] = useState(watchAreas)
  const [adding, setAdding] = useState(null)
  const [error, setError] = useState('')
  const [removing, setRemoving] = useState(null)

  const dirty = adding !== null || JSON.stringify(draft) !== JSON.stringify(watchAreas)

  const toggle = (id) =>
    setDraft((prev) =>
      prev.map((area) => (area.id === id ? { ...area, active: !area.active } : area))
    )

  const updateNew = (patch) => {
    setAdding((prev) => ({ ...prev, ...patch }))
    setError('')
  }

  const save = () => {
    let next = draft
    if (adding) {
      const problem = validateArea(adding)
      setError(problem)
      if (problem) return
      next = [
        ...draft,
        {
          id: `area-new-${(nextAreaId += 1)}`,
          name: adding.name.trim() || 'Khu vực mới',
          point: adding.point,
          radius: adding.radius,
          active: true,
        },
      ]
    }
    setWatchAreas(next)
    setDraft(next)
    setAdding(null)
    notify('Đã lưu khu vực theo dõi.')
  }

  // Thoát không lưu, quay về trang trước nếu có
  const exit = () => {
    setDraft(watchAreas)
    setAdding(null)
    setError('')
    if (location.key !== 'default') navigate(-1)
  }

  // Xóa sau khi xác nhận và lưu ngay
  const confirmRemove = () => {
    const keep = (list) => list.filter((area) => area.id !== removing.id)
    setWatchAreas(keep)
    setDraft(keep)
    notify(`Đã xóa khu vực ${removing.name}.`)
    setRemoving(null)
  }

  return (
    <>
      <SettingsCard
        title="Khu vực để ý"
        description="Khi có bài mới được duyệt trong các khu vực đang bật, LostLink sẽ báo cho bạn."
        actions={
          !adding && (
            <Button size="lg" onClick={() => setAdding(NEW_AREA)}>
              <Icon name="plus" size={15} />
              Thêm khu vực
            </Button>
          )
        }
      >
        {draft.length === 0 && !adding ? (
          <p className="m-0 text-caption text-ink-muted">Bạn chưa theo dõi khu vực nào.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col p-0">
            {draft.map((area) => (
              <li
                key={area.id}
                className="flex items-center gap-2 border-t border-line-subtle py-1.5 first:border-t-0"
              >
                <div className="min-w-0 flex-1">
                  <Switch
                    label={
                      <>
                        <span className="block truncate text-small font-semibold text-ink">
                          {area.name}
                        </span>
                        <span className="block text-tiny text-ink-muted">
                          Bán kính {formatRadius(area.radius)} ·{' '}
                          {area.active ? 'Đang bật' : 'Đang tắt'}
                        </span>
                      </>
                    }
                    checked={area.active}
                    onChange={() => toggle(area.id)}
                  />
                </div>
                <IconButton
                  icon="trash"
                  label={`Xóa khu vực ${area.name}`}
                  tone="danger"
                  onClick={() => setRemoving(area)}
                />
              </li>
            ))}
          </ul>
        )}

        {adding && (
          <div className="mt-4">
            <h3 className="m-0 mb-3 text-body font-bold text-ink">Khu vực mới</h3>
            <AreaEditor value={adding} onChange={updateNew} error={error} />
          </div>
        )}
      </SettingsCard>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button size="xl" onClick={exit}>
          Thoát
        </Button>
        <Button variant="primary" size="xl" disabled={!dirty} onClick={save}>
          Lưu thay đổi
        </Button>
      </div>

      {removing && (
        <Dialog
          title="Xóa khu vực này?"
          size="sm"
          onClose={() => setRemoving(null)}
          footer={
            <>
              <Button onClick={() => setRemoving(null)} data-autofocus>
                Hủy
              </Button>
              <Button variant="danger" onClick={confirmRemove}>
                Xóa khu vực
              </Button>
            </>
          }
        >
          <p className="m-0 text-small leading-relaxed text-ink-secondary">
            Bạn sẽ không nhận thông báo về bài mới quanh <strong>{removing.name}</strong> nữa.
          </p>
        </Dialog>
      )}
    </>
  )
}
