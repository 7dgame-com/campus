export default {
  pluginMeta: {
    name: 'Campus Management',
    description: 'Unified entry for schools, classes, student accounts, and teaching tools',
    groupName: 'Education',
  },
  common: {
    loading: 'Loading...',
    confirm: 'Confirm',
    cancel: 'Cancel',
    actions: 'Actions',
    status: 'Status',
  },
  nav: {
    dashboard: 'Overview',
    schools: 'Schools',
    classes: 'Classes',
    students: 'Students',
    tools: 'Teaching Tools',
    apiDiagnostics: 'API Diagnostics',
  },
  dashboard: {
    eyebrow: 'Campus Scenario',
    title: 'Campus Management Tool',
    description: 'A school-facing management path built on existing organization, user, group, and plugin authorization capabilities.',
    currentRole: 'Current Role',
    workflowTitle: 'Typical Workflow',
    mappingTitle: 'Campus Object Mapping',
  },
  handshake: {
    notInIframe: 'Not running in iframe',
    notInIframeDesc: 'This plugin must run inside the main platform to complete handshake authorization.',
    pageLoaded: 'Page loaded',
    pluginReady: 'Sent PLUGIN_READY',
    waitingInit: 'Waiting for INIT',
    connecting: 'Connecting to host...',
    goToDiagnostics: 'Go to API diagnostics',
  },
  permission: {
    noPermission: 'Campus management requires a root, admin, or manager role',
  },
}
