import { useState } from 'react'
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom'
import { createArea, deleteArea, listAreas, updateArea } from '../../../api/users'
import Icon from '../../../components/common/Icon'
import Button from '../../../components/user/Button'
import Card from '../../../components/user/Card'
import Dialog from '../../../components/user/Dialog'
import EmptyState from '../../../components/user/EmptyState'
import IconButton from '../../../components/user/IconButton'
import Switch from '../../../components/user/Switch'
import AreaEditor from '../../../components/user/settings/AreaEditor'
import SettingsCard from '../../../components/user/settings/SettingsCard'
import { useProfileData } from '../../../hooks/useProfileData'
import { DEFAULT_RADIUS, formatRadius, validateArea } from '../../../lib/user/settings'

const NEW_AREA = { name: '', point: null, radius: DEFAULT_RADIUS }
const SAVED = 'Đã lưu khu vực theo dõi.'
const FAILED = 'Đã có lỗi xảy ra, vui lòng thử lại.'

const areaName = (area) => area.name || 'Khu vực không tên'

// Mục Khu vực để ý: bật/tắt và thêm vùng chỉ lưu khi bấm "Lưu thay đổi", xóa thì lưu ngay
export default function AreaSettingsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { notify } = useOutletContext()
  const { data, loading, reload } = useProfileData(listAreas)
  // Danh sách đã lưu trên server, cập nhật tại chỗ sau mỗi lần lưu
  const [saved, setSaved] = useState(null)
  // Công tắc đã đổi nhưng chưa lưu: id → active
  const [toggled, setToggled] = useState({})
  const [adding, setAdding] = useState(null)
  const [error, setError] = useState('')
  const [removing, setRemoving] = useState(null)
  const [saving, setSaving] = useState(false)

  const areas = saved ?? data?.items ?? null

  if (loading) {
    return (
      <div
        role="status"
        aria-label="Đang tải khu vực để ý"
        className="h-64 animate-pulse rounded-2xl bg-line-subtle"
      />
    )
  }
  if (!areas) {
    return (
      <Card className="pb-8">
        <EmptyState icon="warning" title="Không thể tải khu vực để ý, vui lòng thử lại" />
        <div className="flex justify-center">
          <Button onClick={reload}>Thử lại</Button>
        </div>
      </Card>
    )
  }

  const activeOf = (area) => toggled[area.id] ?? area.active
  const changed = areas.filter((area) => activeOf(area) !== area.active)
  const dirty = adding !== null || changed.length > 0
  const limitReached = areas.length >= (data?.max ?? Infinity)

  const toggle = (area) => {
    const next = !activeOf(area)
    setToggled((prev) => {
      const { [area.id]: _old, ...rest } = prev
      return next === area.active ? rest : { ...rest, [area.id]: next }
    })
  }

  const updateNew = (patch) => {
    setAdding((prev) => ({ ...prev, ...patch }))
    setError('')
  }

  const save = async () => {
    if (adding) {
      const problem = validateArea(adding)
      setError(problem)
      if (problem) return
    }
    setSaving(true)
    try {
      const updated = await Promise.all(
        changed.map((area) => updateArea(area.id, activeOf(area)).then((res) => res.data))
      )
      const byId = new Map(updated.map((area) => [area.id, area]))
      let next = areas.map((area) => byId.get(area.id) ?? area)
      if (adding) {
        const { data: created } = await createArea({
          name: adding.name.trim(),
          lat: adding.point.lat,
          lng: adding.point.lng,
          radius: adding.radius,
        })
        next = [...next, created]
      }
      setSaved(next)
      setToggled({})
      setAdding(null)
      notify(SAVED)
    } catch (err) {
      // Lỗi dữ liệu thì hiện dưới ô nhập, lỗi khác giữ nguyên danh sách
      if (err.status === 422 || err.status === 409)
        setError(err.details?.[0]?.message ?? err.message)
      else notify(FAILED)
    } finally {
      setSaving(false)
    }
  }

  // Thoát không lưu, quay về trang trước nếu có
  const exit = () => {
    setToggled({})
    setAdding(null)
    setError('')
    if (location.key !== 'default') navigate(-1)
  }

  // Xóa sau khi xác nhận và lưu ngay
  const confirmRemove = async () => {
    const target = removing
    setRemoving(null)
    try {
      await deleteArea(target.id)
      setSaved(areas.filter((area) => area.id !== target.id))
      setToggled(({ [target.id]: _removed, ...rest }) => rest)
      notify(SAVED)
    } catch {
      notify(FAILED)
    }
  }

  return (
    <>
      <SettingsCard
        title="Khu vực để ý"
        description="Khi có bài mới được duyệt trong các khu vực đang bật, LostLink sẽ báo cho bạn."
        actions={
          !adding && (
            <Button
              size="lg"
              disabled={limitReached}
              title={limitReached ? `Bạn đã theo dõi tối đa ${data.max} khu vực` : undefined}
              onClick={() => setAdding(NEW_AREA)}
            >
              <Icon name="plus" size={15} />
              Thêm khu vực
            </Button>
          )
        }
      >
        {areas.length === 0 && !adding ? (
          <p className="m-0 text-caption text-ink-muted">Bạn chưa theo dõi khu vực nào.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col p-0">
            {areas.map((area) => (
              <li
                key={area.id}
                className="flex items-center gap-2 border-t border-line-subtle py-1.5 first:border-t-0"
              >
                <div className="min-w-0 flex-1">
                  <Switch
                    label={
                      <>
                        <span className="block truncate text-small font-semibold text-ink">
                          {areaName(area)}
                        </span>
                        <span className="block text-tiny text-ink-muted">
                          Bán kính {formatRadius(area.radius)} ·{' '}
                          {activeOf(area) ? 'Đang bật' : 'Đang tắt'}
                        </span>
                      </>
                    }
                    checked={activeOf(area)}
                    onChange={() => toggle(area)}
                  />
                </div>
                <IconButton
                  icon="trash"
                  label={`Xóa khu vực ${areaName(area)}`}
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
        {!adding && error && (
          <p role="alert" className="m-0 mt-3 text-caption text-danger-ink">
            {error}
          </p>
        )}
      </SettingsCard>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button size="xl" onClick={exit}>
          Thoát
        </Button>
        <Button variant="primary" size="xl" disabled={!dirty || saving} onClick={save}>
          {saving ? 'Đang lưu…' : 'Lưu thay đổi'}
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
            Bạn sẽ không nhận thông báo về bài mới quanh <strong>{areaName(removing)}</strong> nữa.
          </p>
        </Dialog>
      )}
    </>
  )
}
