# 知行台 UX Contract

## Product context

- Audience: 单用户知识工作者。
- Primary jobs: 规划时间、推进项目、记录领域理解和疑问、完成周回顾。
- Target market(s): 个人自用；无市场特定业务规则。
- Active locales: `zh-CN`，专业术语允许中英混排。
- Language/content register and native-review policy: 简洁、直接、使用一致动词。
- Timezone/calendar policy: `Asia/Shanghai`，公历；Google 事件以绝对时间存储，全天日期单独处理。
- Accessibility target: WCAG 2.2 AA。

## Business-context sources

| Domain / scope | Authoritative source | Source type | Reviewed date |
|---|---|---|---|
| Permission model | `PRODUCT.md` | Product brief | 2026-10-09 |
| Data lifecycle | `PRODUCT.md` | Product brief | 2026-10-09 |
| Deletion / retention | `PRODUCT.md` | Product brief | 2026-10-09 |
| Calendar synchronization | Google Calendar API contract + `PRODUCT.md` | External API / Product brief | 2026-10-09 |
| Market / content conventions | `PRODUCT.md` | Product brief | 2026-10-09 |

## Visual contract

- Project `DESIGN.md`: `DESIGN.md`
- Token ownership model: existing runtime canonical（Model B）
- Runtime design-system/token source: `app/globals.css`
- Mapping/export/adapters: CSS custom properties → shared class recipes → workspace components
- Token drift gate: DESIGN.md lint + premium audit + raw token search
- Supported themes: light；dark deferred
- Design-context owner/review policy: durable visual changes update DESIGN.md and CSS together

## Canonical UI Map

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| Select/Listbox | shared native field recipe | UX contract | native（platform popup accepted） | keyboard + browser |
| Date | shared typed date/time field recipe | UX contract | typed | format + keyboard + browser |
| Form | shared form/field/error classes and handlers | UX contract | create / edit | validation workflow |
| Scrollbar | `app/globals.css` global baseline | DESIGN.md | stable-gutter exception | computed/browser |
| Toast | `WorkspaceApp` shared toast viewport | UX contract | success / warning / info / error | live region |
| CRUD | `/api/workspace` + shared editor | UX contract | stay-inline | full-flow browser |

## Component behavior

| Component | Default | Hover | Focus | Active | Disabled | Busy | Error |
|---|---|---|---|---|---|---|---|
| Button | semantic tone | lift/tone | 3px ring | inset | muted/no pointer | fixed spinner slot | inline status |
| Icon button | named button | tone | 3px ring | inset | hidden or explained | disabled | tooltip/status |
| Input | bordered surface | stronger border | ring | n/a | muted | reserved adornment | text + aria-invalid |
| Search | clear + local filter | stronger border | ring | n/a | n/a | reserved slot | status region |
| Textarea | resize none | stronger border | ring | n/a | muted | n/a | text + aria-invalid |
| Table/list | stable rows | surface tint | row action ring | selected tint | muted | stable spinner | persistent retry |

## Dataset navigation

- Lists are personal and bounded in v1; render all with local filtering.
- Committed section/filter state is encoded in `?view=` where practical; sensitive drafts are not placed in URLs.
- Empty, no-results, error and loading use stable page regions with create/reset/retry actions.
- Browser Back restores the selected top-level view; mobile scroll remains page-owned.

## Flow ledger

| Operation | Trigger | Pending | Success destination | Success feedback | Failure recovery | Focus outcome | Source ref |
|---|---|---|---|---|---|---|---|
| Create | 创建 | stable busy action | stay in owning view | “已创建” toast | keep values + inline error | new item / heading | PRODUCT.md |
| Edit | 保存更改 | stable busy action | stay in context | “更改已保存” | keep editor + retry | edited item | PRODUCT.md |
| Edit schedule | Time Rail 日程块 | prefilled event editor | stay on Today | “日程已更新” toast | keep values + inline error | edited time block | PRODUCT.md |
| Edit task | 今日行动/议程任务正文 | prefilled task editor | stay in current view | “任务已更新” toast | keep editor + inline error | edited task trigger | PRODUCT.md |
| Edit project | 项目卡片非操作区域 | prefilled project editor | stay on Projects | “项目已更新” toast | keep values + inline error | edited project card | PRODUCT.md |
| Edit Idea/question | Idea/疑问卡片非操作区域 | prefilled shared editor | stay on Ideas | “线索已更新” toast | keep editor + inline error | edited card | PRODUCT.md |
| Create cognition/note | 领域认知档案或笔记区“新增” | prefilled shared editor | stay on selected domain | “认知条目已创建” toast | keep values + inline error | new card / section heading | PRODUCT.md |
| Edit cognition/note | 认知、分支、阶段总结或笔记卡片 | prefilled shared editor | stay on selected domain | “认知条目已更新” toast | keep editor + inline error | edited card | PRODUCT.md |
| Archive | 归档 | confirmation busy | stay in list | “已归档” + Undo when honest | dialog remains + retry | next item | PRODUCT.md |
| Permanent delete | 删除 | danger confirmation + stable busy action | stay in owning view | “已永久删除” toast | dialog remains + inline retry error | owning view heading | PRODUCT.md |
| Delete learning domain | 领域编辑器“删除” | confirmation names cognition/note/log counts | stay on Learning and select remaining domain | “学习领域已永久删除” toast | editor + dialog remain for retry | remaining domain / page heading | PRODUCT.md |
| Search | 全局搜索 | local, no network wait | same view | result count status | clear/reset | input/results | PRODUCT.md |
| Google sync | 立即同步 | persistent sync status | same view | exact import/export count | status panel + retry | sync trigger | PRODUCT.md |
| Project subgoal | 项目卡内“创建子目标”/任务行右侧的低强调状态（点击浮出三态菜单） | stable busy action | stay in project card；选择后自动收起 | “子目标已创建/已设为…” toast | keep editor or prior status + retry | changed subgoal / status trigger | PRODUCT.md |
| Cancel/back | 取消/返回 | none | originating context | none | unsaved dialog if needed | trigger | PRODUCT.md |

