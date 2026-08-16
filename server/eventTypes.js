// 事件类型包 —— 各类突发公共卫生事件的差异化配置（即"留接口"的扩展点）
// 新增事件类型 = 在此新增一个类型包对象，引擎无需改动
// 每个类型包含：通知组匹配、标准物资包、任务包模板、表单集、启动/现场完成标准

const EVENT_TYPES = {
  INF: {
    typeKey: 'INF',
    name: '传染病疫情',
    icon: '🦠',
    sceneHint: '社区/学校/医院/口岸',
    // 启动时通知的小组
    notifyGroups: ['流调组', '采样组', '消杀组', '管控组', '检验组', '医疗救治组', '物资保障组', '车辆保障组'],
    // 首批任务摘要（通知时下发）
    firstTaskSummary: '核实病例、划定疫点、启动流调与密接排查、准备采样与消杀',
    // 标准物资包
    materialPacks: [
      { pack: '个人防护包', items: [{ name: 'N95口罩', qty: 200 }, { name: '防护服', qty: 100 }, { name: '护目镜', qty: 50 }, { name: '手套', qty: 400 }] },
      { pack: '采样检测包', items: [{ name: '咽拭子', qty: 300 }, { name: '采样管', qty: 300 }, { name: '冷链箱', qty: 10 }] },
      { pack: '消杀处置包', items: [{ name: '含氯消毒剂', qty: 50 }, { name: '喷雾器', qty: 20 }] }
    ],
    // 任务包模板（现场指挥激活后分发）
    taskPacks: [
      { group: '流调组', title: '个案流行病学调查', steps: ['核对病例信息', '开展个案调查', '填写个案调查表', '排查活动轨迹'], formKeys: ['case_invest'], slaHours: 12 },
      { group: '流调组', title: '密接排查判定', steps: ['梳理接触史', '判定密接/次密接', '登记造册'], formKeys: ['contact_trace'], slaHours: 12 },
      { group: '采样组', title: '标本采集送检', steps: ['按名单采样', '规范封装', '填写送检单', '冷链送检'], formKeys: ['sample_send'], slaHours: 8 },
      { group: '消杀组', title: '疫点终末消杀', steps: ['划定消杀范围', '配制消毒液', '实施消杀', '记录消杀面积'], formKeys: ['disinfect_log'], slaHours: 12 },
      { group: '管控组', title: '风险点位管控', steps: ['现场封控', '设置警戒', '人员登记', '落实管控措施'], formKeys: ['site_control'], slaHours: 6 }
    ],
    // 表单集
    forms: [
      { key: 'case_invest', name: '病例个案调查表', fields: ['姓名', '年龄', '住址', '发病日期', '症状', '活动轨迹', '接触史'] },
      { key: 'contact_trace', name: '密接排查登记表', fields: ['姓名', '与病例关系', '接触日期', '接触方式', '管控措施'] },
      { key: 'sample_send', name: '采样送检单', fields: ['样本编号', '采样对象', '样本类型', '采样时间', '送检单位'] },
      { key: 'disinfect_log', name: '消杀记录单', fields: ['消杀地点', '药剂', '浓度', '面积', '操作人'] },
      { key: 'site_control', name: '疫点管控记录', fields: ['点位', '管控措施', '管控人数', '责任人'] }
    ],
    // 启动阶段完成标准
    launchCriteria: ['关键小组均已出发或抵达', '标准物资包均已装车', '保障车辆均已到位'],
    // 现场处置完成标准
    fieldCriteria: ['核心流调完成率100%', '密接排查完成率100%', '应采样本采集送检完毕', '疫点消杀完成并记录', '风险点位管控落实', '全部表单简报影像已回传归档'],
    // 医疗救治差异化配置（M08）
    medical: {
      needContactTrace: true,
      isolationTypes: ['home', 'centralized', 'hospital'],
      keyMedicines: ['抗病毒口服液', '退烧药', '抗生素', '补液盐'],
      keyDevices: ['呼吸机', '监护仪', '指氧仪', '负压救护车'],
      severityHint: '按体温/氧合/影像分级'
    }
  },

  FOOD: {
    typeKey: 'FOOD',
    name: '食源性疾病/食物中毒',
    icon: '🍱',
    sceneHint: '食堂/宴席/餐饮单位/外卖',
    notifyGroups: ['流调组', '采样组', '检验组', '管控组', '医疗救治组', '物资保障组', '车辆保障组'],
    firstTaskSummary: '核实发病与共同就餐史、封存可疑食品留样、启动食品溯源、救治患者',
    materialPacks: [
      { pack: '个人防护包', items: [{ name: '一次性手套', qty: 200 }, { name: '口罩', qty: 200 }] },
      { pack: '采样检测包', items: [{ name: '食品采样袋', qty: 100 }, { name: '肛拭子', qty: 200 }, { name: '冷链箱', qty: 8 }] },
      { pack: '调查取证包', items: [{ name: '封条', qty: 50 }, { name: '取证相机', qty: 4 }] }
    ],
    taskPacks: [
      { group: '流调组', title: '共同暴露餐次调查', steps: ['核实就餐史', '锁定可疑餐次', '绘制发病曲线'], formKeys: ['case_invest', 'meal_expose'], slaHours: 8 },
      { group: '采样组', title: '留样食品与环境采样', steps: ['封存留样', '采集食品/环境/生物样本', '填写送检单'], formKeys: ['sample_send'], slaHours: 12 },
      { group: '检验组', title: '病原/毒素检测', steps: ['接收样本', '病原学检测', '出具报告'], formKeys: ['lab_report'], slaHours: 24 },
      { group: '管控组', title: '涉事单位停业管控', steps: ['现场封存', '责令停业', '监督整改'], formKeys: ['site_control'], slaHours: 6 },
      { group: '医疗救治组', title: '患者救治与病例管理', steps: ['分流救治', '登记病例', '随访转归'], formKeys: ['case_invest'], slaHours: 24 }
    ],
    forms: [
      { key: 'case_invest', name: '病例个案调查表', fields: ['姓名', '年龄', '发病时间', '症状', '就餐史', '就诊情况'] },
      { key: 'meal_expose', name: '共同暴露餐次登记表', fields: ['餐次时间', '就餐地点', '食物品种', '就餐人数', '发病人数'] },
      { key: 'sample_send', name: '采样送检单', fields: ['样本编号', '样本类型', '采样时间', '送检单位'] },
      { key: 'lab_report', name: '检验报告单', fields: ['样本编号', '检测项目', '检测结果', '判定'] },
      { key: 'site_control', name: '涉事单位管控记录', fields: ['单位', '封存物品', '处置措施', '责任人'] }
    ],
    launchCriteria: ['关键小组均已出发或抵达', '标准物资包均已装车', '保障车辆均已到位'],
    fieldCriteria: ['可疑餐次与食品溯源完成', '留样及样本采集送检完毕', '涉事单位管控落实', '患者妥善救治', '全部表单已回传归档'],
    medical: {
      needContactTrace: false,
      isolationTypes: ['hospital', 'none'],
      keyMedicines: ['补液盐', '止泻药', '抗生素', '电解质'],
      keyDevices: ['监护仪', '输液泵'],
      severityHint: '按脱水程度/电解质紊乱分级'
    }
  },

  ENV: {
    typeKey: 'ENV',
    name: '环境/化学污染健康事件',
    icon: '☣️',
    sceneHint: '工业园区/水源/空气污染点',
    notifyGroups: ['流调组', '采样组', '检验组', '管控组', '医疗救治组', '消杀组', '物资保障组', '车辆保障组'],
    firstTaskSummary: '定位并封控污染源、开展环境介质采样、暴露人群健康监护、必要时疏散',
    materialPacks: [
      { pack: '个人防护包', items: [{ name: '防化服', qty: 50 }, { name: '防毒面具', qty: 50 }, { name: '气体检测仪', qty: 6 }] },
      { pack: '环境采样包', items: [{ name: '空气采样器', qty: 6 }, { name: '水样瓶', qty: 50 }, { name: '土壤采样器', qty: 10 }] },
      { pack: '医疗救治包', items: [{ name: '急救箱', qty: 10 }, { name: '洗消用品', qty: 30 }] }
    ],
    taskPacks: [
      { group: '管控组', title: '污染源定位封控', steps: ['定位污染源', '设置警戒区', '阻断扩散'], formKeys: ['site_control'], slaHours: 2 },
      { group: '采样组', title: '环境介质采样', steps: ['空气/水/土壤采样', '规范保存', '填写送检单'], formKeys: ['env_sample'], slaHours: 8 },
      { group: '检验组', title: '污染物检测分析', steps: ['样本前处理', '定性定量分析', '出具报告'], formKeys: ['lab_report'], slaHours: 24 },
      { group: '医疗救治组', title: '暴露人群健康监护', steps: ['暴露者摸底登记', '健康检查', '对症救治', '随访监测'], formKeys: ['expose_monitor'], slaHours: 24 },
      { group: '流调组', title: '暴露范围与人群调查', steps: ['判定暴露边界', '人群摸底', '建立台账'], formKeys: ['case_invest'], slaHours: 12 }
    ],
    forms: [
      { key: 'case_invest', name: '暴露人员登记表', fields: ['姓名', '住址', '暴露时间', '暴露途径', '症状'] },
      { key: 'env_sample', name: '环境采样送检单', fields: ['点位', '介质类型', '采样时间', '检测项目'] },
      { key: 'lab_report', name: '检验报告单', fields: ['样本编号', '检测项目', '检测结果', '判定'] },
      { key: 'expose_monitor', name: '暴露人群健康监测表', fields: ['姓名', '暴露剂量', '症状', '检查结果', '处置'] },
      { key: 'site_control', name: '污染源管控记录', fields: ['源点', '封控措施', '洗消情况', '责任人'] }
    ],
    launchCriteria: ['关键小组均已出发或抵达', '标准物资包均已装车', '保障车辆均已到位'],
    fieldCriteria: ['污染源封控到位', '环境采样送检完毕', '暴露人群摸底并监护', '洗消阻断措施落实', '全部表单已回传归档'],
    medical: {
      needContactTrace: false,
      isolationTypes: ['none'],
      healthMonitor: true,
      keyMedicines: ['解毒剂', '活性炭', '补液盐'],
      keyDevices: ['监护仪', '洗消设备', '气体检测仪'],
      severityHint: '按暴露剂量与临床症状分级'
    }
  },

  POISON: {
    typeKey: 'POISON',
    name: '急性职业中毒',
    icon: '⚗️',
    sceneHint: '工厂/车间/有限空间作业',
    notifyGroups: ['流调组', '检验组', '管控组', '医疗救治组', '物资保障组', '车辆保障组'],
    firstTaskSummary: '现场救援与通风、中毒人员救治、危害因素检测、作业场所管控',
    materialPacks: [
      { pack: '个人防护包', items: [{ name: '防毒面具', qty: 30 }, { name: '防化服', qty: 30 }, { name: '气体检测仪', qty: 4 }] },
      { pack: '医疗救治包', items: [{ name: '急救箱', qty: 8 }, { name: '氧气袋', qty: 10 }] },
      { pack: '检测采样包', items: [{ name: '空气采样器', qty: 4 }, { name: '生物样本采集器', qty: 20 }] }
    ],
    taskPacks: [
      { group: '医疗救治组', title: '中毒人员紧急救治', steps: ['脱离接触', '现场急救', '转运救治', '登记病例'], formKeys: ['case_invest'], slaHours: 2 },
      { group: '管控组', title: '作业场所管控', steps: ['停止作业', '通风排毒', '现场警戒'], formKeys: ['site_control'], slaHours: 2 },
      { group: '检验组', title: '危害因素检测', steps: ['现场快速检测', '样本采集', '实验室分析'], formKeys: ['lab_report'], slaHours: 12 },
      { group: '流调组', title: '中毒原因调查', steps: ['工艺与防护调查', '接触史核实', '原因分析'], formKeys: ['case_invest'], slaHours: 24 }
    ],
    forms: [
      { key: 'case_invest', name: '中毒病例调查表', fields: ['姓名', '工种', '接触毒物', '接触时间', '症状', '救治情况'] },
      { key: 'lab_report', name: '检测报告单', fields: ['检测点', '危害因素', '检测结果', '限值比对'] },
      { key: 'site_control', name: '场所管控记录', fields: ['场所', '管控措施', '整改要求', '责任人'] }
    ],
    launchCriteria: ['关键小组均已出发或抵达', '标准物资包均已装车', '保障车辆均已到位'],
    fieldCriteria: ['中毒人员妥善救治', '危害因素检测完成', '作业场所管控落实', '中毒原因查明', '全部表单已回传归档'],
    medical: {
      needContactTrace: false,
      isolationTypes: ['hospital', 'none'],
      keyMedicines: ['特效解毒剂', '氧气', '补液盐'],
      keyDevices: ['呼吸机', '监护仪', '氧气瓶'],
      severityHint: '按中毒程度分级'
    }
  },

  UNK: {
    typeKey: 'UNK',
    name: '原因不明群体性疾病',
    icon: '❓',
    sceneHint: '多点散发/病因待查',
    notifyGroups: ['流调组', '采样组', '检验组', '管控组', '医疗救治组', '专家组', '物资保障组', '车辆保障组'],
    firstTaskSummary: '统一病例定义、多路径并行排查、边调查边控制、多学科会商',
    materialPacks: [
      { pack: '个人防护包', items: [{ name: 'N95口罩', qty: 200 }, { name: '防护服', qty: 80 }, { name: '手套', qty: 300 }] },
      { pack: '综合采样包', items: [{ name: '采样管', qty: 200 }, { name: '环境采样器', qty: 6 }, { name: '食品采样袋', qty: 50 }, { name: '冷链箱', qty: 8 }] }
    ],
    taskPacks: [
      { group: '专家组', title: '统一病例定义与会商', steps: ['制定病例定义', '多学科会商', '明确排查方向'], formKeys: ['case_define'], slaHours: 6 },
      { group: '流调组', title: '多路径并行排查', steps: ['感染路径排查', '食源路径排查', '环境/中毒路径排查'], formKeys: ['case_invest'], slaHours: 24 },
      { group: '采样组', title: '多样本采集', steps: ['生物样本', '环境样本', '食品样本', '规范送检'], formKeys: ['sample_send'], slaHours: 12 },
      { group: '检验组', title: '多项目检测', steps: ['病原学检测', '毒物筛查', '结果研判'], formKeys: ['lab_report'], slaHours: 24 },
      { group: '管控组', title: '临时管控措施', steps: ['按最大风险原则', '实施临时管控', '动态调整'], formKeys: ['site_control'], slaHours: 12 }
    ],
    forms: [
      { key: 'case_define', name: '病例定义与会商记录', fields: ['病例定义', '会商专家', '排查方向', '结论'] },
      { key: 'case_invest', name: '病例个案调查表', fields: ['姓名', '发病时间', '症状', '暴露史', '初步判断'] },
      { key: 'sample_send', name: '采样送检单', fields: ['样本编号', '样本类型', '采样时间', '检测方向'] },
      { key: 'lab_report', name: '检验报告单', fields: ['样本编号', '检测项目', '检测结果', '提示'] },
      { key: 'site_control', name: '临时管控记录', fields: ['范围', '措施', '依据', '责任人'] }
    ],
    launchCriteria: ['关键小组均已出发或抵达', '标准物资包均已装车', '保障车辆均已到位'],
    fieldCriteria: ['病例定义统一', '多路径排查完成', '样本采集送检完毕', '病因线索收敛', '全部表单已回传归档'],
    medical: {
      needContactTrace: true,
      isolationTypes: ['home', 'centralized', 'hospital'],
      keyMedicines: ['对症治疗药品', '补液盐', '抗生素'],
      keyDevices: ['监护仪', '呼吸机'],
      severityHint: '按最大风险原则分级'
    }
  }
};

