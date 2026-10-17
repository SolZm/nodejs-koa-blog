<template>
  <div class="header-sticky">
    <div class="header">
      <div class="header-inner">
        <div class="logo" @click="goHome">
          <span class="logo-text">SOLZM</span>
        </div>
        <div class="header-actions">
          <form class="search-box" action="/">
            <i class="el-icon-search search-icon" />
            <input
              name="keyword"
              type="text"
              class="search"
              placeholder="搜索文章 / 分类"
              enterkeyhint="search"
            />
            <!--
              手机端虚拟键盘没有回车键，原来输了关键词没地方提交。
              这个按钮只在 ≤768px 出现（桌面端回车照常用，视觉完全不变）；
              顺带一个好处：form 里存在提交按钮之后，键盘的确认键会走隐式提交，
              配合下面的 enterkeyhint="search" 会显示成搜索键，两种方式都能提交。
            -->
            <button type="submit" class="search-submit">搜索</button>
          </form>

          <!-- 问博客入口放在搜索框旁边，比悬浮球更容易被发现 -->
          <div class="ask-entry" @click="$askBlog.visible = true">
            <!-- 用星光而不是聊天气泡：星光是目前 AI 功能的通用视觉符号 -->
            <svg class="ask-entry-sparkle" viewBox="0 0 20 20" width="17" height="17" aria-hidden="true">
              <path
                d="M7 1.5 8.5 5.5 12.5 7 8.5 8.5 7 12.5 5.5 8.5 1.5 7 5.5 5.5Z"
                fill="currentColor"
              />
              <path
                class="ask-entry-sparkle-small"
                d="M15.5 11.5 16.4 13.6 18.5 14.5 16.4 15.4 15.5 17.5 14.6 15.4 12.5 14.5 14.6 13.6Z"
                fill="currentColor"
              />
            </svg>
            <span class="ask-entry-text">问博客</span>
          </div>
        </div>
        <client-only>
          <div v-if="isLoginStatus">
            <el-dropdown class="avatar-container" trigger="click">
              <div class="avatar-wrapper">
                <el-avatar
                  size="small"
                  icon="el-icon-user-solid"
                ></el-avatar>
                <div class="username">{{ userInfo.username }}</div>
                <i class="el-icon-caret-bottom" />
              </div>
              <el-dropdown-menu slot="dropdown" class="user-dropdown">
                <router-link to="/user">
                  <el-dropdown-item>个人中心</el-dropdown-item>
                </router-link>
                <el-dropdown-item divided @click.native="logout">
                  <span style="display: block">退出登录</span>
                </el-dropdown-item>
              </el-dropdown-menu>
            </el-dropdown>
          </div>
        </client-only>
      </div>

      <div v-if="isCategory" class="category">
        <ul v-if="Array.isArray(categoryList)" class="category-box">
          <li v-for="item in categoryList" :key="item.id" class="category-item">
            <NuxtLink
              class="category-item-link"
              :class="{ 'is-active': String(currentCategoryId) === String(item.id) }"
              :to="'/?category_id=' + item.id"
            >
              {{ item.name }}
            </NuxtLink>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script>
import { mapState } from 'vuex'
import {removeToken} from '@/lib/auth'

export default {
  name: 'Header',
  props: {
    isCategory: {
      type: Boolean,
      default: true,
    },
  },
  computed: {
    ...mapState({
      userInfo: state => state.user.userInfo,
      isLoginStatus: state => state.user.isLoginStatus,
      categoryList: (state) => state.category.categoryList
    }),
    currentCategoryId() {
      return this.$route?.query?.category_id || ''
    }
  },
  methods: {
    // 退出登录
    logout() {
      removeToken()
      this.$store.commit('user/SET_LOGIN_STATUS', false)
      this.$store.commit('user/SET_USERINFO', null)
      this.goHome()
    },
    // 返回首页
    goHome() {
      window.location.href = '/'
    }
  }
}
</script>

<style scoped lang="scss">
a{
  text-decoration: none;
}

/**
 * 吸附必须放在这一层，而不是 .header 上。
 *
 * position: sticky 只在自己的父元素范围内吸附：
 * .header 的父元素就是本组件的根 div，高度和 .header 完全一样，
 * 吸附空间是 0，所以写在 .header 上等于没写、页面一滚就没了。
 * 放到根元素上之后，它的父元素是整个页面（含正文和页脚），才有空间可吸。
 * 顺带好处：头部的分类栏和 header 是一起吸住的。
 */
