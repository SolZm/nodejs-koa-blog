/**
 * 给 article_chunk 加全文索引，供检索的「关键词路」使用
 *
 * 为什么要 WITH PARSER ngram：
 *   MySQL 默认的全文分词器按空格切词，对中文等于废掉（一句话会变成一个巨大的词）。
 *   ngram 分词器按 n 元组（默认 2 个字）切，中文才有召回能力。
 *   MySQL 5.7+ 内置，不需要额外安装。
 *
 * 注意：ngram 只影响这条全文索引的行为，不改表里存的数据。
 * 检索层对这条索引做了兜底——万一某个环境建不出来，会退回 LIKE 匹配，不会直接报错。
 */

module.exports = {
  async up({ context }) {
    await context.sequelize.query(
      'ALTER TABLE `article_chunk` ADD FULLTEXT INDEX `ft_chunk_text` (`content`, `heading_path`) WITH PARSER ngram'
    )
  },

  async down({ context }) {
    await context.sequelize.query('ALTER TABLE `article_chunk` DROP INDEX `ft_chunk_text`')
  }
}
