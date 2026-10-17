# 博客全站 HTTPS 迁移 —— 面试知识点总结

> 这份文档整理自我把 `solzm.com` 从纯 HTTP 迁到全站 HTTPS 的完整过程，
> 覆盖**博客前台、后台管理系统、图床、部署流程**四个面。
> 结构是：**业务场景 → 整体架构 → 关键决策与权衡 → 踩过的坑（含排查过程）→ 实测数据 → 追问准备**。
>
> 面试时最有价值的不是"我上了 HTTPS"这件事本身（那是运维常识），
> 而是**迁移过程中的约束怎么推导出方案、以及故障是怎么被定位出来的**。
> 所以每一条我都留了证据和判断依据，而不是只写结论。

---

## 一、业务场景：为什么要做这个

### 迁移前的状态

| 站点 | 域名 | 协议 |
|---|---|---|
| 博客前台 | `solzm.com` / `www.solzm.com` | HTTP |
| 后台管理系统 | `admin.solzm.com` | HTTP |
| 图片 | `img.solzm.com`（七牛云 CDN） | HTTP |

### 具体问题（按严重程度排）

1. **后台登录是明文传输的**——登录要 POST 密码，HTTP 下密码在链路上可被截获。这是最实际的风险。
2. **浏览器标记为"不安全"**，影响观感，也会影响搜索引擎的信任度。
3. **部分浏览器能力在非安全上下文下不可用**（Service Worker、地理位置、剪贴板等），限制了以后做 PWA 之类的可能性。
4. HTTP/2 只能在 HTTPS 下用（浏览器实现如此），意味着当时的性能上限被卡住。

### 目标

- 三个域名全部走 HTTPS
- HTTP 一律 301 跳到 HTTPS（不留明文入口）
- **不能有混合内容**——页面上任何一个 `http://` 资源都会让这次迁移只做了一半
- 证书自动续期，不能三个月后靠人记得

### 关键约束（这几条直接决定了技术选型）

| 约束 | 推导出的决策 |
|---|---|
| 服务器是阿里云 ECS + Ubuntu 24.04 + nginx 1.24 | certbot 用 apt 装就够（源里已是 2.9），不必按官方推荐走 snap |
| 图片在七牛云 CDN，是另一个域名 | 证书要覆盖多域名；**图床必须单独绑一张证书**（服务器上那张不能复用） |
| 后台是独立子域名 | 证书要么一次签三个域名，要么签多张 |
| 单人维护、成本敏感 | 自动续期比省事重要；不买商业证书，用 Let's Encrypt + 七牛免费证书 |
| 站内有 SSE 流式接口（AI 问答） | 443 那块**必须**保留 `proxy_buffering off`，否则功能退化 |
| 前端已经有代码跑在线上 | 迁移过程不能出现长时间不可用，要能分步验证 |

---

## 二、整体架构（迁移后的请求流向）

```
公网
 ├─ :80
 │   ├─ solzm.com / www.solzm.com    web-blog.conf
 │   │     └─ 301 → https://$host$request_uri
 │   │        （例外：/.well-known/acme-challenge/ 走 ACME location，不跳转）
 │   └─ admin.solzm.com              myblog-admin.conf
 │         └─ 301 → https://$host$request_uri
 │            （同样保留 ACME location）
 │
 └─ :443
     ├─ solzm.com / www.solzm.com    web-blog-ssl.conf   ← default_server
     │     └─ include snippet: blog-locations.conf
     │           ├─ /.well-known/acme-challenge/ → /var/www/certbot
     │           ├─ /api/v1/ai/   → 127.0.0.1:3000   （SSE，关缓冲）
     │           ├─ /api/         → 127.0.0.1:3000   （Koa 接口）
     │           └─ /             → 127.0.0.1:3008   （Nuxt SSR）
     ├─ admin.solzm.com              myblog-admin-ssl.conf
     │     ├─ /    → /home/nginx/solzm-admin（静态站）
     │     └─ /api/ → 127.0.0.1:3000
     └─ 未匹配任何 server_name        → 落到 default_server（博客块）
```

