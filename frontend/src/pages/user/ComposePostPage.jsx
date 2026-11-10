import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useOutletContext } from 'react-router-dom'
import { listCategories } from '../../api/categories'
import {
  createPost,
  deleteDraft,
  getDraft,
  getPostForEdit,
  saveDraft,
  updatePost,
} from '../../api/posts'
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
import Note from '../../components/user/Note'
import { postPath } from '../../lib/user/homeFeed'
import {
  EMPTY_FORM,
  buildPostForm,
  clearLocalDraft,
  findInvalidStep,
  formFromPost,
  getSteps,
  isFormEmpty,
  loadLocalDraft,
  mapApiErrors,
  moveToCover,
  prefillDescription,
  reconcileClassification,
  restoreDraft,
  serializeDraft,
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

// Lỗi khi mở form Sửa bài, theo mã HTTP
const EDIT_LOAD_ERRORS = {
  403: { icon: 'lock', title: 'Bạn không có quyền sửa bài này' },
  404: { icon: 'search', title: 'Không tìm thấy bài đăng', description: 'Bài đăng không tồn tại.' },
  409: {
    icon: 'lock',
    title: 'Không thể sửa bài ở trạng thái hiện tại',
    description: 'Chỉ sửa được bài Chờ duyệt, Bị từ chối hoặc Đang tìm.',
  },
}

// Form Đăng bài nhiều bước, bản nháp lưu trên server (không kèm ảnh).
// mode="edit" là form Sửa bài postId, không có bản nháp
export default function ComposePostPage({ mode = 'create', postId = null }) {
  const { user } = useAuth()
  const { notify } = useOutletContext()
  const navigate = useNavigate()
  const editing = mode === 'edit'

  // Tải bản nháp xong mới hiện form để không ghi đè chữ đang gõ
  const [draft, setDraft] = useState(null)
  const [draftLoading, setDraftLoading] = useState(!editing)
  // Sửa bài: bài từ API, lỗi khi tải, số lần thử lại
  const [editState, setEditState] = useState({ post: null, error: null, retry: 0 })
  // Bài đã đổ vào form (chỉ đổ một lần)
  const [filledFrom, setFilledFrom] = useState(null)
  const [savingDraft, setSavingDraft] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [step, setStep] = useState(0)
  const [reached, setReached] = useState(0)
  const [errors, setErrors] = useState({})
  const [reviewing, setReviewing] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [errorTick, setErrorTick] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [categories, setCategories] = useState({ status: 'loading', items: [] })
  const formRef = useRef(null)

  // Để bản nháp nạp sau danh mục vẫn được đối chiếu
  const categoriesRef = useRef(null)

  // Danh mục, thuộc tính trong bản nháp không còn tồn tại thì bỏ
  const fetchCategories = useCallback(
    () =>
      listCategories()
        .then(({ data }) => {
          categoriesRef.current = data
          setCategories({ status: 'ready', items: data })
          setForm((prev) => {
            const patch = reconcileClassification(prev, data)
            return patch ? { ...prev, ...patch } : prev
          })
        })
        .catch(() => setCategories({ status: 'error', items: [] })),
    []
  )

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  // Sửa bài: tải dữ liệu hiện tại của bài
  useEffect(() => {
    if (!editing) return undefined
    let active = true
    getPostForEdit(postId)
      .then(({ data }) => active && setEditState((prev) => ({ ...prev, post: data, error: null })))
      .catch((error) => active && setEditState((prev) => ({ ...prev, post: null, error })))
    return () => {
      active = false
    }
  }, [editing, postId, editState.retry])

  // Có đủ bài và danh mục thì đổ vào form
  const editPost = editState.post
  if (editPost && categories.status === 'ready' && filledFrom !== editPost) {
    setFilledFrom(editPost)
    setForm(formFromPost(editPost, categories.items))
  }

  // Nạp bản nháp trên server; chưa có mà trình duyệt còn bản nháp cũ thì nạp bản đó
  useEffect(() => {
    if (editing) return undefined
    let active = true
    const apply = (restored) => {
      const categoryItems = categoriesRef.current
      const patch = categoryItems && reconcileClassification(restored.form, categoryItems)
      setForm(patch ? { ...restored.form, ...patch } : restored.form)
      setStep(restored.step)
      setReached(restored.step)
      setDraft({ savedAt: restored.savedAt })
    }
    getDraft()
      .then(({ data }) => {
        if (!active) return
        const restored = data ? restoreDraft(data) : loadLocalDraft(user.id)
        if (restored) apply(restored)
      })
      .catch(() => {
        if (!active) return
        const local = loadLocalDraft(user.id)
        if (local) apply(local)
        else notify('Không tải được bản nháp, bạn vẫn có thể soạn bài mới.')
      })
      .finally(() => active && setDraftLoading(false))
    return () => {
      active = false
    }
  }, [user.id, notify, editing])

  const retryCategories = () => {
    setCategories({ status: 'loading', items: [] })
    fetchCategories()
  }

  const category = categories.items.find((item) => item.slug === form.category)

  // Thu hồi URL xem trước của ảnh mới khi rời trang
  const imagesRef = useRef(form.images)
  useEffect(() => {
    imagesRef.current = form.images
  }, [form.images])
  useEffect(
    () => () =>
      imagesRef.current
        .filter((image) => image.file)
        .forEach((image) => URL.revokeObjectURL(image.url)),
    []
  )

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
            title={
              editing
                ? 'Tài khoản tạm thời không được sửa bài'
                : 'Tài khoản tạm thời không được đăng bài'
            }
            description="Tài khoản của bạn đang bị hạn chế, vui lòng chờ LostLink xử lý."
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

  if (editing && editState.error) {
    const known = EDIT_LOAD_ERRORS[editState.error.status]
    return (
      <div className={pageClass}>
        <Card className="pb-8">
          <EmptyState
            icon={known?.icon ?? 'warning'}
            title={known?.title ?? 'Không thể tải bài đăng, vui lòng thử lại.'}
            description={known?.description}
          />
          <div className="flex justify-center gap-3">
            {!known && (
              <Button
                size="xl"
                onClick={() => setEditState((prev) => ({ ...prev, retry: prev.retry + 1 }))}
              >
                Thử lại
              </Button>
            )}
            <Button size="xl" onClick={() => navigate(-1)}>
              Quay lại
            </Button>
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

  // patch là object hoặc hàm nhận vị trí mới nhất
  const updateLocation = (patch) => {
    setForm((prev) => {
      const changes = typeof patch === 'function' ? patch(prev.location) : patch
      return { ...prev, location: { ...prev.location, ...changes } }
    })
    clearErrors(
      typeof patch === 'function'
        ? ['location']
        : Object.keys(patch).map((key) => LOCATION_ERROR_KEYS[key] ?? 'location')
    )
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
    if (image?.file) URL.revokeObjectURL(image.url)
    setForm((prev) => ({ ...prev, images: prev.images.filter((item) => item.id !== id) }))
  }

  const makeCover = (id) => setForm((prev) => ({ ...prev, images: moveToCover(prev.images, id) }))

  const goTo = (index) => {
    if (steps[index]?.key === 'content') {
      const prefill = prefillDescription(form, category)
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
    const invalid = findInvalidStep(target, category)
    if (invalid) {
      setStep(invalid.index)
      showErrors(invalid.errors)
      notify(`Bước "${getSteps(target.type)[invalid.index].label}" còn thiếu thông tin.`)
      return
    }
    setReviewing(true)
  }

  const next = () => {
    const stepErrors = validateStep(stepKey, form, category)
    if (Object.keys(stepErrors).length) {
      showErrors(stepErrors)
      return
    }
    if (isLast) openReview()
    else goTo(current + 1)
  }

  // Huỷ sửa bài thì về trang chi tiết bài
  const cancel = () => navigate(editing && editPost ? postPath(editPost) : '/')
  const back = () => (current === 0 ? cancel() : goTo(current - 1))

  // Bỏ qua câu hỏi thì sang xem lại luôn
  const skipQuestion = () => {
    const target = { ...form, question: { ...form.question, skipped: true } }
    setForm(target)
    setErrors({})
    openReview(target)
  }

  // Lưu nháp (trừ ảnh) rồi về Trang chủ; lỗi thì giữ nguyên form
  const handleSaveDraft = async () => {
    if (isFormEmpty(form)) {
      notify('Chưa có nội dung để lưu nháp.')
      return
    }
    setSavingDraft(true)
    try {
      await saveDraft({ step: current, form: serializeDraft(form) })
      clearLocalDraft(user.id)
      notify(
        form.images.length
          ? 'Đã lưu nháp. Ảnh không được lưu trong bản nháp, vui lòng chọn lại ảnh khi đăng tiếp.'
          : 'Đã lưu nháp.'
      )
      navigate('/')
    } catch (error) {
      notify(error.code === 'DRAFT_EMPTY' ? error.message : 'Đã có lỗi xảy ra, vui lòng thử lại.')
    } finally {
      setSavingDraft(false)
    }
  }

  const discardDraft = async () => {
    try {
      await deleteDraft()
    } catch {
      notify('Đã có lỗi xảy ra, vui lòng thử lại.')
      return
    }
    clearLocalDraft(user.id)
    form.images.forEach((image) => URL.revokeObjectURL(image.url))
    setDraft(null)
    setForm(EMPTY_FORM)
    setStep(0)
    setReached(0)
    setErrors({})
    setConfirmDiscard(false)
  }

  // Đăng xong về Trang chủ, sửa xong về chi tiết bài. Lỗi field nào thì quay về bước đó
  const submit = async () => {
    setSubmitting(true)
    try {
      if (editing) {
        const { data } = await updatePost(postId, buildPostForm(form, { edit: true }))
        setReviewing(false)
        notify('Đã lưu thay đổi, bài đang chờ LostLink duyệt lại.')
        navigate(postPath(data))
        return
      }
      // Server tự xoá bản nháp khi đăng thành công
      await createPost(buildPostForm(form))
      clearLocalDraft(user.id)
      setReviewing(false)
      notify('Đăng bài thành công! Bài đang chờ LostLink duyệt.')
      navigate('/')
    } catch (error) {
      setReviewing(false)
      const mapped = mapApiErrors(error.details ?? [])
      if (mapped) {
        const index = steps.findIndex((item) => item.key === mapped.stepKey)
        if (index >= 0) {
          setStep(index)
          showErrors(mapped.errors)
        }
      }
      notify(
        error.message ||
          (editing
            ? 'Đã có lỗi xảy ra, vui lòng thử lại.'
            : 'Không đăng được bài, vui lòng thử lại.')
      )
    } finally {
      setSubmitting(false)
    }
  }

  const editFromReview = (index) => {
    setReviewing(false)
    goTo(index)
  }

  return (
    <div className={pageClass}>
      <h1 className="m-0 text-heading font-bold tracking-tight text-ink">
        {editing ? 'Sửa bài đăng' : 'Đăng bài mới'}
      </h1>
      <p className="m-0 mt-1 mb-4 text-small text-ink-muted">
        {editing
          ? 'Bài sẽ được LostLink duyệt lại sau khi sửa và tạm ẩn cho tới khi được duyệt.'
          : 'Bài mới sẽ được LostLink duyệt trước khi hiển thị công khai.'}{' '}
        Mục có dấu{' '}
        <span aria-hidden="true" className="text-danger">
          *
        </span>
        <span className="sr-only">sao</span> là bắt buộc.
      </p>

      {editPost?.rejectReason && (
        <Note icon="warning" tone="warning" className="mb-4">
          Bài bị từ chối: {editPost.rejectReason}. Sửa lại rồi lưu để gửi LostLink duyệt lại.
        </Note>
      )}

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

      {draftLoading || (editing && !filledFrom) ? (
        <Card className="p-4 sm:p-6">
          <p role="status" className="m-0 py-10 text-center text-small text-ink-muted">
            {editing ? 'Đang tải bài đăng…' : 'Đang tải bản nháp…'}
          </p>
          {editing && categories.status === 'error' && (
            <div className="flex justify-center pb-6">
              <Button onClick={retryCategories}>Tải lại danh mục</Button>
            </div>
          )}
        </Card>
      ) : (
        <>
          <StepIndicator steps={steps} current={current} reached={reached} onSelect={goTo} />

          <form
            ref={formRef}
            noValidate
            onSubmit={(e) => {
              e.preventDefault()
              next()
            }}
          >
            <Card className="p-4 sm:p-6">
              {stepKey === 'classify' && categories.status === 'ready' && (
                <ClassifyStep
                  form={form}
                  categories={categories.items}
                  category={category}
                  errors={errors}
                  onChange={update}
                  lockType={editing}
                />
              )}
              {stepKey === 'classify' && categories.status === 'loading' && (
                <p role="status" className="m-0 py-10 text-center text-small text-ink-muted">
                  Đang tải danh mục…
                </p>
              )}
              {stepKey === 'classify' && categories.status === 'error' && (
                <div className="flex flex-col items-center gap-3 py-8 text-center">
                  <p role="alert" className="m-0 text-small text-ink-secondary">
                    Không tải được danh mục, vui lòng thử lại.
                  </p>
                  <Button onClick={retryCategories}>Thử lại</Button>
                </div>
              )}
              {stepKey === 'content' && (
                <ContentStep
                  form={form}
                  errors={errors}
                  onChange={update}
                  onAddImages={addImages}
                  onRemoveImage={removeImage}
                  onMakeCover={makeCover}
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
                  suggestions={category?.suggestedQuestions}
                  errors={errors}
                  onChange={updateQuestion}
                  onSkip={skipQuestion}
                />
              )}
            </Card>

            <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Button size="lg" onClick={back}>
                <Icon name="back" size={16} />
                {current === 0 ? 'Huỷ' : 'Quay lại'}
              </Button>
              <div className="flex gap-3">
                {!editing && (
                  <Button
                    size="lg"
                    onClick={handleSaveDraft}
                    disabled={savingDraft}
                    aria-busy={savingDraft || undefined}
                    className="flex-1 sm:flex-none"
                  >
                    {savingDraft ? 'Đang lưu…' : 'Lưu nháp'}
                  </Button>
                )}
                <Button type="submit" variant="primary" size="lg" className="flex-1 sm:flex-none">
                  {isLast ? (editing ? 'Xem lại & lưu' : 'Xem lại & đăng bài') : 'Tiếp tục'}
                  <Icon name="next" size={16} />
                </Button>
              </div>
            </div>
          </form>
        </>
      )}

      {reviewing && (
        <ReviewDialog
          mode={mode}
          form={form}
          category={category}
          submitting={submitting}
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
