import { useEffect, useState } from 'react'
import { listCategories } from '../api/categories'
let cache = null

const loadCategories = () => {
  cache ??= listCategories()
    .then(({ data }) => data.map(({ slug, name }) => ({ slug, name })))
    .catch((error) => {
      cache = null
      throw error
    })
  return cache
}

export function useFeedCategories() {
  const [categories, setCategories] = useState([])

  useEffect(() => {
    let active = true
    loadCategories()
      .then((items) => active && setCategories(items))
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  return categories
}
