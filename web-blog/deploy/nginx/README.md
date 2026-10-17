# solzm.com 的 nginx 配置

这份配置原本只存在于服务器上（`/etc/nginx/`）。服务器重装、换机或者误删就全丢了，
而且里面有几处是踩了坑才定下来的细节（SSE 关缓冲、ACME 的优先级、`proxy_pass` 的斜杠），
丢了很难凭记忆还原。所以放进仓库版本管理。

**注意：这些是 nginx 的配置文件，不是前端产物，不要放进 `static/`。**
放在仓库根目录的 `deploy/` 下不会被 Nuxt 打包，也不会被任何静态服务暴露出去。

> 想了解「为什么这么配」而不是「怎么配」——
> 这轮迁移的完整复盘（关键决策、七个坑的排查过程、面试追问准备）在
> [`../../doc/https-interview.md`](../../doc/https-interview.md)。

## 文件对应关系

| 仓库里的文件 | 服务器上的位置 | 作用 |
| --- | --- | --- |
| `blog-locations.conf` | `/etc/nginx/snippets/blog-locations.conf` | 公共 location：ACME 验证 + `/api/v1/ai/` SSE + `/api/` 反代。**80 和 443 都 include 它** |
| `web-blog.conf` | `/etc/nginx/conf.d/web-blog.conf` | 80 端口：301 跳到 https |
| `web-blog-ssl.conf` | `/etc/nginx/conf.d/web-blog-ssl.conf` | 443 端口：证书、HTTP/2、页面反代 |
| `myblog-admin.conf` | `/etc/nginx/conf.d/myblog-admin.conf` | 后台管理系统：80 端口、`admin.solzm.com`，同时是 80 的默认 server |
| `myblog-admin-ssl.conf` | `/etc/nginx/conf.d/myblog-admin-ssl.conf` | 后台管理系统：443 端口、证书、静态站 + `/api` 反代 |

## 请求怎么走

```
公网
 ├─ :80   web-blog.conf        ─→  301 https://$host$request_uri
 │                               （例外：/.well-known/acme-challenge/ 命中 snippet，不跳转）
 └─ :443  web-blog-ssl.conf    ─→  ssl 证书 + HTTP/2
          └─ include snippet
              ├─ /.well-known/acme-challenge/  →  /var/www/certbot   （Let's Encrypt 续期验证）
              ├─ /api/v1/ai/                   →  127.0.0.1:3000    （AI 问答，SSE 不缓冲）
              ├─ /api/                         →  127.0.0.1:3000    （Koa 接口）
              └─ /                             →  127.0.0.1:3008    （Nuxt SSR 页面）
```

端口别记混：

| 端口 | 进程 | 是什么 |
| --- | --- | --- |
| 3000 | node-server | Koa + Sequelize + MySQL，业务接口 |
| 3008 | web-blog | Nuxt SSR，页面 |

## 首次接管：先 diff，再软链

**不要直接覆盖服务器上正在跑的配置。** 先用仓库里的版本和线上做一次对比：

```bash
cd /path/to/web-blog/deploy/nginx

diff blog-locations.conf /etc/nginx/snippets/blog-locations.conf
diff web-blog.conf       /etc/nginx/conf.d/web-blog.conf
diff web-blog-ssl.conf   /etc/nginx/conf.d/web-blog-ssl.conf
```

- **没有输出** = 完全一致，继续往下
- **有输出** = 线上和仓库有差异。先看清楚差异是什么再决定，
  如果是仓库里少了线上才有的东西，把差异贴出来补进仓库

确认一致后，备份 + 软链（让仓库成为唯一事实来源）：

```bash
sudo cp -a /etc/nginx/conf.d/web-blog.conf     /root/web-blog.conf.bak-$(date +%F)
sudo cp -a /etc/nginx/conf.d/web-blog-ssl.conf /root/web-blog-ssl.conf.bak-$(date +%F)
sudo cp -a /etc/nginx/snippets/blog-locations.conf /root/blog-locations.conf.bak-$(date +%F)

BLOG=/path/to/web-blog            # 换成服务器上 web-blog 的实际路径

sudo ln -sfn $BLOG/deploy/nginx/web-blog.conf       /etc/nginx/conf.d/web-blog.conf
sudo ln -sfn $BLOG/deploy/nginx/web-blog-ssl.conf   /etc/nginx/conf.d/web-blog-ssl.conf
sudo ln -sfn $BLOG/deploy/nginx/blog-locations.conf /etc/nginx/snippets/blog-locations.conf

sudo nginx -t && sudo systemctl reload nginx
```

