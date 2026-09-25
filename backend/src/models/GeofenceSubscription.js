const mongoose = require('mongoose')

const { Schema } = mongoose

const geofenceSubscriptionSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    center: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true }, // [lng, lat]
    },
    radius: { type: Number, required: true }, // mét

    active: { type: Boolean, default: true },
  },
  { timestamps: true }
)

geofenceSubscriptionSchema.index({ center: '2dsphere' })

module.exports = mongoose.model('GeofenceSubscription', geofenceSubscriptionSchema)
