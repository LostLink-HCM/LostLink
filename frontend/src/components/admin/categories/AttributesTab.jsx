import { useState } from 'react'
import Icon from '../../common/Icon'
import Badge from '../../backoffice/Badge'
import Button from '../../backoffice/Button'
import Dialog from '../../backoffice/Dialog'
import IconButton from '../../backoffice/IconButton'
import { cx } from '../../backoffice/classes'
import Switch from '../../backoffice/Switch'
import {
  EMPTY_ATTRIBUTE,
  cleanList,
  isSame,
  makeId,
  validateAttribute,
} from '../../../lib/admin/categories'
import {
  M_LEVELS,
  MATCH_ROLES,
  formatNumber,
  formatPercent,
  mLevelLabel,
} from '../../../lib/admin/matching'
import { inputClass, labelClass } from './styles'
import { ConfirmDeleteDialog, FormError, Panel, SaveBar, Segmented, TextListField } from './ui'

const VISIBLE_VALUES = 4

const byFrequency = (values) =>
  [...values].sort((a, b) => (b.frequency ?? -1) - (a.frequency ?? -1))

function RoleBadge({ role }) {
  return (
    <Badge tone={role === 'exclude' ? 'danger' : 'primary'} className="whitespace-nowrap">
      {MATCH_ROLES[role].label}
    </Badge>
  )
}

function ValueSummary({ values }) {
  const sorted = byFrequency(values)
  const hidden = sorted.length - VISIBLE_VALUES

  return (
    <span className="text-small leading-relaxed text-ink-secondary">
      {sorted.slice(0, VISIBLE_VALUES).map((attributeValue, index) => (
        <span key={attributeValue.id}>
          {index > 0 && <span className="text-ink-subtle"> · </span>}
          {attributeValue.value}{' '}
          <span className="text-ink-muted tabular-nums">
            {attributeValue.frequency == null ? '—' : formatPercent(attributeValue.frequency)}
          </span>
        </span>
      ))}
      {hidden > 0 && <span className="text-ink-muted"> · +{hidden}</span>}
    </span>
  )
}