之后**改配置只改仓库**，服务器上 `git pull` 再 reload。

## 日常改配置的流程（这套部署机制值得单独记住）

**这台服务器的代码不是靠 `git pull` 更新的，是靠云效流水线把文件同步过去的。**
这是实测出来的，不是推测——在 `/home/nginx/web-blog` 里跑 `git status` 会看到：

```
## master
 M .env.production          ← 流水线覆盖过，但没提交
 M ecosystem.config.js
 M nuxt.config.js
 M package.json
?? deploy/                  ← 仓库里明明提交过，这里却是「未跟踪」
```

如果是 `git pull` 拉下来的，`deploy/` 应该是已跟踪文件。它显示未跟踪，说明这些文件
是**被复制进来的**，没走 git。同时 `git log` 里也看不到远端最新的提交。

### 所以流程是

| 环节 | 谁负责 |
| --- | --- |
| 改配置 | 本地仓库（**不要在服务器上编辑**） |
| 提交、推送 | 本地 |
| 把文件同步到服务器 | 云效流水线自动完成，不用管 |
| `nginx -t` + `systemctl reload nginx` | **手动**（流水线只管 PM2，不管 nginx 重载） |
| 在服务器上跑 git 命令 | **谁都别跑** |

推完等流水线跑完，然后：

```bash
sudo nginx -t && sudo systemctl reload nginx
```

### 两个必须记住的点

**① 改了文件不 reload 等于没改。**
nginx 把配置读进内存，文件变了不会自己重读。症状是「文件里明明改对了，
访问行为却还是旧的」——这次 `default_server` 就卡在这一步。

**② 服务器上那个 `.git` 是历史遗留，不要碰。**
它的本地提交（比如 `fix 牛云`）和远端已经完全分叉，而且没有配置上游跟踪。
在那台机器上 `git pull` 会要求合并甚至冲突，`git commit` 更是只会制造垃圾——
反正流水线下一轮会把文件覆盖一遍。需要看代码就去远端仓库看，别在服务器上看。

`nginx -t` 永远先于 reload。它只校验不生效，失败也不影响正在跑的进程；
reload 一个坏配置才会真的把站点搞挂。

## 证书

签发（webroot 方式，不改 nginx 配置）：

```bash
sudo certbot certonly --webroot -w /var/www/certbot \
  -d solzm.com -d www.solzm.com \
  --email zhy_swork@163.com --agree-tos --no-eff-email
```

证书落在 `/etc/letsencrypt/live/solzm.com/`，`fullchain.pem` + `privkey.pem`，
续期后原地更新，所以 `web-blog-ssl.conf` 里的路径不用改、nginx 也不用重载。

**续期验证（必须跑通）：**

```bash
sudo certbot renew --dry-run
```

它会在不消耗真实配额的前提下完整走一遍续期流程。**不跑通就等于没有自动续期**——
这类故障的表现是「三个月后证书突然过期」，而不是现在报错。

> **两张证书同一天到期：2027-01-12**
> - `solzm.com` / `www.solzm.com`：服务器上的 Let's Encrypt，自动续期
> - `img.solzm.com`：七牛云 CDN 上绑的免费证书，**不自动续，要手动换**

## 验收清单

改完配置后跑一遍，全绿才算成功：

