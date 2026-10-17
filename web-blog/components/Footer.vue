<template>
  <footer class="site-footer">
    <div class="footer-inner">
      <div class="footer-brand">
        <div class="footer-logo">SOLZM</div>
        <p class="footer-desc">
          张烘玉的个人博客 —— 记录成为 FDE 路上的工程实践与交付思考。
        </p>
      </div>

      <nav class="footer-links">
        <a href="https://www.solzm.com" class="footer-link">首页</a>
        <a href="mailto:zhy_swork@163.com" class="footer-link">zhy_swork@163.com</a>
        <a
          href="https://beian.miit.gov.cn"
          target="_blank"
          rel="noopener"
          class="footer-link"
          >京ICP备2026011398号-1</a
        >
      </nav>
    </div>

    <div class="footer-bottom">
      &copy; 张烘玉的博客 - solzm.com
    </div>

    <!--
      巨大的描边水印字。
      参考站页脚底部就压着一个这样的字，作用是让深色块不至于空得发闷。
      用 -webkit-text-stroke 描边 + 透明填充，只留一个轮廓，不会抢正文的注意力；
      height + overflow: hidden 把下半截裁掉，做出「被页面边缘截断」的感觉。
    -->
    <div class="footer-watermark" aria-hidden="true">SOLZM</div>
  </footer>
</template>

<script>
export default {
  name: 'Footer',
}
</script>

<style scoped lang="scss">
/*
 * 页脚从「白底 + 一行小灰字」换成参考站那种满宽深色块。
 * 这是整页唯一的深色区域，作用是在长列表滚到底之后给一个明确的收尾。
 */
.site-footer {
  margin-top: var(--sp-7);
  padding: 72px 32px 0;
  background: var(--c-ink);
  color: #fff;
  /* 水印字比视口宽，靠这里裁掉，避免出现横向滚动条 */
  overflow: hidden;
}

.footer-inner {
  box-sizing: border-box;
  width: 100%;
  max-width: var(--w-page);
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 32px;
}

.footer-logo {
  font-size: 26px;
  font-weight: 800;
  letter-spacing: -1px;
}

.footer-desc {
  margin: 14px 0 0;
  max-width: 420px;
  font-size: 14px;
  line-height: 1.7;
  /* 深色底上的次级文字用半透明白，不要直接给灰色——灰在近黑上会发脏 */
  color: rgba(255, 255, 255, 0.6);
}

.footer-links {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 12px;
}

.footer-link {
  color: rgba(255, 255, 255, 0.6);
  font-size: 14px;
  text-decoration: none;
  transition: color 0.2s ease;
}

.footer-link:hover {
  color: var(--c-accent);
}

.footer-bottom {
  box-sizing: border-box;
  width: 100%;
  max-width: var(--w-page);
  margin: 48px auto 0;
  padding: 20px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  font-size: 13px;
  color: rgba(255, 255, 255, 0.42);
}

.footer-watermark {
  margin-top: 40px;
  height: 0.66em;
  overflow: hidden;
  font-size: 200px;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -8px;
  text-align: center;
  white-space: nowrap;
  user-select: none;
  color: transparent;
  -webkit-text-stroke: 1px rgba(255, 255, 255, 0.1);
}

@media (max-width: 768px) {
  .site-footer {
    margin-top: 56px;
    padding: 48px 16px 0;
  }

  .footer-inner {
    flex-direction: column;
    gap: 24px;
  }

  .footer-links {
    align-items: flex-start;
  }

  .footer-bottom {
    margin-top: 32px;
  }

  .footer-watermark {
    margin-top: 24px;
    font-size: 92px;
    letter-spacing: -4px;
  }
}
</style>
