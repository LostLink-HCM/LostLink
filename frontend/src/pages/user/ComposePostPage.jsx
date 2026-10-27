import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useOutletContext } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import Icon from '../../components/common/Icon'
import ClassifyStep from '../../components/user/compose/ClassifyStep'
import ContentStep from '../../components/user/compose/ContentStep'
import LocationStep from '../../components/user/compose/LocationStep'
import QuestionStep from '../../components/user/compose/QuestionStep'
import ReviewDialog from '../../components/user/compose/ReviewDialog'
import StepIndicator from '../../components/user/compose/StepIndicator'
import TimeStep from '../../components/user/compose/TimeStep'
import Button from '../../components/user/Button'
import { buttonClass } from '../../components/user/buttonClass'
import Card from '../../components/user/Card'
import Dialog from '../../components/user/Dialog'
import EmptyState from '../../components/user/EmptyState'
import {
  EMPTY_FORM,
  clearDraft,
  findInvalidStep,
  getSteps,
  loadDraft,
  prefillDescription,
  saveDraft,
  validateStep,
} from '../../lib/user/composePost'

const pageClass = 'mx-auto max-w-240 px-4 pt-5 pb-10 sm:px-6 lg:pt-7'

// Khoá lỗi tương ứng khi sửa một trường con
const LOCATION_ERROR_KEYS = { area: 'area' }
const QUESTION_ERROR_KEYS = { text: ['question'], skipped: ['question', 'options', 'correct'] }

let nextImageId = 0

const formatSavedAt = (iso) =>
  new Date(iso).toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  })

