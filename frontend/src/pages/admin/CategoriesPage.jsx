import { useMemo, useRef, useState } from 'react'
import Icon from '../../components/common/Icon'
import Button from '../../components/backoffice/Button'
import AlgorithmTab from '../../components/admin/categories/AlgorithmTab'
import AttributesTab from '../../components/admin/categories/AttributesTab'
import CategoryAvatar from '../../components/admin/categories/CategoryAvatar'
import CategoryList from '../../components/admin/categories/CategoryList'
import CategoryTabs from '../../components/admin/categories/CategoryTabs'
import CreateCategoryDialog from '../../components/admin/categories/CreateCategoryDialog'
import DeleteCategoryDialog from '../../components/admin/categories/DeleteCategoryDialog'
import GeneralTab from '../../components/admin/categories/GeneralTab'
import QuestionsTab from '../../components/admin/categories/QuestionsTab'
import RelationsTab from '../../components/admin/categories/RelationsTab'
import { createAdminCategories } from '../../data/adminCategories'
import { EMPTY_CATEGORY, makeId, withoutCategory } from '../../lib/admin/categories'

const byOrder = (a, b) => a.order - b.order || a.name.localeCompare(b.name, 'vi')

export default function Categories() {
  const [categoryState, setCategoryState] = useState(() => ({
    items: createAdminCategories(),
    updatedAt: null,
  }))
  const categories = categoryState.items
  const [selectedId, setSelectedId] = useState(categories[0]?.id)
  const [tab, setTab] = useState('general')
  const [modal, setModal] = useState(null)
  const [query, setQuery] = useState('')
  const listRef = useRef(null)
  const selected = categories.find((category) => category.id === selectedId) || categories[0]
  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('vi')
    return [...categories]
      .sort(byOrder)
      .filter((category) =>
        `${category.name} ${category.aliases.join(' ')}`
          .toLocaleLowerCase('vi')
          .includes(normalizedQuery)
      )
  }, [categories, query])

  const updateCategories = (update) =>
    setCategoryState((current) => ({
      items: update(current.items),
      updatedAt: new Date().toISOString(),
    }))

  const patchSelected = (patch) =>
    updateCategories((current) =>
      current.map((category) =>
        category.id === selected.id
          ? { ...category, ...(typeof patch === 'function' ? patch(category) : patch) }
          : category
      )
    )

  const createCategory = (value) => {
    const id = makeId('CAT')
    updateCategories((current) => [
      ...current,
      {
        ...EMPTY_CATEGORY,
        ...value,
        id,
        order: Math.max(0, ...current.map((category) => category.order)) + 1,
        attributes: [],
        contents: [],
        relations: [],
        questions: [],
      },
    ])
    setSelectedId(id)
    setTab('general')
    setQuery('')
    setModal(null)
    requestAnimationFrame(() => {
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
    })
  }

  const removeCategory = () => {
    const next = withoutCategory(categories, selected.id)
    updateCategories(() => next)
    setSelectedId([...next].sort(byOrder)[0]?.id)
    setModal(null)
  }

  const saveAttribute = (attribute) =>
    patchSelected((category) => ({
      attributes: category.attributes.some((item) => item.id === attribute.id)
        ? category.attributes.map((item) => (item.id === attribute.id ? attribute : item))
        : [...category.attributes, attribute],
    }))

  const saveQuestion = (id, text) =>
    patchSelected((category) => ({
      questions: id
        ? category.questions.map((question) =>
            question.id === id ? { ...question, text } : question
          )
        : [...category.questions, { id: makeId('question'), text }],
    }))

  const panelProps = (key) => ({
    role: 'tabpanel',
    id: `category-panel-${key}`,
    'aria-labelledby': `category-tab-${key}`,
    hidden: tab !== key,
    className: 'pt-5',
  })

  return (
    <div className="mx-auto max-w-[1640px] px-8 pt-7 pb-10 text-ink max-[1200px]:px-[22px] max-sm:px-4 max-sm:pt-[22px]">
      <div className="mb-4.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 text-small text-ink-muted" role="status">
          <Icon name="history" size={18} className="shrink-0 text-ink-subtle" />
          <div>
            <span className="block">Cập nhật lần gần nhất</span>
            {categoryState.updatedAt ? (
              <time
                className="mt-1 block text-small font-semibold text-ink-secondary"
                dateTime={categoryState.updatedAt}
              >
                {new Date(categoryState.updatedAt).toLocaleString('vi-VN')}
              </time>
            ) : (
              <strong className="mt-1 block text-small font-semibold text-ink-secondary">
                Chưa có cập nhật
              </strong>
            )}
          </div>
        </div>
        <Button variant="primary" icon="compose" onClick={() => setModal('create')}>
          Thêm danh mục
        </Button>
      </div>

      <div className="grid items-start gap-5.5 [grid-template-columns:minmax(245px,.62fr)_minmax(0,2fr)] max-[1100px]:gap-4 max-[1100px]:[grid-template-columns:minmax(220px,.62fr)_minmax(0,1.6fr)] max-[800px]:grid-cols-1">
        <CategoryList
          categories={filtered}
          total={categories.length}
          selectedId={selected?.id}
          query={query}
          onQueryChange={setQuery}
          onSelect={setSelectedId}
          listRef={listRef}
        />

        {selected && (
          <section
            className="min-w-0 overflow-hidden rounded-2xl border border-line-soft bg-surface shadow-soft"
            aria-label={`Chi tiết danh mục ${selected.name}`}
          >
            <header className="bg-linear-to-b from-primary-subtle to-primary-faint p-6 pb-4 max-[1100px]:p-4.5 max-[1100px]:pb-4 max-sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-5">
                <div className="flex min-w-0 items-center gap-4">
                  <CategoryAvatar
                    src={selected.icon}
                    className="size-14 rounded-2xl shadow-raised"
                  />
                  <div className="min-w-0">
                    <h2 className="m-0 text-2xl font-bold tracking-[-.4px] text-primary-hover">
                      {selected.name}
                    </h2>
                    {selected.aliases.length > 0 && (
                      <p className="mt-1 mb-0 text-small text-ink-muted">
                        Alias: {selected.aliases.join(', ')}
                      </p>
                    )}
                  </div>
                </div>
                <Button
                  className="text-caption max-sm:w-full"
                  variant="danger-subtle"
                  icon="trash"
                  disabled={categories.length <= 1}
                  onClick={() => setModal('delete')}
                >
                  Xóa danh mục
                </Button>
              </div>

              <CategoryTabs value={tab} onChange={setTab} />
            </header>

            <div
              key={selected.id}
              className="px-6 pb-6 max-[1100px]:px-4.5 max-[1100px]:pb-4.5 max-sm:px-4 max-sm:pb-4"
            >
              <div {...panelProps('general')}>
                <GeneralTab category={selected} categories={categories} onSave={patchSelected} />
              </div>
              <div {...panelProps('attributes')}>
                <AttributesTab
                  category={selected}
                  onSaveAttribute={saveAttribute}
                  onRemoveAttribute={(id) =>
                    patchSelected((category) => ({
                      attributes: category.attributes.filter((attribute) => attribute.id !== id),
                    }))
                  }
                  onSaveContents={(contents) => patchSelected({ contents })}
                />
              </div>
              <div {...panelProps('relations')}>
                <RelationsTab
                  category={selected}
                  categories={categories}
                  onSave={(relations) => patchSelected({ relations })}
                />
              </div>
              <div {...panelProps('algorithm')}>
                <AlgorithmTab category={selected} onSave={patchSelected} />
              </div>
              <div {...panelProps('questions')}>
                <QuestionsTab
                  category={selected}
                  onSaveQuestion={saveQuestion}
                  onRemoveQuestion={(id) =>
                    patchSelected((category) => ({
                      questions: category.questions.filter((question) => question.id !== id),
                    }))
                  }
                />
              </div>
            </div>
          </section>
        )}
      </div>

      {modal === 'create' && (
        <CreateCategoryDialog
          categories={[...categories].sort(byOrder)}
          onSubmit={createCategory}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'delete' && selected && (
        <DeleteCategoryDialog
          category={selected}
          categories={categories}
          onConfirm={removeCategory}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
