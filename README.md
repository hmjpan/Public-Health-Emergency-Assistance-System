# 卫盾Agent — 突发公共卫生事件多Agent协同应急处置平台

> GOAI 新智基座 Agent Infra · 7 Agent · 12 Skill 
**一键启动 · 双证据验证 · Guardrail约束 · 法规溯源 · 双模式运行**

## 项目简介

卫盾Agent 是一个面向突发公共卫生事件应急处置的多Agent协同平台。采用 **确定性规则引擎 + LLM增强** 双轨架构，7个职能Agent覆盖从接报到复盘的全流程，12个Skill提供标准化能力封装，每个Skill含Guardrail约束、证据链和法规条文引用。

## 核心特性

| 特性 | 说明 |
|------|------|
| **7个Agent** | Sentinel(哨兵) · Commander(指挥) · Dispatch(调度) · Field(现场) · Medical(医疗) · Communication(通讯) · Review(复盘) |
| **12个Skill** | 7个规则引擎包装 + 5个LLM增强，全部v1.1.0 |
| **双证据验证** | LLM语义分析 + 规则引擎关键词匹配，交叉校验 |
| **Guardrail约束** | 每个Skill四类约束：确定性/业务/容错/安全 |
| **证据链** | provenance + methodology + confidence + missing_evidence |
| **法规溯源** | 规则表携带legal_ref，可追溯到具体法规条文 |
| **7个MCP工具** | contacts/materials/vehicles/medical-resources/knowledge/notification-gateway/event-state |
| **可观测** | Trace全链路追踪 + Metrics指标统计 |
| **双模式** | assist(辅助处置) + drill(模拟演练) |
| **188测试** | 75系统回归 + 113 Agent/Skill，全部通过 |
| **零新依赖** | 仅Express + cors，LLM用内置https，存储用JSON |

## 快速启动

```bash
# Windows 双击 run.bat
# 或手动启动
cd server
npm install
npm start
```

浏览器访问: http://localhost:3000

## 演示账号（密码均为 123456）

每个账号按实战职能裁剪可见模块（页面级由 `ROLE_NAV` 控制，操作级由 `ROLE_PERMS` + 后端 `requirePerm` 双重把关）：

| 账号 | 角色 | 可见模块 | 核心职责 |
|------|------|----------|----------|
| commander | 指挥长 | 16 个（全流程决策面，含态势地图/一键启动/Agent） | 研判、一键启动、推进阶段、审批发布 |
| deputy | 副指挥 | 14 个（决策辅助面 = 指挥长 − 一键启动 − Agent） | 协同决策、推进阶段、审批 |
| liudiao | 流调组长 | 7 个：现场/工单/出动/地图/物资/医疗/密接 | 确认出动、激活任务、填报表单 |
| medic | 医疗救治员 | 4 个：医疗/密接/地图/大屏 | 病例登记、密接追踪、资源更新 |
| wuzi | 物资管理员 | 5 个：物资/出动/医疗资源/地图/大屏 | 备货、装车、标记紧缺 |
| siji | 驾驶员 | 1 个：出动状态 | 车辆就位、电子通行证 |
| spokesman | 宣教发言人 | 2 个：发布/大屏 | 起草发布稿、舆情录入 |
| reviewer | 复盘评估员 | 3 个：复盘/统计/大屏 | 发起复盘、整改闭环 |
| info | 信息员 | 4 个：上报/日报/地图/大屏 | 一线上报 |
| member | 队员 | 2 个：工单/出动（最小可见面） | 接收任务、确认通知 |
| admin | 平台管理员 | 3 个：账号管理/大屏/Agent | 账号管理 |
| drill | 演练管理员 | 4 个：演练/地图/大屏/Agent | 模拟演练管理 |

## 架构

```
用户/事件入口
       │
  AgentTeams 编排层
       │
  7个Agent (Sentinel/Commander/Dispatch/Field/Medical/Communication/Review)
       │
  12个Skill (规则引擎包装×7 + LLM增强×5)
       │
  7个MCP工具 + Trace/Metrics可观测
       │
  规则引擎(v2026.2) · 状态机 · 通知引擎 · JSON存储
```

### 双层架构

- **系统层（确定性）**：规则引擎4张表(分级/时限/编成/知识)、三阶段状态机、多通道通知、5类事件包
- **Agent/Skill层（LLM增强）**：7个Agent + 12个Skill，Guardrail约束，证据链完整

### 三层能力体系

| 层级 | 方式 | Skill | 法规依据 |
|------|------|-------|---------|
| D0 规则层 | 确定性规则引擎 | GradeEvaluate · SlaCheck · StaffAssign | 国办函〔2006〕39号 · 国务院令第376号 |
| D1 检索层 | 知识库加权匹配 | PlanMatch · TypePackResolve | 各类技术方案 |
| D2 LLM层 | LLM + 规则引擎交叉校验 | EventClassify · SOPGuidance · CaseTrack · ReviewReport · DocDraft | 双证据验证 |

## 12个Skill

| Skill | 类型 | 使用Agent | 法规依据 |
|-------|------|-----------|---------|
| TypePackResolve | 规则引擎 | Sentinel, Field, Medical | 《报告管理工作规范》 |
| EventClassify | LLM+规则 | Sentinel | 《报告管理工作规范》 |
| GradeEvaluate | 规则引擎 | Commander | 国办函〔2006〕39号 1.3 |
| SlaCheck | 规则引擎 | Commander | 国务院令第376号 第19条 |
| StaffAssign | 规则引擎 | Commander, Dispatch | 卫办应急发〔2010〕74号 |
| PlanMatch | 规则引擎 | Commander, Field | 各类技术方案 |
| NotifyDispatch | 通知引擎 | Communication | 国务院令第376号 第32条 |
| CriteriaCheck | 状态机 | Commander | 应急预案各阶段标准 |
| DocDraft | 模板+LLM | Communication, Review | — |
| CaseTrack | LLM+计算 | Medical | 《传染病防治法》 |
| SOPGuidance | LLM+内置SOP | Field | CDC现场调查10步法 |
| ReviewReport | LLM+分析 | Review | 《应急预案》第5.3条 |

