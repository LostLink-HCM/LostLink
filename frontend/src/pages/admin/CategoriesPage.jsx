import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import useSystemSettings from '../../hooks/useSystemSettings'
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
import {
  archiveAdminCategory,
  createAdminCategory,
  deleteAdminCategoryAttribute,
  deleteAdminCategoryQuestion,
  listAdminCategories,
  saveAdminCategoryAttribute,
  saveAdminCategoryQuestion,
  updateAdminCategoryAlgorithm,
  updateAdminCategoryContents,
  updateAdminCategoryGeneral,
  updateAdminCategoryRelations,
} from '../../lib/admin/categoriesApi'
import { DEFAULT_SETTINGS } from '../../lib/admin/settings'
import { withoutCategory } from '../../lib/admin/categories'

const byOrder = (a, b) => a.order - b.order || a.name.localeCompare(b.name, 'vi')

export default function Categories() {
  const [categoryState, setCategoryState] = useState({
    items: [],
    updatedAt: null,
    loading: true,
    error: '',
  })
  const categories = categoryState.items
  useEffect(() => {
    let active = true
    listAdminCategories()
      .then((result) => {
        if (active) setCategoryState({ ...result, loading: false, error: '' })
      })
      .catch((error) => {
        if (active) {
          setCategoryState((current) => ({
            ...current,
            loading: false,
            error: error.message || 'Không tải được danh sách danh mục. Vui lòng thử lại.',
          }))
        }
      })
    return () => {
      active = false
    }
  }, [])
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedId = searchParams.get('category')
  const requestedTab = searchParams.get('tab')
  const tab = ['general', 'attributes', 'relations', 'algorithm', 'questions'].includes(
    requestedTab
  )
    ? requestedTab
    : 'general'
  const matchingConfig = useSystemSettings({
    scope: 'matching',
    enabled: tab === 'attributes' || tab === 'algorithm',
  })
  const { systemSettings: matchingSettings } = matchingConfig
  const uFloor = matchingSettings?.values?.uFloor ?? DEFAULT_SETTINGS.uFloor
  const selectCategory = (id, nextTab = tab) =>
    setSearchParams(
      (current) => {
        const params = new URLSearchParams(current)
        if (id) params.set('category', id)
        else params.delete('category')
        params.set('tab', nextTab)
        params.delete('missing')
        params.delete('highlight')
        return params
      },
      { replace: true }
    )
  const setSelectedId = (id) => selectCategory(id)
  const setTab = (nextTab) => selectCategory(selected?.slug || selected?.id, nextTab)
  const [modal, setModal] = useState(null)
  const [recentCategoryId, setRecentCategoryId] = useState(null)
  const missing = searchParams.get('missing') === '1'
  const selected = missing
    ? null
    : selectedId
      ? categories.find((category) => category.id === selectedId || category.slug === selectedId)
      : categories[0]
  const applyCategoryUpdate = (updated) =>
    setCategoryState((current) => {
      const previous = current.items.find((category) => category.id === updated.id)
      const previousRecommendations = new Map(
        (previous?.attributes ?? []).map((attribute) => [attribute.id, attribute.mRecommendation])
      )
      const next = {
        ...updated,
        attributes: updated.attributes.map((attribute) => ({
          ...attribute,
          mRecommendation:
            attribute.mRecommendation ?? previousRecommendations.get(attribute.id) ?? null,
        })),
      }
      return {
        ...current,
        items: current.items.map((category) => (category.id === updated.id ? next : category)),
        updatedAt: updated.updatedAt || current.updatedAt,
        error: '',
      }
    })

  const saveGeneral = async (value) => {
    const updated = await updateAdminCategoryGeneral(selected.id, value)
    applyCategoryUpdate(updated)
    return updated
  }

  const saveAlgorithm = async (value) => {
    const updated = await updateAdminCategoryAlgorithm(selected.id, value)
    applyCategoryUpdate(updated)
    return updated
  }

  const saveContents = async (value) => {
    const updated = await updateAdminCategoryContents(selected.id, value)
    applyCategoryUpdate(updated)
    return updated
  }

  const saveRelations = async (value) => {
    const updated = await updateAdminCategoryRelations(selected.id, value)
    applyCategoryUpdate(updated)
    return updated
  }

  const saveAttribute = async (value) => {
    const updated = await saveAdminCategoryAttribute(selected.id, value)
    applyCategoryUpdate(updated)
    return updated
  }

  const removeAttribute = async (id) => {
    const updated = await deleteAdminCategoryAttribute(selected.id, id)
    applyCategoryUpdate(updated)
    return updated
  }

  const saveQuestion = async (id, text) => {
    const updated = await saveAdminCategoryQuestion(selected.id, id, text)
    applyCategoryUpdate(updated)
    return updated
  }

  const removeQuestion = async (id) => {
    const updated = await deleteAdminCategoryQuestion(selected.id, id)
    applyCategoryUpdate(updated)
    return updated
  }

  const createCategory = async (value) => {
    const created = await createAdminCategory(value)
    setRecentCategoryId(created.id)
    setCategoryState((current) => ({
      ...current,
      items: [...current.items, created],
      updatedAt: created.updatedAt || current.updatedAt,
      error: '',
    }))
    selectCategory(created.id, 'general')
  }

  const removeCategory = async () => {
    const archived = await archiveAdminCategory(selected.id)
    const next = withoutCategory(categories, archived.id)
    setCategoryState((current) => ({
      ...current,
      items: withoutCategory(current.items, archived.id),
      updatedAt: archived.updatedAt || current.updatedAt,
      error: '',
    }))
    setSelectedId([...next].sort(byOrder)[0]?.id)
  }

  const panelProps = (key) => ({
    role: 'tabpanel',
    id: `category-panel-${key}`,
    'aria-labelledby': `category-tab-${key}`,
    hidden: tab !== key,
    className: 'pt-5',
  })

  return (
    <div className="mx-auto max-w-[1640px] px-8 pt-7 pb-10 text-ink max-[1200px]:px-[22px] max-sm:px-4 max-sm:pt-[22px]">
      {categoryState.error && (
        <div
          role="alert"
          className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-danger-soft bg-danger-soft p-3 text-small text-danger-ink"
        >
          <span className="min-w-0 flex-1">{categoryState.error}</span>
          <Button
            size="sm"
            onClick={() => {
              setCategoryState((current) => ({ ...current, loading: true, error: '' }))
              listAdminCategories()
                .then((result) => setCategoryState({ ...result, loading: false, error: '' }))
                .catch((error) =>
                  setCategoryState((current) => ({
                    ...current,
                    loading: false,
                    error: error.message || 'Không tải được danh sách danh mục. Vui lòng thử lại.',
                  }))
                )
            }}
          >
            Thử lại
          </Button>
        </div>
      )}
      {(missing || (!categoryState.loading && selectedId && !selected)) && (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-danger-soft bg-danger-soft p-3 text-small text-danger-ink"
        >
          {missing ? 'Đối tượng không còn tồn tại.' : 'Không tìm thấy danh mục trên trang quản lý.'}
        </p>
      )}
      <div className="mb-4.5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <CategoryList
          categories={[...categories].sort((a, b) => {
            if (a.id === recentCategoryId) return -1
            if (b.id === recentCategoryId) return 1
            return byOrder(a, b)
          })}
          total={categories.length}
          loading={categoryState.loading}
          selectedId={selected?.id}
          onSelect={setSelectedId}
        />
        <div className="flex min-w-[220px] flex-col items-end gap-2 max-[640px]:w-full max-[640px]:items-stretch">
          <div className="flex items-center gap-2 text-small text-primary" role="status">
            <Icon name="history" size={16} className="shrink-0 text-primary" />
            <span>Cập nhật lần gần nhất</span>
            {categoryState.updatedAt ? (
              <time className="font-semibold text-primary" dateTime={categoryState.updatedAt}>
                {new Date(categoryState.updatedAt).toLocaleString('vi-VN')}
              </time>
            ) : (
              <strong className="font-semibold text-primary">Chưa có cập nhật</strong>
            )}
          </div>
          <Button
            className="max-[640px]:w-full"
            variant="primary"
            icon="compose"
            onClick={() => setModal('create')}
          >
            Thêm danh mục
          </Button>
        </div>
      </div>

      <div className="min-w-0">
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
                <GeneralTab category={selected} categories={categories} onSave={saveGeneral} />
              </div>
              <div {...panelProps('attributes')}>
                <AttributesTab
                  category={selected}
                  uFloor={uFloor}
                  uFloorReady={Boolean(matchingSettings)}
                  onSaveAttribute={saveAttribute}
                  onRemoveAttribute={removeAttribute}
                  onSaveContents={saveContents}
                />
              </div>
              <div {...panelProps('relations')}>
                <RelationsTab category={selected} categories={categories} onSave={saveRelations} />
              </div>
              <div {...panelProps('algorithm')}>
                <AlgorithmTab
                  category={selected}
                  onSave={saveAlgorithm}
                  matchingConfig={matchingConfig}
                />
              </div>
              <div {...panelProps('questions')}>
                <QuestionsTab
                  category={selected}
                  onSaveQuestion={saveQuestion}
                  onRemoveQuestion={removeQuestion}
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
