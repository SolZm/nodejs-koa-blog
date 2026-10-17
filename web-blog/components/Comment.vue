<template>
  <div>
    <el-drawer
      :size="commentDrawerSize"
      :with-header="false"
      :visible.sync="showComment"
      direction="rtl"
    >
      <div class="comment">
        <div class="comment-header">
          <span v-if="userInfo"> {{ userInfo.username }}， </span>
          欢迎您的评论
        </div>
        <div v-if="!isLoginStatus" class="login-tips">
          当前是匿名评论，登录后让代码改变世界！
          <span class="sign-in" @click="onShowLoginInner(true)">登录/注册</span>
        </div>

        <From @on-preview="onShowPreviewContent"></From>
        <CommentList ref="commentList" @on-preview="onShowPreviewContent"/>

      </div>

      <el-drawer
        :size="commentDrawerSize"
        :with-header="false"
        :append-to-body="true"
        :visible.sync="showPreviewContent"
      >
        <div class="comment">
          <div class="comment-header">预览：</div>
          <div v-html="previewContent"></div>
        </div>
      </el-drawer>

      <el-drawer
        :size="commentDrawerSize"
        :with-header="false"
        :append-to-body="true"
        :visible.sync="showLoginInner"
      >
        <Login @on-success="onShowLoginInner"></Login>
      </el-drawer>
    </el-drawer>
  </div>
</template>

<script>
import { mapState } from 'vuex'
import Login from "./Login";
import From from "./From";
import CommentList from "./CommentList";
// 这条 import 的顺序是 eslint(import/order) 的要求，挪到前面会让 npm run lint 报错
import { getToken } from '@/lib/auth'

export default {
  name: 'Comment',
  components: {
    From,
    Login,
    CommentList
  },
  data() {
    return {
      showComment: false,
      previewContent: '',
      showPreviewContent: false,
      showLoginInner: false,
      isNarrow: false,
    }
  },
  computed: {
    ...mapState({
      userInfo: (state) => state.user.userInfo,
      isLoginStatus: (state) => state.user.isLoginStatus,
    }),
    /*
     * 抽屉宽度原来是写死的百分比（评论 38.2%、预览/登录 32%）。
     * 百分比是相对视口算的，375px 的手机上只剩 143px，
     * 输入框和按钮全被挤成一列，基本没法用。窄屏直接占满宽度。
     *
     * 判断用 documentElement.clientWidth 而不是 window.innerWidth：
     * 移动端只要页面有元素比视口宽，innerWidth 会被撑大成内容宽度
     * （这个项目之前就是被撑到 1032），拿它判断窄屏会判断错。
     */
    commentDrawerSize() {
      return this.isNarrow ? '100%' : '38.2%'
    },
  },
  mounted() {
    this.updateViewport()
    window.addEventListener('resize', this.updateViewport)
  },
  beforeDestroy() {
    window.removeEventListener('resize', this.updateViewport)
  },
  methods: {
    updateViewport() {
      this.isNarrow = document.documentElement.clientWidth < 768
    },
    // 弹框登录
    onShowLoginInner(isShow) {
      this.showLoginInner = isShow
    },
    // 预览内容
    onShowPreviewContent(content) {
      if (!content) {
        this.$message.warning('请输入内容!')
        return false
      }

      this.previewContent = this.mdRender(content)
      this.showPreviewContent = !this.showPreviewContent
    },
    // 展开侧边栏，获取数据-用户数据，评论列表数据
    async onShowComment() {
      this.showComment = true

      if (!this.isLoginStatus && getToken()) {
        await this.$store.dispatch('user/userInfo')
      }

      if (!this.isLoad) {
        this.isLoad = true
        this.$nextTick(() => {
          this.$refs.commentList && this.$refs.commentList.getComment()
        })
      }
    },
    // 渲染markdown内容
    mdRender(content) {
      return content ? this.$md && this.$md.render(content) : content
    },
  },
}
</script>

<style scoped lang="scss">
ul,
li,
p {
  padding: 0;
  margin: 0;
}
.comment {
  box-sizing: border-box;
  padding: 28px 24px;
  width: 100%;

  &-header {
    padding-bottom: 10px;
    font-size: 20px;
    color: var(--c-text);
    font-weight: 700;
    letter-spacing: -0.3px;
  }

  .login-tips {
    font-size: 14px;
    color: var(--c-text-2);
    padding-bottom: 20px;

    span {
      cursor: pointer;
      color: var(--c-accent-deep);
      text-decoration: underline;
    }
  }
}
</style>
