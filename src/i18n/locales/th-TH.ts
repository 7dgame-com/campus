export default {
  pluginMeta: {
    name: 'การจัดการโรงเรียน',
    description: 'ศูนย์รวมโรงเรียน ชั้นเรียน บัญชีนักเรียน และเครื่องมือสอน',
    groupName: 'การศึกษา',
  },
  common: {
    loading: 'กำลังโหลด...',
    confirm: 'ยืนยัน',
    cancel: 'ยกเลิก',
    actions: 'การทำงาน',
    status: 'สถานะ',
  },
  nav: {
    dashboard: 'ภาพรวม',
    schools: 'โรงเรียน',
    classes: 'ชั้นเรียน',
    students: 'นักเรียน',
    tools: 'เครื่องมือสอน',
    apiDiagnostics: 'ตรวจ API',
  },
  dashboard: {
    eyebrow: 'สถานการณ์โรงเรียน',
    title: 'เครื่องมือจัดการโรงเรียน',
    description: 'รวมความสามารถองค์กร ผู้ใช้ กลุ่ม และสิทธิ์ปลั๊กอินเดิมให้เป็นเส้นทางจัดการสำหรับโรงเรียน',
    currentRole: 'บทบาทปัจจุบัน',
    workflowTitle: 'ขั้นตอนใช้งาน',
    mappingTitle: 'การจับคู่วัตถุโรงเรียน',
  },
  handshake: {
    notInIframe: 'ไม่ได้ทำงานใน iframe',
    notInIframeDesc: 'ปลั๊กอินนี้ต้องทำงานในระบบหลักเพื่อยืนยันสิทธิ์',
    pageLoaded: 'โหลดหน้าแล้ว',
    pluginReady: 'ส่ง PLUGIN_READY แล้ว',
    waitingInit: 'รอ INIT',
    connecting: 'กำลังเชื่อมต่อกับระบบหลัก...',
    goToDiagnostics: 'ไปที่หน้าตรวจ API',
  },
  permission: {
    noPermission: 'การจัดการโรงเรียนต้องใช้บทบาท root, admin หรือ manager',
  },
}
