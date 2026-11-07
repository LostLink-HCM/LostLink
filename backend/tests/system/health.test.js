const assert = require('node:assert/strict')
const { describe, test } = require('node:test')
const request = require('supertest')

const { app } = require('../helpers/auth')
const { useTestDb } = require('../helpers/db')

useTestDb()

describe('NF - Theo dõi bản đang chạy (health check)', () => {
  test('trả trạng thái CSDL và mã commit của bản đang chạy để CI xác nhận deploy', async () => {
    const res = await request(app).get('/api/health').expect(200)

    assert.equal(res.body.status, 'ok')
    assert.equal(res.body.database, 'connected')
    assert.equal(res.body.version, 'test-commit-sha')
  })
})