function AttributeForm({ value, attributes, editing, onSubmit, onClose }) {
  const [form, setForm] = useState(() => ({
    ...value,
    values: value.values.map((v) => ({ ...v })),
  }))
  const [error, setError] = useState('')
  const change = (key, next) => {
    setError('')
    setForm((current) => ({ ...current, [key]: next }))
  }
  const updateValue = (index, next) =>
    change(
      'values',
      form.values.map((item, i) => (i === index ? next : item))
    )

  const submit = (event) => {
    event.preventDefault()
    const nextError = validateAttribute(form, attributes, value.id)
    if (nextError) return setError(nextError)
    onSubmit({
      name: form.name.trim(),
      aliases: cleanList(form.aliases),
      matchRole: form.matchRole,
      mProb: Number(form.mProb),
      isRequired: form.isRequired,
      values: form.values.map((attributeValue) => ({
        ...attributeValue,
        value: attributeValue.value.trim().normalize('NFC'),
        aliases: cleanList(attributeValue.aliases),
      })),
    })
  }

  return (
    <Dialog
      title={editing ? 'Sửa thuộc tính' : 'Thêm thuộc tính'}
      size="lg"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Hủy</Button>
          <Button type="submit" form="admin-attribute-form" variant="primary" icon="check">
            Lưu thuộc tính
          </Button>
        </>
      }
    >
      <form
        id="admin-attribute-form"
        className="flex flex-col gap-4.5"
        onSubmit={submit}
        noValidate
      >
        <label className={labelClass}>
          Tên thuộc tính
          <input
            autoFocus
            className={inputClass}
            value={form.name}
            onChange={(event) => change('name', event.target.value)}
            placeholder="Ví dụ: Loài, Hãng, Màu chủ đạo"
          />
        </label>

        <div className="flex flex-col gap-2">
          <Segmented
            label="Vai trò ghép cặp"
            options={Object.entries(MATCH_ROLES).map(([key, role]) => ({
              value: key,
              label: role.label,
            }))}
            value={form.matchRole}
            onChange={(role) => change('matchRole', role)}
          />
          {form.matchRole === 'exclude' && (
            <p
              role="note"
              className="m-0 flex items-start gap-2 rounded-xl bg-warning-soft px-3.5 py-2.5 text-small leading-relaxed text-warning"
            >
              <Icon name="warning" size={16} className="mt-0.5 shrink-0" />
              Hai bài khác giá trị ở thuộc tính này sẽ không bao giờ được ghép. Chỉ dùng cho thuộc
              tính người dùng gần như không ghi sai.
            </p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className={labelClass}>
            Độ tin cậy khai báo (m)
            <select
              className={cx(inputClass, 'cursor-pointer')}
              value={form.mProb}
              onChange={(event) => change('mProb', Number(event.target.value))}
            >
              {M_LEVELS.map((level) => (
                <option key={level.value} value={level.value}>
                  {level.label} ({formatNumber(level.value, 2)})
                </option>
              ))}
            </select>
          </label>
          <label className="flex cursor-pointer items-center gap-2.5 self-start pt-8 text-small font-semibold text-ink-secondary max-sm:pt-0">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={form.isRequired}
              onChange={(event) => change('isRequired', event.target.checked)}
            />
            Bắt buộc khi đăng bài
          </label>
        </div>

        <TextListField
          label="Alias của thuộc tính"
          itemLabel="alias thuộc tính"
          placeholder="Cách gọi khác"
          value={form.aliases}
          onChange={(aliases) => change('aliases', aliases)}
        />

        <div className={labelClass}>
          <div className="flex items-center gap-1.5">
            <span>Giá trị</span>
            <IconButton
              label="Thêm giá trị"
              icon="plus"
              bordered
              onClick={() =>
                change('values', [
                  ...form.values,
                  { id: makeId('attribute-value'), value: '', aliases: [], frequency: null },
                ])
              }
            />
          </div>
          {form.values.map((attributeValue, index) => (
            <article
              key={attributeValue.id}
              className="rounded-xl border border-line-soft bg-primary-faint p-3"
            >
              <div className="flex items-start gap-2">
                <label className={cx(labelClass, 'min-w-0 flex-1')}>
                  <span className="flex items-baseline justify-between gap-2">
                    Giá trị {index + 1}
                    <span className="text-caption font-normal text-ink-muted tabular-nums">
                      u ={' '}
                      {attributeValue.frequency == null
                        ? '—'
                        : formatPercent(attributeValue.frequency)}
                    </span>
                  </span>
                  <input
                    className={inputClass}
                    value={attributeValue.value}
                    onChange={(event) =>
                      updateValue(index, { ...attributeValue, value: event.target.value })
                    }
                  />
                </label>
                <IconButton
                  label={`Xóa giá trị ${index + 1}`}
                  icon="close"
                  danger
                  className="mt-7"
                  onClick={() =>
                    change(
                      'values',
                      form.values.filter((_, i) => i !== index)
                    )
                  }
                />
              </div>
              <div className="mt-3">
                <TextListField
                  label="Alias"
                  itemLabel={`alias của giá trị ${index + 1}`}
                  value={attributeValue.aliases}
                  onChange={(aliases) => updateValue(index, { ...attributeValue, aliases })}
                />
              </div>
            </article>
          ))}
        </div>
        {error && <FormError>{error}</FormError>}
      </form>
    </Dialog>
  )
}

function AttributeDetailDialog({ attribute, onClose }) {
  return (
    <Dialog
      title={`Thuộc tính: ${attribute.name}`}
      size="lg"
      onClose={onClose}
      footer={<Button onClick={onClose}>Đóng</Button>}
    >
      <div className="space-y-4">
        <dl className="m-0 grid grid-cols-3 gap-3 max-sm:grid-cols-1">
          {[
            ['Vai trò ghép cặp', <RoleBadge key="role" role={attribute.matchRole} />],
            [
              'Độ tin cậy (m)',
              `${mLevelLabel(attribute.mProb)} (${formatNumber(attribute.mProb, 2)})`,
            ],
            ['Bắt buộc khi đăng', attribute.isRequired ? 'Có' : 'Không'],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl bg-primary-faint p-3">
              <dt className="text-caption text-ink-muted">{label}</dt>
              <dd className="m-0 mt-1 text-body font-semibold text-ink-secondary">{value}</dd>
            </div>
          ))}
        </dl>

        <div className="overflow-x-auto rounded-xl border border-line-soft">
          <table className="w-full min-w-[460px] border-collapse text-left text-small">
            <thead>
              <tr className="bg-primary-faint text-caption text-ink-muted">
                <th className="px-3 py-2.5 font-bold">Giá trị</th>
                <th className="px-3 py-2.5 font-bold">Alias</th>
                <th className="px-3 py-2.5 text-right font-bold">Độ hiếm u</th>
              </tr>
            </thead>
            <tbody>
              {byFrequency(attribute.values).map((attributeValue) => (
                <tr key={attributeValue.id} className="border-t border-line-subtle">
                  <td className="px-3 py-2.5 font-semibold text-ink-secondary">
                    {attributeValue.value}
                  </td>
                  <td className="px-3 py-2.5 text-ink-muted">
                    {attributeValue.aliases.join(', ') || '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {attributeValue.frequency == null
                      ? '—'
                      : formatPercent(attributeValue.frequency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Dialog>
  )
}

function ContentsPanel({ category, onSave }) {
  const saved = category.contents.map((item) => item.label)
  const [enabled, setEnabled] = useState(saved.length > 0)
  const [items, setItems] = useState(saved)
  const [error, setError] = useState('')
  const next = enabled ? cleanList(items) : []
  const dirty = !isSame(enabled ? items : [], saved)

  const submit = (event) => {
    event.preventDefault()
    if (enabled && !next.length)
      return setError('Thêm ít nhất một mục, hoặc tắt danh mục vật chứa.')
    onSave(
      next.map(
        (label) =>
          category.contents.find((item) => item.label === label) || { id: makeId('content'), label }
      )
    )
    setItems(next)
  }

  return (
    <Panel title="Bên trong có">
      <form
        id="category-contents-form"
        className="flex flex-col gap-4 px-4.5 pt-3 pb-4"
        onSubmit={submit}
        noValidate
      >
        <div className="max-w-sm">
          <Switch
            label="Danh mục vật chứa"
            checked={enabled}
            onChange={() => {
              setError('')
              setEnabled((current) => !current)
            }}
          />
        </div>
        {enabled && (
          <TextListField
            label="Các mục"
            itemLabel="mục"
            placeholder="Ví dụ: Tiền mặt"
            value={items}
            onChange={(value) => {
              setError('')
              setItems(value)
            }}
          />
        )}
        <SaveBar
          formId="category-contents-form"
          dirty={dirty}
          error={error}
          onReset={() => {
            setError('')
            setEnabled(saved.length > 0)
            setItems(saved)
          }}
        />
      </form>
    </Panel>
  )
}

export default function AttributesTab({
  category,
  onSaveAttribute,
  onRemoveAttribute,
  onSaveContents,
}) {
  const [modal, setModal] = useState(null)

  return (
    <div className="flex flex-col gap-4">
      <Panel
        title="Thuộc tính"
        action={
          <Button
            className="text-caption"
            icon="plus"
            onClick={() => setModal({ kind: 'form', value: { ...EMPTY_ATTRIBUTE, id: null } })}
          >
            Thêm thuộc tính
          </Button>
        }
      >
        {category.attributes.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-left">
              <thead>
                <tr>
                  {[
                    'Thuộc tính',
                    'Giá trị · độ hiếm u',
                    'Vai trò ghép cặp',
                    'Độ tin cậy (m)',
                    'Bắt buộc',
                  ].map((heading) => (
                    <th
                      key={heading}
                      className="bg-primary-faint px-3.5 py-3 text-caption font-bold whitespace-nowrap text-ink-muted"
                    >
                      {heading}
                    </th>
                  ))}
                  <th className="w-28 bg-primary-faint px-1 py-3">
                    <span className="sr-only">Thao tác</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {category.attributes.map((attribute) => (
                  <tr
                    key={attribute.id}
                    className="border-b border-line-subtle transition-colors last:border-b-0 hover:bg-primary-faint"
                  >
                    <td className="w-[22%] px-3.5 py-3.5 align-top">
                      <strong className="block text-body font-semibold text-primary">
                        {attribute.name}
                      </strong>
                    </td>
                    <td className="px-3.5 py-3.5 align-top">
                      <ValueSummary values={attribute.values} />
                    </td>
                    <td className="w-[16%] px-3.5 py-3.5 align-top">
                      <RoleBadge role={attribute.matchRole} />
                    </td>
                    <td className="w-[15%] px-3.5 py-3.5 align-top text-small whitespace-nowrap text-ink-secondary tabular-nums">
                      {mLevelLabel(attribute.mProb)} ({formatNumber(attribute.mProb, 2)})
                    </td>
                    <td className="w-[9%] px-3.5 py-3.5 align-top text-small text-ink-secondary">
                      {attribute.isRequired ? 'Có' : 'Không'}
                    </td>
                    <td className="px-1 py-3 align-top">
                      <div className="flex justify-end gap-0.5">
                        <IconButton
                          label={`Xem ${attribute.name}`}
                          icon="eye"
                          tone="view"
                          onClick={() => setModal({ kind: 'detail', attribute })}
                        />
                        <IconButton
                          label={`Sửa ${attribute.name}`}
                          icon="edit"
                          tone="edit"
                          onClick={() =>
                            setModal({ kind: 'form', value: attribute, editing: true })
                          }
                        />
                        <IconButton
                          label={`Xóa ${attribute.name}`}
                          icon="close"
                          danger
                          onClick={() => setModal({ kind: 'delete', attribute })}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="m-0 p-6 text-center text-body text-ink-muted">Chưa có thuộc tính.</p>
        )}
        <p className="m-0 border-t border-line-subtle px-4.5 py-3 text-caption text-ink-muted">
          Độ hiếm u là tỉ lệ bài trong danh mục có giá trị đó. Trùng giá trị càng hiếm càng được
          cộng nhiều.
        </p>
      </Panel>

      <ContentsPanel category={category} onSave={onSaveContents} />

      {modal?.kind === 'form' && (
        <AttributeForm
          value={modal.value}
          attributes={category.attributes}
          editing={modal.editing}
          onClose={() => setModal(null)}
          onSubmit={(value) => {
            onSaveAttribute({ id: modal.value.id || makeId('attribute'), ...value })
            setModal(null)
          }}
        />
      )}
      {modal?.kind === 'detail' && (
        <AttributeDetailDialog attribute={modal.attribute} onClose={() => setModal(null)} />
      )}
      {modal?.kind === 'delete' && (
        <ConfirmDeleteDialog
          title="Xóa thuộc tính"
          confirmLabel="Xóa thuộc tính"
          onClose={() => setModal(null)}
          onConfirm={() => {
            onRemoveAttribute(modal.attribute.id)
            setModal(null)
          }}
        >
          <p className="m-0">
            Bạn có chắc muốn xóa thuộc tính{' '}
            <strong className="text-ink">“{modal.attribute.name}”</strong>?
          </p>
          <p className="m-0">Các giá trị và alias của thuộc tính cũng sẽ bị xóa.</p>
        </ConfirmDeleteDialog>
      )}
    </div>
  )
}
