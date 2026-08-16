# Skill 工程体系清单

> 按 GOAI Agent Infra 赛道附录B模板填写
> 设计原则：Skill 是任务能力抽象层（不是一次性Agent行为），每个Skill标准化输入输出、失败处理、安全边界、复用价值

---

## Skill 总览

| # | Skill名称 | 类型 | 核心用途 | 使用Agent |
|---|-----------|------|---------|-----------|
| 1 | `TypePackResolve` | 自定义Skill | 事件类型解析与配置加载 | Sentinel, Field, Medical |
| 2 | `GradeEvaluate` | 自定义Skill | 研判定级（量化要素→法定级别） | Commander |
| 3 | `SlaCheck` | 自定义Skill | 法定时限校验（初报2h等） | Commander |
| 4 | `StaffAssign` | 自定义Skill | 标准编成建议（按类型×级别） | Commander, Dispatch |
| 5 | `PlanMatch` | 自定义Skill | 预案/SOP/措施知识库匹配 | Commander, Field |
| 6 | `NotifyDispatch` | 自定义Skill | 多通道通知+强制反馈闭环 | Communication |
| 7 | `CriteriaCheck` | 自定义Skill | 阶段完成标准校验 | Commander |
| 8 | `DocDraft` | 自定义Skill | 文档自动起草（简报/终报/发布稿） | Communication, Review |

---

## Skill 详细规格

### Skill 1: TypePackResolve

| 字段 | 说明 |
|------|------|
| **Skill名称** | `TypePackResolve` |
| **Skill类型** | 自定义Skill / 事件引擎核心能力 |
| **使用场景** | 接收到事件上报时自动识别事件类型，加载对应类型包（通知组、物资包、任务包、表单集、完成标准、医疗配置） |
| **输入参数** | `{typeKey?: string, type?: string, disease?: string, title?: string, rawText?: string}` — 可以是精确的typeKey，也可以是自然语言描述由Skill做模糊匹配 |
| **输出结果** | `{typeKey, name, icon, sceneHint, notifyGroups[], materialPacks[], taskPacks[], forms[], launchCriteria[], fieldCriteria[], medical{}}` |
| **调用条件** | ① Sentinel Agent接收到新上报时调用；② Commander Agent启动响应时调用；③ Field Agent激活任务包时调用 |
| **依赖工具/系统** | `eventTypes.js` 类型包配置文件（内置5种：INF/FOOD/ENV/POISON/UNK） |
| **失败处理** | ① 模糊匹配无结果 → 返回默认类型（INF传染病）+ 警告标记"建议人工确认类型"；② 类型包配置损坏 → 回退到DEFAULT_TYPE + 记录错误日志 |
| **权限与安全** | 只读操作，不修改任何数据；类型包配置需版本化管理 |
| **复用价值** | ⭐ 高。任何需要"事件分类→差异化配置"的场景均可复用：安全生产事故、自然灾害、社会安全事件等。插件化设计（新增类型=添加一个对象）使其极易扩展。 |

---

### Skill 2: GradeEvaluate

| 字段 | 说明 |
|------|------|
| **Skill名称** | `GradeEvaluate` |
| **Skill类型** | 自定义Skill / 确定性规则引擎（D0层） |
| **使用场景** | 指挥员研判事件时，输入量化要素（事件类型、病例人数、死亡人数、波及范围、是否扩散），输出建议级别（I/II/III/IV级）+命中规则+提级条件 |
| **输入参数** | `{typeKey: 'INF\|FOOD\|ENV\|POISON\|UNK', cases: number, deaths: number, scope: 1\|2\|3\|4, spread: boolean}` |
| **输出结果** | `{ok: true, suggestedLevel: 'III级', matchedRules: [{id, level, basis}], gapToHigher: [{id, expr, basis}], ruleVersion: string}` — 含"距上一级差距分析"（提级条件提示） |
| **调用条件** | Commander Agent在研判阶段调用，作为决策辅助（建议级别，最终定级由人决定） |
| **依赖工具/系统** | `grading.json` 规则表（纯函数、无网络、无随机） |
| **失败处理** | ① 输入校验失败（非法typeKey/超范围） → 返回具体错误信息；② 规则未覆盖 → 返回`noMatch: true` + "转人工研判"提示；③ 规则表缺失 → 启动自检时告警 |
| **权限与安全** | 纯函数无副作用；输出含`ruleVersion`确保可审计追溯；设计为"就高不就低"原则 |
| **复用价值** | ⭐⭐ 极高。任何需要"量化要素→法定/标准分级"的场景均可复用：安全生产事故分级、自然灾害应急响应分级等。规则表可替换，引擎逻辑通用。 |

---

### Skill 3: SlaCheck

