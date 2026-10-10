---
version: alpha
name: "知行台"
description: "以日光研究工作室为基底、以知识观测轨道为标志的个人行动与领域学习工作台"
colors:
  canvas: "#F4F7F8"
  surface: "#FFFFFF"
  surfaceMuted: "#EEF3F5"
  ink: "#17233B"
  inkMuted: "#64748B"
  primary: "#3449A4"
  primaryDeep: "#26377D"
  cyan: "#159AA9"
  teal: "#167F78"
  saffron: "#D48B2C"
  success: "#188568"
  warning: "#C67A1A"
  danger: "#B64949"
  line: "#DBE3E8"
  focus: "#5267C7"
typography:
  display:
    fontFamily: '"Songti SC", "STSong", "Noto Serif CJK SC", serif'
  sans:
    fontFamily: '"PingFang SC", "Noto Sans CJK SC", "Microsoft YaHei", system-ui, sans-serif'
  mono:
    fontFamily: '"SFMono-Regular", "SF Mono", Menlo, Consolas, monospace'
rounded:
  sm: "0.625rem"
  DEFAULT: "0.875rem"
  md: "1rem"
  lg: "1.375rem"
  pill: "999px"
spacing:
  xs: "0.375rem"
  sm: "0.625rem"
  md: "0.875rem"
  lg: "1.375rem"
  xl: "1.875rem"
  page-max: "100rem"
components:
  button: {}
  field: {}
  card: {}
  dialog: {}
  drawer: {}
  toast: {}
  timeline: {}
  knowledgeOrbit: {}
---

# 知行台 Design System

## Overview

### Creative North Star

界面像一间上午十点的研究工作室：光线清楚、纸面安静、时间轨迹可见，正在处理的问题被放在桌面中央。知识观测图来自天文台的轨道结构，但只用于表现领域、疑问与项目之间的真实关联。

### Product context and register

- **Audience and primary job:** 单一知识工作者安排日程、推进项目、积累领域理解并记录疑问。
- **Target market(s) and evidence:** 个人自用，不依据中文界面推断特定市场规则；产品事实来自 `PRODUCT.md`。
- **Locale(s) and language policy:** `zh-CN` 为主，专业术语可中英混排；无翻译键泄漏。
- **Usage scene:** 桌面端高频规划与回顾，手机端快速添加日程和任务。
- **Register:** 产品型界面。信息清晰和编辑效率领先于品牌表达。
- **Memorable signature:** 首页连续时间轨与领域页“知识观测轨道”。
- **Restraint:** 表单、任务列表和设置保持熟悉、安静，不用玻璃拟态、霓虹或装饰性渐变。
- **Anti-references:** 不做彩色 KPI 卡片墙，不做暗黑霓虹控制台，不做报纸式密集排版。
- **Token ownership/runtime mapping:** Model B。`app/globals.css` 是运行时规范来源，本文件镜像其语义 token；共享组件只消费 CSS 变量，严格审计检查漂移。

## Colors

冷白画布与白色表面建立长时间工作的舒适度；靛蓝表达主行动与专注，矿物青表达日程同步，青绿表达学习成长，藏红花只用于疑问与需要关注的节点。危险操作使用独立的柔和红色，不能与普通强调色混用。焦点环始终使用 `focus`，不依赖颜色单独表达状态。

## Typography

界面正文与控件使用苹方优先的无衬线栈；页面主标题和知识观测图的核心标签克制地使用宋体，形成“研究手稿”气质。时间、百分比与短编号使用等宽字体。正文基线约 15–16px，中文行高不低于 1.55，不使用斜体表达中文强调。

## Layout

桌面端使用 224px 左导航、弹性主区与 320px 上下文栏；主区最大宽度 1600px。首页第一屏围绕连续时间轨展开。周日程使用连续 08:00—24:00 时间网格和舒适列宽的横向窗口，桌面默认约显示四天并定位到今天；日期头与时间栏在双向滚动时保持对齐。项目页使用双列工程卡，每张卡内直接管理可勾选的子目标；窄屏转为单列。低于 1080px 时右栏下移；低于 760px 时侧栏变为底部导航，编辑面板变为全宽抽屉。间距遵循 6/10/14/22/30px 节奏。页面自然滚动，时间网格和独立抽屉可拥有自己的滚动区域。

## Elevation & Depth

层级主要依靠表面色、细边框与留白。静态卡片使用极轻阴影；悬浮、拖动和覆盖层才增加阴影。禁止在每个重复行上使用高阴影。遮罩使用中性墨蓝透明层。

## Shapes

控件以 10–14px 圆角为主，大容器 16–22px。胶囊只用于状态和分段视图，不把所有按钮做成药丸。时间轨事件左边使用语义色竖线，知识轨道节点使用圆点和圆环。

## Components

### Foundational visual states

默认、悬停、焦点、按下、选中、禁用、忙碌、成功、警告、错误均由共享 class 和语义 token 提供。加载使用稳定占位区域内的应用自有 spinner，不使用骨架屏。所有运动尊重 `prefers-reduced-motion`。

### Buttons and actions

按钮由强调层级（solid/outline/ghost）与意图（brand/neutral/warning/danger）组合。每个决策区只保留一个主按钮；危险操作与保存动作分隔。忙碌状态不改变按钮尺寸。

### Navigation and data display

左导航在桌面持续可见，手机端使用底部导航。当前页面同时以底色、标记和 `aria-current` 表达。项目只从项目页创建；普通任务与日程不自动成为项目内容。点击项目卡片的非操作区域进入项目编辑，卡内子目标、归档、永久删除和创建按钮仍保持独立操作。日程、任务/子目标和项目的永久删除使用红色文字或按钮并与归档分开，确认界面明确影响范围。项目子目标在所属工程卡内以原生复选框管理，任务、项目和学习领域在窄屏转为纵向卡片。

### Forms and overlays

产品表单统一 `noValidate`，文本域 `resize: none`。日期与时间使用带格式提示的 typed 字段，避免平台弹窗差异；普通低风险单选允许原生 popup。桌面编辑采用右侧非模态详情抽屉，创建与确认采用模态对话框。Toast 固定右上角，最多三条。

### Iconography

第一版使用文字标记与简洁 CSS 几何符号，不使用装饰性插画。图标按钮必须有中文可访问名称和提示。

### Motion

悬停与状态反馈 160–200ms，抽屉 240ms，使用自然 ease-out。运动只表达空间关系或保存状态；减少动态时移除位移与缩放，时长不超过 100ms。

### Content and data visualization

文案直接、动词一致：“创建”“保存更改”“归档”“永久删除”“同步”。图表优先直接标注，颜色与标签或形状同时编码。时间投入与阶段进度不展示伪精确度。

## Do's and Don'ts

- **Do:** 让时间轨和当前行动占据首页最高视觉层级。
- **Do:** 让项目、领域、Idea 在所有页面沿用同一套语义色与状态词。
- **Don't:** 用大量统计卡、渐变或玻璃面板填充空间。
- **Don't:** 为美观隐藏滚动条、焦点环、错误文本或完整值。