### 端口对照（这个必须记牢，写错端口的表现很有迷惑性）

| 端口 | 进程 | 是什么 | 写错的症状 |
|---|---|---|---|
| 3000 | node-server (Koa + Sequelize + MySQL) | 业务接口 | 接口返回 Nuxt 的 404 HTML 而不是 JSON |
| 3008 | web-blog (Nuxt SSR) | 页面 | 页面返回 Koa 的 `Not Found` 纯文本 |

### 为什么把 location 抽成一个 snippet

80 和 443 两个 server 块需要**完全一样**的三段 location（ACME 验证、AI 的 SSE、普通接口）。
写两份的问题是：以后改接口地址（比如后端换端口）必须记得改两处，漏一处就会出现
"HTTPS 能用、HTTP 不能用"这种极难排查的不一致。

抽成 `/etc/nginx/snippets/blog-locations.conf` 之后，两边各写一行 `include`，
接口配置只有唯一一份。这也是后面加后台 HTTPS 时能快速复用的原因。

---

## 三、关键决策与权衡

### ① 证书：为什么用 Let's Encrypt + webroot，而不是 `certbot --nginx`

`certbot --nginx` 是一条命令搞定，但它会**自动改写 nginx 配置文件**。
我这套配置里有多个 server 块、还调过 SSE 的缓冲参数，让工具自动改的话：

- 它改到哪个 server 块不好预测（有多个块匹配同一端口时）
- 改完的 diff 很大，出问题难定位

`certonly --webroot` 完全不碰现有配置，代价只是**手工加一个 ACME 的 location**——
而这个 location 本来就必须加（见下一条），所以等于零成本。

另外没选 snap 版 certbot 的原因：官方推荐 snap 是因为旧发行版源里的 certbot 太老
（不支持 ACME v2），而 Ubuntu 24.04 源里已经是 2.9，apt 装更干净，
还自带 systemd timer（`certbot.timer`），**不用自己写 cron**。

### ② 为什么 80 那块必须保留 ACME 验证的 location

这是我认为这次迁移里**最值得讲的决策**，因为它是一个"现在没问题、三个月后才爆炸"的坑。

续期时 Let's Encrypt 会访问 `http://<域名>/.well-known/acme-challenge/<token>`。
如果 80 那块只写：

```nginx
location / { return 301 https://$host$request_uri; }
```

这个请求会被 301 跳到 HTTPS，而 certbot 的服务端不会跟着跳（它认为这是一个异常响应），
验证失败 → **续期失败**。而这个失败当天完全无感，只在 90 天后证书到期时才暴露。

所以 snippet 里这段必须留在 80 那块，而且用 `^~` 钉死优先级：

```nginx
location ^~ /.well-known/acme-challenge/ {
    root /var/www/certbot;
    default_type "text/plain";
    try_files $uri =404;
}
```

`^~` 的作用是"命中这个前缀后不再去匹配正则 location"。大多数配置里加不加都一样，
但一旦别处引入正则 location，ACME 就可能只在续期时才莫名其妙失败——
用 `^~` 把优先级显式钉死，是拿 1 个字符换掉一整类偶发故障。

