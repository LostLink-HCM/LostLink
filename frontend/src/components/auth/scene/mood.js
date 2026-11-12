// Lớp ẩn hiện theo data-mood của svg cảnh, dùng chung cho mèo và cún

// lost: mất cuộn len, sad: form báo lỗi
export const SHOW_WHEN_SAD =
  'opacity-0 transition-opacity group-data-[mood=lost]/scene:opacity-100 group-data-[mood=sad]/scene:opacity-100'

export const DEFAULT_MOUTH =
  'transition-opacity group-data-[mood=lost]/scene:opacity-0 group-data-[mood=sad]/scene:opacity-0 group-data-[mood=happy]/scene:opacity-0 group-data-[mood=play]/scene:opacity-0 group-data-[mood=oops]/scene:opacity-0'

export const SHOW_WHEN_HAPPY =
  'opacity-0 transition-opacity group-data-[mood=happy]/scene:opacity-100'

export const SHOW_WHEN_PLAYFUL =
  'opacity-0 transition-opacity group-data-[mood=happy]/scene:opacity-100 group-data-[mood=play]/scene:opacity-100'

export const SHOW_WHEN_OOPS =
  'opacity-0 transition-opacity group-data-[mood=oops]/scene:opacity-100'

// Con ngươi nhìn theo ô đang nhập, --lx và --ly do AuthScene đặt
export const PUPILS = 'translate-x-(--lx) translate-y-(--ly) transition-[translate] duration-200'

export const LOOK_UP_WHEN_OOPS =
  'group-data-[mood=oops]/scene:translate-x-[3px] group-data-[mood=oops]/scene:-translate-y-[4px]'
