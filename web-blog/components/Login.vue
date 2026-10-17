<template>
  <div>
    <div class="login">
      <div class="login-logo">SOLZM</div>
      <h2 class="login-header">
        {{ isLogin ? '登录' : '注册' }}
      </h2>

      <div v-if="!isLogin" class="login-content">
        <input
          v-model="user.username"
          maxlength="32"
          class="login-input"
          placeholder="请输入你的昵称"
        />
      </div>
      <div class="login-content">
        <input
          v-model="user.email"
          maxlength="32"
          class="login-input"
          placeholder="请输入联系邮箱"
        />
      </div>

      <div class="login-content">
        <input
          v-model="user.password"
          maxlength="16"
          type="password"
          class="login-input"
          placeholder="请输入密码，密码长度必须在6~22位之间，包含字符、数字和 _"
        />
      </div>
      <div class="login-register-tips" @click="isLogin = !isLogin">
        {{ isLogin ? '未有账号？点击注册！' : '已有账号？点击登录！' }}
      </div>
      <div class="login-btn">
        <button
          :disabled="isDisabled"
          :class="['login-btn-submit', {'opacity': isDisabled}]"
          @click="onClickType"
        >
          {{ isLogin ? '登录' : '注册' }}
        </button>
        <button class="login-btn-default" @click="onSuccess(false)">
          匿名评论
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { validEmail, validPassword } from '@/lib/utils'

export default {
  name: "Login",
  data() {
    return {
      // true-登录，false-注册
      isLogin: true,
      // 用户信息
      user: {
        username: '',
        email: '',
        password: '',
      },
    }
  },
  computed: {
    isDisabled() {
      if(this.isLogin === true) {
        return !this.user.email || !this.user.password
      }

      if(this.isLogin === false){
        return !this.user.email
          || !this.user.password
          || !this.user.username
      }

      return true
    }
  },
  methods: {
    // 点击-登录 or 注册
    onClickType() {
      if (this.isLogin) {
        this.onUserLogin()
      } else {
        this.onUserRegister()
      }
    },
    // 用户登录
    async onUserLogin() {
      if(!this.checkoutEmailPassword()) {
        return false
      }

      const [err] = await this.$store.dispatch(
        'user/userLogin',
        this.user
      )
      if (!err) {
        this.onSuccess()
        this.$message.success('登录成功')
      }
    },
    // 用户注册
    async onUserRegister() {
      if(!this.checkoutEmailPassword()) {
        return false
      }

      const user = this.user

      const registerParams = {
        email: user.email,
        username: user.username,
        password1: user.password,
        password2: user.password,
      }
      const [err] = await this.$store.dispatch(
        'user/userRegister',
        registerParams
      )
      if (!err) {
        this.onSuccess()
        this.$message.success('注册成功')
      }
    },
    // 登录注册成功的回调
    onSuccess(show = false) {
      this.user.email = ''
      this.user.username = ''
      this.$emit('on-success', show)
    },
    // 检测邮箱和密码是否正确
    checkoutEmailPassword() {
      const user = this.user

      if(this.isLogin === false && !user.username) {
        this.$message.warning('请输入你的昵称!')
        return false
      }


      if (!validEmail(user.email)) {
        this.$message.warning('请输入正确的邮箱!')
        return false
      }

      if (!validPassword(user.password)) {
        this.$message.warning('密码长度必须在6~22位之间，包含字符、数字和 _')
        return false
      }

      return true
    }
  }
}
</script>

<style scoped lang="scss">
.login {
  box-sizing: border-box;
  width: 100%;
  padding: 28px 20px;
}
.login-header {
  display: none;
  text-align: center;
}

/*
 * 原来这里是一张外链图片（cdn.boblog.com/boblog.png），
 * 那是这套模板自带的旧品牌 logo，站名改成 SOLZM 之后它就不对了，
 * 而且依赖一个和本站无关的 CDN。直接换成文字标识。
 */
.login-logo {
  margin-bottom: 28px;
  font-size: 26px;
  font-weight: 800;
  letter-spacing: -1px;
  color: var(--c-text);
  text-align: center;
}


.login-content {
  display: block;
  margin-bottom: 12px;
}

.login-input {
  resize: none;
  outline: none;
  width: 100%;
  box-sizing: border-box;
  border-radius: var(--r-md);
  padding: 14px 16px;
  font-size: 14px;
  font-family: var(--font-sans);
  color: var(--c-text);
  /* 浅灰底无描边，聚焦才出现薄荷绿（原来是聚焦加一层投影） */
  background: var(--c-surface);
  border: 1px solid transparent;
  transition: 0.2s all ease-in;

  &::placeholder {
    color: var(--c-text-3);
  }

  &:focus {
    background: var(--c-bg);
    border-color: var(--c-accent);
  }
}

.login-register-tips {
  cursor: pointer;
  font-size: 12px;
  color: var(--c-text-3);

  &:hover {
    color: var(--c-accent-deep);
    text-decoration: underline;
  }
}
.login-btn {
  margin: 32px 0;
  &-submit {
    cursor: pointer;
    width: 100%;
    height: 46px;
    font-size: 14px;
    font-weight: 500;
    font-family: var(--font-sans);
    color: #fff;
    text-align: center;
    border: none;
    outline: none;
    border-radius: var(--r-pill);
    /* 主按钮统一成近黑胶囊，和头部「问博客」是同一套 */
    background: var(--c-ink);
    margin-bottom: 12px;
    transition: background 0.2s ease;

    &:hover {
      background: var(--c-ink-hover);
    }
  }
  &-default {
    cursor: pointer;
    width: 100%;
    height: 46px;
    font-size: 14px;
    font-family: var(--font-sans);
    color: var(--c-text-2);
    text-align: center;
    border: 1px solid var(--c-line-strong);
    outline: none;
    border-radius: var(--r-pill);
    background: var(--c-bg);
    transition: all 0.2s ease;

    &:hover {
      color: var(--c-text);
      border-color: var(--c-text-3);
    }
  }
}
</style>
