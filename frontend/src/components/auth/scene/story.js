export const BEATS = {
  arrive: {
    endsOn: 'auth-bubble',
    moods: [
      [0, 'lost'],
      [4700, 'happy'],
    ],
  },
  toss: { endsOn: 'auth-yarn-toss', moods: [[0, 'play']] },
  back: { endsOn: 'auth-yarn-back', moods: [[0, 'play']] },
  lose: {
    endsOn: 'auth-dog-out',
    moods: [
      [0, 'play'],
      [900, 'oops'],
      [1900, 'lost'],
    ],
  },
}

// Số lượt mèo khều len sang trước khi cún làm văng mất
export const TOSSES = 2

// Chỉ dừng (rest) khi cuộn len nằm dưới chân mèo. Đã làm văng len thì phải diễn arrive
export function nextBeat(beat, { busy = false, tosses = 0 } = {}) {
  switch (beat) {
    case 'rest':
      return busy ? { beat: 'rest', tosses } : { beat: 'toss', tosses: 0 }
    case 'toss': {
      const count = tosses + 1
      return { beat: count >= TOSSES && !busy ? 'lose' : 'back', tosses: count }
    }
    case 'back':
      return { beat: busy ? 'rest' : 'toss', tosses }
    case 'lose':
      return { beat: 'arrive', tosses: 0 }
    default:
      return { beat: 'rest', tosses: 0 }
  }
}