每个Skill均有独立 `SKILL.md` 规格文件，含 Guardrail 四类约束、证据链、references/ 法规原文摘录。

## 双模式运行

| 模式 | 说明 |
|------|------|
| **辅助处置(Assist)** | 真人操作，Agent提供建议，人工确认执行 |
| **模拟演练(Drill)** | Agent代替角色，单人可走完全流程 |

切换：`POST /api/agent/mode/:eventId`

## 测试

```bash
cd server

# 系统回归测试（75条）
node tests/regression.js

# Agent/Skill测试（113条）
node tests/agent-tests.js

# 合计 188条，全部通过
```

## 目录结构

```
├── server/
│   ├── index.js              入口
│   ├── store.js              JSON存储
│   ├── rbac.js               角色权限
│   ├── notify.js             多通道通知+强制反馈
│   ├── eventTypes.js         事件类型包
│   ├── workflow.js           三阶段状态机
│   ├── rules/
│   │   ├── engine.js         规则引擎(纯函数)
│   │   ├── grading.json      分级规则(v2026.2)
│   │   ├── sla.json          时限规则
│   │   ├── composition.json  编成规则
│   │   └── knowledge.json    知识库
│   ├── agent/
│   │   ├── skill-base.js     Skill基类
│   │   ├── agent-base.js     Agent基类
│   │   ├── skills/           12个Skill
│   │   ├── agents/           7个Agent
│   │   ├── llm/provider.js   LLM提供商(含fallback)
│   │   ├── mcp-server.js     7个MCP工具
│   │   ├── observability.js  Trace+Metrics
│   │   └── teams/adapter.js  AgentTeams适配
│   ├── routes/               API路由
│   ├── tests/                测试套件
│   └── data/                 JSON数据(运行时生成)
├── web/
│   ├── index.html
│   ├── css/
│   └── js/modules/           前端模块(含agent-panel.js)
├── docs/
│   ├── competition/          竞赛文档(PPT等)
│   └── agentteams/
│       ├── skills/           12个SKILL.md + references/
│       ├── workers/          7个WORKER.md
│       └── AGENTS.md         Agent清单
├── .gitignore
├── LICENSE                   MIT
├── README.md
└── run.bat
```

## API 端点

### 系统层
- `POST /api/events` — 创建事件
- `POST /api/events/:id/launch` — 一键启动
- `POST /api/events/:id/advance` — 阶段推进
- `GET /api/rules/grade/:eventId` — 研判定级
- `GET /api/rules/sla-check/:eventId` — 时限校验
- `GET /api/rules/staff-assign/:eventId` — 编成建议

### Agent/Skill层
- `GET /api/agent/agents` — 列出所有Agent
- `GET /api/agent/skills` — 列出所有Skill
- `POST /api/agent/react` — Agent执行
- `POST /api/agent/orchestrate` — AgentTeams一键编排（按事件阶段触发多Agent协同）
- `GET /api/agent/orchestrate/:eventId` — 编排日志
- `GET /api/agent/traces` — Trace列表
- `GET /api/agent/trace/:traceId` — Trace详情（编排链+全链路Span）
- `GET /api/agent/metrics` — 指标统计
- `GET /api/agent/mcp/tools` — MCP工具清单
- `POST /api/agent/mcp/call` — MCP工具调用
- `GET /api/agent/teams/workers` — AgentTeams Worker配置
- `GET /api/agent/teams/skills` — AgentTeams SKILL.md配置
- `POST /api/agent/mode/:eventId` — 模式切换

## 法规依据

| 法规 | 时间 | 引用 |
|------|------|------|
| 《中华人民共和国突发公共卫生事件应对法》 | **2025.11.1施行** | 核心上位法（该领域首部专门法律） |
| 《中华人民共和国传染病防治法》（第二次修订） | **2025.9.1施行** | 传染病分类、报告时限、疫情控制 |
| 《中华人民共和国突发事件应对法》（修订） | **2024.11.1施行** | 突发事件应对总则 |
| 《国家卫生应急队伍管理办法》（2024年版） | **2024.3印发** | 队伍建设标准（替代2010年版） |
| 《传染病信息报告管理规范（2026版）》 | **2026.1.29印发** | 传染病报告时限与程序 |
| 《突发公共卫生事件应急条例》 | 国务院令第376号 | 仍有效（行政法规层级） |
| 《国家突发公共卫生事件应急预案》 | 国办函〔2006〕39号 | 分级标准（仍有效） |
| GB/T 38567-2020《突发事件卫生应急队伍装备配置指南》 | — | 装备配置标准 |
| CDC 现场疫情调查10步法 | — | 现场处置方法论 |

## 开源协议

MIT License. 详见 [LICENSE](LICENSE) 文件。

## 竞赛信息

GOAI 世界人工智能开源大赛 · 赛道一：新智基座丨Agent Infra

| 评分维度 | 占比 | 覆盖 |
|---------|------|------|
| 场景与价值 | 25% | 5类事件、完整流程、量化价值 |
| 多Agent协同 | 25% | 7个Agent、AgentTeams编排、Event State共享 |
| Skill工程 | 25% | 12个SKILL.md、Guardrail、证据链、references/ |
| 工程落地 | 20% | 188测试、7 MCP、Trace/Metrics、双模式 |
| 开源 | 5% | MIT、完整文档、可复用框架 |
