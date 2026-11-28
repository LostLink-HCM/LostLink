import Icon from '../../common/Icon'
import Avatar from '../Avatar'

// Ảnh người bên kia; yêu cầu hỗ trợ (mình là Moderator được giao) có huy hiệu khiên
export default function ThreadAvatar({ thread, size }) {
  const avatar = <Avatar initials={thread.peer.initials} src={thread.peer.avatarUrl} size={size} />
  if (thread.support !== 'handler') return avatar
  return (
    <span className="relative block shrink-0">
      {avatar}
      <span className="absolute -right-1 -bottom-1 grid size-5 place-items-center rounded-full bg-primary text-white ring-2 ring-surface">
        <Icon name="shield" size={11} />
      </span>
    </span>
  )
}
