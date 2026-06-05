export default {
  pluginMeta: {
    name: 'キャンパス管理',
    description: '学校、クラス、学生アカウント、教材ツールを統合する入口',
    groupName: '教育管理',
  },
  common: {
    loading: '読み込み中...',
    confirm: '確認',
    cancel: 'キャンセル',
    actions: '操作',
    status: '状態',
  },
  nav: {
    dashboard: '概要',
    schools: '学校',
    classes: 'クラス',
    students: '学生',
    tools: '教材ツール',
    apiDiagnostics: 'API診断',
  },
  dashboard: {
    eyebrow: 'キャンパスシナリオ',
    title: 'キャンパス管理ツール',
    description: '既存の組織、ユーザー、グループ、プラグイン権限を学校向けの管理導線にまとめます。',
    currentRole: '現在のロール',
    workflowTitle: '標準フロー',
    mappingTitle: 'キャンパスオブジェクト対応',
  },
  handshake: {
    notInIframe: 'iframe 内で実行されていません',
    notInIframeDesc: 'このプラグインはメインシステム内で実行する必要があります。',
    pageLoaded: 'ページ読み込み完了',
    pluginReady: 'PLUGIN_READY 送信済み',
    waitingInit: 'INIT 待機中',
    connecting: 'ホストに接続中...',
    goToDiagnostics: 'API診断へ',
  },
  permission: {
    noPermission: 'キャンパス管理には root、admin、manager、user のいずれかのロールが必要です',
  },
}
