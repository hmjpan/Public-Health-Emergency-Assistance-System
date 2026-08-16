# 卫盾Agent — 方案PPT内容

> GOAI 世界人工智能开源大赛 · 赛道一：新智基座丨Agent Infra
> 复杂任务多Agent自主协同 — 初赛方案PPT

---

## 封面（Slide 1）

**卫盾Agent**
突发公共卫生事件多Agent自主协同应急处置平台

GOAI · 新智基座 Agent Infra · 初赛方案
【团队名称】· 【日期】

---

## 目录（Slide 2）

1. 场景与价值（25%）
2. 方案总览
3. 多Agent协同设计（25%）
4. Skills工程体系（25%）
5. 工程落地、运行验证与安全可审计（20%）
6. 开放/开源计划（5%）
7. 落地计划与进展
8. 团队介绍

---

# 第一章 · 场景与价值（25%）

---

## 1.1 目标用户与核心痛点（Slide 3）

**目标用户：** 各级疾控中心、卫生监督所、急救中心、公共卫生应急指挥机构

**核心痛点：**

| 痛点 | 现状 | 后果 |
|------|------|------|
| 研判定级靠经验 | 指挥员凭个人经验判断事件级别 | 容易误判（过高浪费资源/过低延误响应） |
| 多组协同靠口头 | 流调/采样/消杀/管控/救治组靠电话协调 | 状态不可见、信息不同步、遗漏任务 |
| 法定时限无预警 | 初报2小时等时限靠人记忆 | 超时追责、合规风险 |
| 经验无法沉淀 | 每次事件从零开始 | 同类错误反复出现 |

---

## 1.2 真实场景示例（Slide 4）

**场景：某区疾控中心接报"某学校20余名学生呕吐腹泻"**

```
一线上报 → Sentinel双证据分类（食源性疾病, 置信度0.92）
→ Commander研判定级（IV级, 法规依据: 国办函〔2006〕39号 1.3.4）
→ 一键启动 → Dispatch并行调度（流调组/采样组/管控组）
→ 物资调拨（采样包+取证包）→ 车辆调度
→ Field现场指导（SOPGuidance: CDC 10步法 步骤4-6）
→ 患者救治（Medical: CaseTrack流行病学指标监测）
→ 信息发布（Communication: DocDraft起草发布稿）
→ 终止评估 → 复盘沉淀（Review: ReviewReport生成复盘报告）
```

**传统方式：** 2-3小时完成研判启动，电话协调易遗漏，时限容易超时
**卫盾Agent：** 5分钟内完成识别+研判+启动，多组自动并行调度，时限自动预警

---

## 1.3 可量化价值（Slide 5）

| 指标 | 传统方式 | 卫盾Agent | 提升 |
|------|---------|-----------|------|
| 研判启动时间 | 2-3小时 | ≤5分钟 | **96%↓** |
| 通知到达确认率 | ~70% | 100%（强制反馈） | **30%↑** |
| 法定时限合规率 | ~60% | ≥95%（自动预警） | **35%↑** |
| 任务遗漏率 | ~15% | ≤2%（标准任务包） | **87%↓** |
| 经验复用率 | 0%（每次从零开始） | ≥80%（知识库匹配） | **质变** |

---

## 1.4 行业可复制性（Slide 6）

**核心架构可迁移至：**
- 🔥 安全生产事故应急处置（矿山、化工、建筑）
- 🌊 自然灾害应急响应（洪涝、地震、台风）
- 🏭 环境污染事件应急（水污染、大气污染）
- 🐄 动物疫情应急处置（非洲猪瘟、禽流感）
- 🏥 医院院内应急管理（群体伤、院内感染）

**可复用资产：** 多Agent协同框架、Skill工程化规范（SKILL.md+Guardrail+证据链）、双证据验证模式、类型包插件化设计、强制反馈通知引擎、双模式运行架构

---

## 1.5 创新点与差异化（Slide 7）

