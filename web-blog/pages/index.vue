<template>
  <div>
    <Header :is-category="false" @fetchData="fetchData" />

    <!--
      首屏大标题区。
      参考站的气质有一半来自「一屏之内只有一个巨大的标题」，
      原来首页直接就是文章列表，没有停顿，看着像后台而不是站点。
    -->
    <section class="hero">
      <div class="hero-inner">
        <h1 class="hero-title">FDE 工程实践笔记</h1>
        <p class="hero-sub">
          记录成为 FDE 路上的积累：贴近真实场景的工程落地、AI 应用的交付实践，以及一线解决问题的思考。
        </p>
      </div>
    </section>

    <div class="container">
      <div class="article">
        <div v-if="isEmptyData" class="empty-data">
          数据为空
          <a href="/">刷新</a>
        </div>
        <ul v-if="article" class="article-box">
          <li v-for="item in article.data" :key="item.id" class="article-list">
            <a :href="'/article/detail?id=' + item.id" class="article-item">
              <div class="article-image">
                <img :src="item.img_url" alt="title" loading="lazy" />
              </div>

              <div class="article-content">
                <div class="article-category">
                  {{ item.category_info.name }}
                </div>
                <h1 class="article-title">
                  {{ item.title }}
                </h1>
                <div class="article-description">
                  {{ item.description }}
                </div>
                <div class="article-date">
                  {{ item.created_at }}
                </div>
              </div>
            </a>
          </li>
        </ul>
        <div class="pagination">
          <el-pagination
            background
            :current-page.sync="page"
            layout="total, prev, pager, next"
            :total="count"
            @current-change="handleCurrentChange"
          />
        </div>
      </div>

      <div class="sidebar">
        <div class="category">
          <div class="category-title">分类</div>
          <ul v-if="Array.isArray(categoryList)" class="category-list">
            <li
              v-for="item in categoryList"
              :key="item.id"
              :class="[
                'category-item',
                { 'category-item-active': String(categoryId) === String(item.id) },
              ]"
              @click="fetchData(item.id)"
            >
              {{ item.name }}
            </li>
          </ul>
        </div>
      </div>
    </div>

    <Footer />
  </div>
</template>
<script>
import { mapState } from 'vuex'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { getArticleList } from '@/request/api/article'

export default {
  components: {
    Header,
    Footer,
  },
  async asyncData(context) {
    // eslint-disable-next-line camelcase
    const { id, keyword, category_id, page = 1 } = context.query
    const [err, res] = await getArticleList({
      id,
      category_id,
      keyword,
      page,
      is_category: 1,
      is_admin: 1,
    })
    if (!err) {
      return {
        page,
        count: res.data.data.meta.count,
        categoryId: category_id,
        article: res.data.data
      }
    }
  },
  async fetch({ store }) {
    await store.dispatch('category/getCategoryData')
  },
  head() {
    return {
      title: '博客',
      meta: [
        { name: 'keywords', content: '张烘玉,博客,张烘玉博客,solzm,前端开发工程师,前端性能优化,JavaScript,css,html' },
        { name: 'description', content: '张烘玉博客 - solzm.com，专注于前端开发技术，前端性能优化！' }
      ]
    }
  },
  computed: {
    ...mapState({
      categoryList: (state) => state.category.categoryList,
    }),
    // 是否为空数据
    isEmptyData() {
      return (
        this.article &&
        Array.isArray(this.article.data) &&
        this.article.data.length === 0
      )
    },
  },
  methods: {
    async fetchData(id) {
      // 切换到不同分类时回到第一页，避免停留在旧页码导致列表为空
      if (String(id) !== String(this.categoryId)) {
        this.page = 1
      }
      const [err, res] = await getArticleList({
        category_id: id,
        is_category: 1,
        is_admin: 1,
        page: this.page
      })
      if (!err) {
        this.categoryId = id
        this.article = res.data.data
        // 同步分页总数，否则切换分类后仍显示上一个分类的条数
        this.count = res.data.data.meta.count
      }
    },
    // 点击数字
    async handleCurrentChange(page) {
      this.page = page
      // 翻页时带上当前分类，否则会退回全部文章
      await this.fetchData(this.categoryId)
      this.$scrollTo(0)
    }
  }
}
</script>

