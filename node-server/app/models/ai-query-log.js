const { sequelize } = require('@core/db')
const { Model, DataTypes } = require('sequelize')

// 问答调用日志模型：用来统计命中率、延迟和成本
class AiQueryLog extends Model {}

AiQueryLog.init(
  {
    id: {
      type: DataTypes.INTEGER(10).UNSIGNED,
      primaryKey: true,
      autoIncrement: true
    },
    question: {
      type: DataTypes.STRING(500),
      allowNull: false,
      comment: '用户提出的问题'
    },
    retrieved_ids: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: '本次召回的文章id数组'
    },
    top_score: {
      type: DataTypes.DECIMAL(8, 6),
      allowNull: true,
      comment: '最高召回得分'
    },
    hit: {
      type: DataTypes.TINYINT,
      allowNull: false,
      defaultValue: 0,
      comment: '是否有召回结果'
    },
    answer_len: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: '回答字符数'
    },
    latency_ms: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: '整次问答耗时（毫秒）'
    },
    prompt_tokens: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    completion_tokens: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    cache_hit: {
      type: DataTypes.TINYINT,
      allowNull: false,
      defaultValue: 0,
      comment: '是否命中答案缓存'
    }
  },
  {
    sequelize,
    modelName: 'ai_query_log',
    tableName: 'ai_query_log',
    // 追加型日志，同样不做软删除
    paranoid: false
  }
)

module.exports = { AiQueryLog }