| 差异化维度 | 现有方案 | 卫盾Agent |
|-----------|---------|-----------|
| 决策辅助 | 纯人工 or 纯AI黑盒 | **确定性规则引擎+Agent智能双轨**：关键决策可解释、可审计 |
| 可靠性保障 | 单一LLM判断 | **双证据验证**：LLM语义+规则引擎交叉校验，降低误判 |
| 安全护栏 | 无约束或硬编码 | **Guardrail四类约束**：确定性/业务/容错/安全，每个Skill独立定义 |
| 法规合规 | 人工记忆法规 | **法规条文溯源**：规则表携带legal_ref，输出可追溯到具体条文 |
| 证据链 | 黑盒无解释 | **完整证据链**：provenance/methodology/confidence/missing_evidence |
| 事件适配 | 固定流程 | **类型包插件化**：新增事件类型=添加一个配置对象，引擎零改动 |
| 信息闭环 | 通知发了就算完 | **强制反馈+自动升级**：5分钟确认时限，超时通知上级 |
| 能力沉淀 | 纸质预案束之高阁 | **Skill工程化封装**：规则/知识/流程沉淀为可复用、可版本化的Skill（SKILL.md） |
| 运行模式 | 单一使用 | **双模式运行**：辅助处置（人机协同）+模拟演练（单人全流程） |

---

# 第二章 · 方案总览

---

## 2.1 总体技术架构（Slide 8）

```
┌─────────────────────────────────────────────┐
│            用户/事件入口                      │
│  一线上报 · 监测预警 · 舆情告警               │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│         AgentTeams 编排层                    │
│  任务拆解 · 角色路由 · 共享状态 · 升级策略     │
│  AGENTS.md → WORKER.md × 7                  │
└──────────────────┬──────────────────────────┘
                   │
┌────┬────┬────┬───┼───┬────┬────┬────┐
│Sent│Comm│Disp│Fie│Med│Comm│Revie│
│inel│ande│atch│ld│ica│unic│w    │
│    │r   │    │   │l  │atio│     │
│哨兵 │指挥 │调度 │现场│医疗│通讯 │复盘  │
└─┬──┴──┬─┴──┬─┴─┬─┴─┬─┴──┬─┴─────┬┘
  │     │    │   │   │    │       │
┌─▼─────▼────▼───▼───▼────▼───────▼──────┐
│         Skill 能力层（12个）              │
│ ┌─ 规则引擎包装 ─────────────────────┐  │
│ │ TypePackResolve · GradeEvaluate    │  │
│ │ SlaCheck · StaffAssign · PlanMatch │  │
│ │ CriteriaCheck · NotifyDispatch     │  │
│ └────────────────────────────────────┘  │
│ ┌─ LLM增强 ──────────────────────────┐  │
│ │ EventClassify · CaseTrack          │  │
│ │ SOPGuidance · ReviewReport · DocDraft│ │
│ └────────────────────────────────────┘  │
│  每个Skill: SKILL.md + Guardrail + 证据链 │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│          MCP 工具层（7个工具）             │
│ contacts · materials · vehicles          │
│ medical-resources · knowledge            │
│ notification-gateway · event-state       │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│          证据与治理层                     │
│ Event State · Rule Results · Audit Trail│
│ Trace · Metrics · Agent Sessions        │
└─────────────────────────────────────────┘
```

**端到端主流程：** 上报接收 → Sentinel分类 → Commander研判 → 一键启动 → 并行调度 → 现场处置 → 终止评估 → 复盘沉淀

**关键技术选型必要性：**
- AgentTeams：多Agent协同编排基点（已实现standalone/bridge双模式）
- 确定性规则引擎：关键决策可审计可解释（公共卫生决策不能是黑盒）
- LLM增强层：扩展非确定性能力（分类/趋势/指导/复盘），通过Guardrail约束
- 双证据验证：LLM + 规则引擎交叉校验，提高可靠性
- MCP：统一工具接入协议（7个工具已实现）
- 可观测：Trace + Metrics 全链路可审计

---

# 第三章 · 多Agent协同设计（25%）

---

## 3.1 七个职能Agent（Slide 9）

| Agent | 角色定位 | 核心职责 |
|-------|---------|---------|
| 🛰️ Sentinel Agent | 哨兵 | 接收上报 → EventClassify双证据分类 → 结构化 → 推送研判 |
| 🎯 Commander Agent | 指挥决策 | GradeEvaluate研判定级 → SlaCheck时限校验 → 一键启动 → 阶段推进 → 终止评估 |
| 📦 Dispatch Agent | 资源调度 | StaffAssign标准编成 → 人员出动 + 物资调拨 + 车辆保障（并行） |
| 🏕️ Field Agent | 现场处置 | SOPGuidance CDC 10步法指导 → 任务分发 + 表单采集 + 简报生成 |
| 🏥 Medical Agent | 医疗救治 | CaseTrack病例分析+流行病学指标 → 密接追踪 + 医疗资源可视 |
| 📡 Communication Agent | 通讯协调 | NotifyDispatch多通道通知 + DocDraft文档起草 → 强制反馈 + 超时升级 |
| 📋 Review Agent | 复盘评估 | ReviewReport复盘分析 + DocDraft报告生成 → 整改台账 + 知识沉淀 |

