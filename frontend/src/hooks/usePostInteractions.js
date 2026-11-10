import { useCallback, useState } from 'react'
import { followPost, likePost, savePost, unfollowPost, unlikePost, unsavePost } from '../api/posts'

const SAVE_ERROR = 'Đã có lỗi xảy ra, vui lòng thử lại.'

const ACTIONS = {
  liked: { on: likePost, off: unlikePost },
  saved: { on: savePost, off: unsavePost, notice: ['Đã lưu bài.', 'Đã bỏ lưu bài.'] },
  following: {
    on: followPost,
    off: unfollowPost,
    notice: ['Đã theo dõi bài đăng.', 'Đã bỏ theo dõi bài đăng.'],
  },
}

// Thích, lưu, theo dõi bài. Giữ thay đổi theo id bài để các trang hiện giống nhau,
// đổi ngay trên giao diện, lỗi thì trả lại
export function usePostInteractions({ requireMember, notify }) {
  const [changes, setChanges] = useState({})

  const stateOf = useCallback(
    (post) => ({
      liked: post.viewer?.liked ?? false,
      likes: post.likes,
      saved: post.viewer?.saved ?? false,
      following: post.viewer?.following ?? false,
      ...changes[post.id],
    }),
    [changes]
  )

  const apply = (id, patch) => setChanges((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }))

  // Trả về trạng thái mới, null nếu chưa đăng nhập hoặc lỗi
  const toggle = (field) => async (post) => {
    if (!requireMember()) return null
    const current = stateOf(post)
    const next = !current[field]
    const { on, off, notice } = ACTIONS[field]
    apply(
      post.id,
      field === 'liked'
        ? { liked: next, likes: current.likes + (next ? 1 : -1) }
        : { [field]: next }
    )
    try {
      const { data } = await (next ? on : off)(post.id)
      apply(post.id, data)
      if (notice) notify(next ? notice[0] : notice[1])
      return next
    } catch {
      apply(
        post.id,
        field === 'liked'
          ? { liked: current.liked, likes: current.likes }
          : { [field]: current[field] }
      )
      notify(SAVE_ERROR)
      return null
    }
  }

  return {
    stateOf,
    toggleLike: toggle('liked'),
    toggleSaved: toggle('saved'),
    toggleFollowed: toggle('following'),
  }
}
