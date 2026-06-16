export default {
  pluginMeta: {
    name: '校园管理',
    description: '整合学校、班级、学生账号和教学工具入口',
    groupName: '教学管理',
  },
  common: {
    loading: '加载中...',
    confirm: '确认',
    cancel: '取消',
    actions: '操作',
    status: '状态',
  },
  nav: {
    dashboard: '总览',
    schools: '学校',
    classes: '班级',
    students: '学生',
    tools: '教学工具',
    apiDiagnostics: 'API 诊断',
  },
  dashboard: {
    eyebrow: '校园场景方案',
    title: '校园管理工具',
    description: '以现有基础插件能力为底座，将组织、用户、小组和插件授权转换为学校可理解、可审阅、可落地的管理路径。',
    currentRole: '当前身份',
    workflowTitle: '典型使用流程',
    mappingTitle: '校园对象映射',
  },
  handshake: {
    notInIframe: '未在 iframe 中运行',
    notInIframeDesc: '此插件需要嵌入主系统中使用，直接访问无法完成握手授权。',
    pageLoaded: '页面加载完成',
    pluginReady: '发送 PLUGIN_READY',
    waitingInit: '等待 INIT — 无父窗口，永不到达',
    connecting: '正在与主系统握手…',
    goToDiagnostics: '前往 API 诊断页面 →',
  },
  permission: {
    noPermission: '您没有校园管理权限，请联系管理员配置 root、admin 或 manager 角色',
  },
}