| 字段 | 说明 |
|------|------|
| **Skill名称** | `SlaCheck` |
| **Skill类型** | 自定义Skill / 确定性规则引擎（D0层） |
| **使用场景** | 校验事件各环节是否满足法定时限（如：初报2小时、进程报告每日等），输出各环节时限状态（ok/near/over） |
| **输入参数** | `stages: [{stage: string, startAt: ISO, doneAt?: ISO}]` |
| **输出结果** | `[{stage, ruleId, limitMinutes, elapsedMin, status: 'pending\|ok\|near\|over\|over_done', action, basis, ruleVersion}]` |
| **调用条件** | Commander Agent随时可调用查询当前时限状态；超时自动触发预警 |
| **依赖工具/系统** | `sla.json` 规则表 |
| **失败处理** | ① 无对应阶段规则 → 返回`status: 'unknown'`；② 时间格式错误 → 返回校验错误 |
| **权限与安全** | 只读校验操作；结果含`ruleVersion`存证 |
| **复用价值** | ⭐⭐ 极高。任何有法定/约定时限的场景均可复用：工单SLA、合同履约时限、审计整改时限等。 |

---

### Skill 4: StaffAssign

| 字段 | 说明 |
|------|------|
| **Skill名称** | `StaffAssign` |
| **Skill类型** | 自定义Skill / 确定性规则引擎（D1层） |
| **使用场景** | 根据事件类型和级别，输出标准编成建议（需要哪些组、每组最低人数、技能标签、任务清单），含人员匹配和缺口提示 |
| **输入参数** | `{typeKey: string, level: 'I级\|II级\|III级\|IV级'}` |
| **输出结果** | `{ok: true, name, typeKey, level, multiplier, groups: [{group, minCount, baseCount, skillTags, tasks}], materialPacks, ruleVersion}` |
| **调用条件** | Commander Agent一键启动时调用，Dispatch Agent接收后执行人员匹配 |
| **依赖工具/系统** | `composition.json` 规则表、通讯录服务（MCP，用于人员匹配） |
| **失败处理** | ① 未知事件类型 → 返回`ok: false`+错误信息；② 通讯录人员不足 → 标记缺口 |
| **权限与安全** | 编成为预案既定，人员指派由指挥员确认（Skill仅输出建议） |
| **复用价值** | ⭐ 高。任何需要"按场景×级别→团队编成"的场景：项目团队组建、应急值班编排、大型活动保障编组等。 |

---

### Skill 5: PlanMatch

| 字段 | 说明 |
|------|------|
| **Skill名称** | `PlanMatch` |
| **Skill类型** | 自定义Skill / 确定性规则引擎（D2层）+ RAG增强 |
| **使用场景** | 根据事件类型、级别、当前阶段，从知识库（预案/SOP/措施/案例）中匹配最相关的处置方案，按权重评分排序 |
| **输入参数** | `{typeKey: string, level: string, stage?: string}, knowledge: KnowledgeItem[]` |
| **输出结果** | `{ok: true, results: [{id, kind, title, typeKey, stage, score, summary}], total, ruleVersion}` — 最多返回`maxResults`条 |
| **调用条件** | Commander Agent研判时参考、Field Agent执行时参考SOP |
| **依赖工具/系统** | `matching.json` 规则表（权重配置）、`knowledge.json` 知识库（预案5/SOP8/措施3/案例2/参数1） |
| **失败处理** | ① 知识库为空 → 返回空结果+警告；② 无匹配 → 返回空列表+建议人工检索 |
| **权限与安全** | 知识库条目需版本化管理；匹配结果可审计 |
| **复用价值** | ⭐⭐ 极高。本质是"结构化知识检索+加权评分"，可迁移至：运维Runbook匹配、合规条款检索、客服知识库搜索等。 |

---

### Skill 6: NotifyDispatch

| 字段 | 说明 |
|------|------|
| **Skill名称** | `NotifyDispatch` |
| **Skill类型** | 自定义Skill / 通知引擎 |
| **使用场景** | 按通知组列表+通道配置，并行下发多通道通知（语音/短信/APP），启动强制反馈闭环（5分钟确认+超时自动升级） |
| **输入参数** | `{eventId: string, targets: [{id, name, phone, role, superiorId}], content: string, channels?: string[], ackMinutes?: number, kind?: 'alert\|instruction\|test'}` |
| **输出结果** | 通知记录列表 `[{id, targetName, channels, channelLogs, status, ackDeadline}]` + 升级引擎自动巡检 |
| **调用条件** | Commander Agent启动响应时批量调用；Field Agent下发任务指令时调用；定时测试通知 |
| **依赖工具/系统** | 通知网关MCP（语音/短信/APP推送）— 当前为模拟通道，已预留真实网关接口 |
| **失败处理** | ① 通道发送失败 → 记录到channelLogs（ok: false）+ 尝试备用通道；② 持续超时 → 升级引擎自动升频通知上级 |
| **权限与安全** | 通知内容不得包含敏感明文（手机号脱敏存储）；升级记录不可删除（审计要求） |
| **复用价值** | ⭐⭐ 极高。"多通道通知+强制反馈+超时升级"模式可迁移至：运维告警通知、工单催办、审批催办、值班叫醒等。 |