## Navigation and responsive behavior

- Route document title policy: `{页面} — 知行台`；client view changes update the title。
- Route error / 403 page behavior: keep product identity and offer sign-in/home path; do not disguise 403 as 404。
- Sidebar/drawer/bottom-sheet transformation: persistent left sidebar ≥760px；mobile bottom navigation and full-width editor below。
- Responsive record strategy: project cards use two columns on wide screens and one column on narrow screens；subgoals stay inside their owning project card；项目卡片非操作区域使用独立语义按钮打开名称、DDL 与笔记编辑，卡内操作不触发项目编辑。Idea/疑问卡片使用相同的整卡编辑入口，状态与归档按钮保持独立；卡片网格由宽屏三列逐级转为手机单列。领域学习在宽屏使用“认知档案 + 学习侧栏”，中窄屏转为单列；领域书架始终为单排横向滑动窗口，卡片保持舒适宽度且滚动条可见，核心认知、知识分支、阶段总结和笔记不因断点隐藏，编辑与删除入口保持可达。设置页在桌面将日历连接置于全宽首位，隐私与数据卡并列，窄屏转为单列。
- Calendar grid strategy: 周视图固定日期头与时间栏，08:00—24:00 由同一连续比例轴定位；所有屏幕使用舒适日列宽的横向窗口，仅在首次进入周视图时定位到今天，之后保留用户的自由滚动位置且不启用列吸附；时间网格拥有横向和纵向滚动，不裁切日期或事件。
- Agenda strategy: task 的行动日期与 DDL 分离；行动日期决定它出现在哪天的“今日行动”，DDL 只用于截止管理。议程分成“待完成任务”和“未来日程”两个语义分组。前者只显示 `status !== done` 且存在 DDL 的 task（包括项目子目标），并允许完成、编辑和删除；后者只显示 `endAt >= now` 的站内或 Google 日程，并沿用编辑、归档和删除。已结束的 routine/历史时间记录只保留在日历视图，不进入议程；两组都按时间升序完整呈现，不做固定条数截断。
- Focus restoration: modal/drawer returns focus to trigger; sticky controls use scroll-margin and safe-area padding。

## Overlays and feedback

- Dialog primitive: application-owned modal with inert background, focus containment, Escape and restoration。
- Destructive confirmation levels: archive uses warning；permanent delete uses danger and names the object, affected child records, external-calendar consequence and irreversibility。
- Toast placement/duration/deduplication: top-right, 4.5s, identical messages deduplicated within 2s, maximum 3。
- Unsaved changes: create form asks before discard; routine existing-record fields use explicit save。
- Layer contract: dropdown 200, popover 300, header 400, backdrop 500, dialog 600, drawer 700, command 800, toast 900。

## Async and resilience

- Mutations are pessimistic; low-risk completion toggles may be optimistic only with rollback。
- Duplicate submit is disabled; external calendar effects are never automatically retried after uncertain completion。
- Offline read keeps current data; writes retain input and provide retry, not an implicit queue。
- 401 returns through approved sign-in; 403 explains the allowlist boundary。
- Stale requests use AbortController or request identity before committing state。

## Validation

- Manual typed schema for v1 with server revalidation。
- Validate on submit, then on change for fields already in error。
- Long forms show summary plus inline association; first invalid field receives focus。
- All product forms use `noValidate`; textareas use `resize: none`。Idea/疑问标题使用自动增高的多行字段，其他实体标题保持单行。

## Permission and clipboard

- All non-public content is server-protected; wrong authenticated account receives 403。
- Google tokens never appear in UI, toast, URL, logs or client storage。
- Disabled sync explains missing Google connection and links to Settings。

## Verification

- Required static commands: premium strict audit, anti-pattern search, lint, build, tests。
- Browser matrix: desktop, narrow mobile, keyboard, reduced motion, success/empty/error where injectable。
- Canonical sibling comparison: create/edit flows across 日程、项目、领域学习、Ideas。
- CRUD and failure-path evidence: browser exercise plus `tests/rendered-html.test.mjs`。
