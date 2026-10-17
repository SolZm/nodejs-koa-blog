#!/usr/bin/env node
/**
 * 离线建索引：把文章切片、向量化，写入 article_chunk
 *
 * 用法：
 *   npm run index             增量：只处理新增或内容有变化的文章
 *   npm run index -- --force  全量重建（比如换了向量模型）
 *   npm run index -- --id=31  只处理指定文章，方便调试
 *
 * 为什么放在离线脚本而不是接口里：
 *   向量化慢、会失败、按量计费。放进请求链路会让接口又慢又不可靠。
 *   离线跑还能失败重来，不影响线上。
 */
require('module-alias/register')

const config = require('../config/config')
const InitManager = require('../core/init')

InitManager.loadConfig()
InitManager.loadHttpException()

const { sequelize } = require('@core/db')
const { indexAll } = require('@service/ai/indexer')

const args = process.argv.slice(2)
const FORCE = args.includes('--force')
const onlyId = (args.find((arg) => arg.startsWith('--id=')) || '').split('=')[1]

async function main() {
  console.log(
    `[index] 开始（provider=${config.ai.provider}${FORCE ? ', 强制全量' : ''}${onlyId ? ', 仅 #' + onlyId : ''}）`
  )

  const stats = await indexAll({ force: FORCE, onlyId }, (line) => console.log(line))

  console.log(
    `[index] 完成：待处理 ${stats.total} 篇 / 新索引 ${stats.indexed} 篇 / 跳过 ${stats.skipped} 篇 / 失败 ${stats.failed} 篇，共写入 ${stats.chunks} 片，耗时 ${stats.seconds}s（model=${stats.model}）`
  )

  return stats.failed
}

main()
  .then(async (failed) => {
    await sequelize.close()
    process.exit(failed > 0 ? 1 : 0)
  })
  .catch(async (err) => {
    console.error('[index] 执行失败：', err)
    await sequelize.close().catch(() => {})
    process.exit(1)
  })
