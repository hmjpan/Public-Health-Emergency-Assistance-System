# 多Agent架构设计 — Agent Identity 清单

> 按 GOAI Agent Infra 赛道附录A模板填写，基于 AgentTeams（Hiclaw）框架设计

---

## 一、总体架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                    用户/事件入口                              │
│   一线上报 · 监测预警 · 客诉工单 · 舆情告警                     │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│              AgentTeams 编排层                               │
│   任务拆解 · 角色路由 · 共享状态 · 升级策略                      │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────┬───────┬───────┼───────┬──────────┬────────────────┐
│Sentinel│Command│Dispatch│Field│Medical   │Communication  │Review
│Agent   │er     │Agent  │Agent│Agent     │Agent         │Agent
│哨兵     │Agent  │资源调度 │现场  │医疗救治   │通讯协调       │复盘评估
│        │指挥决策│        │处置  │          │              │
└────┬───┴───┬───┴───┬───┴──┬──┴────┬─────┴───────┬──────┴──┬─┘
     │       │       │      │       │             │         │
┌────▼───────▼───────▼──────▼───────▼─────────────▼─────────▼─┐
│                    Skill 能力层                               │
│  GradeEvaluate · SlaCheck · StaffAssign · PlanMatch          │
│  NotifyDispatch · CriteriaCheck · DocDraft · TypePackResolve │
└────────────────────────┬─────────────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────────────┐
│                MCP / 适配器层                                  │
│  通讯录 · 物资台账 · 车辆GPS · 医疗资源 · 知识库 · 通知网关       │
└────────────────────────┬─────────────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────────────┐
│               证据与治理层                                     │
│  Event State(共享状态) · Rule Results(规则存证)                  │
│  Notification Logs · Channel Logs · Audit Trail               │
└──────────────────────────────────────────────────────────────┘
```

---

## 二、Agent Identity 清单

### Agent 1: Sentinel Agent（哨兵Agent）

| 字段 | 说明 |
|------|------|
| **Name** | `sentinel-agent` |
| **Role** | 监测预警与事件分类。负责接收一线上报、自动识别事件类型（传染病/食源/环境/中毒/不明），完成信息归一化并推送给Commander Agent研判。 |
| **Capabilities** | ✅ 能做的：事件类型自动识别（基于规则+关键词匹配）、上报信息结构化、事件分级初筛、预警生成 ❌ 不能做的：不能启动响应、不能下达指令、不能修改事件类型判定 |
| **Inputs** | 一线上报文本（地点、情况、规模、报告人）、监测数据异常告警、舆情关键词 |
| **Outputs** | 结构化事件对象 `{typeKey, title, location, scale, reporter, rawText, suggestedType, confidence}` |
| **Dependencies** | `TypePackResolve` Skill、`eventTypes.js` 类型包配置、通讯录服务（MCP） |
| **Decision Boundary** | 自主决策：事件类型分类、信息完整性检查 🚫 需人工确认：事件是否属实、是否进入研判（由Commander Agent决定） |
| **Trace** | 每次上报生成唯一 `eventId`，记录 `receiveAt / typeResolveAt / classifyResult / confidence`，写入 `events` 表，全链路可回放 |

---

### Agent 2: Commander Agent（指挥决策Agent）

| 字段 | 说明 |
|------|------|
| **Name** | `commander-agent` |
| **Role** | 事件研判、定级决策、一键启动、阶段推进、终止评估。是整个应急响应链路的"单线决策"核心。 |
| **Capabilities** | ✅ 能做的：调用规则引擎获取定级建议、生成研判材料包、一键启动响应并选择通知组、推进阶段（响应→现场→终止）、审批信息发布、确认事件终止 ❌ 不能做的：不能直接操作物资/人员/车辆具体分配（委托给Dispatch Agent） |
| **Inputs** | Sentinel Agent输出的结构化事件、`GradeEvaluate` Skill定级建议、`SlaCheck` Skill时限状态、`CriteriaCheck` Skill阶段完成标准校验结果 |
| **Outputs** | 启动指令（事件类型+级别+通知组列表）、阶段推进决策、终止评估决定、发布审批意见 |
| **Dependencies** | `GradeEvaluate` / `SlaCheck` / `CriteriaCheck` / `StaffAssign` Skill、`Event State` 共享状态、Communication Agent（通知下发） |
| **Decision Boundary** | 自主决策：调用Skill获取建议、查询时限状态、校验完成标准 🚫 需人工确认：最终定级（规则建议仅预填）、一键启动确认、终止评估确认——Agent提供决策依据，人拍板 |
| **Trace** | 所有研判操作写入 `rule_results`（含规则版本）、`decision_logs` 记录每次启动/推进/终止的 `actor / timestamp / basis / ruleVersion`，支持审计回放 |

---

### Agent 3: Dispatch Agent（资源调度Agent）

| 字段 | 说明 |
|------|------|
| **Name** | `dispatch-agent` |
| **Role** | 接收启动指令后并行调度人员出动、物资储备调拨、车辆后勤保障，跟踪各环节状态直至启动完成标准达成。 |
| **Capabilities** | ✅ 能做的：按事件类型×级别匹配标准编成建议、人员/物资/车辆状态全生命周期管理（确认→出发→抵达、备货→装车→发出→签收、车辆就位）、紧缺预警 ❌ 不能做的：不能修改编成标准、不能跳过启动完成标准直接推进阶段 |
| **Inputs** | Commander Agent启动指令、`StaffAssign` Skill编成建议、通讯录（MCP）、物资台账（MCP）、车辆台账（MCP） |
| **Outputs** | 人员出动状态列表、物资调拨状态列表、车辆保障状态列表、启动完成标准达成报告 |
| **Dependencies** | `StaffAssign` Skill、`CriteriaCheck` Skill（启动阶段）、通讯录/物资台账/车辆台账 MCP工具 |
| **Decision Boundary** | 自主决策：人员/车辆匹配分配、物资包按类型自动匹配 🚫 需人工确认：特殊物资超量调拨、人员跨组借调 |
| **Trace** | 每次状态变更写入对应表（personnel/materials/vehicles）并生成 `dispatch_log` 记录，含 `action / operator / timestamp / fromStatus / toStatus`，支持完整调度链回放 |

---

### Agent 4: Field Agent（现场处置Agent）

| 字段 | 说明 |
|------|------|
| **Name** | `field-agent` |
| **Role** | 现场指挥下的任务管理、标准表单采集、定时简报生成、紧急上报传达、指令下传与反馈收集。 |
| **Capabilities** | ✅ 能做的：按事件类型激活任务包并分发到各工作组、接收现场表单回传、生成定时简报、管理任务状态（pending/in_progress/blocked/done）、阻塞任务预警 ❌ 不能做的：不能自行创建任务（任务来自类型包模板）、不能跳过关键任务完成标准 |
| **Inputs** | Commander Agent现场指令、`TypePackResolve` Skill任务包模板、现场人员回传的表单数据、紧急上报信息 |
| **Outputs** | 任务执行状态报告、表单回传归档、定时简报、现场完成标准达成报告 |
| **Dependencies** | `TypePackResolve` / `CriteriaCheck` Skill（现场阶段）、表单存储服务（MCP） |
| **Decision Boundary** | 自主决策：任务分发、状态更新、简报生成 🚫 需人工确认：关键任务完成确认、阻塞任务升级处理 |
| **Trace** | 所有任务状态变更、表单提交、简报生成写入 `tasks` / `forms` / `briefs` 表，含 `eventId / groupId / operator / timestamp / data`，支持任务全链路回溯 |

---

### Agent 5: Medical Agent（医疗救治Agent）

| 字段 | 说明 |
|------|------|
| **Name** | `medical-agent` |
| **Role** | 病例全流程跟踪（登记→分流→救治→转归）、密接追踪（传染病场景）、医疗资源实时可视化。 |
| **Capabilities** | ✅ 能做的：病例7节点状态机管理、密接排查登记与追踪、医疗资源（药品/设备/床位）实时可视、按事件类型差异化配置隔离/药品/设备方案 ❌ 不能做的：不能修改诊疗方案（由人工医学决策） |
| **Inputs** | 现场病例数据、病例转归信息、密接排查结果、医疗资源库存数据 |
| **Outputs** | 病例全流程状态报告、密接追踪台账、医疗资源热力图、资源缺口预警 |
| **Dependencies** | `TypePackResolve` Skill（医疗差异化配置）、医疗资源台账（MCP） |
| **Decision Boundary** | 自主决策：病例状态流转、资源统计 🚫 需人工确认：重症分流决策、隔离方案调整 |
| **Trace** | 每个病例的每次状态变更写入 `cases` 表，含 `node / operator / timestamp / clinicalNote`，支持病例全流程回放 |

---

### Agent 6: Communication Agent（通讯协调Agent）

| 字段 | 说明 |
|------|------|
| **Name** | `communication-agent` |
| **Role** | 多通道通知下发（语音/短信/APP）、强制反馈闭环（5分钟确认+超时自动升级）、信息发布与舆情管理。 |
| **Capabilities** | ✅ 能做的：按通知组匹配通道并并行下发、巡检超时未确认通知并自动升级、起草发布稿（模板+数据填充）、舆情关键词标红 ❌ 不能做的：不能跳过升级机制、不能自行决定发布内容（需Commander审批） |
| **Inputs** | Commander Agent通知指令、通讯录（MCP）、发布审批意见、舆情监测数据 |
| **Outputs** | 通知发送记录（含通道日志）、升级事件记录、发布稿草稿、舆情摘要 |
| **Dependencies** | `NotifyDispatch` Skill、通知网关MCP（语音/短信/APP推送）、`DocDraft` Skill（发布稿起草） |
| **Decision Boundary** | 自主决策：通道选择、超时巡检、升级通知 🚫 需人工确认：发布内容审批（三段式：起草→审批→发布） |
| **Trace** | 每条通知写入 `notifications` 表（含 `ackDeadline / escalateLevel / channelLogs`），升级事件写入 `escalation_log`，全链路可审计 |

---

### Agent 7: Review Agent（复盘评估Agent）

| 字段 | 说明 |
|------|------|
| **Name** | `review-agent` |
| **Role** | 事件终止后的复盘评估、整改台账闭环、知识沉淀回流。将处置经验沉淀为可复用规则。 |
| **Capabilities** | ✅ 能做的：自动生成复盘报告（基于事件全链路数据）、生成整改台账并跟踪闭环、将新发现的模式/规则沉淀到知识库、生成终报初稿 ❌ 不能做的：不能自行关闭事件（需Commander确认） |
| **Inputs** | 事件全链路数据（任务/病例/通知/物资/表单等）、整改反馈、`DocDraft` Skill（终报初稿） |
| **Outputs** | 复盘报告、整改台账（含闭环状态）、知识库更新建议、终报初稿 |
| **Dependencies** | `DocDraft` Skill、知识库服务（MCP）、事件全链路 `Event State` |
| **Decision Boundary** | 自主决策：数据收集、报告生成、知识提取 🚫 需人工确认：整改方案审批、知识库更新审核 |
| **Trace** | 复盘过程写入 `reviews` / `rectifications` 表，知识沉淀写入 `knowledge.json`，含版本号，支持知识演进追踪 |

---

## 三、Agent 协同流程

### 3.1 端到端任务闭环（7步）

```
1. 任务输入：Sentinel Agent 接收一线上报 → 结构化事件对象
                    ↓