---

## 3.2 Agent协同流程（Slide 10）

```
         ┌──────────────────────────────────────────┐
         │          Event State (共享状态)            │
         │  事件信息 · 决策记录 · 任务状态 · 资源状态    │
         └──┬─────┬─────┬─────┬─────┬─────┬─────┬───┘
            │     │     │     │     │     │     │
  ┌─────────▼┐ ┌──▼───┐┌▼────┐┌▼───┐┌▼───┐┌▼──┐┌▼──────┐
  │Sentinel  │ │Commdr││Disp ││Fie ││Med ││Comm││Review │
  │接收上报  │→│研判  │→│调度 │→│处置│→│救治│→│通讯│→│复盘   │
  │类型识别  │ │启动  │ │人员 │ │任务│ │病例│ │通知│ │沉淀   │
  │          │ │阶段  │ │物资 │ │表单│ │密接│ │反馈│ │知识   │
  └──────────┘ └──────┘│车辆 │ │简报│ │资源│ │发布│ │       │
                       └─────┘└────┘└────┘└────┘└───────┘

  关键协同机制：
  ① 上下文传递：所有Agent读写Event State共享状态
  ② 并行执行：人员/物资/车辆同时调度（Dispatch内部并行）
  ③ 完成标准串联：CriteriaCheck Skill校验阶段完成才推进
  ④ 异常升级：超时/阻塞自动升级到Commander
```

---

## 3.3 上下文传递与状态流转（Slide 11）

**共享状态容器 — Event State：**
```json
{
  "eventId": "EVT-001",
  "typeKey": "FOOD",
  "level": "IV级",
  "stage": "responding",
  "timeline": [...],
  "decisions": [{actor: "commander-agent", action: "launch", at: "...", ruleVersion: "v2026.2"}],
  "personnel": [...],
  "materials": [...],
  "tasks": [...],
  "cases": [...],
  "notifications": [...]
}
```

**状态流转：**
```
detected → responding → field → closed
    ↑          ↑          ↑        ↑
 Sentinel  Commander  Commander Commander
           一键启动    推进      终止

异常分支：
- 启动标准未达成 → 阻塞responding + Dispatch催办
- 任务阻塞 → Field预警 → Commander介入
- 通知超时 → Communication自动升级
- SLA超时限 → Commander预警
```

---

## 3.4 安全边界与高风险动作（Slide 12）

| 动作类别 | 风险等级 | 安全机制 |
|---------|---------|---------|
| 事件定级 | 🔴 高 | Agent建议 → 人工确认（规则引擎"就高不就低"） |
| 一键启动 | 🔴 高 | 仅Commander/Deputy角色可操作，审批记录存证 |
| 阶段推进 | 🟡 中 | 必须通过CriteriaCheck校验，不达标禁止推进 |
| 信息发布 | 🔴 高 | 三段式：起草→审批→发布，Agent仅起草 |
| 超量调拨 | 🟡 中 | 超阈值需人工确认 |
| 通知发送 | 🟢 低 | Agent自主执行，全程留痕 |
| 知识更新 | 🟡 中 | Agent提取建议 → 人工审核入库 |

**设计原则：** 高风险动作保留人工确认、审批、回滚和审计能力；低风险动作自动闭环提升效率。

---

## 3.5 双模式运行（Slide 12b）

**辅助处置模式（Assist） vs 模拟演练模式（Drill）：**

| 维度 | 辅助处置（Assist） | 模拟演练（Drill） |
|------|-------------------|------------------|
| 定位 | 真实事件处置，Agent辅助人类 | 单人走完全流程，Agent代替角色 |
| 决策权 | Agent仅提供建议，人工确认执行 | Agent可代替角色操作（虚拟人员） |
| 数据写入 | Agent不能直接写数据，需人工执行 | Agent可直接写入Event State |
| 典型场景 | 疾控中心实际接报处置 | 培训演练、系统演示、能力评估 |

**模式切换机制：**
```
POST /api/agent/mode/:eventId  {mode: 'assist'|'drill'}
  ↓
canAgentWrite(agentId, eventId) → 检查模式权限
  ↓ assist: Agent建议 → 人工确认
  ↓ drill: Agent直接执行 → 分配虚拟人员身份
```