**验证方式**（这条我配进了验收清单）：

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://solzm.com/.well-known/acme-challenge/x
# 期望 404（nginx 自己的），不能是 301
```

### ③ 接口地址：为什么要改成同源相对路径

迁移前 `.env.production` 里写的是绝对地址：

```
BASE_URL = 'http://39.106.53.90:80/api/v1'
```

这个值会在**构建时被编译进 JS 产物**（我在产物里实测到它烧在 `5bdf821.js` 里）。
页面一旦变成 HTTPS，浏览器会把这种请求判定为**混合内容**直接拦截。

表现很有迷惑性：**页面正常、图片正常，但点分类、翻页、评论、AI 问答全部失效**——
因为 SSR 出来的 HTML 是完整的，只有客户端发起的请求被拦。

改成同源相对路径 `/api/v1` 之后：

- 走 HTTP 还是 HTTPS 自动就对，切协议不用改构建产物
- 同源，不涉及 CORS
- 顺带把写死的服务器 IP 从 JS 里去掉了（换服务器/换域名不用重新构建）

**但这里有个不能想当然的地方**：SSR 阶段 axios 跑在 Node 里，
Node 的 axios **必须拿到绝对地址**，给相对路径会直接抛 `Invalid URL`。
所以按运行环境分开取：

```js
const isServer = typeof window === 'undefined'
config.baseURL = isServer
  ? process.env.API_INTERNAL_URL || 'http://127.0.0.1:3000/api/v1'  // SSR 直连本机 Koa
  : process.env.BASE_URL                                            // 浏览器走同源
```

用 `typeof window` 而不是 `process.server`，是为了不依赖构建工具的常量替换，
行为在任何打包方式下都确定。

### ④ 图片：为什么必须换 https，而且不能只改数据库

两件事都得做，缺一不可：

1. **七牛那边给 `img.solzm.com` 绑证书**。实测发现这个域名虽然 443 能连上，
   但返回的是七牛自己的通用证书（`subject: CN=*.qbox.me`），**域名不匹配**。
   证书不匹配比混合内容更糟——浏览器直接拒绝加载，连降级的机会都没有。
   注意**不能复用服务器上那张 Let's Encrypt 证书**，因为它的 SAN 里没有 `img.solzm.com`。
2. **数据库里的 URL 换成 https**。封面在 `article.img_url`，正文里的图片在 `article.content`。

实测数据（本地那份线上副本）：

| 位置 | 数量 |
|---|---|
| 封面 `img_url` 是 `http://img.solzm.com` | **31 篇**（全部） |
| 正文 `content` 里内嵌图床地址 | **4 篇，共 8 处**（id=28 有 5 处） |

改数据用事务包起来，先干跑统计、再改、最后验证剩余为 0：

```sql
START TRANSACTION;
UPDATE article SET img_url = REPLACE(img_url, 'http://img.solzm.com', 'https://img.solzm.com')
 WHERE img_url LIKE 'http://img.solzm.com%';
UPDATE article SET content = REPLACE(content, 'http://img.solzm.com', 'https://img.solzm.com')
 WHERE content LIKE '%http://img.solzm.com%';
-- 报的行数应是 31 / 4，对得上再 COMMIT，不对就 ROLLBACK;
COMMIT;
```

**顺序很重要**：必须等七牛证书真正生效之后再改库。
反过来的话，把 URL 改成 https、但证书还没绑好，**连现在的 HTTP 站点也会一起挂**
（因为 HTTPS 加载失败比混合内容被拦更彻底）。

### ⑤ 为什么默认 server 要显式声明

443 上有了两个块之后，"没匹配上任何 `server_name` 的请求交给谁"就变成了一个必须回答的问题。

nginx 的规则是：**取配置文件里出现的第一个** `listen 443` 的块——
而配置是通过 `include /etc/nginx/conf.d/*.conf` 加载的，`*` 按**文件名字母序**展开：

```
myblog-admin-ssl.conf     ← m 在前
web-blog-ssl.conf         ← w 在后
```

结果是：加了后台的块之后，不匹配的请求从"回博客"变成了"回后台登录页"。
不影响任何真实域名（它们都是精确匹配），但这是个**靠文件名碰运气**的行为。

所以在博客那块显式写上：

```nginx
listen 443 ssl http2 default_server;
```

注意事项：同一个 `地址:端口` 上只能有一个 `default_server`，两个块都写会让 nginx
启动失败（`a duplicate default server`）。

### ⑥ 迁移顺序为什么不能乱

这是整个迁移里最容易出事的地方，两条硬约束：

- 443 的块里写了 `ssl_certificate`，**证书文件不存在 nginx 就起不来** → 证书必须先签出来
- 签证书时挑战请求带的是 `Host: admin.solzm.com`，命中后台那个块
  → **ACME 的 location 必须先配在后台块里**，签证书才可能成功

