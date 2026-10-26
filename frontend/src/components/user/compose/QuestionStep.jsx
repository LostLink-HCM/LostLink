import { useId } from 'react'
import { MAX_OPTIONS, MIN_OPTIONS } from '../../../lib/user/composePost'
import Icon from '../../common/Icon'
import Button from '../Button'
import IconButton from '../IconButton'
import Note from '../Note'
import { cx, focusRing } from '../classes'
import { inputClass, labelClass } from './styles'
import { FieldError, StepHeading } from './ui'

// Chỉ tin Nhặt được: câu hỏi trắc nghiệm để nhận ra chủ nhân
export default function QuestionStep({ question, errors, onChange, onSkip }) {
  const id = useId()

  if (question.skipped) {
    return (
      <>
        <StepHeading title="Câu hỏi xác minh" />
        <div className="flex flex-col items-start gap-4 rounded-2xl border border-line bg-surface-muted p-5">
          <p className="m-0 text-small leading-relaxed text-ink-secondary">
            Bạn đã bỏ qua câu hỏi xác minh. Ai muốn nhận đồ sẽ gửi một lời nhắn xin liên hệ, và bạn
            tự quyết định đồng ý hay không.
          </p>
          <Button size="xl" onClick={() => onChange({ skipped: false })}>
            <Icon name="edit" size={16} />
            Đặt câu hỏi
          </Button>
        </div>
      </>
    )
  }

  const setOption = (index, value) =>
    onChange({ options: question.options.map((option, i) => (i === index ? value : option)) })

  // Xoá phương án thì dời chỉ số đáp án đúng cho khớp
  const removeOption = (index) => {
    const correct =
      question.correct === index
        ? null
        : question.correct > index
          ? question.correct - 1
          : question.correct
    onChange({ options: question.options.filter((_, i) => i !== index), correct })
  }

  return (
    <>
      <StepHeading
        title="Một câu hỏi để nhận ra chủ nhân"
        description="Chỉ người thật sự đánh mất món này mới trả lời được. Mỗi người chỉ được trả lời một lần, trả lời đúng thì hai bên mới nhắn tin được với nhau."
      />

      <div className="rounded-2xl border border-line bg-surface-muted p-4 sm:p-5">
        <p className="m-0 mb-4 text-caption leading-relaxed text-ink-muted">
          Nên hỏi về thứ chỉ chủ nhân biết: món bên trong, số thẻ, chữ viết tay. Đừng ghi những chi
          tiết đó vào mô tả công khai.
        </p>

        <label htmlFor={`${id}-question`} className={labelClass}>
          Câu hỏi
        </label>
        <input
          id={`${id}-question`}
          value={question.text}
          onChange={(e) => onChange({ text: e.target.value })}
          placeholder="Ví dụ: Bên trong ví có bao nhiêu thẻ ngân hàng?"
          aria-invalid={errors.question ? true : undefined}
          aria-describedby={errors.question ? `${id}-question-error` : undefined}
          className={cx(inputClass, 'h-11')}
        />
        <FieldError id={`${id}-question-error`}>{errors.question}</FieldError>

        <fieldset className="m-0 mt-5 border-0 p-0">
          <legend className={labelClass}>
            Các phương án <span className="font-normal text-ink-muted">· chọn đáp án đúng</span>
          </legend>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {question.options.map((option, index) => {
              const correct = question.correct === index
              return (
                <li
                  key={index}
                  className={cx(
                    'flex items-center gap-3 rounded-xl border bg-surface py-1.5 pr-1.5 pl-3.5 transition-colors',
                    correct ? 'border-primary/60 ring-3 ring-primary/10' : 'border-line'
                  )}
                >
                  <input
                    type="radio"
                    name={`${id}-correct`}
                    checked={correct}
                    onChange={() => onChange({ correct: index })}
                    aria-label={`Chọn phương án ${index + 1} là đáp án đúng`}
                    className="size-4 shrink-0 cursor-pointer accent-primary"
                  />
                  <input
                    value={option}
                    onChange={(e) => setOption(index, e.target.value)}
                    placeholder={`Phương án ${index + 1}`}
                    aria-label={`Phương án ${index + 1}`}
                    className="h-9 min-w-0 flex-1 border-0 bg-transparent text-body text-ink outline-none placeholder:text-ink-subtle"
                  />
                  {correct && (
                    <span className="shrink-0 rounded-full bg-primary-soft px-2.5 py-1 text-tiny font-semibold text-primary">
                      Đáp án đúng
                    </span>
                  )}
                  {question.options.length > MIN_OPTIONS && (
                    <IconButton
                      icon="close"
                      label={`Xoá phương án ${index + 1}`}
                      tone="danger"
                      onClick={() => removeOption(index)}
                    />
                  )}
                </li>
              )
            })}
          </ul>
          <FieldError>{errors.options}</FieldError>
          <FieldError>{errors.correct}</FieldError>
          {question.options.length < MAX_OPTIONS && (
            <button
              type="button"
              onClick={() => onChange({ options: [...question.options, ''] })}
              className={cx(
                'mt-3 inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border border-dashed border-line-strong bg-transparent px-3.5 text-caption font-semibold text-primary hover:border-primary/50 hover:bg-primary-subtle',
                focusRing
              )}
            >
              <Icon name="plus" size={14} />
              Thêm phương án
            </button>
          )}
        </fieldset>
      </div>

      <Note icon="info" tone="warning" className="mt-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Không muốn đặt câu hỏi? Khi đó ai muốn nhận đồ sẽ gửi lời nhắn xin liên hệ, và bạn tự
            quyết định đồng ý hay không.
          </span>
          <button
            type="button"
            onClick={onSkip}
            className={cx(
              'h-9 shrink-0 cursor-pointer self-start rounded-full border border-warning/30 bg-surface px-4 text-caption font-semibold text-warning hover:bg-warning-soft sm:self-auto',
              focusRing
            )}
          >
            Bỏ qua
          </button>
        </div>
      </Note>
    </>
  )
}