---

### Skill 7: CriteriaCheck

| 字段 | 说明 |
|------|------|
| **Skill名称** | `CriteriaCheck` |
| **Skill类型** | 自定义Skill / 状态机校验引擎 |
| **使用场景** | 校验当前阶段完成标准是否达成：启动阶段（人员出发+物资装车+车辆就位）、现场阶段（关键任务完成+表单回传+零阻塞） |
| **输入参数** | `{eventId: string, stage: 'responding\|field'}` |
| **输出结果** | `{groupsReady: bool, materialsReady: bool, vehiclesReady: bool, allReady: bool, detail: {...}}` — 含各小组/物资/车辆的逐项状态 |
| **调用条件** | Commander Agent尝试推进阶段前必须调用；Dashboard自动轮询展示 |
| **依赖工具/系统** | 人员表、物资表、车辆表、任务表、表单表（JSON存储/MCP） |
| **失败处理** | ① 标准未达成 → 返回`allReady: false`+详细未达标项；② 数据缺失 → 标记对应项为"数据待补" |
| **权限与安全** | 只读校验；阶段推进决策权在Commander Agent（Skill仅输出判断） |
| **复用价值** | ⭐ 高。任何需要"阶段门/完成标准校验"的流程均可复用：研发发布门禁、项目里程碑验收、审批流程条件校验等。 |

---

### Skill 8: DocDraft

| 字段 | 说明 |
|------|------|
| **Skill名称** | `DocDraft` |
| **Skill类型** | 自定义Skill / 模板+数据自动填充 |
| **使用场景** | 根据事件数据自动生成文档初稿：简报（定时）、终报（事件终止时）、发布稿（信息发布时）。模板段自动填充，评述段留人工。 |
| **输入参数** | `{eventId: string, docType: 'brief\|final\|publish'}` |
| **输出结果** | 文档初稿Markdown/HTML，含自动填充段（时间线、数据、措施）+人工批注段（评述、建议） |
| **调用条件** | Commander Agent需要简报/终报时调用；Communication Agent起草发布稿时调用 |
| **依赖工具/系统** | 事件全链路数据、文档模板库 |
| **失败处理** | ① 数据不足 → 对应段落标记"[数据待补]"；② 模板缺失 → 回退到通用模板 |
| **权限与安全** | 生成内容需人工审核后方可发布；文档含版本号可追溯 |
| **复用价值** | ⭐ 高。任何"数据→结构化文档"的自动起草场景：运维事故报告、项目周报、数据分析报告等。 |

---

## Skill 与 Agent 关系矩阵

| Skill \ Agent | Sentinel | Commander | Dispatch | Field | Medical | Communication | Review |
|---------------|----------|-----------|----------|-------|---------|---------------|--------|
| TypePackResolve | ● | ● | | ● | ● | | |
| GradeEvaluate | | ● | | | | | |
| SlaCheck | | ● | | | | | |
| StaffAssign | | ● | ● | | | | |
| PlanMatch | | ● | | ● | | | |
| NotifyDispatch | | | | | | ● | |
| CriteriaCheck | | ● | | | | | |
| DocDraft | | | | | | ● | ● |

---

## Skill 生命周期管理

```
定义 → 审核 → 版本发布 → 运行时加载 → 调用存证 → 更新/回滚
```

1. **定义**：每个Skill有独立的Schema定义（输入/输出/调用条件/失败处理）
2. **审核**：规则表变更需通过回归测试（75用例全绿）
3. **版本发布**：每个Skill携带`ruleVersion`，调用结果存证
4. **运行时加载**：通过Nacos或本地文件加载（可配置）
5. **调用存证**：所有调用写入`rule_results`表（含版本、输入、输出、时间戳）
6. **更新/回滚**：规则表版本化管理，支持快速回滚到任意历史版本

---

## 与阿里云官方用云Skills的集成规划

| 官方Skill | 本项目集成方式 |
|-----------|--------------|
| ECS管理Skill | Dispatch Agent用于车辆/服务器资源弹性调度 |
| 短信/语音Skill | Communication Agent替换当前模拟通道，接入真实通知网关 |
| OSS存储Skill | 事件附件（表单影像、采样照片）存储 |
| 日志服务Skill | 全链路Trace和审计日志接入SLS |
| Nacos配置管理 | Skill版本管理、Agent配置注册、运行时发现 |
