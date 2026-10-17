const qiniu = require('qiniu')

// 七牛云的 AK/SK 一律从环境变量读，不再写死在代码里。
//
// 【为什么要改】
// 原来这里是两行明文常量，而且已经随 init 提交（45ce86c）进了 git 历史。
// 硬编码最麻烦的地方不是「提交后泄露」，而是【换密钥要改代码重新发布】——
// 结果就是谁都不换。挪到 .env 之后，轮换只需要改一行配置。
//
// 【注意 .env 是独立维护的】
// .env 不入库，所以这套代码部署到服务器之后，要在服务器的 node-server/.env
// 里补上下面两个变量，否则上传接口会返回「上传服务未配置」。
// 只影响图片上传，站点其他功能不受影响。
//
// 【为什么缺失时不直接退出进程】
// 参照 config/config.js 里对 fetch 的处理思路：七牛只是上传功能依赖的外部服务，
// 没必要因为它没配就让文章、评论这些主功能一起起不来。这里警告 + 接口层兜底。
const ACCESS_KEY = process.env.QINIU_ACCESS_KEY
const SECRET_KEY = process.env.QINIU_SECRET_KEY

const qiniuConfigured = Boolean(ACCESS_KEY && SECRET_KEY)

if (!qiniuConfigured) {
    console.warn(
        '[upload] ⚠️  未配置 QINIU_ACCESS_KEY / QINIU_SECRET_KEY，图片上传接口将不可用。' +
        '请在 .env 里补上这两个变量（模板见 .env.example）。'
    )
}

// 没配时不构造 Mac，避免把 undefined 交给 qiniu 库去做签名
const mac = qiniuConfigured
    ? new qiniu.auth.digest.Mac(ACCESS_KEY, SECRET_KEY)
    : null

const { Auth } = require('@middlewares/auth');
const AUTH_ADMIN = 16;

const { Resolve } = require('@lib/helper');
const res = new Resolve();

const Router = require('koa-router')

const router = new Router({
    prefix: '/api/v1'
})

// 创建回复
router.post('/upload/token', new Auth(AUTH_ADMIN).m, async (ctx) => {
    // 少了密钥时给一句能看懂的话，而不是让 qiniu 库抛一个签名相关的怪错误
    if (!mac) {
        ctx.status = 500
        ctx.body = res.fail({}, '上传服务未配置：缺少 QINIU_ACCESS_KEY / QINIU_SECRET_KEY')
        return
    }

    const options = {
        scope: 'myblog-article',
        expires: 7200
    };
    const putPolicy = new qiniu.rs.PutPolicy(options);
    ctx.response.status = 200;
    const data = {
        token: putPolicy.uploadToken(mac)
    }
    ctx.body = res.json(data)
})

module.exports = router
