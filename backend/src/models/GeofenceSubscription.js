const mongoose = require('mongoose')

const { Schema } = mongoose

const NAME_MAX = 60
const RADIUS_MIN = 500
const RADIUS_MAX = 5000

const geofenceSubscriptionSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, default: '', trim: true, maxlength: NAME_MAX },
    center: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true }, // [lng, lat]
    },
    radius: { type: Number, required: true, min: RADIUS_MIN, max: RADIUS_MAX }, // mét

    active: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'geofence_subscriptions' }
)

geofenceSubscriptionSchema.index({ center: '2dsphere' })

const GeofenceSubscription = mongoose.model('GeofenceSubscription', geofenceSubscriptionSchema)
GeofenceSubscription.NAME_MAX = NAME_MAX
GeofenceSubscription.RADIUS_MIN = RADIUS_MIN
GeofenceSubscription.RADIUS_MAX = RADIUS_MAX

module.exports = GeofenceSubscription
