const { AttributeValue, Category, CategoryAttribute, Post } = require('../../src/models')
const { todayVn } = require('../../src/utils/vnTime')

const DAY = 24 * 60 * 60 * 1000
const BEN_THANH = { lat: 10.7725, lng: 106.698 }

const yesterday = () => todayVn(Date.now() - DAY)

// Danh mục Ví & tiền có thuộc tính Chất liệu và checklist đồ bên trong
const createWalletCategory = async () => {
  const category = await Category.create({
    name: 'Ví & tiền',
    slug: 'vi-tien',
    contentItems: ['Tiền mặt', 'CCCD/CMND', 'Thẻ ngân hàng'],
  })
  const material = await CategoryAttribute.create({ category: category._id, name: 'Chất liệu' })
  const leather = await AttributeValue.create({ attribute: material._id, value: 'Da' })
  const plastic = await AttributeValue.create({ attribute: material._id, value: 'Nhựa' })
  return { category, material, leather, plastic }
}

// Tạo thẳng trong CSDL: bài Mất đồ đang tìm, ghim ở chợ Bến Thành
const makePost = (owner, category, fields = {}) =>
  Post.create({
    owner: owner._id,
    type: 'lost',
    category: category._id,
    title: 'Mất ví da màu nâu',
    timeFrom: new Date(Date.now() - 2 * DAY),
    area: 'Quận 1',
    placeName: 'Chợ Bến Thành, Phường Bến Thành, Quận 1',
    locType: 'point',
    locExact: { type: 'Point', coordinates: [BEN_THANH.lng, BEN_THANH.lat] },
    locPublic: { type: 'Point', coordinates: [106.6995, 10.7738] },
    status: 'searching',
    ...fields,
  })

const jpeg = (name = 'anh.jpg', size = 1024) => ({
  buffer: Buffer.alloc(size, 1),
  name,
  type: 'image/jpeg',
})

// Gửi form multipart giống trình duyệt: field data là JSON, field images là ảnh
const multipart = (req, token, payload, images = []) => {
  let next = token ? req.set('Authorization', `Bearer ${token}`) : req
  next = next.field('data', typeof payload === 'string' ? payload : JSON.stringify(payload))
  for (const image of images) {
    next = next.attach('images', image.buffer, { filename: image.name, contentType: image.type })
  }
  return next
}

// Client đã đăng nhập: gọi API kèm access token
const authed = (client, accessToken) => {
  const withToken = (req) => req.set('Authorization', `Bearer ${accessToken}`)
  return {
    get: (path) => withToken(client.get(path)),
    delete: (path) => withToken(client.delete(path)),
    patch: (path, body) => withToken(client.patch(path)).send(body),
    patchForm: (path, payload, images) =>
      multipart(client.patch(path), accessToken, payload, images),
    postForm: (path, payload, images) => multipart(client.post(path), accessToken, payload, images),
  }
}

module.exports = {
  DAY,
  BEN_THANH,
  yesterday,
  createWalletCategory,
  makePost,
  jpeg,
  multipart,
  authed,
}
