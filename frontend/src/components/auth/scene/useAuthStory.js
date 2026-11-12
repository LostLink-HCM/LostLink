import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { BEATS, nextBeat } from './story'
import { moodForFocus } from './useFocusTracking'

// Người dùng rảnh tay chừng này thì cảnh chơi tiếp
const IDLE_MS = 2500

// Điều khiển nhịp câu chuyện (story.js). loop false thì đứng yên
export default function useAuthStory({ start, loop, lastInput }) {
  const tosses = useRef(0)
  const [story, setStory] = useState(start ? 'arrive' : 'rest')
  const [storyMood, setStoryMood] = useState(start ? 'lost' : 'idle')
  const [prevLoop, setPrevLoop] = useState(loop)

  // Vừa bị tạm dừng thì bỏ nhịp đang diễn, về đứng yên
  if (loop !== prevLoop) {
    setPrevLoop(loop)
    if (!loop) setStory('rest')
  }

  const busy = () =>
    document.hidden ||
    moodForFocus(document.activeElement) !== 'idle' ||
    performance.now() - lastInput.current < IDLE_MS

  const advance = (from) => {
    const next = nextBeat(from, { busy: busy(), tosses: tosses.current })
    tosses.current = next.tosses
    setStory(next.beat)
  }
  const checkIdle = useEffectEvent(() => advance('rest'))

  // Đứng yên thì chờ người dùng rảnh tay, đang diễn thì đổi nét mặt theo mốc
  useEffect(() => {
    if (story === 'rest') {
      if (!loop) return
      const id = setInterval(checkIdle, 400)
      return () => clearInterval(id)
    }
    const timers = BEATS[story].moods.map(([at, mood]) => setTimeout(() => setStoryMood(mood), at))
    return () => timers.forEach(clearTimeout)
  }, [story, loop])

  // Chuyển nhịp theo animationend để luôn khớp với CSS, kể cả khi tab bị ẩn
  const onAnimationEnd = (event) => {
    if (story !== 'rest' && event.animationName === BEATS[story].endsOn) advance(story)
  }

  return { story, storyMood, onAnimationEnd }
}
