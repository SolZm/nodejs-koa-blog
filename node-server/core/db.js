const Sequelize = require('sequelize')

const {
  dbName,
  host,
  port,
  user,
  password
} = require('../config/config').database


const sequelize = new Sequelize(dbName, user, password, {
  dialect: 'mysql',
  host,
  port,
  logging: false,
  timezone: '+08:00',
  define: {
    // create_time && update_time
    timestamps: true,
    // delete_time
    paranoid: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at',
    // 把驼峰命名转换为下划线
    underscored: true,
    scopes: {
      bh: {
        attributes: {
          exclude: ['password', 'updated_at', 'deleted_at', 'created_at']
        }
      },
      iv: {
        attributes: {
          exclude: ['content', 'password', 'updated_at', 'deleted_at']
        }
      }
    }
  }
})

// 表结构改由迁移脚本管理，不再用 sync() 自动建表。
//
// 为什么去掉：
//   sync() 只能新增表和列，无法修改列类型、删除列，也无法回滚，
//   更没法在变更中搬运数据。生产库上这些都是必然会遇到的场景。
//
// 首次使用、或拉取了带新迁移的分支后，先执行：
//   npm run migrate

sequelize.authenticate().then(res => {
  console.log('Connection has been established successfully.');
}).catch(err => {
  console.error('Unable to connect to the database:', err);
})

// sequelize.query("CREATE DATABASE IF NOT EXISTS boblog DEFAULT CHARACTER SET utf8 COLLATE utf8_unicode_ci").then(res=>{
//   console.log('CREATE DATABASE SUCCESS!')
// }).catch(err => {
//   console.log('CREATE DATABASE FAIL!', err)
// })


module.exports = {
  sequelize
}