.header-sticky {
  position: sticky;
  top: 0;
  z-index: 99;
}

.header {
  background: var(--c-bg);
  box-sizing: border-box;
  /*
   * 原来靠 box-shadow: 0 8px 24px rgba(0,0,0,.06) 分层。
   * 参考站的层次几乎全部来自留白，阴影很克制（翻遍整页没有一处明显投影），
   * 所以换掉投影、改成一条 1px 浅线——吸顶的时候边界也照样清楚。
   */
  border-bottom: 1px solid var(--c-line);
}

.header-inner {
  box-sizing: border-box;
  /*
   * 宽度从 1024 放宽到 1120：大字号 + 大留白之后，1024 会显得挤。
   * 仍然是 max-width + padding 的自适应写法，窄屏照旧自动收缩。
   */
  width: 100%;
  max-width: var(--w-page);
  /* 72 → 80：参考站头部留白明显更松，Logo 也更大 */
  height: 80px;
  margin: 0 auto;
  padding: 0 32px;
  display: flex;
  justify-content: space-between;
  gap: 32px;
  align-items: center;
}

.logo {
  position: relative;
  display: inline-flex;
  align-items: center;
  box-sizing: border-box;
  height: 80px;
  cursor: pointer;
}

.logo-text {
  /* 34 → 30 但字距收紧、字重加粗：视觉上更「整」，也更像参考站的标题处理 */
  font-size: 30px;
  font-weight: 800;
  letter-spacing: -1px;
  color: var(--c-text);
  user-select: none;
}

.search-box {
  position: relative;
  height: 80px;
  width: 340px;
  display: flex;
  align-items: center;
}

/* 搜索框和问博客按钮挨在一起，整体作为 header 中间那一块 */
.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

/*
 * 问博客按钮。
 *
 * 原来是「深靛 → 紫罗兰 → 品红」的渐变（那套配色是为旧体系选的）。
 * 现在全站强调色只有薄荷绿一种，再用彩色渐变就会和整页打架，
 * 所以改成参考站那个近黑胶囊主 CTA，让按钮本身退成中性色，
 * 只在左边那颗星光上留薄荷绿——整页唯一的一处彩色就是它。
 */
.ask-entry {
  display: flex;
  align-items: center;
  gap: 7px;
  height: 44px;
  padding: 0 20px;
  border-radius: var(--r-pill);
  background: var(--c-ink);
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  transition: transform 0.2s ease, background 0.2s ease;
}

.ask-entry:hover {
  background: var(--c-ink-hover);
  transform: translateY(-1px);
}

.ask-entry:active {
  transform: translateY(0);
}

.ask-entry-sparkle {
  flex: 0 0 auto;
  /* 图标是 currentColor 填充，所以这里改颜色就等于给星光上色 */
  color: var(--c-accent);
}

/* 小星星缓慢呼吸，让按钮有「在等你用」的感觉，但不至于晃眼 */
.ask-entry-sparkle-small {
  animation: ask-icon-twinkle 2.8s ease-in-out infinite;
}