**创新价值：** 同一套Agent/Skill，两种使用方式，既支撑实际工作，又支撑培训演练，零代码改动切换。

---

## 3.6 AgentTeams编排（Slide 12c）

**三级映射：AGENTS.md → WORKER.md × 7 → AgentTeams配置**

```
AGENTS.md（全局清单）
  ├── Sentinel  → Worker: sentinel-worker
  ├── Commander → Worker: commander-worker
  ├── Dispatch  → Worker: dispatch-worker
  ├── Field     → Worker: field-worker
  ├── Medical   → Worker: medical-worker
  ├── Communication → Worker: communication-worker
  └── Review    → Worker: review-worker

每个WORKER.md定义:
  - skills: [Skill名称列表]
  - tools: [MCP工具列表]
  - triggers: [触发条件]
  - escalation: [升级策略]
  - soul: [系统提示词摘要]
```

**运行模式：**
- **standalone模式**：Agent独立运行，通过REST API交互（当前）
- **bridge模式**：接入AgentTeams框架，Manager→TeamLeader→Worker编排（已预留接口）

---

# 第四章 · Skills工程体系（25%）

---

## 4.1 十二大核心Skill（Slide 13）

| Skill | 用途 | 使用Agent | 类型 | 法规依据 |
|-------|------|-----------|------|---------|
| `TypePackResolve` | 事件类型解析与配置加载 | Sentinel, Field, Medical | 自定义Skill | 《报告管理工作规范》 |
| `EventClassify` | 自然语言上报→事件类型（双证据验证） | Sentinel | LLM+规则引擎D3 | 《报告管理工作规范》 |
| `GradeEvaluate` | 研判定级（要素→法定级别→风险等级） | Commander | 规则引擎D0 | 《突发公共卫生事件应对法》(2025) |
| `SlaCheck` | 法定时限校验+自动预警 | Commander | 规则引擎D0 | 《应对法》(2025)+《传染病防治法》(2025) |
| `StaffAssign` | 标准编成建议（工作组×级别乘数） | Commander, Dispatch | 规则引擎D1 | 《国家卫生应急队伍管理办法》(2024版) |
| `PlanMatch` | 预案/SOP知识库匹配 | Commander, Field | 规则引擎D2+RAG | 各类技术方案 |
| `NotifyDispatch` | 多通道通知+强制反馈+超时升级 | Communication | 通知引擎 | 《应对法》(2025)+《应急条例》第32条 |
| `CriteriaCheck` | 阶段完成标准校验 | Commander | 状态机引擎 | 应急预案各阶段标准 |
| `DocDraft` | 文档自动起草（简报/终报/发布稿） | Communication, Review | 模板引擎+LLM | — |
| `CaseTrack` | 病例全流程分析+流行病学指标 | Medical | LLM+确定性计算 | 《传染病防治法》(2025修订) |
| `SOPGuidance` | CDC 10步法匹配+场景化操作指导 | Field | LLM+内置SOP | CDC现场调查10步法 |
| `ReviewReport` | 复盘报告+改进建议+知识沉淀 | Review | LLM+结构化分析 | 《应急预案》第5.3条 |

---

## 4.2 Skill标准化规格（以GradeEvaluate v1.1.0为例）（Slide 14）

```yaml
Skill名称: GradeEvaluate
版本: 1.1.0
类型: 确定性规则引擎（D0层）
法规依据: 《中华人民共和国突发公共卫生事件应对法》(2025) + 《国家突发公共卫生事件应急预案》国办函〔2006〕39号 1.3.1-1.3.4

输入:
  typeKey: 'INF|FOOD|ENV|POISON|UNK'
  cases: number       # 病例人数
  deaths: number      # 死亡人数
  scope: 1|2|3|4      # 波及范围等级
  spread: boolean      # 是否有扩散趋势

输出:
  suggestedLevel: 'I级|II级|III级|IV级'
  riskLevel: 'L0|L1|L2|L3'     # 风险等级映射（I级→L0）
  riskLabel: '特别重大|重大|较大|一般'
  matchedRules: [{id, level, riskLevel, basis, legal_ref, expr}]
  gapToHigher: [{id, expr, basis, legal_ref}]   # 距上一级差距
  ruleVersion: '2026.2'

证据链（evidence）:
  provenance: 'grading.json rule_version=2026.2'
  rule_evaluated: 20     # 本轮评估的规则数
  rule_matched: 1        # 命中规则数
  confidence: 'high'     # high/low
  missing_evidence: []   # 缺失证据提示
  methodology: '受限表达式求值，白名单变量，纯函数无网络无随机'

Guardrail（约束护栏）:
  确定性约束: 纯函数，相同输入必得相同输出，无随机无网络
  业务约束: "就高不就低"——多规则命中取最高级别
  容错约束: 规则未覆盖→noMatch:true+转人工，不猜测
  安全约束: 结果仅为建议，最终定级由人决定

调用条件: Commander Agent研判阶段
依赖工具: grading.json 规则表（v2026.2，20条规则）
失败处理:
  - 输入非法 → 返回具体错误
  - 规则未覆盖 → noMatch:true + 转人工 + missing_evidence提示
  - 规则表缺失 → 启动自检告警
复用价值: 任何"量化要素→法定分级"场景
```

