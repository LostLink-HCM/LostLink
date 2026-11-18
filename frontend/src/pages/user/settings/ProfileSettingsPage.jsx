import { useEffect, useId, useRef, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { changeAvatar, getMyProfile, updateProfile } from '../../../api/users'
import { useAuth } from '../../../auth/AuthContext'
import Avatar from '../../../components/user/Avatar'
import Button from '../../../components/user/Button'
import Card from '../../../components/user/Card'
import EmptyState from '../../../components/user/EmptyState'
import { cx } from '../../../components/user/classes'
import { inputClass, labelClass } from '../../../components/user/compose/styles'
import SettingsCard from '../../../components/user/settings/SettingsCard'
import { useProfileData } from '../../../hooks/useProfileData'
import { profilePath } from '../../../lib/user/profiles'
import { AVATAR_ACCEPT, BIO_MAX, validateAvatar, validateBio } from '../../../lib/user/settings'

const GENERIC_ERROR = 'Đã có lỗi xảy ra, vui lòng thử lại.'
const messageOf = (error, field) => {
  if (error.code === 'IMAGE_UPLOAD_FAILED') return error.message
  if (error.status >= 400 && error.status < 500) return error.fieldErrors?.[field] ?? error.message
  return GENERIC_ERROR
}

function AvatarCard({ username, avatarUrl, onSaved }) {
  const inputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview])

  const reset = () => {
    setFile(null)
    setPreview('')
  }

  const pick = (event) => {
    const [picked] = event.target.files
    event.target.value = ''
    if (!picked) return
    const problem = validateAvatar(picked)
    setError(problem)
    if (problem) return reset()
    setFile(picked)
    setPreview(URL.createObjectURL(picked))
  }

  const save = async () => {
    setBusy(true)
    try {
      const { data } = await changeAvatar(file)
      onSaved(data.avatarUrl)
      setError('')
      reset()
    } catch (failure) {
      setError(messageOf(failure, 'avatar'))
      reset()
    } finally {
      setBusy(false)
    }
  }

  return (
    <SettingsCard title="Ảnh đại diện" description="JPG, PNG hoặc WEBP, không quá 5 MB.">
      <div className="flex flex-wrap items-center gap-4">
        <Avatar
          initials={username.slice(0, 2).toUpperCase()}
          src={preview || avatarUrl}
          size="2xl"
        />
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept={AVATAR_ACCEPT}
            onChange={pick}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
          />
          <Button onClick={() => inputRef.current.click()} disabled={busy}>
            {file ? 'Chọn ảnh khác' : 'Đổi ảnh'}
          </Button>
          {file && (
            <>
              <Button onClick={reset} disabled={busy}>
                Hủy
              </Button>
              <Button variant="primary" onClick={save} disabled={busy}>
                Lưu thay đổi
              </Button>
            </>
          )}
        </div>
      </div>
      {error && (
        <p role="alert" className="m-0 mt-3 text-caption text-danger-ink">
          {error}
        </p>
      )}
    </SettingsCard>
  )
}

function BioCard({ bio, onSaved }) {
  const id = useId()
  const [value, setValue] = useState(bio)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const changed = value !== bio

  const submit = async (event) => {
    event.preventDefault()
    const problem = validateBio(value)
    setError(problem)
    if (problem) return

    setBusy(true)
    try {
      const { data } = await updateProfile({ bio: value })
      setValue(data.bio)
      onSaved(data.bio)
    } catch (failure) {
      setError(messageOf(failure, 'bio'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <SettingsCard title="Giới thiệu" description="Giúp người khác yên tâm khi liên hệ với bạn.">
      <form noValidate onSubmit={submit} className="flex flex-col gap-3">
        <div>
          <label htmlFor={id} className={labelClass}>
            Giới thiệu
          </label>
          <textarea
            id={id}
            rows={4}
            value={value}
            aria-invalid={error ? true : undefined}
            aria-describedby={`${id}-count${error ? ` ${id}-error` : ''}`}
            onChange={(event) => {
              setValue(event.target.value)
              setError('')
            }}
            className={cx(inputClass, 'resize-y py-2.5')}
          />
          <div className="mt-1.5 flex items-start justify-between gap-3">
            {error ? (
              <p id={`${id}-error`} role="alert" className="m-0 text-caption text-danger-ink">
                {error}
              </p>
            ) : (
              <span />
            )}
            <span
              id={`${id}-count`}
              className={cx(
                'shrink-0 text-caption',
                value.trim().length > BIO_MAX ? 'text-danger-ink' : 'text-ink-subtle'
              )}
            >
              {value.trim().length}/{BIO_MAX}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            onClick={() => {
              setValue(bio)
              setError('')
            }}
            disabled={!changed || busy}
          >
            Hủy
          </Button>
          <Button type="submit" variant="primary" disabled={!changed || busy}>
            Lưu thay đổi
          </Button>
        </div>
      </form>
    </SettingsCard>
  )
}
export default function ProfileSettingsPage() {
  const { user, updateUser } = useAuth()
  const { notify } = useOutletContext()
  const { data, loading, reload } = useProfileData(getMyProfile)
  const [bio, setBio] = useState(null)

  if (loading) {
    return (
      <div
        role="status"
        aria-label="Đang tải hồ sơ"
        className="h-64 animate-pulse rounded-2xl bg-line-subtle"
      />
    )
  }
  if (!data) {
    return (
      <Card className="pb-8">
        <EmptyState icon="warning" title="Không thể tải hồ sơ, vui lòng thử lại" />
        <div className="flex justify-center">
          <Button onClick={reload}>Thử lại</Button>
        </div>
      </Card>
    )
  }

  const savedBio = bio ?? data.profile.bio ?? ''

  return (
    <>
      <AvatarCard
        username={user.username}
        avatarUrl={user.avatarUrl}
        onSaved={(avatarUrl) => {
          updateUser({ avatarUrl })
          notify('Đổi ảnh đại diện thành công.')
        }}
      />
      <BioCard
        key={savedBio}
        bio={savedBio}
        onSaved={(next) => {
          setBio(next)
          notify('Cập nhật hồ sơ thành công.')
        }}
      />
      <p className="m-0 text-caption text-ink-muted">
        Xem hồ sơ của bạn tại{' '}
        <Link to={profilePath(user.username)} className="font-semibold text-primary">
          Trang cá nhân
        </Link>
        .
      </p>
    </>
  )
}
