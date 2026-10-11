# 知行台

一个单用户的私人个人助手网站，把日程、项目、领域学习、Ideas 与疑问放在同一套“捕捉 → 规划 → 执行 → 记录 → 回顾”工作流中。

## 已实现

- 今日页：主要行动、连续时间轨、今日任务、项目与学习概览。
- 日程页：周视图与议程视图、快速创建、Google Calendar 双向同步入口。
- 项目页：项目概览、任务看板、进度和下一步行动。
- 领域学习：领域书架、认知档案、核心认知、知识分支、分阶段总结与跨领域笔记。
- Ideas 与疑问：快速捕捉、关联领域/项目、探索与解决状态。
- 周回顾：任务完成、学习投入和时间分配。
- 私人访问：服务端账号 allowlist；Google OAuth token 使用 AES-GCM 加密后存入 D1。

## 本地运行

要求 Node.js `>=22.13.0`。

```bash
pnpm install
pnpm run dev
```

本地 `localhost` 使用预览身份；部署后必须通过 ChatGPT 登录和邮箱 allowlist。

## 环境变量

复制 `.env.example` 中的键到 Sites 部署环境：

- `ALLOWED_USER_EMAIL`：唯一可访问站点的 ChatGPT 登录邮箱。
- `GOOGLE_ALLOWED_EMAIL`：允许连接的 Google Calendar 邮箱。
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`：Google OAuth Web 客户端。
- `GOOGLE_TOKEN_ENCRYPTION_KEY`：令牌加密密钥，建议至少 32 字节随机值。
- `GOOGLE_OAUTH_STATE_SECRET`：OAuth state 签名密钥，建议至少 32 字节随机值。

Google Cloud Console 中需要启用 Google Calendar API，并把以下地址加入 OAuth 客户端的授权重定向 URI：

```text
https://<你的 Sites 域名>/api/google/callback
```

## 数据与检查

数据库使用 Sites D1 + Drizzle。首个请求会幂等创建表并写入一组演示数据，迁移文件位于 `drizzle/`。

```bash
pnpm run db:generate
pnpm run lint
pnpm run build
pnpm run test
```

产品范围、设计系统与交互契约分别记录在 `PRODUCT.md`、`DESIGN.md` 和 `UX-CONTRACT.md`。
