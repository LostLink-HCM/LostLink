import Badge from './Badge'

export default function TypeBadge({ type }) {
  return (
    <Badge tone={type === 'lost' ? 'danger' : 'primary'}>
      {type === 'lost' ? 'Mất đồ' : 'Nhặt được'}
    </Badge>
  )
}
