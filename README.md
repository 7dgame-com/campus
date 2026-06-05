# 校园管理插件

校园管理插件是夏鼎平台校园场景的聚合入口。它不新增独立后端，不引入新的数据库或运行时环境变量，只通过插件域名下的 `/api/*` 反向代理复用主后端已有能力。

## 功能边界

- 学校：复用 `Organization`，用于账号、菜单和工具开放范围。
- 班级与小组：复用 `Group`，用于班级、课程组或项目组协作。
- 人员身份：复用 `User` 与现有角色体系，`root` 为管理员，`admin` 为学校管理，`manager` 为老师，`user` 为学生。
- 教学工具：只聚合已有插件入口，工具启停、地址、版本和菜单可见性仍由 `system-admin` 管理。

## 角色界面

- 管理员（`root`）：总览、学校、班级、学生账号、教学工具和全局插件注册入口。
- 学校管理（`admin`）：总览、学校、班级、学生账号和教学工具。
- 老师（`manager`）：总览、班级、学生查看和教学工具。
- 学生（`user`）：总览和教学工具。

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
