<template>
  <div>
    <Header />
    <div v-if="userInfo" class="userinfo">
      <div class="profile">
        <el-avatar :size="64" icon="el-icon-user-solid" />
        <div class="profile-meta">
          <div class="profile-name">{{ userInfo.username }}</div>
          <div class="profile-email">{{ userInfo.email }}</div>
        </div>
      </div>

      <p class="profile-quote">
        假如生活欺骗了你，请你不要放弃，坚持下去！天是不会给绝路你的！
      </p>

      <div v-if="Array.isArray(commentList) && commentList.length > 0" class="comment">
        <h2 class="comment-title">评论列表</h2>
        <ul class="comment-list">
          <li v-for="item in commentList" :key="item.id" class="comment-item">
            <div class="comment-article">
              {{ item.article.title }}
            </div>
            <div class="comment-body">
              {{ item.content }}
            </div>
            <div class="comment-foot">
              <span>{{ item.created_at }}</span>
              <span>回复：{{ item.reply_list || '无' }}</span>
            </div>
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
    </div>
  </div>
</template>

<script>
import {mapState} from 'vuex'
import Header from '@/components/Header'
import { getCommentTarget } from '@/request/api/comment'

export default {
  name: "User",
  components: {
    Header
  },
  data() {
    return {
      page: 1,
      count: 0,
      commentList: []
    }
  },
  async fetch({ store }) {
    await store.dispatch('category/getCategoryData')
  },
  head() {
    /*
     * 这里原来直接写了 this.userInfo.username，
     * 而 userInfo 初始值是 null —— 服务端渲染时读 null.username 会抛异常，
     * 表现是直接访问或刷新 /user 返回 500（登录后从站内点进去是客户端渲染，不报错）。
     * 加个兜底，顺便把标题里残留的旧域名换成实际站点名。
     */
    const username = this.userInfo && this.userInfo.username
    return {
      title: username ? `${username} - 个人中心 - 博客` : '个人中心 - 博客',
      meta: [
        { name: 'keywords', content: '张烘玉,博客,张烘玉博客,solzm,前端开发工程师,前端性能优化,JavaScript,css,html' },
        { name: 'description', content: '张烘玉博客 - solzm.com，专注于前端开发技术，前端性能优化！' }
      ]
    }
  },
  computed: {
    ...mapState({
      userInfo: state => state.user.userInfo
    })
  },
  mounted() {
    this.getComment()
  },
  methods: {
    async getComment() {
      const uid = this.userInfo && this.userInfo.id
      const [err, res] = await getCommentTarget({
        user_id: uid,
        is_replay: 1,
        is_article: 1,
        page: this.page
      })
      if (!err) {
        this.isLoad = true
        this.commentList = res.data.data.data
        this.count = res.data.data.meta.count
      }
    },
    // 点击数字
    async handleCurrentChange(page) {
      this.page = page
      await this.getComment()
      this.$scrollTo(0)
    },
  }
}
</script>

<style scoped lang="scss">
/*
 * 宽度收到正文那一档（760）而不是列表页的 1120。
 * 这一页是一串「卡片 + 文字」，太宽会显得松散。
 */
.userinfo {
  box-sizing: border-box;
  width: 100%;
  max-width: var(--w-read);
  padding: 0 32px;
  margin: 64px auto 0;
}

.profile {
  display: flex;
  align-items: center;
  gap: 20px;
}

.profile-meta {
  min-width: 0;
}

.profile-name {
  font-size: 28px;
  font-weight: 800;
  letter-spacing: -0.8px;
  color: var(--c-text);
}

.profile-email {
  margin-top: 6px;
  font-size: 14px;
  color: var(--c-text-3);
}

/* 那句签名原来只是缩进两格的普通段落，做成引用块更有分量 */
.profile-quote {
  margin: 32px 0 0;
  padding: 16px 20px;
  border-left: 3px solid var(--c-accent);
  border-radius: 0 var(--r-md) var(--r-md) 0;
  background: var(--c-surface);
  color: var(--c-text-2);
  font-size: 15px;
  line-height: 1.8;
}

.comment {
  margin-top: 48px;
}

.comment-title {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.3px;
  color: var(--c-text);
  margin-bottom: 20px;
}

/* 每条评论从「一条分隔线」改成独立的描边卡片 */
.comment-item {
  padding: 20px;
  margin-bottom: 12px;
  border: 1px solid var(--c-line);
  border-radius: var(--r-lg);
}

.comment-article {
  font-size: 15px;
  font-weight: 600;
  color: var(--c-text);
}

.comment-body {
  margin-top: 8px;
  font-size: 14px;
  line-height: 1.7;
  color: var(--c-text-2);
}

.comment-foot {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-top: 12px;
  font-size: 13px;
  color: var(--c-text-3);
}

@media (max-width: 768px) {
  .userinfo {
    padding: 0 16px;
    margin-top: 40px;
  }

  .profile-name {
    font-size: 22px;
  }
}
</style>
