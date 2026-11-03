import { useRef, useState } from 'react'
import Button from '../../backoffice/Button'
import Dialog from '../../backoffice/Dialog'
import IconButton from '../../backoffice/IconButton'
import { cx } from '../../backoffice/classes'
import { inputClass, labelClass } from './styles'
import { ConfirmDeleteDialog, FormError, Panel } from './ui'

const MAX_LENGTH = 500

function QuestionForm({ question, categoryName, onSubmit, onClose }) {
  const [text, setText] = useState(question?.text || '')
  const [error, setError] = useState('')
  const inputRef = useRef(null)
  const submit = (event) => {
    event.preventDefault()
    const value = text.trim()
    if (!value || value.length > MAX_LENGTH) {
      setError(
        !value ? 'Vui lòng nhập nội dung câu hỏi.' : 'Câu hỏi không được vượt quá 500 ký tự.'
      )
      inputRef.current?.focus()
      return
    }
    onSubmit(value)
  }

  return (
    <Dialog
      title={question ? 'Sửa câu hỏi xác minh' : 'Thêm câu hỏi xác minh'}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Hủy</Button>
          <Button type="submit" form="admin-question-form" variant="primary" icon="check">
            Lưu câu hỏi
          </Button>
        </>
      }
    >
      <form id="admin-question-form" className="flex flex-col gap-4.5" noValidate onSubmit={submit}>
        <p className="m-0 text-body text-ink-muted">
          Danh mục: <strong className="text-ink-secondary">{categoryName}</strong>
        </p>
        <label htmlFor="admin-question-text" className={labelClass}>
          Nội dung câu hỏi
          <textarea
            ref={inputRef}
            id="admin-question-text"
            autoFocus
            rows={5}
            maxLength={MAX_LENGTH}
            required
            className={cx(inputClass, 'min-h-32 resize-y leading-relaxed')}
            value={text}
            onChange={(event) => {
              setText(event.target.value)
              setError('')
            }}
            placeholder="Nhập câu hỏi xác minh…"
            aria-invalid={Boolean(error)}
            aria-describedby={`admin-question-count${error ? ' admin-question-error' : ''}`}
          />
        </label>
        <small id="admin-question-count" className="-mt-3 text-right text-caption text-ink-muted">
          {text.length}/{MAX_LENGTH} ký tự
        </small>
        {error && <FormError id="admin-question-error">{error}</FormError>}
      </form>
    </Dialog>
  )
}

export default function QuestionsTab({ category, onSaveQuestion, onRemoveQuestion }) {
  const [modal, setModal] = useState(null)

  return (
    <>
      <Panel
        title="Câu hỏi xác minh"
        action={
          <Button
            className="text-caption"
            icon="plus"
            onClick={() => setModal({ kind: 'form', question: null })}
          >
            Thêm câu hỏi
          </Button>
        }
      >
        {category.questions.length ? (
          <ol className="m-0 list-none px-4 py-2">
            {category.questions.map((question, index) => (
              <li
                key={question.id}
                className="flex min-w-0 items-center gap-3 border-b border-line-subtle py-2.5 text-body text-ink-secondary last:border-b-0"
              >
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary-soft text-caption font-bold text-primary">
                  {index + 1}
                </span>
                <p className="m-0 min-w-0 flex-1 break-words leading-relaxed">{question.text}</p>
                <div className="flex shrink-0 gap-1">
                  <IconButton
                    label={`Sửa câu hỏi ${index + 1}`}
                    icon="edit"
                    tone="edit"
                    onClick={() => setModal({ kind: 'form', question })}
                  />
                  <IconButton
                    label={`Xóa câu hỏi ${index + 1}`}
                    icon="close"
                    danger
                    onClick={() => setModal({ kind: 'delete', question })}
                  />
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="m-0 p-6 text-center text-body text-ink-muted">Chưa có câu hỏi xác minh.</p>
        )}
      </Panel>

      {modal?.kind === 'form' && (
        <QuestionForm
          question={modal.question}
          categoryName={category.name}
          onClose={() => setModal(null)}
          onSubmit={(text) => {
            onSaveQuestion(modal.question?.id, text)
            setModal(null)
          }}
        />
      )}
      {modal?.kind === 'delete' && (
        <ConfirmDeleteDialog
          title="Xóa câu hỏi xác minh"
          confirmLabel="Xóa câu hỏi"
          onClose={() => setModal(null)}
          onConfirm={() => {
            onRemoveQuestion(modal.question.id)
            setModal(null)
          }}
        >
          <p className="m-0">Bạn có chắc muốn xóa câu hỏi xác minh này?</p>
          <p className="m-0 rounded-xl bg-primary-faint px-3.5 py-2.5 break-words text-ink">
            “{modal.question.text}”
          </p>
        </ConfirmDeleteDialog>
      )}
    </>
  )
}
