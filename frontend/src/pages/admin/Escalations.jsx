import { useOutletContext } from 'react-router-dom'
import EscalationsWorkspace from '../../components/backoffice/EscalationsWorkspace'

export default function Escalations() {
  const { escalationState, setEscalationState } = useOutletContext()

  return (
    <EscalationsWorkspace
      escalationState={escalationState}
      setEscalationState={setEscalationState}
      actor="Admin"
    />
  )
}
