import { CATEGORY_ATTRIBUTES } from '../../../data/composePost'
import { describeLocation, describeTime, getSteps } from '../../../lib/user/composePost'
import TypeTag from '../home/TypeTag'
import Button from '../Button'
import Dialog from '../Dialog'
import Note from '../Note'

function Section({ title, onEdit, children }) {
  return (
    <section className="border-b border-line-subtle py-3.5 last:border-b-0">
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <h3 className="m-0 text-caption font-semibold tracking-wide text-ink-subtle uppercase">
          {title}
        </h3>
        <Button variant="ghost" size="sm" onClick={onEdit}>
          Sửa
        </Button>
      </div>
      {children}
    </section>
  )
}

// Xem lại toàn bộ trước khi đăng, bấm Sửa để quay về đúng bước
export default function ReviewDialog({ form, onEdit, onClose, onSubmit }) {
  const steps = getSteps(form.type)
  const stepIndex = (key) => steps.findIndex((step) => step.key === key)
  const attributeLabels = Object.fromEntries(
    (CATEGORY_ATTRIBUTES[form.category] ?? []).map((attr) => [attr.key, attr.label])
  )
  const attributes = Object.entries(form.attributes)
  const { question } = form

  return (
    <Dialog
      title="Xem lại bài đăng"
      size="lg"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Tiếp tục sửa</Button>
          <Button variant="primary" onClick={onSubmit} data-autofocus>
            Đăng bài
          </Button>
        </>
      }
    >
      <Note className="mb-3.5">
        Bài đăng sẽ ở trạng thái Chờ xét duyệt và chỉ hiển thị công khai sau khi Moderator duyệt.
      </Note>

      <Section title="Phân loại" onEdit={() => onEdit(stepIndex('classify'))}>
        <div className="flex flex-wrap items-center gap-2">
          <TypeTag type={form.type} className="py-1" />
          <span className="rounded-full bg-line-subtle px-2.5 py-1 text-tiny text-ink-secondary">
            {form.category}
          </span>
        </div>
        {attributes.length > 0 && (
          <p className="m-0 mt-2 text-small text-ink-secondary">
            {attributes
              .map(([key, value]) => `${attributeLabels[key] ?? key}: ${value}`)
              .join(' · ')}
          </p>
        )}
        {form.contents.length > 0 && (
          <p className="m-0 mt-1 text-small text-ink-secondary">
            Bên trong có: {form.contents.join(', ')}
            {form.type === 'found' && (
              <span className="block text-caption text-ink-muted">
                Phần này không hiển thị công khai, chỉ dùng để ghép cặp.
              </span>
            )}
          </p>
        )}
      </Section>

      <Section title="Nội dung" onEdit={() => onEdit(stepIndex('content'))}>
        <p className="m-0 text-body font-semibold text-ink">{form.title}</p>
        <p className="m-0 mt-1 line-clamp-4 text-small whitespace-pre-line text-ink-secondary">
          {form.description || 'Không có mô tả.'}
        </p>
        {form.images.length > 0 ? (
          <ul className="m-0 mt-2.5 flex list-none flex-wrap gap-2 p-0">
            {form.images.map((image, index) => (
              <li key={image.id}>
                <img
                  src={image.url}
                  alt={`Ảnh ${index + 1}`}
                  className="size-14 rounded-lg border border-line object-cover"
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 mt-1.5 text-caption text-ink-muted">Không có ảnh.</p>
        )}
      </Section>

      <Section title="Thời gian" onEdit={() => onEdit(stepIndex('time'))}>
        <p className="m-0 text-small text-ink">{describeTime(form)}</p>
      </Section>

      <Section title="Vị trí" onEdit={() => onEdit(stepIndex('location'))}>
        <p className="m-0 text-small text-ink">{describeLocation(form.location)}</p>
      </Section>

      {form.type === 'found' && (
        <Section title="Câu hỏi xác minh" onEdit={() => onEdit(stepIndex('question'))}>
          {question.skipped ? (
            <p className="m-0 text-small text-ink-secondary">
              Không đặt câu hỏi, người muốn nhận đồ sẽ gửi yêu cầu liên hệ.
            </p>
          ) : (
            <>
              <p className="m-0 text-small font-semibold text-ink">{question.text}</p>
              <ul className="m-0 mt-1.5 flex list-none flex-col gap-1 p-0">
                {question.options
                  .map((text, index) => ({ text: text.trim(), index }))
                  .filter((option) => option.text)
                  .map((option) => (
                    <li key={option.index} className="text-small text-ink-secondary">
                      {option.text}
                      {option.index === question.correct && (
                        <span className="ml-2 rounded-full bg-primary-soft px-2 py-0.5 text-tiny font-semibold text-primary">
                          Đáp án đúng
                        </span>
                      )}
                    </li>
                  ))}
              </ul>
            </>
          )}
        </Section>
      )}
    </Dialog>
  )
}