所以后台那次的顺序是：**① 加 ACME 位置 → ② 扩证书 → ③ 加 443 块 → ④ 最后才改 80 的 301**。
第 ④ 步放最后的理由：80 一旦 301 而 443 还没配好，后台会立刻无法访问。

每一步之间都有可验证的中间态，所以全程没有"服务不可用"的窗口。

---

## 四、踩过的坑（含排查过程）

> 面试问"遇到什么困难"，直接用这几个。重点讲**怎么定位的**，而不是"我改了哪行"。

### 坑 1：certbot 报 404，但看不出是谁返回的 404

**现象**：签发失败，日志里是

```
Type: unauthorized
Detail: ... Invalid response from http://solzm.com/.well-known/acme-challenge/xxx: 404
```

**难点**：404 是最没信息量的错误——调用方看到的是 404，看不出这 404 是 nginx 给的、
还是后端应用给的、还是路径写错了。

**排查过程**：

1. 从外部直接请求那个路径，发现返回的是 **216KB 的 HTML 页面**，
   开头是 `<!doctype html><html data-n-head-ssr ...>`
2. 对比另一个肯定不存在的路径，返回的也是**同样 216KB 的页面**
3. 结论：这个请求**根本没被 nginx 特殊处理**，直接落到了 `location /` 的反代上，
   由 Nuxt 返回了它自己的 404 页面

**定位依据**：nginx 自带的 404 只有**几百字节**的静态错误页，
而应用返回的 404 是完整的业务页面。**响应体大小和内容特征，能区分"谁返回的 404"**——
这个判据在后面的验收里也一直在用（改完之后该路径返回 162 字节，说明 nginx 接管了）。

**根因**：80 那块压根没有 ACME 的 location。

**教训**：`nginx -t` 只校验语法，**不校验业务逻辑是否齐全**。配置"语法正确"和
"功能正确"是两件事，必须用真实请求去验。

### 坑 2：混合内容的两处来源，得系统性地找全

混合内容不会在服务端报错，只在浏览器控制台里静默拦截。找全的办法：

```bash
# 1) 页面里所有 http:// 资源
curl -s https://solzm.com/ | grep -o 'http://[^"'"'"' ]*' | sort | uniq -c | sort -rn

# 2) 客户端 JS 产物里烧录的绝对地址（这个不会出现在 HTML 里！）
for f in $(curl -s https://solzm.com/ | grep -o 'src="[^"]*\.js"' | sed 's/src="//;s/"//'); do
  echo "$f -> $(curl -s https://solzm.com$f | grep -c '39\.106\.53\.90')"
done
```

第二条是关键：**环境变量注入的绝对地址只在 JS 产物里，HTML 里搜不到**。
只查 HTML 会以为已经干净了。

最终用真实浏览器自动验证最可靠——列图片的 `naturalWidth`、监听 `requestfailed`：

```
图片总数 10 / 已加载 10 / 加载失败 0 / 仍是 http 的 0
失败请求：[]
```

### 坑 3：SSE 被缓冲——怎么判断"流式"是不是真的流式

nginx 默认会缓冲响应，SSE 会在浏览器侧退化成"卡很久然后一次性全出来"。

**判断依据：首字节时间 vs 总耗时。**

```bash
curl -s -N -m 45 -X POST https://solzm.com/api/v1/ai/ask \
  -H 'Content-Type: application/json' -d '{"question":"MCP 是什么？"}' \
  -o /dev/null -w "首字节=%{time_starttransfer}s 总耗时=%{time_total}s\n"
```

实测 `首字节 0.97s / 总耗时 5.75s` → 差得很远，说明是边生成边推送的。
如果两个数字几乎相等，就是被缓冲了。

顺带一个容易漏的点：**80 和 443 两块都要有这段配置**。只改 80 的话，
迁到 HTTPS 之后 AI 问答就悄悄退化了。

