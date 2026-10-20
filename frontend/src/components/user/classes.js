// Tiện ích class dùng riêng cho khu người dùng, tách khỏi khu moderator/admin
export const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus'

export const cx = (...classes) => classes.filter(Boolean).join(' ')
