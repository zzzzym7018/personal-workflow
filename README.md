# Personal Workflow

> 面向知识工作者的个人日程与进度管理系统。

Personal Workflow（知行台）是一个面向单用户私人使用的个人项目。它尝试把分散在日历、待办清单、项目工具和学习笔记中的信息，整理到同一套清晰的工作流中：安排时间、追踪截止日期、推进长期项目，并持续记录知识学习进度。

## 为什么做这个项目

知识工作往往同时包含短期日程、带 DDL 的任务、持续数周或数月的项目，以及没有明确终点的学习过程。它们彼此相关，却通常分散在不同工具中。

这个项目希望提供一个安静、直观的个人工作台，让每天要做的事与长期积累保持连接，而不是只完成一张不断增长的待办清单。

## 主要用途

- **日程管理**：记录 routine 和有明确时间段的安排，并通过时间轨查看当天节奏。
- **DDL 管理**：创建带截止日期的任务，区分待处理、进行中与已完成状态。
- **项目推进**：管理长期项目、DDL、项目笔记和可勾选的阶段性子目标。
- **知识学习**：按领域整理当前理解、知识分支、阶段总结与跨领域笔记。
- **Ideas 与疑问**：随时捕捉想法和问题，并关联到具体领域或项目。
- **日历同步**：支持与 Google Calendar 连接，兼顾电脑端规划与移动端录入。

## 使用说明

