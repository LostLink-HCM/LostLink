import { useState } from 'react'
import Icon from '../../common/Icon'
import Button from '../../backoffice/Button'
import IconButton from '../../backoffice/IconButton'
import { cx, focusRing } from '../../backoffice/classes'
import {
  DEFAULT_RELATION_RATIO,
  isSame,
  makeId,
  validateRelations,
} from '../../../lib/admin/categories'
import { inputClass } from './styles'
import { Panel, SaveBar } from './ui'

// Form giữ tỷ lệ dạng phần trăm cho dễ nhập, lưu lại dạng 0 đến 1
const toForm = (relations) =>
  relations.map((relation) => ({ ...relation, ratioPercent: Math.round(relation.ratio * 100) }))

const fromForm = (relations, sourceCategoryId) =>
  relations.map(({ ratioPercent, ...relation }) => ({
    ...relation,
    sourceCategoryId,
    ratio: Number(ratioPercent) / 100,
  }))

function RelationGroup({ relation, index, candidates, takenIds, onChange, onRemove }) {
  const members = candidates.filter((category) => relation.memberCategoryIds.includes(category.id))
  const toggle = (categoryId) =>
    onChange({
      ...relation,
      memberCategoryIds: relation.memberCategoryIds.includes(categoryId)
        ? relation.memberCategoryIds.filter((id) => id !== categoryId)
        : [...relation.memberCategoryIds, categoryId],
    })

  return (
    <article className="rounded-xl border border-line-soft bg-primary-faint p-3.5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <strong className="text-small font-semibold text-ink-secondary">Nhóm {index + 1}</strong>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-caption font-semibold text-ink-secondary">
            Tỷ lệ r
            <span className="relative w-24">
              <input
                className={cx(inputClass, 'pr-8 tabular-nums')}
                type="number"
                min="1"
                max="100"
                step="5"
                value={relation.ratioPercent}
                onChange={(event) => onChange({ ...relation, ratioPercent: event.target.value })}
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-small text-ink-muted">
                %
              </span>
            </span>
          </label>
          <IconButton label={`Xóa nhóm ${index + 1}`} icon="close" danger onClick={onRemove} />
        </div>
      </header>

      {members.length > 0 && (
        <ul className="m-0 mt-3 flex list-none flex-wrap gap-2 p-0">
          {members.map((member) => (
            <li
              key={member.id}
              className="inline-flex max-w-full items-center gap-1 rounded-full bg-primary-soft py-1 pr-1 pl-3 text-small font-medium text-primary"
            >
              <span className="truncate">{member.name}</span>
              <button
                type="button"
                className={cx(
                  'inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-muted hover:bg-white hover:text-danger-ink',
                  focusRing
                )}
                aria-label={`Bỏ ${member.name} khỏi nhóm ${index + 1}`}
                onClick={() => toggle(member.id)}
              >
                <Icon name="close" size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <details className="mt-3 rounded-xl border border-line-soft bg-surface">
        <summary className="cursor-pointer rounded-xl px-3 py-2 text-small font-semibold text-primary outline-none hover:bg-primary-faint focus-visible:ring-2 focus-visible:ring-focus/30">
          Chọn danh mục
        </summary>
        <div className="grid max-h-52 gap-1 overflow-y-auto border-t border-line-subtle p-2 sm:grid-cols-2">
          {candidates.map((category) => {
            const inOtherGroup =
              takenIds.has(category.id) && !relation.memberCategoryIds.includes(category.id)
            return (
              <label
                key={category.id}
                className={cx(
                  'flex items-center gap-2 rounded-md px-2.5 py-2 text-small text-ink-secondary',
                  inOtherGroup
                    ? 'cursor-not-allowed opacity-50'
                    : 'cursor-pointer hover:bg-primary-subtle'
                )}
              >
                <input
                  type="checkbox"
                  className="size-4 shrink-0 accent-primary"
                  checked={relation.memberCategoryIds.includes(category.id)}
                  disabled={inOtherGroup}
                  onChange={() => toggle(category.id)}
                />
                <span className="min-w-0 truncate font-semibold">{category.name}</span>
                {inOtherGroup && (
                  <small className="ml-auto shrink-0 text-ink-muted">Nhóm khác</small>
                )}
              </label>
            )
          })}
        </div>
      </details>
    </article>
  )
}

export default function RelationsTab({ category, categories, onSave }) {
  const saved = toForm(category.relations)
  const [relations, setRelations] = useState(saved)
  const [error, setError] = useState('')
  const dirty = !isSame(fromForm(relations, category.id), category.relations)
  const candidates = categories.filter((item) => item.id !== category.id)
  const takenIds = new Set(relations.flatMap((relation) => relation.memberCategoryIds))
  const change = (next) => {
    setError('')
    setRelations(next)
  }

  const submit = (event) => {
    event.preventDefault()
    const nextError = validateRelations(relations)
    if (nextError) return setError(nextError)
    const next = fromForm(relations, category.id)
    onSave(next)
    setRelations(toForm(next))
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="m-0 flex items-start gap-2.5 rounded-2xl bg-linear-to-r from-primary-soft to-primary-faint px-4 py-3 text-small leading-relaxed text-primary">
        <Icon name="info" size={16} className="mt-0.5 shrink-0" />
        <span>
          Bài mất thuộc danh mục này sẽ được ghép với bài nhặt thuộc các danh mục bên dưới. Trùng
          danh mục liên quan được tính bằng r lần trùng hẳn. Ví dụ Ví với Giấy tờ: 60%.
        </span>
      </p>

      <form
        id="category-relations-form"
        className="flex flex-col gap-4"
        onSubmit={submit}
        noValidate
      >
        <Panel
          title="Danh mục liên quan"
          action={
            <Button
              className="text-caption"
              icon="plus"
              onClick={() =>
                change([
                  ...relations,
                  {
                    id: makeId('relation'),
                    sourceCategoryId: category.id,
                    memberCategoryIds: [],
                    ratioPercent: DEFAULT_RELATION_RATIO * 100,
                  },
                ])
              }
            >
              Thêm nhóm
            </Button>
          }
        >
          {relations.length ? (
            <div className="space-y-3 p-4.5 max-sm:p-3">
              {relations.map((relation, index) => (
                <RelationGroup
                  key={relation.id}
                  relation={relation}
                  index={index}
                  candidates={candidates}
                  takenIds={takenIds}
                  onChange={(next) =>
                    change(relations.map((item, i) => (i === index ? next : item)))
                  }
                  onRemove={() => change(relations.filter((_, i) => i !== index))}
                />
              ))}
            </div>
          ) : (
            <p className="m-0 p-6 text-center text-body text-ink-muted">
              Chưa có danh mục liên quan.
            </p>
          )}
        </Panel>
        <SaveBar
          formId="category-relations-form"
          dirty={dirty}
          error={error}
          onReset={() => change(saved)}
        />
      </form>
    </div>
  )
}
