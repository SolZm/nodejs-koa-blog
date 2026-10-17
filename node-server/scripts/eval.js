#!/usr/bin/env node
/**
 * 检索评测
 *
 *   npm run eval                      跑三种模式并输出对比表
 *   npm run eval -- --mode hybrid     只跑某一种
 *   npm run eval -- --verbose         打印每道题的命中详情（用来定位是哪道题拖后腿）
 *   npm run eval -- --scan            扫描博客资料阈值，输出召回与过滤的权衡曲线
 *
 * 为什么评测集要分正负两组：
 *   只测召回（Hit@3），你会不自觉地把资料阈值调低——什么文章都拿来引用，命中率自然好看。
 *   只测无关问题过滤，又会把阈值调高——什么来源都不要，准确率满分但系统没用。
 *   必须两组一起看，阈值才是个可以被「选」出来的超参，而不是拍脑袋的数。
 *
 * 指标定义：
 *   先取回 topK 个切片，按「文章」去重（同一篇文章的多片只算一个来源，
 *   否则一篇长文章会霸榜，指标虚高），再考察期望文章有没有进前 3。
 *
 *   Hit@3 —— 期望文章出现在前 3 个来源里的比例
 *   MRR   —— 第一个正确来源排名的倒数平均值（排第 1 得 1，排第 3 得 1/3）
 *
 * 注意：AI_PROVIDER=mock 时，向量是字符重叠算出来的，数字只说明「管道通了」，
 * 不能当作真实语义检索的效果。换成真实模型后必须重跑一次。
 */
require('module-alias/register')

const InitManager = require('../core/init')
InitManager.loadConfig()
InitManager.loadHttpException()

const config = require('../config/config')
const { sequelize } = require('@core/db')
const { retrieve } = require('@service/ai/retrieval')
const questions = require('../eval/questions.json')
const negatives = require('../eval/negatives.json')

const CHUNK_TOPK = 10 // 先取回多少切片
const HIT_K = 3 // 取去重后的前几个来源来判定命中

const args = process.argv.slice(2)
const verbose = args.includes('--verbose')
const scan = args.includes('--scan')
const modeArg = (args.find((arg) => arg.startsWith('--mode=')) || '').split('=')[1]
const MODES = modeArg ? [modeArg] : ['keyword', 'vector', 'hybrid']

/** 按文章去重，保留首次出现的顺序 */
function dedupeArticles(chunks) {
  const seen = new Set()
  const ids = []
  chunks.forEach((chunk) => {
    if (!seen.has(chunk.article_id)) {
      seen.add(chunk.article_id)
      ids.push(chunk.article_id)
    }
  })
  return ids
}

async function evalMode(mode) {
  const rows = []
  let hits = 0
  let mrrSum = 0
  let blogMisses = 0

  for (const item of questions) {
    const { chunks, meta } = await retrieve(item.question, { topK: CHUNK_TOPK, mode })
    if (meta.sourceRejected) blogMisses++
    const articleIds = dedupeArticles(chunks)

    const index = articleIds
      .slice(0, HIT_K)
      .findIndex((id) => item.expected.includes(id))

    const hit = index >= 0
    if (hit) {
      hits++
      mrrSum += 1 / (index + 1)
    }

    rows.push({
      question: item.question,
      expected: item.expected,
      articleIds: articleIds.slice(0, HIT_K),
      hit,
      rank: hit ? index + 1 : null
    })
  }

  return {
    mode,
    hitRate: hits / questions.length,
    mrr: mrrSum / questions.length,
    // 期望文章本轮没有成为博客资料的比例。这个数字和 Hit@3 要一起看
    blogMissRate: blogMisses / questions.length,
    rows
  }
}

/** 负样本：应该被博客资料阈值过滤的比例 */
async function evalNegatives(mode) {
  let filtered = 0

  for (const item of negatives) {
    const { meta } = await retrieve(item.question, { topK: CHUNK_TOPK, mode })
    if (meta.sourceRejected) filtered++
  }

  return {
    mode,
    filterAccuracy: filtered / negatives.length
  }
}

function pad(text, width) {
  const value = String(text)
  const length = [...value].reduce((sum, char) => sum + (char.charCodeAt(0) > 127 ? 2 : 1), 0)
  return value + ' '.repeat(Math.max(0, width - length))
}

