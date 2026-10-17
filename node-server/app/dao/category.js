const { Op } = require('sequelize')
const { Category } = require('@models/category')
const { buildMeta } = require('@lib/pagination')

class CategoryDao {
  // 创建分类
  static async create(params = {}) {
    const {
      name,
      sort_order = 1,
      parent_id = 0
    } = params
    // 查询是否存在重复的分类
    const hasCategory = await Category.findOne({
      where: {
        name,
        deleted_at: null
      }
    });

    if (hasCategory) {
      throw new global.errs.Existing('分类已存在');
    }

    const category = new Category();
    category.name = name
    category.sort_order = sort_order
    category.parent_id = parent_id

    try {
      const res = await category.save();
      const data = {
        name: res.name,
        key: res.key,
        parent_id: res.parent_id,
        msg: '创建成功'
      }
      return [null, data]

    } catch (err) {
      return [err, null]
    }
  }


  // 删除分类
  static async destroy(id) {
    // 查询分类
    const category = await Category.findOne({
      where: {
        id,
        deleted_at: null
      }
    });
    if (!category) {
      throw new global.errs.NotFound('没有找到相关分类');

    }
    try {
      const res = await category.destroy()
      return [null, res]

    } catch (err) {
      return [err, null]
    }
  }

  // 获取分类详情
  static async detail(id) {
    try {
      const category = await Category.scope('bh').findOne({
        where: {
          id,
          deleted_at: null
        }
      });
      if (!category) {
        throw new global.errs.NotFound('没有找到相关分类');
      }

      return [null, category]
    } catch (err) {
      return [err, null]
    }
  }

  // 更新分类
  static async update(id, v) {
    const category = await Category.findByPk(id);
    if (!category) {
      throw new global.errs.NotFound('没有找到相关分类');
    }
    category.name = v.get('body.name');
    category.status = v.get('body.status');
    category.sort_order = v.get('body.sort_order');
    category.parent_id = v.get('body.parent_id') || 0;

    try {
      const res = await category.save();
      return [null, res]
    } catch (err) {
      return [err, null]
    }
  }

  // 分类列表
  static async list(query = {}) {
    const { status, name, id } = query
    let params = {}
    if (status) {
      params.status = status
    }

    if (name) {
      params.name = {
        [Op.like]: `%${name}%`
      };
    }

    if (id) {
      params.id = id
    }

    try {
      // 分类是给前台侧边栏、后台下拉框做全量展示用的，量级很小（几十条），刻意不分页。
      // 修正前这里是 limit 被注释掉（返回全量），meta 却按「每页 10 条」汇报，两者不一致。
      // 现在保持返回全量，但让 meta 如实反映实际结果。
      const category = await Category.scope('bh').findAndCountAll({
        where: params,
        order: [
          ['created_at', 'DESC']
        ]
      });

      const data = {
        data: category.rows,
        meta: buildMeta({
          page: 1,
          pageSize: category.count || 1,
          count: category.count
        })
      }

      return [null, data]

    } catch (err) {
      console.log('err', err)

      return [err, null]
    }
  }
}

module.exports = {
  CategoryDao
}