### 坑 4：nginx 1.24 不支持 `http2 on;`

写 `http2 on;` 会直接报 `unknown directive "http2"`。
这个指令是 nginx **1.25.1** 才引入的语法糖，1.24 及以前只能在 `listen` 后面跟：

```nginx
listen 443 ssl http2;
```

**教训**：抄配置一定要对照自己的版本号。很多教程不写版本前提，
照抄会得到一条"看起来完全合理"但启动不了的配置。

### 坑 5：改了配置文件，不 reload 等于没改

**现象**：文件里明明有 `default_server`（`grep` 能搜到），
但访问行为没变，仍然是后台。

**原因**：nginx 启动时把配置读进内存，文件变更不会自动重读。

**排查**：这种情况很好定位——**先确认文件内容对不对，再确认有没有 reload**。
两步分开查，就不会在"是不是路径错了/是不是语法错了"上浪费时间。

结论：`nginx -t && systemctl reload nginx` 必须成为改配置的固定第二步。

### 坑 6：以为服务器是 `git pull` 更新的，其实不是

**现象**：我在服务器上跑 `git log --oneline -3`，看到的提交是
`fix 牛云` / `fix` / `fix`——**和我推的提交完全不是一条历史**。

**排查过程**（用三条命令区分了几种可能）：

| 命令 | 输出 | 结论 |
|---|---|---|
| `git remote -v` | codeup 仓库地址 | 远端是我推的那个，没搞错仓库 |
| `git status -sb` | `deploy/` 显示为 `??`（未跟踪） | 但仓库里明明提交过这个目录 |
| `pm2 describe blog` | `exec cwd: /home/nginx/web-blog` | 只有一份副本，没有指错目录 |

`deploy/` 是"未跟踪"这一点是决定性的：如果是 `git pull` 拉下来的，它应该是已跟踪文件。
**它未跟踪 → 文件是被复制进来的，没走 git**。同时 `.env.production` 等文件显示为"已修改未提交"，
说明流水线把新版本覆盖上去了，但没人提交。

**结论**：这套部署是**云效流水线把文件同步到服务器**，不是 git pull。
所以：

- 我推的改动能上线（文件同步过去了）✓
- 但 `git log` 里看不到我的提交（git 历史压根没动）✓

**顺带发现的隐患**：服务器上那个 `.git` 的本地提交和远端**已经完全分叉**，
在那台机器上 `git pull` 会要求合并甚至冲突，`git commit` 只会制造垃圾。
现在已经在文档里写明"服务器上的 git 不要碰"。

**教训**：`git log` 和实际线上代码对不上时，第一反应不应该是"我看错目录了"，
而应该怀疑**部署机制本身不是基于 git 的**。

### 坑 7：验证工具本身引入了噪声

**现象**：用 curl 访问 `https://solzm.com/` 一切正常（200、HTTP/2、证书校验通过），
但用浏览器（Playwright 驱动 Chrome）验证时**一直卡死到超时**，`domcontentloaded` 都等不到。

**排查**：既然 curl 通、浏览器不通，说明差异在**两者走的网络路径**上。查系统代理：

```bash
scutil --proxy
# HTTPProxy  127.0.0.1:7890
# HTTPSProxy 127.0.0.1:7890
```

本机开着代理软件（FlClash），**Chrome 默认走系统代理，curl 默认直连**。
给浏览器加上 `--no-proxy-server` 之后立刻正常。

**为什么值得记**：排查时"工具报的错"和"系统的真实状态"是两件事。
如果当时没有 curl 做对照组，很容易误判成服务器证书有问题，然后在错误的方向上排查很久。

（同一个根源还导致了另一个现象：SSH 老断。本机在 iPhone 热点上、加代理，
到服务器的延迟在 25ms~197ms 之间跳。处理方式是给 `solzm.com` 加直连规则 + 用 `tmux` 保会话。）

---

## 五、实测数据与验收清单

### 迁移完成后的实测结果

