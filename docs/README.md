# 校园管理插件说明

本插件是平台已有能力的校园语义聚合层，不新建后台服务。

## 接入模型

- iframe 插件标准握手：`PLUGIN_READY -> INIT`
- 会话校验：`GET /api/v1/plugin/verify-token`
- 业务接口：统一走 `/api/*` 反向代理到主后端
- 权限：本地根据 `verify-token` 返回角色判断页面入口
- 宿主入口：`accessScope` 使用 `auth-only`，插件内部只允许 `root`、`admin`、`manager` 使用

## 页面

- 管理员（`root`）：总览、学校、班级、学生账号、教学工具和全局插件注册入口
- 学校管理（`admin`）：总览、学校、班级、学生账号和教学工具
- 老师（`manager`）：总览、班级、学生查看和教学工具
- 学生（`user`）：不进入校园管理插件，学习内容从课程工具入口进入

## 对象映射

- 学校：`Organization`
- 班级：`Group`
- 学生/老师：`User`
- 教学工具：已有插件入口与 `system-admin` 插件注册管理

## 部署

生产环境建议通过 `system-admin` 动态注册插件，不要求宿主 Docker 镜像新增 campus 专用环境变量。
