/**
 * RAG 相关的两张表
 *
 * article_chunk  —— 文章切片 + 向量，检索的基本单位
 * ai_query_log   —— 每次问答的调用记录，用来算命中率、延迟、成本
 *
 * 注意：这两张表都**不加 deleted_at（不做软删除）**。
 * 它们是派生数据 / 追加型日志，重建索引时直接物理删除、重新写入即可，
 * 留着软删除标记只会让表越来越大，还得在每次查询里过滤。
 * 因此对应的 Sequelize 模型要显式写 paranoid: false，覆盖全局默认。
 */

const CREATE_TABLES = [
  // 文章切片
  `CREATE TABLE IF NOT EXISTS \`article_chunk\` (
    \`id\` int unsigned NOT NULL AUTO_INCREMENT,
    \`article_id\` int unsigned NOT NULL COMMENT '所属文章id',
    \`chunk_index\` int NOT NULL DEFAULT '0' COMMENT '在文章内的顺序，从 0 开始',
    \`heading_path\` varchar(500) NOT NULL DEFAULT '' COMMENT '标题路径，如「一、整图测试 > 核心思路」',
    \`content\` text NOT NULL COMMENT '切片正文',
    \`char_len\` int NOT NULL DEFAULT '0' COMMENT '字符数，便于诊断切片是否合理',
    \`embedding\` json DEFAULT NULL COMMENT '向量（JSON 数组）',
    \`embedding_model\` varchar(64) NOT NULL DEFAULT '' COMMENT '生成该向量的模型名，换模型时便于区分',
    \`content_hash\` char(64) NOT NULL COMMENT '切片正文的 sha256，用于增量索引',
    \`created_at\` datetime NOT NULL,
    \`updated_at\` datetime NOT NULL,
    PRIMARY KEY (\`id\`),
    KEY \`idx_article_id\` (\`article_id\`),
    KEY \`idx_content_hash\` (\`content_hash\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  // 问答调用日志
  `CREATE TABLE IF NOT EXISTS \`ai_query_log\` (
    \`id\` int unsigned NOT NULL AUTO_INCREMENT,
    \`question\` varchar(500) NOT NULL COMMENT '用户提出的问题',
    \`retrieved_ids\` json DEFAULT NULL COMMENT '本次召回的文章id数组',
    \`top_score\` decimal(8,6) DEFAULT NULL COMMENT '最高召回得分',
    \`hit\` tinyint NOT NULL DEFAULT '0' COMMENT '是否有召回结果：1-有,0-无',
    \`answer_len\` int NOT NULL DEFAULT '0' COMMENT '回答字符数',
    \`latency_ms\` int NOT NULL DEFAULT '0' COMMENT '整次问答耗时（毫秒）',
    \`prompt_tokens\` int NOT NULL DEFAULT '0' COMMENT '输入 token 数',
    \`completion_tokens\` int NOT NULL DEFAULT '0' COMMENT '输出 token 数',
    \`cache_hit\` tinyint NOT NULL DEFAULT '0' COMMENT '是否命中答案缓存',
    \`created_at\` datetime NOT NULL,
    \`updated_at\` datetime NOT NULL,
    PRIMARY KEY (\`id\`),
    KEY \`idx_created_at\` (\`created_at\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
]

module.exports = {
  async up({ context }) {
    for (const sql of CREATE_TABLES) {
      await context.sequelize.query(sql)
    }
  },

  async down({ context }) {
    await context.sequelize.query('DROP TABLE IF EXISTS `ai_query_log`')
    await context.sequelize.query('DROP TABLE IF EXISTS `article_chunk`')
  }
}