// 兜底（未知类型）
const DEFAULT_TYPE = EVENT_TYPES.INF;

function normalize(v) { return String(v || '').trim(); }

// 按输入解析事件类型包；strict=true 时无匹配返回 null（供双证据"无证据"分支使用）
function resolveEventType(input = {}, strict = false) {
  const typeKey = normalize(input.typeKey);
  if (typeKey && EVENT_TYPES[typeKey]) return EVENT_TYPES[typeKey];
  const t = normalize(input.type) + normalize(input.disease) + normalize(input.title) + normalize(input.rawText);
  // 1. 强传染病信号（法定传染病命名优先，避免被场所/症状词误判）
  if (/诺如|流感|新冠|霍乱|鼠疫|禽流感|麻疹|手足口|水痘|登革|疟疾|腮腺炎|风疹|结核|炭疽|乙肝|丙肝|艾滋|狂犬|感染性腹泻疫情/.test(t)) return EVENT_TYPES.INF;
  // 2. 食源信号（食堂/餐饮场所 + 典型食源症状）
  if (/食源|食物中毒|食品安全|聚餐|宴席|食堂|外卖|餐饮|就餐史|同餐|午餐后|晚餐后|早餐后|呕吐腹泻|腹泻呕吐|恶心呕吐/.test(t)) return EVENT_TYPES.FOOD;
  // 3. 环境/化学污染
  if (/化学|污染|环境|毒气|泄漏|辐射|异味/.test(t)) return EVENT_TYPES.ENV;
  // 4. 职业中毒
  if (/职业中毒|有限空间|农药中毒|气体中毒|中毒事件/.test(t)) return EVENT_TYPES.POISON;
  // 5. 原因不明（"聚集性"非疫情语境归此处，交由人工/LLM复核）
  if (/不明|待查|群体性|聚集性(?!疫情)/.test(t) && !/传染病/.test(t)) return EVENT_TYPES.UNK;
  // 6. 一般传染病/疫情表述
  if (/传染病|疫情|病毒|发热|咳嗽|聚集性疫情/.test(t)) return EVENT_TYPES.INF;
  if (strict) return null;
  return DEFAULT_TYPE;
}

function listEventTypes() {
  return Object.values(EVENT_TYPES).map(t => ({
    typeKey: t.typeKey, name: t.name, icon: t.icon, sceneHint: t.sceneHint,
    notifyGroups: t.notifyGroups, firstTaskSummary: t.firstTaskSummary,
    launchCriteria: t.launchCriteria, fieldCriteria: t.fieldCriteria
  }));
}

module.exports = { EVENT_TYPES, DEFAULT_TYPE, resolveEventType, listEventTypes };