<style scoped lang="scss">
html,
body,
div,
h1,
h2,
h3,
h4,
h5,
h6,
a,
ul,
li {
  padding: 0;
  margin: 0;
}

li {
  // list-style: none;
}

a {
  color: var(--c-text);
}

/* ===== 首屏标题区 ===== */
.hero {
  border-bottom: 1px solid var(--c-line);
}

.hero-inner {
  box-sizing: border-box;
  width: 100%;
  max-width: var(--w-page);
  margin: 0 auto;
  padding: 88px 32px 64px;
}

.hero-title {
  /* 参考站标题就是靠「特别大 + 特别黑 + 字距收紧」立住的，这里照搬 */
  font-size: 56px;
  font-weight: 800;
  letter-spacing: -2px;
  line-height: 1.15;
  color: var(--c-text);
}

.hero-sub {
  margin: 20px 0 0;
  max-width: 620px;
  font-size: 16px;
  line-height: 1.75;
  color: var(--c-text-2);
}

.container {
  box-sizing: border-box;
  width: 100%;
  max-width: var(--w-page);
  margin: 0 auto;
  padding: 0 32px;
  display: flex;

  .article {
    flex: 1;
    min-width: 0;
    padding-right: 40px;
    padding-top: 48px;
  }

  .sidebar {
    width: 300px;
    padding-left: 32px;
    padding-top: 48px;
    /* 原来的 border-left 分隔线换成极浅的一条，避免和卡片描边打架 */
    border-left: 1px solid var(--c-line);
  }
}

.empty-data {
  text-align: center;
  padding: 64px 0;
  font-size: 14px;
  color: var(--c-text-3);
}

/* ===== 分类侧栏 ===== */
.category {
  &-title {
    /* 原来是全大写英文 CATEGORY LIST，中文站点里读起来是噪音 */
    color: var(--c-text);
    font-size: 15px;
    font-weight: 700;
    letter-spacing: -0.2px;
    padding-bottom: 20px;
  }

  &-item {
    cursor: pointer;
    display: inline-block;
    padding: 8px 16px;
    font-size: 13px;
    color: var(--c-text-2);
    margin-right: 8px;
    margin-bottom: 8px;
    border-radius: var(--r-pill);
    text-decoration: none;
    background-color: var(--c-surface);
    transition: background-color 0.2s ease, color 0.2s ease;

    &:hover {
      color: var(--c-text);
    }

    &-active {
      color: var(--c-accent-deep);
      background: var(--c-accent-soft);
      font-weight: 500;
    }
  }
}

/* ===== 文章卡片 ===== */
.article-list {
  box-sizing: border-box;
  display: block;
  clear: both;
  margin-bottom: 20px;
}

.article-item {
  display: flex;
  align-items: stretch;
  width: 100%;
  padding: 20px;
  border: 1px solid var(--c-line);
  border-radius: var(--r-lg);
  text-decoration: none;
  background: var(--c-bg);
  /*
   * 参考站靠浅底色和留白分区，几乎不用投影。
   * 这里连 hover 也只改描边颜色，不加 box-shadow——一加投影整页就「脏」了。
   */
  transition: border-color 0.2s ease, transform 0.25s ease;
}

.article-item:hover {
  border-color: var(--c-line-strong);
  transform: translateY(-2px);
}

.article-image {
  flex: 0 0 200px;
  width: 200px;
  height: 132px;
  border-radius: var(--r-md);
  overflow: hidden;
  /* 有文章没配图，给个浅底当占位，不然会显示成破图 */
  background: var(--c-surface);
}

