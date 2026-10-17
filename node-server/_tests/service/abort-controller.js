/** Jest 24 的沙箱在 Node 16 下不会暴露全局 AbortController，测试里用最小兼容实现。 */
function createTestAbortController() {
  const listeners = new Set()
  const signal = {
    aborted: false,
    addEventListener(type, listener) {
      if (type === 'abort') listeners.add(listener)
    },
    removeEventListener(type, listener) {
      if (type === 'abort') listeners.delete(listener)
    }
  }

  return {
    signal,
    abort() {
      if (signal.aborted) return
      signal.aborted = true
      listeners.forEach((listener) => listener())
      listeners.clear()
    }
  }
}

module.exports = { createTestAbortController }
