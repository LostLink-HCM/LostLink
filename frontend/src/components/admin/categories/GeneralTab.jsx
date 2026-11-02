import { useState } from 'react'
import { cleanList, isSame, validateGeneral } from '../../../lib/admin/categories'
import ImageField from './ImageField'
import { inputClass, labelClass } from './styles'
import { FormError, NumberField, SaveBar, TextListField } from './ui'

const pick = (category) => ({
  name: category.name,
  icon: category.icon,
  order: category.order,
  aliases: category.aliases,
})

export default function GeneralTab({ category, categories, onSave }) {
  const saved = pick(category)
  const [form, setForm] = useState(saved)
  const [errors, setErrors] = useState({})
  const dirty = !isSame({ ...form, order: Number(form.order) }, saved)
  const change = (key, value) => {
    setErrors({})
    setForm((current) => ({ ...current, [key]: value }))
  }

  const submit = (event) => {
    event.preventDefault()
    const nextErrors = validateGeneral(form, categories, category.id)
    if (Object.keys(nextErrors).length) return setErrors(nextErrors)
    const next = {
      name: form.name.trim(),
      icon: form.icon,
      order: Number(form.order),
      aliases: cleanList(form.aliases),
    }
    onSave(next)
    setForm(next)
  }

  return (
    <form id="category-general-form" className="flex flex-col gap-5" onSubmit={submit} noValidate>
      <div className="grid gap-4 sm:[grid-template-columns:minmax(0,1fr)_180px]">
        <label className={labelClass}>
          Tên danh mục
          <input
            className={inputClass}
            value={form.name}
            onChange={(event) => change('name', event.target.value)}
            aria-invalid={errors.name ? true : undefined}
          />
          {errors.name && <FormError>{errors.name}</FormError>}
        </label>
        <NumberField
          label="Thứ tự hiển thị"
          min="1"
          max="999"
          step="1"
          value={form.order}
          error={errors.order}
          onChange={(event) => change('order', event.target.value)}
        />
      </div>

      <ImageField
        label="Ảnh đại diện"
        value={form.icon}
        onChange={(icon) => change('icon', icon)}
      />

      <TextListField
        label="Alias"
        itemLabel="alias"
        placeholder="Cách gọi khác"
        value={form.aliases}
        onChange={(aliases) => change('aliases', aliases)}
      />

      <SaveBar
        formId="category-general-form"
        dirty={dirty}
        onReset={() => {
          setErrors({})
          setForm(saved)
        }}
      />
    </form>
  )
}