| 验证项 | 结果 |
|---|---|
| `https://solzm.com` / `www` | 200、**HTTP/2**、证书校验通过 |
| `https://admin.solzm.com` | 200，返回后台（改前会落到博客） |
| 不匹配域名（default_server） | 返回博客 |
| 证书 SAN | `solzm.com`、`www.solzm.com`、`admin.solzm.com` |
| 证书有效期 | 90 天（2026-10-14 → 2027-01-12） |
| 80 端口 | 三个域名全部 301 → https |
| 两个域名的 ACME 路径 | 404（**不是 301**） |
| 博客接口 / 后台接口 | 200 `application/json` |
| 首页图片 | `http://` 0 处、`https://` 10 处，浏览器实测 10/10 加载成功 |
| 页面失败请求 | 0 |
| AI 问答 SSE | 200，首字节 0.97s / 总耗时 5.75s（流式未被缓冲） |

### 五条固定验收命令

```bash
# 1) 80 跳转
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://solzm.com/     # 301 https://solzm.com/

# 2) 续期通道没被跳转吞掉（最容易漏的一条）
curl -s -o /dev/null -w "%{http_code}\n" http://solzm.com/.well-known/acme-challenge/x   # 404

# 3) 页面与 HTTP/2
curl -s -o /dev/null -w "%{http_code} %{http_version}\n" https://solzm.com/    # 200 2

# 4) 接口通（返回 JSON 而不是 Nuxt 的 404 HTML）
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" \
  "https://solzm.com/api/v1/article?page=1&is_admin=1"                          # 200 application/json

# 5) 混合内容归零
curl -s https://solzm.com/ | grep -c 'http://img\.solzm\.com'                   # 0
```

### 续期必须验证（不能只看"配置写对了"）

```bash
sudo certbot renew --dry-run
```

它在不消耗真实配额的前提下完整走一遍续期流程。**这是唯一能证明"三个月后不会突然过期"的方式**——
ACME 路径返回 404 只是必要条件，`--dry-run` 通过才算闭环。

---

## 六、面试可能被追问的问题（提前准备）

