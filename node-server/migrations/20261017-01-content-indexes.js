/**
 * 给「内容三表」补索引：article / comment / reply
 *
 * 【为什么要做这件事】
 * baseline 迁移（20261013-01）里的建表语句是从生产库导出的原始 DDL，
 * 这三张表除主键外【一个索引都没有】。它们偏偏是全站查询最密集的对象：
 * 首页文章列表、文章详情、评论区列表、每条评论的回复。
 * 数据量小的时候看不出来，评论一多，文章详情页就会退化成全表扫描。
 *
 * 【一个容易被忽略的前提：paranoid】
 * core/db.js 全局开了 paranoid（deleted_at 软删除），所以任何 ORM 查询
 * 都会被自动追加 `deleted_at IS NULL` —— 每个 WHERE 都白白多一个条件。
 * 索引必须把它带上，否则优化器只能用索引定位一部分、剩下的回表过滤。
 *
 * 【列顺序是怎么定的】
 * 通用规则是「等值条件在前，排序条件在后」：
 *   · deleted_at —— 值恒为 NULL，选择性极低，只配当等值前缀的一员
 *   · 业务外键（article_id / category_id / comment_id）—— 真正的选择性来源，最左
 *   · created_at —— 放在最后，让 ORDER BY created_at DESC 能走索引有序扫描，
 *     顺带支持 LIMIT 提前终止（分页查询的 COUNT 也能复用同一索引）
 *
 * 关于 ORDER BY created_at DESC：MySQL 8 的升序索引支持反向扫描，
 * 所以正常建升序即可，不必特意写成 (created_at DESC)。
 *
 * 【为什么不是每列都建一条】
 * 索引不是免费的（写放大 + 磁盘）。这里刻意只建复合索引，
 * 让最左前缀去覆盖单列查询 —— 例如 idx_comment_article_deleted_ctime
 * 顺带覆盖了「只按 article_id 查」的场景，不需要再建 (article_id) 单列索引。
 * 下面「刻意不建的索引」一节列了被排除的候选和原因。
 */

const INDEXES = [
  // ---------------------------------------------------------------
  // article —— 首页列表
  //
  // 对应查询：app/dao/article.js:151 的 list()
  //   WHERE deleted_at IS NULL
  //   ORDER BY created_at DESC
  //   LIMIT/OFFSET
  // （首页「全部文章」默认视图；article.js:114 里 category_id 默认 0，
  //   说明确实存在不带分类的形态，所以这条和下面那条都要建，不能只留一条）
  // ---------------------------------------------------------------
  {
    name: 'idx_article_deleted_ctime',
    table: 'article',
    columns: ['deleted_at', 'created_at']
  },

  // ---------------------------------------------------------------
  // article —— 首页按分类过滤
  //
  // 对应查询：app/dao/article.js:151 + :136
  //   WHERE category_id = ? AND deleted_at IS NULL
  //   ORDER BY created_at DESC
  //
  // category_id 必须放最左才能收敛到该分类下的少量行；
  // 若依赖上面那条索引，就得扫遍全站存活文章再回表筛 category_id。
  // ---------------------------------------------------------------
  {
    name: 'idx_article_cat_deleted_ctime',
    table: 'article',
    columns: ['category_id', 'deleted_at', 'created_at']
  },

  // ---------------------------------------------------------------
  // comment —— 文章详情页的评论区（全站最高频的一条查询）
  //
  // 对应查询：app/dao/comment.js:230 的 targetComment()
  //   经 app/api/v1/article.js:139 调用，只传 { article_id: id }
  //   实际 SQL：WHERE article_id = ? AND deleted_at IS NULL
  //             ORDER BY created_at DESC LIMIT/OFFSET
  //
  // 注意 status 不在索引里 —— 这里有个反直觉的细节：
  // targetComment 的 status 形参默认值是 -1（comment.js:203），
  // 而 -1 会让它把 status 条件【删掉】（comment.js:226），
  // 前端入口又恰好不传 status。所以这条查询真的没有 status 条件，
  // 把 status 加进索引反而会破坏 created_at 的排序能力。
  // ---------------------------------------------------------------
  {
    name: 'idx_comment_article_deleted_ctime',
    table: 'comment',
    columns: ['article_id', 'deleted_at', 'created_at']
  },

  // ---------------------------------------------------------------
  // comment —— 后台的评论审核列表（不带 article_id 的那种）
  //
  // 对应查询：app/dao/comment.js:154 的 list()
  //   WHERE status = ? AND deleted_at IS NULL
  //   ORDER BY created_at DESC
  //
  // 这条走不了上面那两列 article_id 前缀，所以单独建。
  // 「待审核评论」是管理员会反复打开的页面，值得一条索引。
  // ---------------------------------------------------------------
  {
    name: 'idx_comment_status_deleted_ctime',
    table: 'comment',
    columns: ['status', 'deleted_at', 'created_at']
  },

  // ---------------------------------------------------------------
  // reply —— 展开每条评论的回复
  //
  // 对应查询：app/dao/comment.js:296 的 getReplyData()
  //   WHERE comment_id IN (...) AND status = 1 AND deleted_at IS NULL
  //
  // 这里 status 是【真的有】的条件（只显示审核通过的回复），
  // 所以它应当出现在索引里，且排在 comment_id 之后。
  // 没有 ORDER BY，created_at 加了也没用，不浪费列宽。
  // ---------------------------------------------------------------
  {
    name: 'idx_reply_comment_status_deleted',
    table: 'reply',
    columns: ['comment_id', 'status', 'deleted_at']
  }
]

