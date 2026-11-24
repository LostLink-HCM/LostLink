import { useEffect, useState } from 'react'
import { listCategories } from '../api/categories'
let cache = null

const loadCategories = () => {
  cache ??= listCategories()
    .then(({ data }) => data.map(({ slug, name, icon }) => ({ slug, name, icon: icon || '' })))
    .catch((error) => {
      cache = null
      throw error
    })
  return cache
}

export function useFeedCategoryList() {
  const [state, setState] = useState({ categories: [], loading: true })

  useEffect(() => {
    let active = true
    loadCategories()
      .then((categories) => active && setState({ categories, loading: false }))
      .catch(() => active && setState({ categories: [], loading: false }))
    return () => {
      active = false
    }
  }, [])

  return state
}

export function useFeedCategories() {
  return useFeedCategoryList().categories
}
