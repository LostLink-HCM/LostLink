// Từ `strong` trở lên là gợi ý mạnh, từ `possible` tới dưới `strong` là gợi ý yếu, thấp hơn thì không gợi ý
export const MATCH_THRESHOLDS = { strong: 0.9, possible: 0.5 }

// Bài còn nhận gợi ý ghép cặp: Đang tìm hoặc Đã liên hệ
export const isMatchable = (post) => ['searching', 'contacted'].includes(post.status)

// Gợi ý bị từ chối, hết hiệu lực hoặc dưới ngưỡng thì không hiện
const isVisible = (match) =>
  !['rejected', 'stale'].includes(match.state) && match.score >= MATCH_THRESHOLDS.possible

export const matchPercent = (score) => `${Math.round(score * 100)}%`

export const isStrongMatch = (score) => score >= MATCH_THRESHOLDS.strong

// Tiêu chí ủng hộ trước, mạnh nhất trước; tiêu chí chống lại sau
export const sortedEvidence = (evidence) => [...evidence].sort((a, b) => b.weight - a.weight)

// Gợi ý cho một bài của tôi kèm bài đối ứng, khả năng khớp cao trước
export function suggestionsFor(myPost, posts, matches) {
  const lost = myPost.type === 'lost'
  return matches
    .filter((match) => isVisible(match) && (lost ? match.postLost : match.postFound) === myPost.id)
    .map((match) => ({
      match,
      post: posts.find((post) => post.id === (lost ? match.postFound : match.postLost)),
    }))
    .filter((item) => item.post)
    .sort((a, b) => b.match.score - a.match.score)
}

// Các bài của tôi còn nhận gợi ý, mỗi bài kèm danh sách gợi ý của nó
export const matchGroups = (posts, matches, username) =>
  posts
    .filter((post) => post.author === username && isMatchable(post))
    .map((post) => ({ post, items: suggestionsFor(post, posts, matches) }))
