/**
 * 基线迁移：把项目原有的 6 张表固化成迁移体系里的第一份
 *
 * 为什么是「基线」而不是「从零建表」：
 *   生产库和本地库上这些表早就存在了，这份迁移的作用是让迁移体系接管它们——
 *   所以统一用 CREATE TABLE IF NOT EXISTS：表已存在就跳过，不存在就建出来，
 *   两种情况都能把这条迁移记录进 SequelizeMeta，之后的新变更再往后追加即可。
 *
 * DDL 来源：仓库根目录 sql/boblog.sql（生产库导出，MySQL 8.0.46）
 */

const CREATE_TABLES = [
  // 管理员
  `CREATE TABLE IF NOT EXISTS \`admin\` (
    \`id\` int unsigned NOT NULL AUTO_INCREMENT COMMENT '管理员id',
    \`email\` varchar(50) NOT NULL COMMENT '登录邮箱',
    \`password\` varchar(255) NOT NULL COMMENT '登录密码',
    \`nickname\` varchar(50) NOT NULL COMMENT '管理员昵称',
    \`created_at\` datetime NOT NULL,
    \`updated_at\` datetime NOT NULL,
    \`deleted_at\` datetime DEFAULT NULL,
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`admin_email_unique\` (\`email\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  // 文章
  `CREATE TABLE IF NOT EXISTS \`article\` (
    \`id\` int unsigned NOT NULL AUTO_INCREMENT COMMENT '文章id',
    \`title\` varchar(128) NOT NULL COMMENT '文章标题',
    \`description\` varchar(255) NOT NULL COMMENT '文章简介',
    \`img_url\` varchar(255) NOT NULL COMMENT '文章封面图URL',
    \`content\` text NOT NULL COMMENT '文章内容',
    \`seo_keyword\` varchar(128) NOT NULL COMMENT '文章SEO关键字',
    \`status\` tinyint DEFAULT '1' COMMENT '文章展示状态：0-隐藏,1-正常',
    \`sort_order\` int unsigned DEFAULT '1' COMMENT '排序编号,默认1,数值越大排越前',
    \`browse\` int unsigned DEFAULT '0' COMMENT '文章浏览次数',
    \`favorite_num\` int unsigned DEFAULT '0' COMMENT '文章点赞次数',
    \`admin_id\` int unsigned NOT NULL COMMENT '发布文章的管理员id',
    \`category_id\` int unsigned NOT NULL COMMENT '分类id',
    \`created_at\` datetime NOT NULL,
    \`updated_at\` datetime NOT NULL,
    \`deleted_at\` datetime DEFAULT NULL,
    PRIMARY KEY (\`id\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  // 分类
  `CREATE TABLE IF NOT EXISTS \`category\` (
    \`id\` int unsigned NOT NULL AUTO_INCREMENT COMMENT '分类id',
    \`name\` varchar(50) NOT NULL COMMENT '分类名称',
    \`status\` tinyint DEFAULT '1' COMMENT '类别状态,0-隐藏,1-正常',
    \`sort_order\` int unsigned DEFAULT '1' COMMENT '排序编号,默认1,数值越大排越前',
    \`parent_id\` int unsigned DEFAULT '0' COMMENT '父类别id,当id=0时,说明是根节点',
    \`created_at\` datetime NOT NULL,
    \`updated_at\` datetime NOT NULL,
    \`deleted_at\` datetime DEFAULT NULL,
    PRIMARY KEY (\`id\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  // 评论
  `CREATE TABLE IF NOT EXISTS \`comment\` (
    \`id\` int unsigned NOT NULL AUTO_INCREMENT,
    \`content\` text NOT NULL COMMENT '评论内容',
    \`status\` tinyint DEFAULT '0' COMMENT '评论状态：0-审核中,1-审核通过,2-审核不通过',
    \`article_id\` int unsigned NOT NULL COMMENT '关联的评论文章id',
    \`user_id\` int unsigned DEFAULT '0' COMMENT '评论用户id,0-代表匿名回复',
    \`email\` varchar(255) DEFAULT '0' COMMENT '匿名评论时，填的联系邮箱',
    \`created_at\` datetime NOT NULL,
    \`updated_at\` datetime NOT NULL,
    \`deleted_at\` datetime DEFAULT NULL,
    PRIMARY KEY (\`id\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  // 回复
  `CREATE TABLE IF NOT EXISTS \`reply\` (
    \`id\` int NOT NULL AUTO_INCREMENT COMMENT '回复id',
    \`content\` text NOT NULL COMMENT '回复内容',
    \`status\` tinyint DEFAULT '0' COMMENT '回复状态：0-审核中,1-审核通过,2-审核不通过',
    \`comment_id\` int unsigned NOT NULL COMMENT '关联的评论id',
    \`article_id\` int unsigned NOT NULL COMMENT '关联的文章id',
    \`user_id\` int unsigned DEFAULT '0' COMMENT '回复用户id,0-代表匿名回复',
    \`email\` varchar(255) DEFAULT '0' COMMENT '匿名评论时，填的联系邮箱',
    \`reply_user_id\` int unsigned DEFAULT '0' COMMENT '回复对象id,0-代表匿名回复',
    \`created_at\` datetime DEFAULT NULL,
    \`updated_at\` datetime NOT NULL,
    \`deleted_at\` datetime DEFAULT NULL,
    PRIMARY KEY (\`id\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  // 用户
  `CREATE TABLE IF NOT EXISTS \`user\` (
    \`id\` int unsigned NOT NULL AUTO_INCREMENT,
    \`username\` varchar(50) NOT NULL COMMENT '用户昵称',
    \`email\` varchar(50) NOT NULL COMMENT '登录邮箱',
    \`password\` varchar(255) NOT NULL COMMENT '登录密码',
    \`status\` tinyint DEFAULT '1' COMMENT '用户状态：0-禁用,1-正常',
    \`created_at\` datetime NOT NULL,
    \`updated_at\` datetime NOT NULL,
    \`deleted_at\` datetime DEFAULT NULL,
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`user_email_unique\` (\`email\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
]

// 回滚时按相反顺序删除
const DROP_TABLES = ['user', 'reply', 'comment', 'category', 'article', 'admin']

module.exports = {
  async up({ context }) {
    for (const sql of CREATE_TABLES) {
      await context.sequelize.query(sql)
    }
  },

  async down({ context }) {
    for (const table of DROP_TABLES) {
      await context.sequelize.query('DROP TABLE IF EXISTS `' + table + '`')
    }
  }
}