@keyframes ask-icon-twinkle {
  0%,
  100% {
    opacity: 0.55;
  }

  50% {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .ask-entry-sparkle-small {
    animation: none;
  }
}

.search-icon {
  position: absolute;
  left: 16px;
  color: var(--c-text-3);
  font-size: 15px;
  z-index: 1;
}

.search {
  box-sizing: border-box;
  width: 100%;
  padding: 0 16px 0 40px;
  height: 44px;
  line-height: 44px;
  color: var(--c-text);
  font-size: 14px;
  /* 无边框 + 浅灰底，和参考站的胶囊输入框一致；聚焦才出现描边 */
  border: 1px solid transparent;
  border-radius: var(--r-pill);
  outline: none;
  transition: all 0.2s ease;
  background: var(--c-surface);
  font-family: var(--font-sans);
}

.search::placeholder {
  color: var(--c-text-3);
}

.search:focus {
  border-color: var(--c-accent);
  background: var(--c-bg);
}

/* 桌面端有回车，不加按钮，保持原有视觉 */
.search-submit {
  display: none;
}

.avatar-wrapper {
  width: auto;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: 12px;
  padding: 5px 14px 5px 5px;
  border-radius: var(--r-pill);
  border: 1px solid var(--c-line-strong);
  background: var(--c-bg);
  transition: all 0.2s ease;
}

.avatar-wrapper:hover {
  background: var(--c-surface);
}

.username {
  margin: 0 2px;
  max-width: 88px;
  font-size: 13px;
  color: var(--c-text-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/*
 * 分类导航。
 * 原来是「文字 + 下划线」的写法，和参考站的胶囊体系不搭；
 * 改成浅灰胶囊，选中态用薄荷浅底 + 深薄荷字（浅底上必须用深一档才够对比）。
 */
.category {
  &-box {
    box-sizing: border-box;
    width: 100%;
    max-width: var(--w-page);
    margin: 0 auto;
    padding: 0 32px 16px;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
  }

  &-item {
    list-style: none;
    &-link {
      display: inline-flex;
      align-items: center;
      height: 34px;
      padding: 0 16px;
      border-radius: var(--r-pill);
      font-size: 13px;
      color: var(--c-text-2);
      text-decoration: none;
      background: transparent;
      transition: background 0.2s ease, color 0.2s ease;
    }

    &-link:hover {
      background: var(--c-surface);
      color: var(--c-text);
    }

    .is-active {
      background: var(--c-accent-soft);
      color: var(--c-accent-deep);
      font-weight: 500;
    }
  }
}

@media (max-width: 768px) {
  /*
   * ===== 手机端头部（L2）：改成两行 =====
   * 第一行：logo + 问博客
   * 第二行：整条搜索框 + 「搜索」按钮
   *
   * 为什么非要两行：实测搜索框在 375px 上只有 155px、320px 上只有 100px，
   * 再往里塞一个 44px 的按钮，输入区就只剩三四个字的宽度了。
   */
  .header-inner {
    height: auto;
    padding: 10px 16px;
    gap: 8px 12px;
    flex-wrap: wrap;
  }

  /*
   * display: contents 让搜索框「脱离」.header-actions 这层包裹，
   * 直接成为 .header-inner 的 flex 子项，才能用 flex-basis: 100% 独占一整行。
   * 只在手机端生效，桌面端的结构和间距一点没动。
   */
  .header-actions {
    display: contents;
  }

  .logo {
    order: 1;
    height: 40px;
  }

  .logo-text {
    font-size: 22px;
    letter-spacing: -0.4px;
  }

  .ask-entry {
    order: 2;
    /* 第一行里把问答按钮推到最右 */
    margin-left: auto;
    height: 38px;
    padding: 0 14px;
    font-size: 13px;
  }

  /* 登录态头像收起用户名，只留头像 */
  .avatar-wrapper {
    order: 2;
    margin-left: 8px;
    padding: 4px 10px 4px 4px;
  }

  .username {
    display: none;
  }

  /* 搜索框独占第二行 */
  .search-box {
    order: 3;
    flex: 1 0 100%;
    width: 100%;
    min-width: 0;
    height: 44px;
    padding-right: 0;
  }

  .search {
    /* 输入区吃掉除按钮外的剩余宽度 */
    flex: 1 1 auto;
    width: auto;
    min-width: 0;
    height: 44px;
    line-height: 44px;
    padding-right: 10px;
    font-size: 13px;
  }

  .search-submit {
    display: block;
    flex: 0 0 auto;
    height: 36px;
    margin-left: 8px;
    padding: 0 16px;
    border: none;
    border-radius: var(--r-pill);
    background: var(--c-ink);
    color: #fff;
    font-size: 13px;
    font-weight: 500;
    line-height: 1;
    cursor: pointer;
  }

  .search-submit:active {
    background: var(--c-ink-hover);
  }

  .category {
    &-box {
      padding: 0 16px 12px;
      /* 分类多的时候横向滚动，而不是换行把头部越撑越高 */
      flex-wrap: nowrap;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;

      &::-webkit-scrollbar {
        display: none;
      }
    }

    &-item-link {
      /* 44px 是可点击区域的下限，再小手指就点不准了 */
      height: 40px;
      padding: 0 16px;
      white-space: nowrap;
    }
  }
}
</style>