线上版本：[打开 Personal Workflow](https://zhixing-desk.blithekid1.chatgpt.site)

首次访问需要使用获准的 ChatGPT 账号登录。进入工作台后，可以按下面的方式组织信息：

1. **今日**
   - 时间轨展示当天有明确起止时间的日程，可点击空白时段创建日程，点击已有日程继续编辑。
   - “今日行动”用于管理任务。计划在今天执行、今天有明确时间段、今天到期或已经逾期的任务会进入行动列表；未完成任务会从计划开始日持续保留。
   - 日程与任务是两类数据：日程占用具体时间段，任务以完成状态和 DDL 为核心。
2. **日程**
   - 在横向时间表中查看和编辑 routine、未来安排及任务。
   - routine（例如练琴）直接记录起止时间；带 DDL 的任务可以从日程页或“今日行动”创建。
   - 议程聚合未完成且设有 DDL 的任务，以及尚未结束的未来日程；完整时间记录仍可在时间表中查看。
3. **项目**
   - 项目只在项目页创建，用于持续数周或数月的长期工作，不会由普通日程自动生成。
   - 每个项目可维护名称、DDL、项目笔记和子目标；子目标支持“未开始”“进行中”“已完成”。
4. **领域学习**
   - 以领域为单位记录当前理解、知识分支和阶段总结，方便快速回顾自己已经形成的认知。
   - 领域内笔记与跨领域笔记用于保留补充材料、联系和后续思考。
5. **Ideas 与疑问**
   - 用卡片记录临时想法和待探索问题；卡片可再次打开编辑，也可以删除。

日程、任务、项目和学习记录保存在部署环境的 D1 数据库中，不会随 Git 提交进入公开仓库。

## 访问与隐私

线上站点采用两层访问控制：

- **Sites 访问策略**：生产站点使用 custom allowlist，只有被明确加入的账号才能访问。
- **应用内校验**：服务端通过 `ALLOWED_USER_EMAIL` 再次核对登录邮箱，未配置或不匹配时拒绝加载工作台和数据 API。

当前部署为单用户、owner-only 使用模式。仓库公开并不代表工作台数据公开；其他人即使知道站点 URL，也无法通过登录与服务端校验。`localhost` 开发环境提供本地预览身份，仅用于本机调试。

## 当前状态

项目已实现今日、日程、项目、领域学习、Ideas 与疑问等核心页面。“回顾”模块的实现目前保留在代码中，但已暂时从导航和路由入口停用。

这是一个以个人使用为出发点的项目，重点关注信息层级、可视化表达和低负担编辑体验，而不是团队协作或复杂的企业流程。

## 本地运行

需要 Node.js `>=22.13.0` 与 pnpm。

```bash
pnpm install
pnpm run dev
```

复制 `.env.example` 中的键到本地或 Sites 部署环境。示例文件只包含占位符；请勿提交真实邮箱、OAuth 密钥、加密密钥或 Wrangler 本地数据。

环境变量用途：

- `ALLOWED_USER_EMAIL`：唯一允许进入私人工作台的 ChatGPT 登录邮箱。
- `EXPORT_TOKEN`：个人 Agent 调用只读导出接口时使用的独立 bearer token；应在部署环境中标记为 secret。
- `GOOGLE_ALLOWED_EMAIL`：允许连接的 Google Calendar 账号。
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`：Google OAuth 应用凭据。
- `GOOGLE_TOKEN_ENCRYPTION_KEY`：在服务端加密 Google refresh token。
- `GOOGLE_OAUTH_STATE_SECRET`：签名并校验 OAuth state。

若未配置四项 Google OAuth 凭据，工作台的其他功能仍可使用，但 Google Calendar 连接与同步不会完整工作。

### 只读远程导出

项目提供 `GET /api/export`，供个人 Agent 拉取只读 JSON 快照。接口返回 `projects`、`tasks`、`domains`、`learningLogs`、`knowledgeNotes`、`ideas` 和 `events` 七类数据，不包含 Google OAuth 凭据。导出使用独立的 `EXPORT_TOKEN` 鉴权，并返回全部学习记录；工作台自身仍只加载最近 50 条学习记录。

在 Sites 部署环境中将随机 token 配置为 secret：

```bash
openssl rand -hex 32
```

请勿把生成结果写入仓库或 `.env` 文件。生产站点是私人 Site，因此无登录态的 Agent 除 `EXPORT_TOKEN` 外，还需要 Sites 服务访问 token，并通过 `OAI-Sites-Authorization` 请求头发送。拉取脚本支持从 `SITES_ACCESS_TOKEN` 读取这个值：

```bash
EXPORT_URL=https://zhixing-desk.blithekid1.chatgpt.site/api/export \
EXPORT_TOKEN=<export-token> \
SITES_ACCESS_TOKEN=<sites-service-token> \
python3 pull_export.py
```

脚本仅使用 Python 标准库，会校验七类字段及 `exportedAt`，按日期写入 `data/YYYY-MM-DD.json`，并默认拒绝覆盖同一天的已有快照。`data/` 已被 Git 忽略。可用 `--out` 指定其他目录，用 `--force` 明确覆盖已有文件。

### Agent MCP 接口

站点同时提供私人、只读的 `POST /mcp` 接口，供支持 Streamable HTTP MCP 的 Agent 使用。接口遵循 MCP 2026-07-28，提供今日概览、任务、项目、领域学习、Ideas 与完整快照六个读取工具，不提供创建、修改或删除能力。MCP 与网页共用 D1 数据，但使用独立路由，不会改变现有页面或 `/api/workspace` 的编辑行为。

私人 Site 会在请求到达 `/mcp` 前执行 OAuth 鉴权。在 ChatGPT / Codex 中可直接安装 Sites 自动生成的私人插件；其他 Agent 需要使用支持 OAuth 2.1 的 MCP 客户端连接 `https://zhixing-desk.blithekid1.chatgpt.site/mcp`，首次连接时在浏览器中授权。不要把访问令牌写入仓库或公开配置。

DeepSeek Harness 当前内置的 `@deepseek-ai/dsh-mcp-client` 只支持静态请求头，不能直接完成这条 OAuth 流程；需要使用支持 OAuth 的 DSH MCP 管理插件。这个限制只在客户端侧，网页和 MCP 服务端不需要改成公开访问。

常用检查命令：

```bash
pnpm run lint
pnpm run build
pnpm run test
```

## 技术与数据

项目使用 TypeScript、React/Vinext、Cloudflare Workers、D1 与 Drizzle。Google Calendar 凭据在服务端加密存储，线上日程、项目和学习记录不会写入 Git 仓库。

更详细的产品范围、设计系统与交互约定分别记录在 `PRODUCT.md`、`DESIGN.md` 和 `UX-CONTRACT.md`。

## 项目定位

这是一个专门为知识工作者设计的个人规划系统：既管理今天，也保留长期项目与知识成长的连续性。
