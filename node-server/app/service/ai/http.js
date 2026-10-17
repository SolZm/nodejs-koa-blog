/**
 * AI 服务共用的 HTTP 小工具
 * 带超时是必须的：模型服务偶发挂起，不加超时会把请求线程一直吊着。
 */

/**
 * 检查运行时是否有全局 fetch。
 *
 * Node 18 才内置 fetch。服务器上常常装着多个 Node 版本，
 * 如果 PM2 是用裸命令 `node` 启动的，从不同 shell 启动会解析到不同版本，
 * 表现就是「有时能跑、有时报 fetch is not defined，还看不出为什么」。
 * 这里显式检查，把那个莫名其妙的报错换成一句能直接照着修的话。
 */
function assertFetchAvailable() {
  if (typeof fetch !== 'function') {
    throw new Error(
      `当前 Node 运行时（${process.version}）没有全局 fetch，AI 相关功能需要 Node 18 及以上。` +
        '常见原因是服务器装了多个 Node 版本、PM2 启动时解析到了旧的那个；' +
        '可在部署脚本里用绝对路径指定，例如 pm2 start app.js --name app ' +
        '--interpreter /root/.nvm/versions/node/v18.20.8/bin/node'
    )
  }
}

function createAbortError() {
  const error = new Error('回答已停止')
  error.name = 'AbortError'
  return error
}

function throwIfAborted(signal) {
  if (signal && signal.aborted) throw createAbortError()
}

function isAbortError(error, signal) {
  return Boolean((signal && signal.aborted) || (error && error.name === 'AbortError'))
}

/** 可被 AbortSignal 提前结束的定时器，避免停止后还继续 mock 输出或重试 */
function abortableDelay(ms, signal) {
  if (signal && signal.aborted) return Promise.reject(createAbortError())

  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer)
      reject(createAbortError())
    }
    const timer = setTimeout(() => {
      if (signal) signal.removeEventListener('abort', onAbort)
      resolve()
    }, ms)

    if (signal) signal.addEventListener('abort', onAbort, { once: true })
  })
}

async function fetchWithTimeout(url, options, timeoutMs, signal) {
  assertFetchAvailable()

  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)
  const onAbort = () => controller.abort()

  if (signal) {
    if (signal.aborted) controller.abort()
    else signal.addEventListener('abort', onAbort, { once: true })
  }

  try {
    return await globalThis.fetch(url, { ...options, signal: controller.signal })
  } catch (error) {
    if (timedOut) throw new Error('AI 服务响应超时')
    if (isAbortError(error, signal)) throw createAbortError()
    throw error
  } finally {
    clearTimeout(timer)
    if (signal) signal.removeEventListener('abort', onAbort)
  }
}

module.exports = {
  fetchWithTimeout,
  createAbortError,
  throwIfAborted,
  isAbortError,
  abortableDelay
}
