const { EventEmitter } = require('node:events')

const events = new EventEmitter()

const notifyFrequencyInputsChanged = () => events.emit('frequency-inputs-changed')
const onFrequencyInputsChanged = (listener) => events.on('frequency-inputs-changed', listener)
const offFrequencyInputsChanged = (listener) => events.off('frequency-inputs-changed', listener)

module.exports = {
  notifyFrequencyInputsChanged,
  onFrequencyInputsChanged,
  offFrequencyInputsChanged,
}