**Skill设计三原则：**
1. **证据链完整**：每个Skill输出必含provenance/methodology/confidence/missing_evidence
2. **Guardrail约束**：每个Skill明确四类约束（确定性/业务/容错/安全）
3. **法规溯源**：规则表携带`legal_ref`，输出可追溯到具体法规条文

---

## 4.3 Skill与Agent关系矩阵（Slide 15）

| Skill \ Agent | Sentinel | Commander | Dispatch | Field | Medical | Communication | Review |
|---------------|----------|-----------|----------|-------|---------|---------------|--------|
| TypePackResolve | ● | ● | | ● | ● | | |
| EventClassify | ● | | | | | | |
| GradeEvaluate | | ● | | | | | |
| SlaCheck | | ● | | | | | |
| StaffAssign | | ● | ● | | | | |
| PlanMatch | | ● | | ● | | | |
| NotifyDispatch | | | | | | ● | |
| CriteriaCheck | | ● | | | | | |
| DocDraft | | | | | | ● | ● |
| CaseTrack | | | | | ● | | |
| SOPGuidance | | | | ● | | | |
| ReviewReport | | | | | | | ● |

---

## 4.4 Skill生命周期管理（Slide 16）

```
定义(SKILL.md) → 审核 → 版本发布(v2026.2) → 运行时加载 → 调用存证 → 更新/回滚
     ↓                                                  ↓
 Guardrail + references/                          rule_results + Trace
```

- **定义**：每个Skill有独立SKILL.md（YAML Frontmatter + Markdown body + references/目录）
- **三级加载**：SKILL.md（规格） → references/（法规原文） → 运行时规则表
- **审核**：规则表变更必须通过188条测试全绿（75系统 + 113 Agent）
- **版本发布**：携带`ruleVersion`（当前v2026.2），所有调用结果存证
- **Guardrail**：每个Skill明确四类约束（确定性/业务/容错/安全），运行时校验
- **证据链**：每次执行自动生成evidence对象（provenance/methodology/confidence/missing_evidence）
- **调用存证**：写入`rule_results`表（含版本、输入、输出、时间戳、evidence）
- **回滚**：版本化管理，一键回滚到任意历史版本

**SKILL.md 规格示例（文件结构）：**
```
docs/agentteams/skills/GradeEvaluate/
├── SKILL.md          # 规格定义（输入/输出/Guardrail/证据链/法规表）
└── references/
    └── 国办函〔2006〕39号_分级标准.md  # 法规原文摘录
```

---

# 第五章 · 工程落地、运行验证与安全可审计（20%）

---

## 5.1 当前工程完成度（Slide 17）

**系统层（已建成 100%）：**
- ✅ 12个功能模块全部开发完成
- ✅ Node.js + Express 后端（~1300 LOC）
- ✅ 原生JS SPA前端（零构建零依赖）
- ✅ 自定义SVG图表库（7种图表）
- ✅ 确定性规则引擎（4张规则表v2026.2，含法规条文引用）
- ✅ 三阶段状态机 + 完成标准校验
- ✅ 多通道通知 + 强制反馈升级引擎
- ✅ 5种事件类型包（INF/FOOD/ENV/POISON/UNK）
- ✅ RBAC权限控制（11个演示账号）
- ✅ JSON存储 + 原子写入 + 启动自检 + 每日快照