```bash
# 1) 80 跳转到 https
curl -sI http://solzm.com/ | head -1                 # 期望 301
curl -s -o /dev/null -w "%{http_code}\n" http://solzm.com/   # 期望 301

# 2) 跳转目标正确
curl -s -o /dev/null -w "%{redirect_url}\n" http://solzm.com/   # 期望 https://solzm.com/

# 3) 续期路径没被跳转吞掉（关键，最容易被忽略）
curl -s -o /dev/null -w "%{http_code}\n" http://solzm.com/.well-known/acme-challenge/x
# 期望 404（nginx 的，几百字节），不能是 301

# 4) 页面正常
curl -s -o /dev/null -w "%{http_code} %{http_version}\n" https://solzm.com/   # 期望 200 2

# 5) 接口通（返回 JSON 而不是 Nuxt 的 404 HTML）
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" "https://solzm.com/api/v1/article?page=1&is_admin=1"
# 期望 200 application/json

# 6) 压缩生效（2026-10-17 加，改前这些响应是裸传的）
curl -s -o /dev/null -D - -H 'Accept-Encoding: gzip' "https://solzm.com/api/v1/article?page=1&is_admin=1" \
  | grep -i content-encoding
# 期望 content-encoding: gzip（改前为空）

ADMIN_JS=$(curl -s https://admin.solzm.com/ | grep -o '/static/js/app\.[a-z0-9]*\.js' | head -1)
curl -s -o /dev/null -D - -H 'Accept-Encoding: gzip' "https://admin.solzm.com${ADMIN_JS}" \
  | grep -iE 'content-encoding|cache-control'
# 期望同时出现 gzip 和 max-age=31536000

# 7) 确认没有画蛇添足：/_nuxt/ 只应有一个 Cache-Control
curl -s -o /dev/null -D - "https://solzm.com/_nuxt/$(curl -s https://solzm.com/ | grep -o '/_nuxt/[A-Za-z0-9._-]*\.js' | head -1 | sed 's#/_nuxt/##')" \
  | grep -ci cache-control
# 期望 1（上游 Nuxt 给的那条）。出现 2 说明有人又在反代上 add_header 了
```

想看 AI 问答的流式有没有被缓冲（首字节时间应明显小于总耗时）：

```bash
curl -s -N -m 45 -X POST https://solzm.com/api/v1/ai/ask \
  -H 'Content-Type: application/json' \
  -d '{"question":"MCP 是什么？"}' \
  -o /dev/null -w "首字节=%{time_starttransfer}s 总耗时=%{time_total}s\n"
```

两个数字如果几乎相等，说明某处把流式响应缓冲了。

## 踩过的坑速查

| 现象 | 原因 | 修法 |
| --- | --- | --- |
| certbot 报 `404` / `Invalid response from http://.../.well-known/acme-challenge/` | 80 块里没有 ACME 的 location，请求落到了前端反代上，前端返回 404 | 加 `location ^~ /.well-known/acme-challenge/`，并确认返回的是 nginx 自己几百字节的 404 |
| 接口返回一大坨 Nuxt 的 404 HTML 而不是 JSON | `/api` 被 `location /` 吃掉了，或者 `proxy_pass` 指向了 3008 | `/api/` 反代到 3000，并去掉 `proxy_pass` 末尾的斜杠 |
| AI 问答「卡很久然后一次性全出来」 | 443 那块漏了 `proxy_buffering off` | 见 `blog-locations.conf` 第 2 段 |
| nginx 启动报 `unknown directive "http2"` | 把 `http2 on;` 写在了 nginx 1.24 上（该指令 1.25.1 才有） | 用 `listen 443 ssl http2;` |
| 三个月后证书突然过期 | `certbot renew` 从没跑通过，通常是 ACME 路径被 301 吞了 | 保留 snippet 的 include，并定期 `certbot renew --dry-run` |
| HTTPS 页面上图片全空、控制台一堆 mixed-content | 图片地址还是 `http://`，或者图床证书不匹配 | 图床绑证书 + 库里 URL 换成 https |
| 以为「全站没有 gzip」 | `/etc/nginx/nginx.conf` 里其实有 `gzip on;`，但它下面的 `gzip_types` 是**注释掉的** —— 等于只压 `text/html`。所以 HTML 有 gzip、JS 和 API JSON 却是裸传，最容易误判 | 判断压缩有没有生效要按 Content-Type 实测（`curl -H 'Accept-Encoding: gzip' ... -D -`），不能只看有没有 `gzip on` 这一行 |
| 给 `/_nuxt/` 加了 `Cache-Control` 后，响应里出现两个同名头 | Nuxt 自己的 serve-static 已经下发了 `public, max-age=31536000`，nginx 再 `add_header` 是**叠加**而不是覆盖 | 上游已有就别再加。真要改先是 `proxy_hide_header Cache-Control` 隐藏上游那条 |

## 后台管理的 HTTPS 是怎么加的

起因（实测）：后台最初只有 80 端口能用——`http://admin.solzm.com` 返回后台页面，
而 `https://admin.solzm.com` 证书校验失败；忽略证书告警的话还会落到博客那个块上
（返回的是博客首页，不是后台）。**后台登录要 POST 密码，走明文 HTTP 等于把密码
暴露在链路上**，所以补了 HTTPS。

