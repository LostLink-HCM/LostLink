const assert = require('node:assert/strict')
const { describe, test } = require('node:test')

const {
  AttributeValue,
  Category,
  CategoryAttribute,
  CategoryVerificationQuestion,
} = require('../../src/models')
const { createUser, newClient } = require('../helpers/auth')
const { useTestDb } = require('../helpers/db')

useTestDb()

describe('Danh mục cho form Đăng bài', () => {
  test('Guest xem được danh mục kèm thuộc tính, giá trị, checklist và câu hỏi gợi ý', async () => {
    const admin = await createUser()
    const wallet = await Category.create({
      name: 'Ví & tiền',
      slug: 'vi-tien',
      order: 2,
      matchRadius: 400,
      frequency: 0.18,
      contentItems: ['Tiền mặt', 'CCCD/CMND'],
    })
    await Category.create({ name: 'Giấy tờ & thẻ', slug: 'giay-to-the', order: 1 })
    const material = await CategoryAttribute.create({
      category: wallet._id,
      name: 'Chất liệu',
      matchRole: 'exclude',
      mProb: 0.8,
    })
    const leather = await AttributeValue.create({
      attribute: material._id,
      value: 'Da',
      frequency: 0.5,
    })
    const fabric = await AttributeValue.create({ attribute: material._id, value: 'Vải' })
    await CategoryVerificationQuestion.create({
      category: wallet._id,
      question: 'Bên trong ví có thẻ nào?',
      createdBy: admin._id,
    })

    const res = await newClient().get('/api/categories')

    assert.equal(res.status, 200)
    assert.deepEqual(
      res.body.data.map((category) => category.slug),
      ['giay-to-the', 'vi-tien']
    )
    assert.deepEqual(res.body.data[1], {
      slug: 'vi-tien',
      name: 'Ví & tiền',
      icon: '',
      contentItems: ['Tiền mặt', 'CCCD/CMND'],
      attributes: [
        {
          id: String(material._id),
          name: 'Chất liệu',
          isRequired: false,
          values: [
            { id: String(leather._id), value: 'Da' },
            { id: String(fabric._id), value: 'Vải' },
          ],
        },
      ],
      suggestedQuestions: ['Bên trong ví có thẻ nào?'],
    })
    // Tham số ghép cặp, độ hiếm, vai trò thuộc tính là dữ liệu nội bộ
    assert.doesNotMatch(JSON.stringify(res.body), /matchRadius|frequency|matchRole|mProb|createdBy/)
  })
})
