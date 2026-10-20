import { buttonClass } from './buttonClass'

// pressed: nút bật/tắt (Lưu bài, Theo dõi), tự gắn aria-pressed
export default function Button({
  variant,
  size,
  block,
  pressed,
  type = 'button',
  className,
  ...props
}) {
  return (
    <button
      type={type}
      aria-pressed={pressed}
      className={buttonClass({ variant, size, block, pressed, className })}
      {...props}
    />
  )
}
