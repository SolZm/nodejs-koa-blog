/**
 * 统一配置入口
 *
 * 改造成原则：
 * 1. 所有可变配置从环境变量读取，密钥不再写死在代码里（见同级目录的 .env.example）
 * 2. 导出的结构保持原样（environment / database / security），
 *    这样 core/db.js、core/init.js、core/util.js、middlewares/* 这些老代码一行都不用改
 * 3. 在文件顶部就加载 .env，保证无论在哪个模块第一次 require 本文件，环境变量都已就绪
 */
const path = require('path')

require('dotenv').config({ path: path.resolve(__dirname, '../.env') })

const env = process.env

const environment = env.NODE_ENV || 'dev'
const isProd = environment === 'production'

/**
 * 解析对话模型的降级链。
 *
 * 格式：多组用分号分隔，每组三个字段用竖线分隔，依次是 baseUrl|apiKey|model
 *   AI_CHAT_FALLBACKS=https://dashscope.aliyuncs.com/compatible-mode/v1|sk-xxx|qwen-plus
 *
 * 为什么用这种朴素格式而不是 JSON：.env 里写 JSON 要处理引号转义，很容易写错，
 * 而且真写错了，报错信息也看不懂。
 */
function parseChatFallbacks(raw) {
  if (!raw) return []

  return raw
    .split(';')
    .map((group) => group.trim())
    .filter(Boolean)
    .map((group) => {
      const [baseUrl, apiKey, model] = group.split('|').map((part) => (part || '').trim())
      return {
        baseUrl: (baseUrl || '').replace(/\/+$/, ''),
        apiKey: apiKey || '',
        model: model || ''
      }
    })
    // 缺地址或模型名的条目直接丢掉：留着只会在真正需要降级时才发现配错了
    .filter((item) => item.baseUrl && item.model)
}

// AI 功能依赖 Node 18 才有的全局 fetch。
//
// 这里只警告、不退出：没有 fetch 只会让问答功能不可用，
// 没必要把文章、评论这些主功能一起拖下水。
// 真正会用不了的地方（app/service/ai/http.js）会给明确报错。
if (typeof fetch !== 'function') {
  console.warn(
    `[config] ⚠️  当前 Node 是 ${process.version}，没有全局 fetch，AI 问答会不可用。
         常见原因：机器上装了多个 Node 版本，PM2 用裸命令 node 启动时解析到了旧版本。
         解决：在部署脚本里用绝对路径指定，例如
         pm2 start app.js --name app --interpreter /root/.nvm/versions/node/v18.20.8/bin/node`
  )
}

// 生产环境必须显式提供这些变量，缺失就直接退出。
// 这是故意的「早失败」：宁可启动不起来，也不要用默认值悄悄跑在生产上。
const REQUIRED_IN_PROD = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'JWT_SECRET']

if (isProd) {
  const missing = REQUIRED_IN_PROD.filter((key) => !env[key])

  if (missing.length > 0) {
    console.error('[config] 生产环境缺少必需的环境变量：' + missing.join(', '))
    process.exit(1)
  }
} else {
  // 开发环境允许走默认值，但把风险明确提示出来，避免默认配置被带上线
  const weak = []
  if (!env.DB_PASSWORD) weak.push('DB_PASSWORD')
  if (!env.JWT_SECRET || env.JWT_SECRET === 'secretKey') weak.push('JWT_SECRET（默认弱值）')

  if (weak.length > 0) {
    console.warn('[config] 开发环境正在使用默认配置：' + weak.join('、'))
  }
}

module.exports = {
  environment,
  database: {
    dbName: env.DB_NAME || 'boblog',
    host: env.DB_HOST || 'localhost',
    port: Number(env.DB_PORT) || 3306,
    user: env.DB_USER || 'root',
    password: env.DB_PASSWORD || ''
  },
  security: {
    secretKey: env.JWT_SECRET || 'secretKey',
    // 过期时间（秒），默认 1 小时
    expiresIn: Number(env.JWT_EXPIRES_IN) || 60 * 60
  },
  ai: {
    // mock：完全不调用外部服务，用确定性的字符哈希生成「伪向量」。
    //       它没有真正的语义，但字面重叠越多、向量越接近，足以把整条链路跑通并验证检索。
    // openai：走 OpenAI 兼容协议（各自的 {baseUrl}/chat/completions 与 /embeddings）
    provider: env.AI_PROVIDER || 'mock',

    // 对话（生成）与向量（检索）分开配置。
    //
    // 为什么拆开：这两件事常常来自不同厂商。比如对话想用 DeepSeek，
    // 但 DeepSeek 不提供 embedding 接口，向量只能继续用百炼——
    // 如果两者共用一组 baseUrl/apiKey，就换不动。
    //
    // 各自都回退到通用的 AI_BASE_URL / AI_API_KEY，所以只配通用那组也能跑。
    chat: {
      baseUrl: (env.AI_CHAT_BASE_URL || env.AI_BASE_URL || '').replace(/\/+$/, ''),
      apiKey: env.AI_CHAT_API_KEY || env.AI_API_KEY || '',
      model: env.AI_CHAT_MODEL || ''
    },

    // 对话降级链：主模型超时/限流/不可用时，按顺序尝试备用模型。
    // 典型用法是配一个**不同厂商**的模型，这样一家挂了不影响整体可用。
    chatFallbacks: parseChatFallbacks(env.AI_CHAT_FALLBACKS),

    embedding: {
      baseUrl: (env.AI_EMBEDDING_BASE_URL || env.AI_BASE_URL || '').replace(/\/+$/, ''),
      apiKey: env.AI_EMBEDDING_API_KEY || env.AI_API_KEY || '',
      model: env.AI_EMBEDDING_MODEL || '',
      dim: Number(env.AI_EMBEDDING_DIM) || 1024
    },

    timeoutMs: Number(env.AI_TIMEOUT_MS) || 30000,
    // 博客命中阈值：召回结果低于这个相似度，就不把文章当作本次问答的博客资料。
    //
    // 为什么必须有：两路召回几乎总能捞回一些东西，不设阈值的话，
    // 无关文章也会被当成来源塞进上下文，污染引用和回答。
    //
    // 为什么做成配置项而不是常量：这个值和向量模型强相关，
    // 换成真实模型后分布完全不同，必须用评测集重新标定：npm run eval -- --scan
    //
    // 取值怎么来的（mock 模式，22 道正样本 + 8 道负样本扫描）：
    //   阈值 0.14 → Hit@3 86.4%，博客漏命中 9.1%，无关来源过滤 75%   ← 拐点
    //   阈值 0.18 → Hit@3 77.3%，博客漏命中 18.2%，无关来源过滤 100%
    // 抬到 0.18 多过滤 25 个点的无关来源，却让命中率掉 9 个点。
    //
    // 混合知识模式下，低于阈值不会拒绝整次问答，只会转成「通用技术说明」；
    // 因此这里控制的是博客引用质量，而不是系统是否回答。
    minRelevance: env.AI_MIN_RELEVANCE
      ? Number(env.AI_MIN_RELEVANCE)
      : (env.AI_PROVIDER || 'mock') === 'mock'
        ? 0.14
        : 0.6
  }
}
