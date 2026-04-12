# 👁️ ARGUS by googleadsagent.ai

[English](README.md) | [Français](README.fr.md) | [Español](README.es.md) | [中文](README.zh.md) | [Nederlands](README.nl.md) | [Русский](README.ru.md) | [한국어](README.ko.md)

### 算法真实性分析平台

**社交媒体虚假个人资料和帖子的 VirusTotal — 免费、开源、Cloudflare 原生**

🔗 **在线访问**：[googleadsagent.ai/tools/argus](https://googleadsagent.ai/tools/argus/)
📊 **报告**：[googleadsagent.ai/tools/argus/reports](https://googleadsagent.ai/tools/argus/reports)

---

## 功能介绍

ARGUS 分析 LinkedIn、Reddit、Instagram、X、Facebook、YouTube、Quora、TikTok 和 Pinterest 上的任何社交媒体个人资料、帖子或互动模式。返回一个**加权信任评分（0–100）**，包含完整推理、检测引擎分析、评论者分析和扣分说明。

被标记的内容会获得一个被 Google 索引的公开页面，具有 SEO 友好的 URL。所有分析都表述为算法意见——而非判决。个人资料所有者可以随时提出异议。

**每个上线的页面都经过人工审核和批准。**

---

## 核心功能

- **4 个检测引擎**：图像、文本、行为、网络——各自独立评分
- **评论者分析**：分析每个可见评论者的机器人模式、协调性、真实性
- **加权评分算法**：`网络(35%) + 行为(30%) + 图像(20%) + 文本(15%) - 扣分`
- **扣分系统**：对不可验证数据、机器人模式、虚假互动等自动扣分
- **私密资料模式**：对 ARGUS 无法抓取的资料粘贴内容 + 截图
- **Claude AI 分析**：由 Anthropic Claude 提供深度内容分析
- **动态公开报告**：通过 Cloudflare Workers 即时生成的 Wiki 风格页面
- **SEO 友好 URL**：`/report/reddit-landing-page-navigation-conversion-85`
- **管理后台**：OAuth 保护，含 Chart.js 分析、分组、争议解决
- **证据上传**：R2 存储争议证据文件
- **邮件通知**：通过 Resend 向提交者发送详细分析结果
- **动态站点地图**：从已发布报告自动生成
- **浏览器扩展**：Chrome 扩展用于快速分析

---

## 评分算法

与通用 AI 评分不同，ARGUS 使用**确定性加权组合**：

```
Final Score = Weighted Composite - Penalties

Weighted Composite:
  Network Engine  × 0.35
  Behavioral      × 0.30
  Image           × 0.20
  Text            × 0.15

Penalties (applied automatically):
  Account age unverifiable:      -8
  No visible posting history:    -10
  Private submission:            -15
  Page couldn't be fetched:      -12
  Very limited content:          -10
  Bot activity detected:         -up to 20
  AI-generated content:          -up to 15
  Fake engagement detected:      -up to 20
  >50% suspicious comments:      -15
  High followers + few posts:    -18
  New account + high engagement: -20
```

---

## 使用的 Cloudflare 服务

| 服务     | 用途                              | 免费额度            |
|-------------|--------------------------------------|----------------------|
| **Pages**   | 静态页面 + Functions API         | 无限制            |
| **KV**      | 提交、争议、配置缓存  | 10万次读取/天       |
| **R2**      | 证据保险库（争议文件上传）| 10GB + 1000万次操作/月 |
| **Workers** | 动态报告生成、站点地图   | 10万次请求/天         |

**月成本：约 $0–$5**

---

## 检测引擎

| 引擎 | 分析内容 | 关键信号 |
|--------|----------|-------------|
| **图像** | 头像、帖子图片 | GAN 伪影、库存照片、C2PA 来源、EXIF 异常 |
| **文本** | 简介、帖子、评论 | AI 生成文本、文体测量一致性、模板化语言 |
| **行为** | 活动模式 | 账户年龄 vs 活跃度、发帖频率、互动比率 |
| **网络** | 连接、互动 | 粉丝比率、协调指标、机器人网络签名 |

---

## 法律架构

每个页面都受到以下保护：

1. **"算法分析，非判决"** — 在每个页面上显示
2. **完全方法论公开** — 开源，可公开审计
3. **透明评分** — 显示加权组合和扣分
4. **突出的争议机制** — 显眼位置，不隐藏
5. **人工编辑审核** — 管理员批准每个发布的页面

---

## 争议 / 退出流程

任何人都可以在 `/tools/argus/dispute` 提交争议并上传文件（R2）。

| 级别 | 证据 | 结果 |
|------|----------|---------|
| **级别 1** | 政府证件 + 平台验证 | 自动批准删除 |
| **级别 2** | 跨平台存在、雇主确认 | 人工审核 |
| **级别 3** | "我是真人"但无证据 | 争议被拒 |

---

## 在线 URL

- **首页**：[googleadsagent.ai/tools/argus](https://googleadsagent.ai/tools/argus/)
- **提交**：[googleadsagent.ai/tools/argus/app](https://googleadsagent.ai/tools/argus/app)
- **报告**：[googleadsagent.ai/tools/argus/reports](https://googleadsagent.ai/tools/argus/reports)
- **争议**：[googleadsagent.ai/tools/argus/dispute](https://googleadsagent.ai/tools/argus/dispute)
- **文档**：[googleadsagent.ai/tools/argus/docs](https://googleadsagent.ai/tools/argus/docs)
- **站点地图**：[googleadsagent.ai/api/argus-sitemap](https://googleadsagent.ai/api/argus-sitemap)

---

## MIT 许可证

开源。社区维护。欢迎 PR。

**github.com/itallstartedwithaidea/argus**
