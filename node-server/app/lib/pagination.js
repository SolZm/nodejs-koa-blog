/**
 * 分页工具
 *
 * 背景：项目里各处的分页参数解析和 meta 组装都是各写各的，
 * 导致文章列表出现过「limit 写死 10、offset 用 page_size」这种不一致。
 * 统一到这里，新的列表接口直接复用。
 */

const DEFAULT_PAGE_SIZE = 10
const MAX_PAGE_SIZE = 50

/**
 * 从 query 里解析分页参数
 * @param {object} query 通常是 ctx.query，值都是字符串
 * @returns {{ page: number, pageSize: number, limit: number, offset: number }}
 */
function parsePagination(query = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1)

  const requested = parseInt(query.page_size, 10) || DEFAULT_PAGE_SIZE
  // 夹在 1 ~ MAX_PAGE_SIZE 之间，避免被传个 page_size=999999 拖垮数据库
  const pageSize = Math.min(Math.max(1, requested), MAX_PAGE_SIZE)

  return {
    page,
    pageSize,
    limit: pageSize,
    offset: (page - 1) * pageSize
  }
}

/**
 * 组装统一的 meta，保证 per_page / total_pages 与实际使用的 pageSize 一致
 * @param {{ page: number, pageSize: number, count: number }} params
 */
function buildMeta({ page, pageSize, count = 0 }) {
  return {
    current_page: page,
    per_page: pageSize,
    count,
    total: count,
    total_pages: Math.ceil(count / pageSize)
  }
}

module.exports = {
  parsePagination,
  buildMeta,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE
}
