import { useOutletContext } from 'react-router-dom'
import PostsWorkspace from '../../components/backoffice/PostsWorkspace'

export default function Posts() {
  const { posts, setPosts, matchPairs } = useOutletContext()

  return <PostsWorkspace posts={posts} setPosts={setPosts} matchPairs={matchPairs} />
}
