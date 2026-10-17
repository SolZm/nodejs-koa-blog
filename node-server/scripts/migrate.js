#!/usr/bin/env node
/**
 * 迁移命令入口
 *
 *   node scripts/migrate.js up      执行所有未执行的迁移
 *   node scripts/migrate.js down    回滚最近一次迁移
 *   node scripts/migrate.js status  查看迁移状态
 *
 * 通常通过 npm script 调用：npm run migrate / npm run migrate:undo / npm run migrate:status
 */
const { umzug } = require('../core/umzug')

const command = process.argv[2] || 'up'

async function run() {
  switch (command) {
    case 'up': {
      const executed = await umzug.up()
      if (executed.length === 0) {
        console.log('[migrate] 没有待执行的迁移，数据库已是最新')
      } else {
        console.log('[migrate] 已执行：' + executed.map((m) => m.name).join(', '))
      }
      break
    }

    case 'down': {
      const reverted = await umzug.down()
      if (reverted.length === 0) {
        console.log('[migrate] 没有可回滚的迁移')
      } else {
        console.log('[migrate] 已回滚：' + reverted.map((m) => m.name).join(', '))
      }
      break
    }

    case 'status': {
      const pending = await umzug.pending()
      const executed = await umzug.executed()
      console.log('[migrate] 已执行 ' + executed.length + ' 个：' + (executed.map((m) => m.name).join(', ') || '(无)'))
      console.log('[migrate] 待执行 ' + pending.length + ' 个：' + (pending.map((m) => m.name).join(', ') || '(无)'))
      break
    }

    default:
      console.error('[migrate] 未知命令：' + command + '（可用：up / down / status）')
      process.exit(1)
  }
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[migrate] 执行失败：', err.message || err)
    process.exit(1)
  })
