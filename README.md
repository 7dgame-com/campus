# 校园管理插件

校园管理插件是 AR创作平台校园场景的聚合入口。它不新增独立后端，不引入新的数据库或运行时环境变量，只通过插件域名下的 `/api/*` 反向代理复用主后端已有能力。

## 功能边界

- 学校：复用 `Organization`，用于账号、菜单和工具开放范围。
- 班级与小组：复用 `Group`，用于班级、课程组或项目组协作。
- 人员身份：复用 `User` 与现有角色体系，`root` 为管理员，`admin` 为学校管理，`manager` 为老师，`user` 为学生。
- 教学工具：只聚合已有插件入口，工具启停、地址、版本和菜单可见性仍由 `system-admin` 管理。

## 角色界面

- 管理员（`root`）：总览、学校、班级、学生账号、教学工具和全局插件注册入口。
- 学校管理（`admin`）：总览、学校、班级、学生账号和教学工具。
- 老师（`manager`）：总览、班级、学生查看和教学工具。
- 学生（`user`）：不进入校园管理插件，学习内容从课程工具入口进入。

## 本地开发

```bash
corepack pnpm install
corepack pnpm run dev
```

默认开发地址为 `http://localhost:3006`，主后端代理为 `http://localhost:8081`。宿主本地调试入口在 `web/public/config/plugins.json` 中注册。

## 关键约束

- 不依赖 `/api-config`。
- 不新增 campus 专用后端。
- 不直接修改其他插件的业务实现。
- 需要完整用户管理能力时，通过宿主导航进入 `user-management`。
- 需要插件注册管理时，通过宿主导航进入 `system-admin`。

## 组织登录流水

从具体组织进入校园管理，在“账号”之后打开“登录流水”（`/login-records`）。老师、组织管理员和 root 可查看；公共插件入口不提供全平台流水。

- 展示当前组织所有账号的历史成功登录，支持北京时间日期范围、用户名/姓名及当前最高身份筛选，默认最近 7 天、每页 20 条。
- 账号移出组织后，其记录不再出现在该组织；加入组织后，可查看该账号已采集的历史记录。该记录表示登录平台，不代表进入组织页面或在线时长。
- 使用 identity-service 的 `GET /v1/plugin-user/login-events`，经 `/api-auth` 代理访问。需启用 `IDENTITY_PLUGIN_USER_READONLY_ENABLED` 和 `IDENTITY_LOGIN_AUDIT_ENABLED`，并配置 Legacy、Identity 数据库及一致的组织 shadow 成员关系。
- 后台必须先支持新接口再更新插件；功能关闭、组织校验失败或接口不可用会展示错误，不会回退到全平台或显示为零条记录。

## 验证

```bash
./node_modules/.bin/vue-tsc -b
./node_modules/.bin/vite build
./node_modules/.bin/vitest --run
```

## CI 与发布

仓库使用 SSH-over-443：

```bash
git remote set-url origin ssh://git@ssh.github.com:443/7dgame-com/campus.git
```

推送 `develop`、`main`、`publish` 会触发 CI；同时 Docker workflow 会构建并推送镜像到 `hkccr.ccs.tencentyun.com/plugins/campus`：

- `develop` 分支生成 `develop` 标签。
- `main` 分支生成 `main` 标签。
- `publish` 分支生成 `publish` 和 `latest` 标签。

仓库需要配置 secrets：

- `TENCENT_REGISTRY_USER`
- `TENCENT_REGISTRY_PASSWORD`
