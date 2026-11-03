import { useState } from 'react'
import Button from '../../backoffice/Button'
import Dialog from '../../backoffice/Dialog'
import { cx } from '../../backoffice/classes'
import { EMPTY_CATEGORY, validateGeneral } from '../../../lib/admin/categories'
import ImageField from './ImageField'
import { inputClass, labelClass } from './styles'
import { FormError, Hint } from './ui'

const ALGORITHM_KEYS = ['matchRadius', 'timeShape', 'timeMedianDays', 'diffusion']

export default function CreateCategoryDialog({ categories, onSubmit, onClose }) {
  const [form, setForm] = useState({ name: '', icon: EMPTY_CATEGORY.icon, templateId: '' })
  const [error, setError] = useState('')
  const template = categories.find((category) => category.id === form.templateId)
  const change = (key, value) => {
    setError('')
    setForm((current) => ({ ...current, [key]: value }))
  }
  const submit = (event) => {
    event.preventDefault()
    const errors = validateGeneral({ name: form.name, order: 1 }, categories)
    if (errors.name) return setError(errors.name)
    onSubmit({
      name: form.name.trim(),
      icon: form.icon,
      ...(template && Object.fromEntries(ALGORITHM_KEYS.map((key) => [key, template[key]]))),
    })
  }

  return (
    <Dialog
      title="Thêm danh mục"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Hủy</Button>
          <Button type="submit" form="admin-create-category" variant="primary" icon="check">
            Tạo danh mục
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
                Chép từ {category.name}
              </option>
            ))}
          </select>
          <Hint>
            {template
              ? `Lấy bán kính, kiểu suy giảm, trung vị thời gian chờ và hệ số khuếch tán của ${template.name}.`
              : 'Dùng thông số mặc định cho đồ vật nằm yên.'}
          </Hint>
        </label>
        {error && <FormError>{error}</FormError>}
      </form>
    </Dialog>
  )
}
