import { useOutletContext } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import MessagesWorkspace from '../../components/backoffice/MessagesWorkspace'

export default function Messages() {
  const { messageState, setMessageState, quickReplies } = useOutletContext()
  const { user } = useAuth()
  const workspaceRole = user?.role === 'admin' ? 'admin' : 'moderator'

  return (
    <MessagesWorkspace
      messageState={messageState}
      setMessageState={setMessageState}
      workspaceRole={workspaceRole}
      user={user}
      quickReplies={quickReplies}
    />
  )
}
