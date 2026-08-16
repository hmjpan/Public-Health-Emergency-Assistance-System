// AgentTeams 适配层
// 将 7 个 Agent 映射为 AgentTeams 的 Worker 配置
// 支持 standalone（独立运行）和 bridge（接入 AgentTeams 框架）模式
const { listAgents, registry } = require('../index');
const fs = require('fs');
const path = require('path');

/**
 * 生成 AgentTeams Worker 配置（YAML 格式字符串）
 * 遵循 AgentTeams 的 WORKER.md 规范
 */
function generateWorkerConfig() {
  const agents = listAgents();
  const skills = registry.list();

  let yaml = `# AgentTeams Worker 配置\n# 自动生成于 ${new Date().toISOString()}\n\n`;

  for (const agent of agents) {
    yaml += `## Agent: ${agent.name} (${agent.id})\n`;
    yaml += `# 角色: ${agent.role}\n`;
    yaml += `# Skills: ${agent.skills.join(', ')}\n`;
    yaml += `# Soul:\n`;
    yaml += `# ${agent.soul.split('\n').join('\n# ')}\n\n`;
  }

  yaml += `\n## Skills 清单\n`;
  for (const skill of skills) {
    yaml += `\n### Skill: ${skill.name}\n`;
    yaml += `# 版本: ${skill.version}\n`;
    yaml += `# 确定性等级: ${skill.detLevel}\n`;
    yaml += `# 描述: ${skill.description}\n`;
    yaml += `# 使用Agent: ${skill.agent || '共享'}\n`;
    yaml += `# 输入: ${JSON.stringify(skill.inputSchema)}\n`;
    yaml += `# 输出: ${JSON.stringify(skill.outputSchema)}\n`;
  }

  return yaml;
}

/**
 * 生成 SKILL.md 文件（每个 Skill 一个）
 * 遵循 AgentTeams 的 SKILL.md 规范
 */
function generateSkillMarkdown() {
  const skills = registry.list();
  const docs = {};

  for (const skill of skills) {
    let md = `# ${skill.name}\n\n`;
    md += `- **版本**: ${skill.version}\n`;
    md += `- **确定性等级**: ${skill.detLevel}\n`;
    md += `- **使用 Agent**: ${skill.agent || '共享'}\n\n`;
    md += `## 描述\n${skill.description}\n\n`;
    md += `## 输入参数\n\`\`\`json\n${JSON.stringify(skill.inputSchema, null, 2)}\n\`\`\`\n\n`;
    md += `## 输出结果\n\`\`\`json\n${JSON.stringify(skill.outputSchema, null, 2)}\n\`\`\`\n\n`;
    md += `## 失败处理\n`;
    if (skill.detLevel === 'D0' || skill.detLevel === 'D1') {
      md += `- 输入校验失败 → 返回具体错误信息\n`;
      md += `- 规则未覆盖 → 返回 noMatch + 转人工提示\n`;
    } else {
      md += `- LLM 不可用 → 降级为模板化回复\n`;
      md += `- 输出解析失败 → 使用规则引擎 fallback\n`;
    }
    md += `\n## 安全边界\n`;
    if (skill.detLevel.startsWith('D0') || skill.detLevel === 'D1') {
      md += `- 纯函数，无副作用\n- 结果仅建议，最终决策由人确认\n`;
    } else {
      md += `- LLM 生成内容需人工审核\n- 高风险动作（发布/定级）保留人工确认\n`;
    }
    docs[skill.name] = md;
  }
  return docs;
}

/**
 * 导出 AgentTeams 配置到目录
 */
function exportToDir(dir) {
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    // 写 Worker 配置
    fs.writeFileSync(path.join(dir, 'WORKERS.yaml'), generateWorkerConfig(), 'utf8');
    // 写 SKILL.md
    const skillDocs = generateSkillMarkdown();
    const skillsDir = path.join(dir, 'skills');
    if (!fs.existsSync(skillsDir)) fs.mkdirSync(skillsDir, { recursive: true });
    for (const [name, md] of Object.entries(skillDocs)) {
      fs.writeFileSync(path.join(skillsDir, `${name}.md`), md, 'utf8');
    }
    return { ok: true, dir, files: Object.keys(skillDocs).length + 1 };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

module.exports = { generateWorkerConfig, generateSkillMarkdown, exportToDir };