async function main() {
  console.log(`[eval] ${questions.length} 道题，检索 ${CHUNK_TOPK} 个切片，按文章去重后考察前 ${HIT_K} 个来源`)
  console.log(
    `[eval] provider=${config.ai.provider}  向量=${config.ai.embedding.model || 'mock-' + config.ai.embedding.dim}`
  )

  if (config.ai.provider === 'mock') {
    console.log('[eval] ⚠️  mock 向量是字符重叠算的，这份数字只说明管道跑通，不代表真实语义检索效果')
  }

  const results = []
  for (const mode of MODES) {
    results.push(await evalMode(mode))
  }

  if (verbose) {
    for (const result of results) {
      console.log(`\n--- ${result.mode} ---`)
      result.rows.forEach((row) => {
        const mark = row.hit ? `✅ 第${row.rank}位` : '❌ 未命中'
        console.log(`  ${mark}  ${pad(row.question, 44)} 期望${JSON.stringify(row.expected)} 实际${JSON.stringify(row.articleIds)}`)
      })
    }
  }

  console.log('\n=== 检索质量（正样本 ' + questions.length + ' 题）===')
  console.log('模式        Hit@3      MRR      博客漏命中率')
  console.log('------------------------------------------------')
  results.forEach((result) => {
    const missText = result.mode === 'keyword' ? '—' : (result.blogMissRate * 100).toFixed(1) + '%'
    console.log(
      `${pad(result.mode, 12)}${pad((result.hitRate * 100).toFixed(1) + '%', 10)}${pad(result.mrr.toFixed(3), 10)}${missText}`
    )
  })
  console.log('（博客漏命中率 = 期望文章没有成为本轮博客资料的比例；纯关键词模式不做阈值判断）')

  const refusalResults = []
  for (const result of results) {
    if (result.mode !== 'keyword') refusalResults.push(await evalNegatives(result.mode))
  }

  if (refusalResults.length > 0) {
    console.log('\n=== 无关问题过滤（负样本 ' + negatives.length + ' 题）===')
    console.log('模式        正确过滤率')
    console.log('------------------------')
    refusalResults.forEach((result) => {
      console.log(`${pad(result.mode, 12)}${(result.filterAccuracy * 100).toFixed(1)}%`)
    })
  }

  // 阈值扫描：把阈值当超参，用数据选出最合适的那个
  if (scan) {
    const original = config.ai.minRelevance
    // 先把阈值关掉，只跑一轮检索，拿到「原始候选 + 置信度」。
    // 阈值只是对这些结果做一刀切，没必要每换一个阈值就重新调一次向量服务
    // （否则 6 个阈值 × 30 道题 = 180 次 API 调用，又慢又费钱）。
    config.ai.minRelevance = 0

    const positiveData = []
    for (const item of questions) {
      const { chunks, meta } = await retrieve(item.question, { topK: CHUNK_TOPK, mode: 'hybrid' })
      positiveData.push({
        expected: item.expected,
        articleIds: dedupeArticles(chunks),
        confidence: meta.confidence
      })
    }

    const negativeData = []
    for (const item of negatives) {
      const { meta } = await retrieve(item.question, { topK: CHUNK_TOPK, mode: 'hybrid' })
      negativeData.push({ question: item.question, confidence: meta.confidence })
    }

    config.ai.minRelevance = original

    // 真实向量模型的相似度分布和 mock 完全不同（实测同义句 0.8、无关句 0.35），
    // 所以扫描区间要跟着换，不能沿用 mock 时那套低阈值
    const thresholds = [0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6]

    console.log('\n=== 阈值扫描（正样本 ' + questions.length + ' / 负样本 ' + negatives.length + '）===')
    console.log('阈值     Hit@3      博客漏命中率  正确过滤率')
    console.log('---------------------------------------------------')

    for (const threshold of thresholds) {
      let hits = 0
      let blogMisses = 0

      positiveData.forEach((item) => {
        // 置信度低于阈值 = 不采用博客资料，直接算博客未命中
        if (item.confidence < threshold) {
          blogMisses++
          return
        }
        const index = item.articleIds.slice(0, HIT_K).findIndex((id) => item.expected.includes(id))
        if (index >= 0) hits++
      })

      const filtered = negativeData.filter((item) => item.confidence < threshold).length

      console.log(
        `${pad(threshold.toFixed(2), 9)}${pad(((hits / questions.length) * 100).toFixed(1) + '%', 11)}${pad(((blogMisses / questions.length) * 100).toFixed(1) + '%', 11)}${((filtered / negatives.length) * 100).toFixed(1)}%`
      )
    }

    console.log('\n各题的置信度分布（用来判断阈值该落在哪）：')
    const confidences = positiveData.map((item) => item.confidence).sort((a, b) => a - b)
    const negativeConfidences = negativeData.map((item) => item.confidence).sort((a, b) => b - a)
    console.log('  正样本 最低/中位/最高: ' + confidences[0].toFixed(3) + ' / ' + confidences[Math.floor(confidences.length / 2)].toFixed(3) + ' / ' + confidences[confidences.length - 1].toFixed(3))
    console.log('  负样本 最高/中位/最低: ' + negativeConfidences[0].toFixed(3) + ' / ' + negativeConfidences[Math.floor(negativeConfidences.length / 2)].toFixed(3) + ' / ' + negativeConfidences[negativeConfidences.length - 1].toFixed(3))
  }
}

main()
  .then(async () => {
    await sequelize.close()
    process.exit(0)
  })
  .catch(async (err) => {
    console.error('[eval] 执行失败：', err)
    await sequelize.close().catch(() => {})
    process.exit(1)
  })
