const {AdminDao} = require('../../app/dao/admin')
const {nickname, email, password} = require('../utils')

test('创建管理员模型，按正常的参数传入，应该创建成功', async () => {
  // DAO 统一返回 [err, data] 元组，需要解构；原来直接取 admin.nickname 拿到的其实是元组对象
  const [err, admin] = await AdminDao.create({
    nickname,
    email,
    password
  })
  expect(err).toBeNull()
  expect(admin.nickname).toBe(nickname)
  expect(admin.email).toBe(email)
  expect(admin.password).toBe(undefined)
})