// Form Đăng bài nhiều bước. Phần giao diện: chưa gọi API, bản nháp lưu ở trình duyệt
export default function ComposePostPage() {
  const { user } = useAuth()
  const { notify } = useOutletContext()
  const navigate = useNavigate()

  // Có bản nháp thì nạp vào để đăng tiếp
  const [draft, setDraft] = useState(() => loadDraft(user.id))
  const [form, setForm] = useState(() => draft?.form ?? EMPTY_FORM)
  const [step, setStep] = useState(() => draft?.step ?? 0)
  const [reached, setReached] = useState(() => draft?.step ?? 0)
  const [errors, setErrors] = useState({})
  const [reviewing, setReviewing] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [errorTick, setErrorTick] = useState(0)
  const formRef = useRef(null)

  // Thu hồi URL xem trước của ảnh khi rời trang
  const imagesRef = useRef(form.images)
  useEffect(() => {
    imagesRef.current = form.images
  }, [form.images])
  useEffect(() => () => imagesRef.current.forEach((image) => URL.revokeObjectURL(image.url)), [])

  // Sau mỗi lần báo lỗi, cuộn tới chỗ thiếu đầu tiên (lỗi nằm ngay dưới trường của nó)
  useEffect(() => {
    if (!errorTick) return
    const firstError = formRef.current?.querySelector('[role="alert"]')
    if (!firstError) return
    const field = firstError.id
      ? formRef.current.querySelector(`[aria-describedby~="${firstError.id}"]`)
      : null
    const target = field ?? firstError.previousElementSibling ?? firstError
    target.scrollIntoView({ behavior: 'smooth', block: 'center' })
    field?.focus({ preventScroll: true })
  }, [errorTick])

  const steps = getSteps(form.type)
  const current = Math.min(step, steps.length - 1)
  const stepKey = steps[current].key
  const isLast = current === steps.length - 1

  // Tài khoản bị hạn chế không được đăng bài
  if (user.status === 'restricted') {
    return (
      <div className={pageClass}>
        <Card className="pb-8">
          <EmptyState
            icon="lock"
            title="Tài khoản tạm thời không được đăng bài"
            description="Tài khoản của bạn đang bị hạn chế, vui lòng chờ Moderator xử lý."
          />
          <div className="flex justify-center">
            <Link to="/" className={buttonClass({ size: 'xl' })}>
              Về trang chủ
            </Link>
          </div>
        </Card>
      </div>
    )
  }

  const clearErrors = (keys) =>
    setErrors((prev) => {
      if (!keys.some((key) => key in prev)) return prev
      const next = { ...prev }
      keys.forEach((key) => delete next[key])
      return next
    })

  const update = (patch) => {
    setForm((prev) => ({ ...prev, ...patch }))
    clearErrors(Object.keys(patch))
  }

  const updateLocation = (patch) => {
    setForm((prev) => ({ ...prev, location: { ...prev.location, ...patch } }))
    clearErrors(Object.keys(patch).map((key) => LOCATION_ERROR_KEYS[key] ?? 'location'))
  }

  const updateQuestion = (patch) => {
    setForm((prev) => ({ ...prev, question: { ...prev.question, ...patch } }))
    clearErrors(Object.keys(patch).flatMap((key) => QUESTION_ERROR_KEYS[key] ?? [key]))
  }

  const addImages = (files) => {
    const added = files.map((file) => ({
      id: `img-${(nextImageId += 1)}`,
      url: URL.createObjectURL(file),
      name: file.name,
      file,
    }))
    setForm((prev) => ({ ...prev, images: [...prev.images, ...added] }))
  }

  const removeImage = (id) => {
    const image = form.images.find((item) => item.id === id)
    if (image) URL.revokeObjectURL(image.url)
    setForm((prev) => ({ ...prev, images: prev.images.filter((item) => item.id !== id) }))
  }

  const goTo = (index) => {
    if (steps[index]?.key === 'content') {
      const prefill = prefillDescription(form)
      if (prefill) setForm((prev) => ({ ...prev, ...prefill }))
    }
    setStep(index)
    setReached((prev) => Math.max(prev, index))
    setErrors({})
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const showErrors = (nextErrors) => {
    setErrors(nextErrors)
    setErrorTick((tick) => tick + 1)
  }

  // Kiểm tra toàn bộ, thiếu ở đâu thì quay về bước đó
  const openReview = (target = form) => {
    const invalid = findInvalidStep(target)
    if (invalid) {
      setStep(invalid.index)
      showErrors(invalid.errors)
      notify(`Bước "${getSteps(target.type)[invalid.index].label}" còn thiếu thông tin.`)
      return
    }
    setReviewing(true)
  }

  const next = () => {
    const stepErrors = validateStep(stepKey, form)
    if (Object.keys(stepErrors).length) {
      showErrors(stepErrors)
      return
    }
    if (isLast) openReview()
    else goTo(current + 1)
  }

  const back = () => (current === 0 ? navigate('/') : goTo(current - 1))

  // Bỏ qua câu hỏi thì sang xem lại luôn
  const skipQuestion = () => {
    const target = { ...form, question: { ...form.question, skipped: true } }
    setForm(target)
    setErrors({})
    openReview(target)
  }

  // Lưu nháp ở bất kỳ bước nào rồi kết thúc
  const handleSaveDraft = () => {
    if (!saveDraft(user.id, form, current)) {
      notify('Không lưu được bản nháp, vui lòng thử lại.')
      return
    }
    notify(
      form.images.length
        ? 'Đã lưu nháp. Ảnh chưa được lưu kèm, bạn chọn lại khi đăng tiếp nhé.'
        : 'Đã lưu nháp. Mở lại Đăng bài để đăng tiếp.'
    )
    navigate('/')
  }

  const discardDraft = () => {
    clearDraft(user.id)
    form.images.forEach((image) => URL.revokeObjectURL(image.url))
    setDraft(null)
    setForm(EMPTY_FORM)
    setStep(0)
    setReached(0)
    setErrors({})
    setConfirmDiscard(false)
  }

  // Chưa có API tạo bài: giả lập lưu thành công, bài chờ Moderator duyệt
  const submit = () => {
    clearDraft(user.id)
    setReviewing(false)
    notify('Đăng bài thành công! Bài đang chờ Moderator duyệt.')
    navigate('/')
  }

  const editFromReview = (index) => {
    setReviewing(false)
    goTo(index)
  }

  return (
    <div className={pageClass}>
      <h1 className="m-0 text-heading font-bold tracking-tight text-ink">Đăng bài mới</h1>
      <p className="m-0 mt-1 mb-5 text-small text-ink-muted">
        Bài mới sẽ được Moderator duyệt trước khi hiển thị công khai.
      </p>

      {draft && (
        <div
          role="status"
          className="mb-4 flex flex-col gap-2.5 rounded-xl border border-primary/20 bg-primary-subtle px-4 py-3 text-small text-ink-secondary sm:flex-row sm:items-center"
        >
          <span className="flex items-center gap-2.5">
            <Icon name="history" size={16} className="shrink-0 text-primary" />
            <span>
              Đang tiếp tục bản nháp lưu lúc{' '}
              <strong className="font-semibold text-ink">{formatSavedAt(draft.savedAt)}</strong>.
            </span>
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirmDiscard(true)}
            className="self-start sm:ml-auto sm:self-auto"
          >
            <Icon name="trash" size={14} />
            Bỏ bản nháp
          </Button>
        </div>
      )}

      <StepIndicator steps={steps} current={current} reached={reached} onSelect={goTo} />

      <form
        ref={formRef}
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          next()
        }}
      >
        <Card className="p-5 sm:p-7">
          {stepKey === 'classify' && <ClassifyStep form={form} errors={errors} onChange={update} />}
          {stepKey === 'content' && (
            <ContentStep
              form={form}
              errors={errors}
              onChange={update}
              onAddImages={addImages}
              onRemoveImage={removeImage}
            />
          )}
          {stepKey === 'time' && <TimeStep form={form} errors={errors} onChange={update} />}
          {stepKey === 'location' && (
            <LocationStep
              type={form.type}
              location={form.location}
              errors={errors}
              onChange={updateLocation}
            />
          )}
          {stepKey === 'question' && (
            <QuestionStep
              question={form.question}
              errors={errors}
              onChange={updateQuestion}
              onSkip={skipQuestion}
            />
          )}
        </Card>

        <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button size="xl" onClick={back}>
            <Icon name="back" size={16} />
            {current === 0 ? 'Huỷ' : 'Quay lại'}
          </Button>
          <div className="flex gap-3">
            <Button size="xl" onClick={handleSaveDraft} className="flex-1 sm:flex-none">
              Lưu nháp
            </Button>
            <Button type="submit" variant="primary" size="xl" className="flex-1 sm:flex-none">
              {isLast ? 'Xem lại & đăng bài' : 'Tiếp tục'}
              <Icon name="next" size={16} />
            </Button>
          </div>
        </div>
      </form>

      {reviewing && (
        <ReviewDialog
          form={form}
          onEdit={editFromReview}
          onClose={() => setReviewing(false)}
          onSubmit={submit}
        />
      )}

      {confirmDiscard && (
        <Dialog
          title="Bỏ bản nháp?"
          size="sm"
          onClose={() => setConfirmDiscard(false)}
          footer={
            <>
              <Button onClick={() => setConfirmDiscard(false)}>Giữ lại</Button>
              <Button variant="danger" onClick={discardDraft}>
                Bỏ bản nháp
              </Button>
            </>
          }
        >
          <p className="m-0 text-small text-ink-secondary">
            Nội dung đã lưu sẽ bị xoá và form trở về trống. Không thể hoàn tác.
          </p>
        </Dialog>
      )}
    </div>
  )
}