.article-image img {
  width: 100%;
  height: 100%;
  /* 配图尺寸不统一，用 cover 裁成同一比例，列表看起来才齐 */
  object-fit: cover;
  display: block;
}

.article-content {
  flex: 1;
  min-width: 0;
  padding-left: 24px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.article-category {
  display: inline-block;
  padding: 3px 12px;
  border-radius: var(--r-pill);
  font-size: 12px;
  font-weight: 500;
  color: var(--c-accent-deep);
  background: var(--c-accent-soft);
}

.article-title {
  /* 22 → 24 但字重从 bold 提到 700 并收紧字距，标题更「立」 */
  font-weight: 700;
  font-size: 24px;
  letter-spacing: -0.5px;
  color: var(--c-text);
  line-height: 1.35;
  margin-top: 12px;
}

.article-description {
  font-size: 14px;
  color: var(--c-text-2);
  line-height: 1.7;
  margin: 10px 0 0;
  /* 描述长短不一，截两行，卡片高度才能对齐 */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.article-date {
  margin-top: auto;
  padding-top: 14px;
  font-size: 13px;
  color: var(--c-text-3);
}

@media (max-width: 768px) {
  /* ===== 手机端首页（L2）：两栏堆叠成一栏 ===== */
  .hero-inner {
    padding: 40px 16px 32px;
  }

  .hero-title {
    /* 56px 在 375px 上放不下几个字，压到 30 */
    font-size: 30px;
    letter-spacing: -0.8px;
  }

  .hero-sub {
    margin-top: 12px;
    font-size: 14px;
  }

  .container {
    padding: 0 16px;
    flex-direction: column;
  }

  .container .article {
    padding-right: 0;
    padding-top: 20px;
  }

  /*
   * 分类侧边栏在手机上排到文章列表「前面」。
   * 原因：首页的 Header 传的是 :is-category="false"，顶部那条分类导航没有渲染，
   * 分类只存在于侧边栏。如果按 DOM 顺序落到文章下面，用户得先滚过 10 篇文章才能切分类。
   */
  .container .sidebar {
    order: -1;
    width: 100%;
    margin-top: 16px;
    padding: 0;
    border-left: none;
    border-bottom: none;
  }

  /*
   * 分类一共 23 个，竖着排会占掉大半屏（实测约 500px），文章一篇都看不到。
   * 改成一行横向滑动的胶囊条，高度压到约 46px，切换分类仍然只需一次点击。
   */
  .container .category {
    display: flex;
    align-items: center;
  }

  .category-title {
    display: none;
  }

  .category-list {
    display: flex;
    flex-wrap: nowrap;
    gap: 8px;
    width: 100%;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    /* 给横向滚动条留一点点空间，避免胶囊贴边 */
    padding-bottom: 4px;

    &::-webkit-scrollbar {
      display: none;
    }
  }

  .category-item {
    flex: 0 0 auto;
    /* 44px 是可点击区域的下限，原来约 35px，手机上容易点错 */
    display: flex;
    align-items: center;
    min-height: 44px;
    white-space: nowrap;
    margin: 0;
    padding: 8px 16px;
  }

  .article-list {
    margin-bottom: 12px;
  }

  .article-item {
    padding: 14px;
  }

  .article-image {
    /* 缩略图写死 flex 值，避免被正文挤扁 */
    flex: 0 0 96px;
    width: 96px;
    height: 96px;
  }

  .article-content {
    padding-left: 14px;
  }

  .article-category {
    font-size: 11px;
    padding: 2px 10px;
  }

  .article-title {
    font-size: 17px;
    letter-spacing: -0.2px;
    margin-top: 8px;
  }

  .article-description {
    font-size: 13px;
    margin-top: 6px;
    /* 手机上卡片窄，截一行就够，否则卡片会很高 */
    -webkit-line-clamp: 1;
  }

  .article-date {
    padding-top: 8px;
    font-size: 12px;
  }
}
</style>