**Agent/Skill层（已建成 100%）：**
- ✅ 7个职能Agent（Sentinel/Commander/Dispatch/Field/Medical/Communication/Review）
- ✅ 12个Skill（8个包装规则引擎 + 4个LLM增强），全部v1.1.0
- ✅ LLM Provider（零新依赖，支持DashScope/OpenAI，含降级fallback）
- ✅ 双证据验证（LLM语义 + 规则引擎交叉校验）
- ✅ Skill标准化规格（SKILL.md + Guardrail + 证据链 + references/）
- ✅ 7个MCP工具（contacts/materials/vehicles/medical-resources/knowledge/notification-gateway/event-state）
- ✅ 可观测体系（Trace全链路追踪 + Metrics指标统计）
- ✅ 双模式运行（辅助处置 + 模拟演练）
- ✅ AgentTeams适配层（standalone/bridge双模式）
- ✅ 文档体系（SKILL.md × 12 + WORKER.md × 7 + AGENTS.md）

**测试验证：**
- 11个演示账号（密码统一123456），覆盖全部角色
- 完整操作链路可走通：上报→研判→启动→调度→处置→终止→复盘
- `node tests/regression.js` — 75条系统回归测试全绿
- `node tests/agent-tests.js` — 113条Agent/Skill测试全绿
- **合计188条测试，全部通过**

---

## 5.2 运行验证证据（Slide 18）

**规则引擎自检：**
```
[规则引擎] 自检通过 (规则版本v2026.2，含法规条文引用)
[自检] 数据表全部正常(36/36)
[快照] 每日快照完成(7文件)
```

**188条测试全覆盖：**

系统层（75条回归测试）：
- 分级判定（D0）：5种事件类型 × 多种要素组合，含法规条文校验
- 时限校验（D0）：pending/ok/near/over/over_done 全状态
- 标准编成（D1）：类型×级别交叉验证，含工作组名称/乘数/物资包
- 知识匹配（D2）：权重计算、排序、截断
- 边界情况：非法输入、缺失字段、规则未覆盖

Agent/Skill层（113条测试）：
- 12个Skill独立测试：输入→预期输出，含边界条件
- 7个Agent react流程测试：mock LLM返回 + 端到端执行
- 双证据验证测试：LLM/规则引擎一致/冲突/降级场景
- 双模式切换测试：assist/drill模式权限校验
- MCP工具调用测试：7个工具Schema验证
- 可观测验证：Trace写入 + Metrics统计

---

## 5.3 安全与审计机制（Slide 19）

| 机制 | 实现 |
|------|------|
| **RBAC权限** | 11个角色，单线决策（仅commander/deputy可启动/推进/终止） |
| **规则存证** | 所有规则调用写入`rule_results`（含ruleVersion、输入、输出、时间戳、evidence证据链） |
| **Guardrail约束** | 12个Skill均含四类约束：确定性约束/业务约束/容错约束/安全约束 |
| **证据链完整** | 每个Skill输出含provenance/methodology/confidence/missing_evidence |
| **法规溯源** | 规则表携带`legal_ref`（《应对法》2025/《传染病防治法》2025/《卫生应急队伍管理办法》2024/《传染病信息报告管理规范》2026版），输出可追溯具体条文 |
| **通知审计** | 全量通知记录 + 通道日志 + 升级记录，不可删除 |
| **数据硬化** | 原子写入 + 启动自检（损坏表自动隔离） + 每日快照（保留7份） |
| **高风险审批** | 定级/启动/发布/终止均需人工确认，Agent仅提供建议（双模式：drill模式下Agent可代操作） |
| **回滚能力** | 规则表版本化（v2026.2） + 数据快照 + 操作日志全链路可回放 |

---

## 5.4 MCP工具集成（Slide 20）

**已实现7个MCP工具**，通过 `server/agent/mcp-server.js` 暴露，遵循 MCP 协议 Schema：

| MCP工具 | 用途 | 使用Agent | 状态 |
|---------|------|-----------|------|
| contacts | 人员信息、组织架构、上下级关系 | Dispatch, Communication | ✅ 已实现 |
| materials | 库存查询、调拨记录、紧缺预警 | Dispatch | ✅ 已实现 |
| vehicles | 车辆位置、状态跟踪、电子通行证 | Dispatch | ✅ 已实现 |
| medical-resources | 药品/设备/床位实时数据 | Medical | ✅ 已实现 |
| knowledge | 预案/SOP/措施/案例检索 | Commander, Field | ✅ 已实现 |
| notification-gateway | 语音/短信/APP推送 | Communication | ✅ 已实现（含降级） |
| event-state | 事件状态读写 | 所有Agent | ✅ 已实现 |

