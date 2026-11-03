const mongoose = require('mongoose')

const { Schema } = mongoose

// Danh mục đồ vật
const categorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    icon: { type: String, trim: true, default: '' },
    order: { type: Number, default: 0 },

    // Tham số ghép cặp theo docs/design/matching-algorithm.md (mục 5.1, 5.2, 8)
    // Bán kính ban đầu (mét), σ₀ = matchRadius / 3
    matchRadius: { type: Number, required: true, default: 400, min: 100, max: 50000 },
    timeShape: { type: Number, required: true, default: 1, min: 0.3, max: 5 }, // k của Weibull
    // Lưu trung vị admin nhập chứ không lưu λ, λ tính lại lúc chạy theo k
    timeMedianDays: { type: Number, required: true, default: 3.5, min: 0.1, max: 365 },
    diffusion: { type: Number, required: true, default: 0, min: 0 }, // D, m²/ngày; đồ vật nằm yên là 0

    // Checklist "Bên trong có", rỗng nghĩa là không phải danh mục vật chứa
    contentItems: [{ type: String, trim: true }],

    // Độ hiếm u: tỉ lệ bài thuộc danh mục, chỉ job định kỳ ghi
    frequency: { type: Number, min: 0, max: 1, default: null },
  },
  { timestamps: true, collection: 'categories' }
)

module.exports = mongoose.model('Category', categorySchema)
