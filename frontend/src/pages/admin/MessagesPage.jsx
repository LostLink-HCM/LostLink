import { useOutletContext } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import MessagesWorkspace from '../../components/backoffice/MessagesWorkspace'

export default function Messages() {
  const { messageState, setMessageState, quickReplies } = useOutletContext()
  const { user } = useAuth()

  return (
    <MessagesWorkspace
      messageState={messageState}
      setMessageState={setMessageState}
      workspaceRole="admin"
      user={user}
      quickReplies={quickReplies}
    />
  )
}
