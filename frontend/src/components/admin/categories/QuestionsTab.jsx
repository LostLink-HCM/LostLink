import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import Button from '../../backoffice/Button'
import IconButton from '../../backoffice/IconButton'
import { cx } from '../../backoffice/classes'
import { isSame, makeId } from '../../../lib/admin/categories'
import { ConfirmDeleteDialog, FormError, Panel, SaveBar } from './ui'

const MAX_LENGTH = 500
const DUPLICATE_QUESTION_MESSAGE =
  'Câu hỏi xác minh này đã tồn tại trong danh mục, vui lòng nhập lại giá trị khác.'

const copyQuestions = (questions) => questions.map(({ id, text }) => ({ id, text }))
const normalizeQuestion = (text) =>
  String(text ?? '')
    .trim()
    .normalize('NFC')

export default function QuestionsTab({ category, onSaveQuestion, onRemoveQuestion }) {
  const [savedQuestions, setSavedQuestions] = useState(() => copyQuestions(category.questions))
  const [questions, setQuestions] = useState(() => copyQuestions(category.questions))
  const [showValidation, setShowValidation] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [highlightedId, setHighlightedId] = useState(null)
  const highlightTimer = useRef(null)
  const questionRefs = useRef(new Map())
  const pendingScrollId = useRef(null)
  const dirty = !isSame(questions, savedQuestions)

  const normalizedQuestions = questions.map((question) => normalizeQuestion(question.text))
  const questionCounts = new Map()
  normalizedQuestions.filter(Boolean).forEach((text) => {
    questionCounts.set(text, (questionCounts.get(text) ?? 0) + 1)
  })
  const savedQuestionById = new Map(savedQuestions.map((question) => [question.id, question]))
  const duplicateErrors = questions.map((question, index) => {
    const text = normalizedQuestions[index]
    const savedQuestion = savedQuestionById.get(question.id)
    const changed = !savedQuestion || normalizeQuestion(savedQuestion.text) !== text
    if (changed && questionCounts.get(text) > 1) return DUPLICATE_QUESTION_MESSAGE
    return ''
  })
  const hasDuplicates = duplicateErrors.some(Boolean)
  const questionErrors = questions.map((_, index) => {
    if (!normalizedQuestions[index]) return showValidation ? 'Vui lòng nhập nội dung câu hỏi.' : ''
    if (normalizedQuestions[index].length > MAX_LENGTH)
      return 'Câu hỏi không được vượt quá 500 ký tự.'
    return duplicateErrors[index]
  })

  useEffect(() => () => clearTimeout(highlightTimer.current), [])

  useLayoutEffect(() => {
    questionRefs.current.forEach((input) => {
      input.style.height = 'auto'
      input.style.height = `${Math.max(input.scrollHeight, 40)}px`
    })
  }, [questions])

  useEffect(() => {
    const id = pendingScrollId.current
    const input = id ? questionRefs.current.get(id) : null
    if (!input) return

    const frame = requestAnimationFrame(() => {
      input.scrollIntoView({ behavior: 'smooth', block: 'center' })
      input.focus()
      pendingScrollId.current = null
    })

    return () => cancelAnimationFrame(frame)
  }, [questions.length])

  const highlightQuestion = (id) => {
    clearTimeout(highlightTimer.current)
    setHighlightedId(id)
    highlightTimer.current = setTimeout(() => setHighlightedId(null), 3000)
    requestAnimationFrame(() =>
      questionRefs.current.get(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    )
  }

  const addQuestion = () => {
    const emptyQuestion = questions.find((question) => !normalizeQuestion(question.text))
    if (emptyQuestion) {
      highlightQuestion(emptyQuestion.id)
      questionRefs.current.get(emptyQuestion.id)?.focus()
      return
    }

    const question = { id: makeId('question'), text: '' }
    pendingScrollId.current = question.id
    setQuestions((current) => [...current, question])
    setShowValidation(false)
    setSaveError('')
  }

  const updateQuestion = (id, text) => {
    if (highlightedId === id && normalizeQuestion(text)) {
      clearTimeout(highlightTimer.current)
      setHighlightedId(null)
    }
    setQuestions((current) =>
      current.map((question) => (question.id === id ? { ...question, text } : question))
    )
    setSaveError('')
  }

  const removeQuestionFromDraft = (id) => {
    setQuestions((current) => current.filter((question) => question.id !== id))
    if (highlightedId === id) {
      clearTimeout(highlightTimer.current)
      setHighlightedId(null)
    }
  }

  const submit = async (event) => {
    event.preventDefault()
    setShowValidation(true)
    setSaveError('')
    const validationErrors = questions.map((question, index) => {
      const text = normalizeQuestion(question.text)
      if (!text) return 'Vui lòng nhập nội dung câu hỏi.'
      if (text.length > MAX_LENGTH) return 'Câu hỏi không được vượt quá 500 ký tự.'
      return duplicateErrors[index]
    })
    if (validationErrors.some(Boolean)) {
      const firstInvalid = questions.find((_, index) => validationErrors[index])
      if (firstInvalid) {
        requestAnimationFrame(() => {
          const input = questionRefs.current.get(firstInvalid.id)
          input?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          input?.focus()
        })
      }
      return
    }

    const nextQuestions = questions.map((question, index) => ({
      id: question.id,
      text: normalizedQuestions[index],
    }))
    const nextIds = new Set(nextQuestions.map((question) => question.id))
    const originalIds = new Set(savedQuestions.map((question) => question.id))
    const removed = savedQuestions.filter((question) => !nextIds.has(question.id))
    const updated = nextQuestions.filter((question) => {
      const previous = savedQuestions.find((item) => item.id === question.id)
      return previous && normalizeQuestion(previous.text) !== question.text
    })
    const added = nextQuestions.filter((question) => !originalIds.has(question.id))

    setSaving(true)
    let latestQuestions = savedQuestions
    try {
      for (const question of removed) {
        const result = await onRemoveQuestion(question.id)
        latestQuestions = copyQuestions(result.questions)
        setSavedQuestions(latestQuestions)
      }

      for (const question of updated) {
        const result = await onSaveQuestion(question.id, question.text)
        latestQuestions = copyQuestions(result.questions)
        setSavedQuestions(latestQuestions)
      }

      for (const question of added) {
        const previousIds = new Set(latestQuestions.map((item) => item.id))
        const result = await onSaveQuestion(null, question.text)
        latestQuestions = copyQuestions(result.questions)
        const created = latestQuestions.find(
          (item) => !previousIds.has(item.id) && item.text === question.text
        )
        if (!created)
          throw new Error('Không xác định được câu hỏi vừa lưu. Vui lòng tải lại danh mục.')

        setQuestions((current) => current.map((item) => (item.id === question.id ? created : item)))
        setSavedQuestions(latestQuestions)
      }

      setQuestions(latestQuestions)
      setSavedQuestions(latestQuestions)
      setShowValidation(false)
    } catch (error) {
      setSaveError(error.message || 'Không lưu được cấu hình câu hỏi. Vui lòng thử lại.')
    } finally {
      setSaving(false)
    }
  }

  const reset = () => {
    setQuestions(copyQuestions(savedQuestions))
    setShowValidation(false)
    setSaveError('')
    clearTimeout(highlightTimer.current)
    setHighlightedId(null)
  }

  return (
    <>
      <form
        id="category-questions-form"
        className="flex flex-col gap-4"
        onSubmit={submit}
        noValidate
      >
        <Panel
          title="Câu hỏi xác minh"
          action={
            <Button className="text-caption" icon="plus" onClick={addQuestion} disabled={saving}>
              Thêm câu hỏi
            </Button>
          }
        >
          {questions.length ? (
            <ol className="m-0 list-none px-4 py-2">
              {questions.map((question, index) => {
                const error = questionErrors[index]
                const inputId = `admin-question-input-${index}`
                const errorId = `admin-question-error-${index}`

                return (
                  <li
                    key={question.id}
                    className="flex min-w-0 items-start gap-3 py-1 text-body text-ink-secondary"
                  >
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary-soft text-caption font-bold text-primary">
                      {index + 1}
                    </span>
                    <div
                      className={cx(
                        'flex min-w-0 flex-1 flex-col gap-1 border-b border-line-subtle pb-1',
                        error && 'border-danger/35',
                        highlightedId === question.id
                          ? 'border-[#3976bd]'
                          : !error && 'focus-within:border-[#3976bd]'
                      )}
                    >
                      <label htmlFor={inputId} className="sr-only">
                        Câu hỏi xác minh {index + 1}
                      </label>
                      <textarea
                        ref={(node) => {
                          if (node) questionRefs.current.set(question.id, node)
                          else questionRefs.current.delete(question.id)
                        }}
                        id={inputId}
                        rows={1}
                        maxLength={MAX_LENGTH}
                        disabled={saving}
                        className="min-h-10 w-full resize-none overflow-hidden rounded-none border-0 bg-transparent px-0 py-1 leading-relaxed text-ink outline-none focus:ring-0"
                        value={question.text}
                        aria-invalid={error ? true : undefined}
                        aria-describedby={error ? errorId : undefined}
                        placeholder="Nhập câu hỏi xác minh…"
                        onChange={(event) => updateQuestion(question.id, event.target.value)}
                      />
                      {error && (
                        <FormError id={errorId} subtle>
                          {error}
                        </FormError>
                      )}
                    </div>
                    <IconButton
                      label={`Xóa câu hỏi ${index + 1}`}
                      icon="close"
                      danger
                      disabled={saving}
                      onClick={() => setDeleteTarget(question)}
                    />
                  </li>
                )
              })}
            </ol>
          ) : (
            <p className="m-0 text-center text-body text-ink-muted">Chưa có câu hỏi xác minh.</p>
          )}
        </Panel>
        <SaveBar
          formId="category-questions-form"
          dirty={dirty}
          error={saveError}
          saving={saving}
          blocked={hasDuplicates}
          saveLabel="Lưu cấu hình"
          onReset={reset}
        />
      </form>

      {deleteTarget && (
        <ConfirmDeleteDialog
          title="Xóa câu hỏi xác minh"
          confirmLabel="Xóa"
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => removeQuestionFromDraft(deleteTarget.id)}
        >
          <p className="m-0">Bạn có chắc muốn xóa câu hỏi xác minh này?</p>
          <p className="m-0 break-words font-semibold text-primary">“{deleteTarget.text}”</p>
        </ConfirmDeleteDialog>
      )}
    </>
  )
}