2. 任务拆解：Commander Agent 研判 → 定级 → 一键启动
           → 生成任务拆解指令（按事件类型+级别）
                    ↓
3. 上下文传递：Event State 共享状态容器
           → 所有Agent读写同一事件上下文
           → 包含：事件信息、决策记录、任务状态、资源状态
                    ↓
4. 工具调用：各Agent通过Skill + MCP调用工具
           → Dispatch: 通讯录/物资/车辆 MCP
           → Field: 表单服务 MCP
           → Medical: 医疗资源 MCP
           → Communication: 通知网关 MCP
                    ↓
5. 结果验证：CriteriaCheck Skill 校验阶段完成标准
           → 启动完成：人员出发+物资装车+车辆就位
           → 现场完成：关键任务100%+表单回传+零阻塞
                    ↓
6. 执行证据沉淀：Rule Results存证 + Notification Logs
              + Channel Logs + 全链路审计轨迹
                    ↓
7. 审批与回滚：高风险动作（发布/终止/超量调拨）
           → 人工确认 → 审批记录 → 回滚能力
```

### 3.2 状态流转与异常处理

```
detected → responding → field → closed
   ↑          ↑          ↑        ↑
 Sentinel  Commander  Commander Commander
           一键启动    推进      终止

异常分支：
- 启动标准未达成 → 阻塞在 responding，Dispatch Agent 催办
- 任务阻塞 → Field Agent 预警 → Commander 介入
- 通知超时 → Communication Agent 自动升级 → 上级介入
- SLA超时限 → Commander Agent 收到预警 → 采取补救
```

### 3.3 映射到 AgentTeams 框架能力

| AgentTeams 能力 | 本项目映射 |
|----------------|-----------|
| 角色编排 | 7个Agent角色定义（Identity清单） |
| 任务拆解 | Commander Agent 按事件类型×级别拆解，Dispatch/Field/Medical并行执行 |
| 上下文传递 | Event State 共享状态 + rule_results 规则存证 |
| 协同执行 | 多Agent并行（人员/物资/车辆同时调度），通过完成标准校验串联 |
| 状态追踪 | 三阶段状态机（detected/responding/field/closed）+ 全链路Trace |
