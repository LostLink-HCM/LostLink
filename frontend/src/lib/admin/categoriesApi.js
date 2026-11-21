import { api } from '../api'

const isDatabaseId = (value) => /^[a-f\d]{24}$/i.test(value || '')

const categoryPath = (categoryId) => `/admin/categories/${encodeURIComponent(categoryId)}`

const readCategory = async (request) => {
  const { data } = await request
  return data
}

export async function listAdminCategories() {
  return readCategory(api.get('/admin/categories'))
}

export async function createAdminCategory(input) {
  return readCategory(api.post('/admin/categories', input))
}

export async function uploadAdminCategoryIcon(file) {
  const form = new FormData()
  form.append('icon', file)
  const { data } = await api.post('/admin/categories/icon', form)
  return data.url
}

export async function updateAdminCategoryGeneral(categoryId, input) {
  return readCategory(api.patch(`${categoryPath(categoryId)}/general`, input))
}

export async function updateAdminCategoryAlgorithm(categoryId, input) {
  return readCategory(api.patch(`${categoryPath(categoryId)}/algorithm`, input))
}

export async function updateAdminCategoryContents(categoryId, contents) {
  return readCategory(
    api.put(`${categoryPath(categoryId)}/contents`, {
      contentItems: contents.map((item) => item.label),
    })
  )
}

const toAttributePayload = (attribute) => ({
  name: attribute.name,
  aliases: attribute.aliases,
  matchRole: attribute.matchRole,
  mProb: attribute.mProb,
  isRequired: attribute.isRequired,
  values: attribute.values.map(({ id, value, aliases }) => ({
    ...(isDatabaseId(id) ? { id } : {}),
    value,
    aliases,
  })),
})

export async function saveAdminCategoryAttribute(categoryId, attribute) {
  const payload = toAttributePayload(attribute)
  const path = `${categoryPath(categoryId)}/attributes`
  return readCategory(
    isDatabaseId(attribute.id)
      ? api.patch(`${path}/${encodeURIComponent(attribute.id)}`, payload)
      : api.post(path, payload)
  )
}

export async function deleteAdminCategoryAttribute(categoryId, attributeId) {
  return readCategory(
    api.delete(`${categoryPath(categoryId)}/attributes/${encodeURIComponent(attributeId)}`)
  )
}

export async function updateAdminCategoryRelations(categoryId, relations) {
  return readCategory(
    api.put(`${categoryPath(categoryId)}/relations`, {
      relations: relations.map(({ id, ratio, memberCategoryIds }) => ({
        ...(isDatabaseId(id) ? { id } : {}),
        ratio,
        memberCategoryIds,
      })),
    })
  )
}

export async function saveAdminCategoryQuestion(categoryId, questionId, text) {
  const path = `${categoryPath(categoryId)}/verification-questions`
  return readCategory(
    isDatabaseId(questionId)
      ? api.patch(`${path}/${encodeURIComponent(questionId)}`, { text })
      : api.post(path, { text })
  )
}

export async function deleteAdminCategoryQuestion(categoryId, questionId) {
  return readCategory(
    api.delete(
      `${categoryPath(categoryId)}/verification-questions/${encodeURIComponent(questionId)}`
    )
  )
}

export async function archiveAdminCategory(categoryId) {
  return readCategory(api.delete(categoryPath(categoryId)))
}
