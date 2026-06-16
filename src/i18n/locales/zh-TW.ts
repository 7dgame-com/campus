export default {
  pluginMeta: {
    name: '校園管理',
    description: '整合學校、班級、學生帳號和教學工具入口',
    groupName: '教學管理',
  },
  common: {
    loading: '載入中...',
    confirm: '確認',
    cancel: '取消',
    actions: '操作',
    status: '狀態',
  },
  nav: {
    dashboard: '總覽',
    schools: '學校',
    classes: '班級',
    students: '學生',
    tools: '教學工具',
    apiDiagnostics: 'API 診斷',
  },
  dashboard: {
    eyebrow: '校園場景方案',
    title: '校園管理工具',
    description: '以既有基礎外掛能力為底座，將組織、使用者、小組和外掛授權轉換為學校可理解、可審閱、可落地的管理路徑。',
    currentRole: '目前身分',
    workflowTitle: '典型使用流程',
    mappingTitle: '校園物件映射',
  },
  handshake: {
    notInIframe: '未在 iframe 中執行',
    notInIframeDesc: '此插件需要嵌入主系統中使用，直接訪問無法完成握手授權。',
    pageLoaded: '頁面載入完成',
    pluginReady: '傳送 PLUGIN_READY',
    waitingInit: '等待 INIT — 無父視窗，永不到達',
    connecting: '正在與主系統握手…',
    goToDiagnostics: '前往 API 診斷頁面 →',
  },
  permission: {
    noPermission: '您沒有校園管理權限，請聯絡管理員配置 root、admin 或 manager 角色',
  },
}