/**
 * 刻意【不建】的索引，以及原因（避免以后有人「顺手补上」）：
 *
 * · article(deleted_at) 单列 —— 列值几乎全是 NULL，选择性趋近于 0，
 *   而且已被 idx_article_deleted_ctime 的最左前缀覆盖。
 * · article(category_id) 单列 —— 被 idx_article_cat_deleted_ctime 覆盖。
 * · article(status) / comment(status) 单列 —— status 只有 0/1/2 三个值，
 *   低基数索引优化器基本不会选。
 * · article(title) 普通索引 —— article.js:142 用的是 title LIKE '%kw%'，
 *   前导通配符用不上 B-Tree；要真做标题搜索得等全文索引（ngram）。
 * · reply(comment_id) / reply(article_id) 单列 —— 分别被
 *   idx_reply_comment_status_deleted 和「未来可能加的 article_id 那条」覆盖。
 * · user(email) / admin(email) —— baseline 里已有 user_email_unique、
 *   admin_email_unique，重复建纯属负担。
 * · category 的任何二级索引 —— 表只有几十条（代码注释里写明），
 *   优化器不会选，建了只是负担。
 * · article_chunk(article_id) / ai_query_log(created_at) ——
 *   20261013-02 里已经建过（idx_article_id、idx_created_at）。
 * · ai_query_log(hit) / (cache_hit) —— 这两列只参与聚合计算，不进 WHERE。
 *
 * 暂缓、等量级上来再补（当前是低频后台列表，收益不明显）：
 * · reply(article_id, status, deleted_at, created_at) —— 后台按文章筛回复
 * · user(status, deleted_at, created_at) —— 后台用户列表
 */

/**
 * 建索引前先确认它不存在。
 *
 * 为什么要这么啰嗦：MySQL 8 没有 `CREATE INDEX IF NOT EXISTS`，
 * 直接 ADD INDEX 撞上已存在的索引会报 Duplicate key name 并让整个迁移失败。
 * 这条迁移在生产库和本地库上都要能安全重复执行。
 */
async function indexExists(sequelize, table, name) {
  const rows = await sequelize.query(
    `SELECT COUNT(*) AS cnt FROM information_schema.statistics
      WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?`,
    { replacements: [table, name] }
  )
  return Number(rows[0][0].cnt) > 0
}

module.exports = {
  async up({ context }) {
    for (const idx of INDEXES) {
      const exists = await indexExists(context.sequelize, idx.table, idx.name)

      if (exists) {
        console.log(`[migrate] 索引已存在，跳过：${idx.table}.${idx.name}`)
        continue
      }

      const cols = idx.columns.map((c) => '`' + c + '`').join(', ')
      await context.sequelize.query(
        `ALTER TABLE \`${idx.table}\` ADD INDEX \`${idx.name}\` (${cols})`
      )
      console.log(`[migrate] 已建索引：${idx.table}.${idx.name} (${idx.columns.join(', ')})`)
    }
  },

  async down({ context }) {
    for (const idx of INDEXES) {
      const sql = `ALTER TABLE \`${idx.table}\` DROP INDEX \`${idx.name}\``
      try {
        await context.sequelize.query(sql)
        console.log(`[migrate] 已删除索引：${idx.table}.${idx.name}`)
      } catch (err) {
        // 索引本来就不存在时不必让回滚失败
        console.log(`[migrate] 跳过（索引不存在）：${idx.table}.${idx.name}`)
      }
    }
  }
}
