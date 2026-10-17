const { sequelize } = require('@core/db')
const { Model, DataTypes } = require('sequelize')

// 文章切片模型：检索的基本单位
class ArticleChunk extends Model {}

ArticleChunk.init(
  {
    id: {
      type: DataTypes.INTEGER(10).UNSIGNED,
      primaryKey: true,
      autoIncrement: true
    },
    article_id: {
      type: DataTypes.INTEGER(10).UNSIGNED,
      allowNull: false,
      comment: '所属文章id'
    },
    chunk_index: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: '在文章内的顺序，从 0 开始'
    },
    heading_path: {
      type: DataTypes.STRING(500),
      allowNull: false,
      defaultValue: '',
      comment: '标题路径，如「一、整图测试 > 核心思路」'
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: '切片正文'
    },
    char_len: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: '字符数，便于诊断切片是否合理'
    },
    embedding: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: '向量（JSON 数组）'
    },
    embedding_model: {
      type: DataTypes.STRING(64),
      allowNull: false,
      defaultValue: '',
      comment: '生成该向量的模型名'
    },
    content_hash: {
      type: DataTypes.CHAR(64),
      allowNull: false,
      comment: '切片正文的 sha256，用于增量索引'
    }
  },
  {
    sequelize,
    modelName: 'article_chunk',
    tableName: 'article_chunk',
    // 切片是派生数据，重建时物理删除即可，不做软删除（覆盖全局的 paranoid: true）
    paranoid: false
  }
)

module.exports = { ArticleChunk }
