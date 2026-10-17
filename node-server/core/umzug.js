/**
 * 迁移器（Umzug）
 *
 * 职责：扫描 migrations/ 目录，按文件名顺序执行其中的 up / down。
 * 已执行过的迁移记录在数据库的 SequelizeMeta 表里，避免重复执行。
 */
const path = require('path')
const { Umzug, SequelizeStorage } = require('umzug')

const { sequelize } = require('./db')

const umzug = new Umzug({
  migrations: {
    // 用绝对路径，保证从任何工作目录调用都不会找不到迁移文件
    glob: path.join(__dirname, '../migrations/*.js')
  },
  // 传给每个迁移的上下文：这里给 QueryInterface，迁移里写 SQL / 改表都用它
  context: sequelize.getQueryInterface(),
  // 记录已执行迁移的表，默认表名 SequelizeMeta
  storage: new SequelizeStorage({ sequelize }),
  logger: console
})

module.exports = { umzug }
