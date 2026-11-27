import { useState } from 'react'
import Button from '../../backoffice/Button'
import Dialog from '../../backoffice/Dialog'
import { cx } from '../../backoffice/classes'
import { EMPTY_CATEGORY, validateGeneral } from '../../../lib/admin/categories'
import ImageField from './ImageField'
import { inputClass, labelClass } from './styles'
import { FormError, Hint } from './ui'
import { TIME_SHAPES, formatNumber } from '../../../lib/admin/matching'

export default function CreateCategoryDialog({ categories, onSubmit, onClose }) {
  const [form, setForm] = useState({ name: '', icon: EMPTY_CATEGORY.icon, templateId: '' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [imageUploading, setImageUploading] = useState(false)
  const template = categories.find((category) => category.id === form.templateId)
  const algorithm = template || EMPTY_CATEGORY
  const shape = TIME_SHAPES.find((item) => Number(item.k) === Number(algorithm.timeShape))
  const algorithmValues = [
    { label: 'Bán kính ban đầu', value: `${formatNumber(algorithm.matchRadius)} m` },
    {
      label: 'Kiểu suy giảm (k)',
      value: `${shape?.label || 'Tùy chỉnh'}: k = ${formatNumber(algorithm.timeShape, 1)}`,
    },
    {
      label: 'Trung vị thời gian chờ',
      value: `${formatNumber(algorithm.timeMedianDays, 1)} ngày`,
    },
    {
      label: 'Hệ số khuếch tán D',
      value: `${formatNumber(algorithm.diffusion, 2)} m²/ngày`,
    },
  ]
  const change = (key, value) => {
    setError('')
    setForm((current) => ({ ...current, [key]: value }))
  }
  const submit = async (event) => {
    event.preventDefault()
    const errors = validateGeneral({ name: form.name, order: 1 }, categories)
    if (errors.name) return setError(errors.name)
    setSubmitting(true)
    setError('')
    try {
      await onSubmit({
        name: form.name.trim(),
        icon: form.icon,
        ...(template && { templateCategoryId: template.id }),
      })
      setSubmitting(false)
      onClose()
    } catch (submitError) {
      setError(submitError.message || 'Không tạo được danh mục. Vui lòng thử lại.')
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      title="Thêm danh mục"
      onClose={onClose}
      scrollableContent
      footer={
        <>
          <Button onClick={onClose} disabled={submitting || imageUploading}>
            Hủy
          </Button>
          <Button
            type="submit"
            form="admin-create-category"
            variant="primary"
            icon="check"
            disabled={submitting || imageUploading}
          >
            {submitting ? 'Đang tạo…' : imageUploading ? 'Đang tải ảnh…' : 'Tạo danh mục'}
          </Button>
        </>
      }
    >
      <form
        id="admin-create-category"
        className="flex flex-col gap-4.5"
        onSubmit={submit}
        noValidate
      >
        <label className={labelClass}>
          Tên danh mục
          <input
            autoFocus
            className={inputClass}
            value={form.name}
            onChange={(event) => change('name', event.target.value)}
          />
        </label>
        <ImageField
          label="Ảnh đại diện"
          value={form.icon}
          onChange={(icon) => change('icon', icon)}
          onBusyChange={setImageUploading}
          disabled={submitting || imageUploading}
        />
        <label className={labelClass}>
          Cấu hình thuật toán ban đầu
          <select
            className={cx(inputClass, 'cursor-pointer')}
            value={form.templateId}
            onChange={(event) => change('templateId', event.target.value)}
          >
            <option value="">Mặc định: đồ vật nằm yên, suy giảm trung tính</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                Sao chép từ {category.name}
              </option>
            ))}
          </select>
          <Hint>
            {template
              ? `Các thông số dưới đây sẽ được sao chép từ ${template.name}.`
              : 'Các thông số dưới đây là giá trị mặc định cho danh mục mới.'}
          </Hint>
        </label>
        <section
          aria-label="Thông số cấu hình thuật toán sẽ áp dụng"
          className="rounded-xl border border-primary/20 bg-primary-subtle/40 p-3.5"
        >
          <h3 className="m-0 text-small font-semibold text-primary">Thông số sẽ áp dụng</h3>
          <dl className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
            {algorithmValues.map(({ label, value }) => (
              <div key={label} className="rounded-lg border border-line bg-white px-3 py-2.5">
                <dt className="text-caption text-ink-muted">{label}</dt>
                <dd className="m-0 mt-1 text-small font-semibold text-ink">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
        {error && <FormError>{error}</FormError>}
      </form>
    </Dialog>
  )
}