| 问题 | 回答要点 |
|---|---|
| HTTPS 的握手过程？ | 简版：TCP → ClientHello（含支持的加密套件、随机数）→ ServerHello + 证书 → 客户端验证证书链（是否被受信任 CA 签发、域名是否匹配、是否过期、是否被吊销）→ 密钥交换 → 对称加密通信。**证书验证的四件事**是重点 |
| 301 和 302 的区别？为什么用 301？ | 301 是永久重定向，浏览器和搜索引擎会缓存；302 是临时的。协议升级是永久事实，所以用 301。副作用：**缓存后很难回退**，调试时会遇到"改了配置浏览器还跳"，需要清缓存或用 curl 验证 |
| HTTP/2 相比 1.1 好在哪？怎么开？ | 多路复用（一个连接并发多个请求，解决队头阻塞）、头部压缩（HPACK）、服务端推送。浏览器只在 HTTPS 下启用；nginx 是 `listen 443 ssl http2;`（1.25.1+ 才支持 `http2 on;`） |
| 什么是混合内容？ | HTTPS 页面加载 HTTP 资源。分两类：**blockable**（脚本、样式、iframe、XHR——直接拦截）和 **upgradable**（图片、音视频——浏览器可能自动升级成 https）。这次踩的是 blockable 那类（接口 XHR）和图片这类 |
| ACME 协议是什么？HTTP-01 和 DNS-01 的区别？ | ACME 是自动签发证书的协议（Let's Encrypt 实现了它）。HTTP-01 是在 `/.well-known/acme-challenge/` 放一个文件让对方访问，要求域名解析到本机且 80 能访问；DNS-01 是加一条 DNS TXT 记录，**好处是能签泛域名、且不需要暴露 80**。我用的是 HTTP-01 |
| 怎么保证证书不会过期？ | 两层：① 让路径永远可达（80 保留 ACME location，用 `^~` 钉优先级）；② 定期 `certbot renew --dry-run` 验证整条链路。另外 Ubuntu 的 certbot 包自带 systemd timer，不用自己写 cron |
| 为什么接口要改同源？跟 CORS 什么关系？ | 同源就没有跨域，也不会有混合内容问题。如果接口在另一个域名，方案是给它单独签证书 + 配置 CORS（还要处理预检请求），链路更长、出错面更大。**能用同源就不要跨域** |
| SSR 和浏览器端取接口地址为什么不一样？ | SSR 在 Node 里跑，axios **必须给绝对地址**（相对路径会报 `Invalid URL`）；浏览器端给相对路径就是同源。所以按 `typeof window === 'undefined'` 分开取，SSR 直连 `127.0.0.1:3000` 少绕一圈 nginx 和 TLS |
| HSTS 是什么？为什么这次没上？ | 强制浏览器以后只用 HTTPS 访问该域名。没上的原因：**一旦下发很难回退**（max-age 内浏览器强制 https），而且要确认所有子域名的 HTTPS 都好了才能考虑用 `includeSubDomains`。先让 HTTPS 稳定跑一段时间再上更稳 |
| nginx 怎么选 server 块？ | 精确匹配 `server_name` → 通配符 → 正则 → **都没匹配上就用该端口的 default server**。default server 是"第一个 `listen` 该端口的块"，而 include 按文件名字母序展开——所以它可能被新加的文件悄悄改变，需要显式声明 |
| SSE 在 nginx 上要注意什么？ | 必须 `proxy_buffering off`（否则变成"卡很久一次性全出来"）、`proxy_read_timeout` 给足、`proxy_http_version 1.1`。判断标准是**首字节时间应明显小于总耗时** |
| 如果访问量涨上来，这套配置哪里先扛不住？ | ① Nuxt SSR 单实例（PM2 可以改 `instances: 'max'`）；② 向量检索是内存暴力扫描，切片量大了要换索引方案；③ 所有请求都过同一台 nginx + 同一个 Koa 进程，没有横向扩展。真正要扩的时候瓶颈顺序是：SSR CPU → 数据库连接数 → 单机带宽 |

---

## 七、遗留与改进

| 项目 | 状态 | 说明 |
|---|---|---|
| HSTS | 未开 | 等 HTTPS 稳定跑一段时间再加，避免过早绑定 |
| 七牛证书续期 | **手动** | 服务器那张 Let's Encrypt 会自动续，但七牛这张不会。两张同一天到期（2027-01-12），已经设了日历提醒 |
| 服务器上的 `.git` | 待清理 | 本地提交和远端已分叉，现在只在文档里标注"不要碰"。彻底解决要么删掉 `.git`（纯当部署目录），要么 `fetch + reset --hard` 对齐远端 |
| 裸 IP 暴露后台入口 | 已知 | `http://39.106.53.90` 命中的是 80 端口的 default server（后台块）。不是漏洞但不够干净，可以加一个兜底块返回 444 |
| 配置漂移风险 | 已解决 | nginx 配置全部入库 + 服务器软链，改动只发源自仓库 |

---

## 八、一句话总结

这次迁移真正的难点不在"怎么签一张证书"，而在**三件事**：

1. **迁移是一次"全链路一致性"检查**——证书、DNS、安全组、nginx、环境变量、数据库、图床，
   任何一环还是 http，整体就是坏的。而每一环的失败症状都不一样（有的 404、
   有的静默拦截、有的三个月后才爆）。
2. **判断依据比结论重要**——"404 的响应体是 216KB 还是 162 字节"能区分是谁返回的 404；
   "首字节 vs 总耗时"能判断流式有没有被缓冲；"`deploy/` 是未跟踪还是已跟踪"能判断部署走没走 git。
   这些都是能复用的**可观测依据**，比记住某条配置更有价值。
3. **变更顺序本身就是设计的一部分**——证书先于 443 块、443 块先于 80 跳转、图床证书先于改数据库。
   顺序错的代价不是报错，而是**服务不可用**。