### 为什么顺序必须是这四步

先看两个约束：

- 443 的块里写了 `ssl_certificate`，**文件不存在 nginx 就起不来** → 证书必须先签出来
- 签证书时挑战请求带的是 `Host: admin.solzm.com`，命中 `myblog-admin.conf`
  → ACME 的 location 必须先配在这个块里，签证书才可能成功

所以顺序是 **① 加 ACME 位置 → ② 扩证书 → ③ 加 443 块 → ④ 80 才改 301**。
其中第 ④ 步放最后：80 一旦 301 而 443 还没配好，后台会立刻无法访问。

### ① 给后台的 80 块加 ACME 验证位置

见 `myblog-admin.conf` 里 `location ^~ /.well-known/acme-challenge/` 那段。
改完 `nginx -t && systemctl reload nginx`，然后确认挑战路径可达
（此时应该返回 nginx 自己几百字节的 404，而不是后台的 index.html）：

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://admin.solzm.com/.well-known/acme-challenge/x
```

### ② 把域名扩进现有证书

`--expand` 表示在原有证书上加域名，不是重新签一张。证书路径不会变
（还是 `/etc/letsencrypt/live/solzm.com/`，取的是第一个 `-d` 的名字）：

```bash
sudo certbot certonly --webroot -w /var/www/certbot \
  -d solzm.com -d www.solzm.com -d admin.solzm.com \
  --expand --email zhy_swork@163.com --agree-tos --no-eff-email
```

确认 SAN 里三个域名都在：

```bash
openssl s_client -connect admin.solzm.com:443 -servername admin.solzm.com </dev/null 2>/dev/null \
  | openssl x509 -noout -text | grep -A1 "Subject Alternative Name"
```

### ③ 加 443 的块

见 `myblog-admin-ssl.conf`。改完 `nginx -t && systemctl reload nginx`，
确认 https 打开的是**后台**而不是博客：

```bash
curl -s https://admin.solzm.com/ | grep -o "<title>[^<]*</title>"
```

### ④ 最后才把 80 改成 301

见 `myblog-admin.conf` 里 `location /` 那段。这是这一步的真正目的：
**关掉明文入口**，让密码不可能再走 HTTP 传出去。

### 顺带处理了 443 的默认 server

443 上有两个块之后，「没匹配上任何 `server_name` 的请求交给谁」变成了一个必须
有答案的问题（有人直接用 IP 访问、扫描器扫到、某个早先的 A 记录还指着这台机器时
都会触发）。

nginx 的规则是：**拿按文件名排序最靠前的那个 443 块顶替**。也就是
`include /etc/nginx/conf.d/*.conf` 展开后的第一个——
`myblog-admin-ssl.conf` 排在 `web-blog-ssl.conf` 前面，所以默认会落到**后台**。

不影响任何真实域名（它们都是精确匹配），但「对外是博客、结果不匹配的流量领到
后台登录页」看着不自然。所以 `web-blog-ssl.conf` 上显式声明了：

```nginx
listen 443 ssl http2 default_server;
```

这样它就被钉死成默认块，以后再加多少个 `.conf` 都不会变。

⚠️ 同一个 `地址:端口` 上只能有一个 `default_server`，两个块都写会让 nginx
启动失败（`a duplicate default server`）。

验证方式——发一个不存在的域名过去，看回的是哪个站：

```bash
curl -s -k -H "Host: bucunzai-xyz.com" https://39.106.53.90/ | grep -o "<title>[^<]*</title>"
# 期望 <title>个人博客</title>（改之前是 Vue Admin ZHY）
```

## 残留的 vim 交换文件

`conf.d/` 里能看到 `.myblog-serve.conf.swp` 这类文件，但 `myblog-serve.conf`
**并不存在**。它们是 vim 编辑时连接中断留下的交换文件（正常退出会自动删除），
不是配置。

确认没有 vim 还在跑之后再清理：

```bash
ps aux | grep "[v]im"
sudo ls -la /etc/nginx/conf.d/.*.sw*
# 确认上面没有活跃会话，再删
```

改配置建议在 `tmux` 里做，断线后 `tmux a` 能回到现场，不会再产生这类残留。