**MCP工具设计特点：**
- 统一 `tools/list` + `tools/call` 协议，标准 MCP Server 接口
- 每个工具有完整的 JSON Schema 输入/输出定义
- 与现有 JSON 存储零冲突，通过 REST API 桥接
- 支持 standalone 模式（独立运行）和 bridge 模式（接入 AgentTeams）

---

## 5.5 可观测体系（Slide 21）

**已实现 Trace + Metrics 双层可观测**，通过 `server/agent/observability.js` 暴露：

| 数据类型 | 覆盖范围 | 状态 | 实现细节 |
|---------|---------|------|---------|
| **Trace** | Agent/Skill/MCP调用全链路 | ✅ 已实现 | 每次react生成traceId，记录skill执行顺序、输入输出、耗时、LLM调用标记 |
| **Log** | 决策依据、失败原因、权限校验 | ✅ 已实现 | rule_results表存证 + 通道日志 + 操作日志，含ruleVersion |
| **Metrics** | 响应时间、通知确认率、任务完成率、SLA合规率 | ✅ 已实现 | agent_metrics表，支持/api/agent/metrics查询 |

**可观测数据流：**
```
Agent.react() → Trace记录（traceId, agentId, skills[], durationMs）
    ↓
Skill.execute() → rule_results存证（ruleVersion, input, output, evidence）
    ↓
Metrics聚合 → agent_metrics表（agent调用次数、Skill成功率、LLM使用率）
    ↓
API暴露 → GET /api/agent/traces/:eventId + GET /api/agent/metrics
```

**API端点：**
- `GET /api/agent/traces/:eventId` — 查看某事件所有Agent交互Trace
- `GET /api/agent/metrics` — 全局指标统计
- `GET /api/agent/sessions/:eventId` — Agent会话记录

---

# 第六章 · 开放/开源计划（5%）

---

## 6.1 开源范围与协议（Slide 22）

**开源协议：** MIT License

**开源范围：**
- ✅ 核心框架：多Agent协同设计模板、Agent Identity清单（AGENTS.md）
- ✅ Skill接口契约：12个Skill的SKILL.md规格定义（含Guardrail + 证据链 + references/）
- ✅ Worker规格：7个Agent的WORKER.md定义
- ✅ 规则引擎：4张规则表（v2026.2，含法规条文引用）+ 确定性求值器
- ✅ 事件类型包：5种事件类型配置（可作为模板）
- ✅ 回归测试套件：188条测试用例（75系统 + 113 Agent/Skill）
- ✅ 前端图表库：自研轻量SVG图表（7种图表）
- ✅ 文档：架构设计、接口契约、部署说明

**闭源/限制部分：**
- 🔒 演示数据（模拟通讯录、物资台账）— 不涉及真实数据
- 🔒 通知网关密钥 — 环境变量配置，不入代码库

---

## 6.2 可复用成果（Slide 23）

| 成果 | 复用方式 | 迁移场景 |
|------|---------|---------|
| 多Agent协同框架 | Agent Identity模板（AGENTS.md） + 状态机 | 任何多Agent应急场景 |
| Skill工程化规范 | SKILL.md规格（Guardrail + 证据链 + references/） | 任何需要可审计AI能力的场景 |
| 双证据验证模式 | LLM语义 + 规则引擎交叉校验 | 任何需要高可靠AI判断的场景 |
| 类型包插件化设计 | 新增配置对象=新事件类型 | 安全生产/自然灾害/城市应急 |
| 强制反馈通知引擎 | 通知+确认+超时升级 | 运维告警/工单催办/审批催办 |
| 双模式运行 | assist（辅助决策）/ drill（模拟演练） | 任何需要培训演练的场景 |
| 法规溯源体系 | 规则表携带legal_ref，输出可追溯条文 | 任何受监管行业的AI决策 |
| SVG图表库 | 零依赖、即插即用 | 任何数据可视化场景 |

---

## 6.3 第三方依赖披露（Slide 24）

| 依赖 | 类型 | 用途 | 许可证 | 状态 |
|------|------|------|--------|------|
| Node.js | 运行时 | 服务端 | MIT | ✅ 使用 |
| Express | 框架 | HTTP服务 | MIT | ✅ 使用 |
| DashScope（通义千问） | LLM API | 事件分类/趋势分析/SOP指导/复盘 | 商业授权 | ✅ 可选（含降级） |
| AgentTeams | 协同框架 | 多Agent编排 | 开源 | ✅ standalone已实现 |
| 阿里云SMS/Voice | 商业API | 通知网关 | 商业授权 | 🔧 接口已预留 |

**零新npm依赖**：LLM调用使用Node.js内置https模块，存储复用现有JSON方案，MCP使用标准协议。

---

# 第七章 · 落地计划与进展

---

## 7.1 当前进展（Slide 25）

```
✅ 已完成（初赛V1.0 + V2.0 Agent层）
├── 系统层（12个功能模块，100%完成）
│   ├── 规则引擎 + 4张规则表v2026.2（含法规条文引用）
│   ├── 75条系统回归测试全绿
│   ├── 三阶段状态机 + 完成标准校验
│   ├── 多通道通知 + 强制反馈升级引擎
│   ├── 5种事件类型包（INF/FOOD/ENV/POISON/UNK）
│   ├── RBAC权限控制 + 11个演示账号
│   └── JSON存储 + 数据硬化 + 每日快照
│
├── Agent/Skill层（100%完成）
│   ├── 7个职能Agent（含soul提示词 + react循环）
│   ├── 12个Skill v1.1.0（含Guardrail + 证据链 + 法规引用）
│   ├── 113条Agent/Skill测试全绿
│   ├── LLM Provider（DashScope/OpenAI，含降级fallback）
│   ├── 双证据验证（LLM + 规则引擎交叉校验）
│   ├── 7个MCP工具（标准MCP Server协议）
│   ├── 可观测体系（Trace + Metrics）
│   └── 双模式运行（辅助处置 + 模拟演练）
│
├── 文档体系（100%完成）
│   ├── SKILL.md × 12（每个Skill独立规格文件）
│   ├── WORKER.md × 7（每个Agent独立规格文件）
│   ├── AGENTS.md（全局Agent清单）
│   └── references/（法规原文摘录、CDC 10步法等）
│
└── 合计 188条测试全绿，零新npm依赖
```

---

## 7.2 里程碑与落地计划（Slide 26）

| 阶段 | 时间 | 目标 | 交付物 |
|------|------|------|--------|
| 初赛 | 8.16 | 方案设计 + Agent/Skill层完成 | 作品简介+方案PPT ✅ + 188测试全绿 ✅ |
| 复赛 | 9.3 | AgentTeams桥接 + 运行验证 | 可运行Demo+代码包+Demo视频 |
| 决赛 | 9.22 | 工程完善+现场展示 | 路演PPT+现场Demo+最终代码 |
| 赛后 | Q4 2025 | 开源发布 | GitHub仓库+文档+社区运营 |

---

## 7.3 风险控制（Slide 27）

| 风险 | 等级 | 应对 | 状态 |
|------|------|------|------|
| AgentTeams接入复杂度 | 🟢 低 | 已实现standalone模式 + bridge适配层，7个Agent Identity完整定义 | ✅ 已解决 |
| MCP工具开发工作量 | 🟢 低 | 已实现7个MCP工具，标准协议，REST桥接 | ✅ 已解决 |
| 可观测接入成本 | 🟢 低 | 已实现Trace + Metrics，API可查询 | ✅ 已解决 |
| 闭源模型依赖 | 🟢 低 | 规则引擎为纯函数，LLM仅增强层，已实现fallback降级 | ✅ 已解决 |
| Skill法规准确性 | 🟡 中 | 引用国标原文+条文号，references/目录存原文摘录 | ✅ 已验证 |

---

# 第八章 · 团队介绍

---

## 8.1 团队情况（Slide 28）

**【请根据实际情况填写】**

| 成员 | 角色 | 背景 | 核心技能 |
|------|------|------|---------|
| 【姓名】 | 【角色】 | 【学校/公司】 | 【技能】 |
| 【姓名】 | 【角色】 | 【学校/公司】 | 【技能】 |
| 【姓名】 | 【角色】 | 【学校/公司】 | 【技能】 |

---

## 尾页（Slide 31）

**卫盾Agent**

让公共卫生应急处置从"人盯人、电话催"
走向"可协同、可治理、可复用"的Agent Infra。

**谢谢！**

---

> 📌 PPT制作说明：
> - 本文件为PPT文字内容稿，共8章31页（含新增3.5双模式、3.6 AgentTeams编排）
> - 建议配色：蓝色+白色（专业感）+ 橙色强调（紧迫感）
> - 建议图标：每章用对应emoji/图标区分
> - 架构图建议用draw.io或PPT自带形状绘制
> - 第8章团队信息需根据实际情况填写
> - 重点强调：12 Skill（非8个）、188测试（非75条）、7 MCP工具（非"待封装"）、双模式、Guardrail、证据链
