# 二次开发说明（后台 / 筛选 / 协作 / 摄影集）

本仓库基于 [Afilmory](https://github.com/Afilmory/afilmory) 二次开发，新增了内置后台、照片筛选、登录与角色权限、统一附件库、个人/团队协作模式，以及摄影集与分类管理。

> 这是一套面向本仓库演示与自托管的轻量实现：账号、会话与后台配置全部保存在仓库内的 SQLite 数据库 `content/afilmory.db`，照片只写本地 `photos/` 目录，不依赖独立后端服务；官方 Hono/PostgreSQL 后端已从本仓库移除。

## 启动

在仓库根目录执行：

```bash
pnpm install --ignore-scripts
cp config.example.json config.json
cp builder.config.default.ts builder.config.ts
```

`builder.config.ts` 使用本地存储（照片放在仓库根目录 `photos/`，缩略图输出到 `apps/web/public/thumbnails/`）：

```ts
storage: {
  provider: 'local',
  basePath: './photos',
  baseUrl: '/photos',
  distPath: './apps/web/public/photos',
  maxFileLimit: 1000,
  excludeRegex: '^_',
}
```

生成照片清单并启动前端：

```bash
pnpm build:manifest
pnpm --filter @afilmory/web web --host 127.0.0.1 --port 5199
```

打开：

- 首页：<http://127.0.0.1:5199/>
- 摄影集：<http://127.0.0.1:5199/albums>
- 分类：<http://127.0.0.1:5199/categories>
- 后台：<http://127.0.0.1:5199/console>（未登录会跳转 `/console/login`）

首次运行（数据库里还没有任何账号）时，打开 `/console` 会被引导到 `/console/setup`，填写站点名与第一个管理员账号即可完成初始化；初始化只会创建这一个管理员，其他成员需要之后在「成员与模式」里手动邀请。`content/afilmory.db` 首次创建；如需测试独立实例，可用 `AFILMORY_DB_PATH=content/another.db` 指定数据库路径。

当前示例库已有以下账号（用于演示，不是首次初始化的默认值）：

| 账号 | 密码 | 角色 |
| --- | --- | --- |
| `owner@another-afilmory.local` | `admin123` | 所有者 |
| `linyi@another-afilmory.local` | `photo123` | 编辑 |
| `ache@another-afilmory.local` | `photo123` | 投稿者 |

密码用 Node 内置 `node:sqlite` 存到 `content/afilmory.db`，scrypt 加盐哈希；会话放在 `sessions` 表，Cookie 为 HttpOnly 的 `afilmory_session`，有效期 7 天。可在「成员与模式」中逐个重置成员密码；所有者本人也可以在「成员与模式」中重置自己的密码，或运行 `pnpm reset:password <邮箱> <新密码>`。

个人模式下只有所有者能登录，编辑/投稿账号会收到 401；登录页会提示「当前为个人模式，仅所有者账号可以登录」。

## 功能

### 1. 后台管理

`/console` 是仿 Halo 的浅色后台：左侧固定导航、顶部保存栏、白色卡片内容区。

| 分区 | 能力 |
| --- | --- |
| 概览 | 照片 / 摄影集 / 分类 / 成员统计，未分类与未分摄影集快捷入口 |
| 附件库 | 全部照片统一查看、搜索、筛选、上传、单张设置、批量归类、重新索引、移入回收站 |
| 回收站 | 查看已删除照片的缩略图与删除时间，恢复、永久删除或清空 |
| 站点设置 | 站点名、标题、描述、地址、主题色、作者、头像、GitHub、Twitter、页脚、ICP/公安备案 |
| 图库外观 | 默认视图、列数、排序，以及 EXIF、地图、上传者、摄影集/分类入口开关 |
| 摄影集 | 新建/删除摄影集，编辑名称、路径、简介、可见性、封面；照片统一去附件库归入 |
| 分类 | 新建/删除分类，编辑名称、路径、颜色、图标、描述；照片统一去附件库归类 |
| 成员与模式 | 个人/团队模式、邀请设置、默认角色、成员增删改、重置密码 |
| 角色与权限 | 新建/编辑/删除自定义角色，按功能分区勾选权限；内置所有者/管理员/编辑/投稿者/访客不可删除 |
| 存储与数据 | 固定本地存储（目录、公开路径、文件大小与格式），以及 SQLite 数据位置说明 |

分区、按钮和数据范围都会按当前账号的角色权限变化。内置角色：

- 所有者 / 管理员：全部权限。
- 编辑：附件库上传、编辑、批量归类、重建，以及摄影集/分类管理；不能改站点、成员与存储。
- 投稿者：只看得到自己投稿的照片，可上传、编辑自己照片的分类/摄影集与信息、删除自己的照片；不能改上传者，也看不到他人照片。
- 访客：只读概览与附件库。

### 1.1 自定义角色

在「角色与权限」中可新建任意角色，按概览、附件库、摄影集、分类、成员、角色、站点设置等分组勾选权限。给成员换角色后，该成员重新登录即可获得新的菜单、按钮与数据范围。

- 「查看全部照片」与「查看自己投稿的照片」互斥使用：没有前者时，附件库自动变成「我的照片」。
- 「编辑全部照片」与「编辑自己投稿的照片」同理；没有「批量归类」权限时，单张详情仍可编辑自己照片的摄影集/分类，但不能改上传者。
- 删除权限分为「删除全部照片」与「删除自己投稿的照片」。
- 角色 ID 创建后不可修改；仍有成员使用的角色不能删除。

配置与账号统一保存在 `content/afilmory.db`：`settings` 表的 `admin-data` 行存站点/摄影集/分类/成员/角色等完整内容，`users` 与 `sessions` 表存登录。`content/admin-data.json` 只作为首次启动的导入种子。开发服务器提供：

- `GET /api/auth/state`：是否已初始化、账号数
- `POST /api/auth/setup`：首次创建管理员
- `POST /api/auth/login` / `logout`、`GET /api/auth/me`、`POST /api/auth/password`
- `POST /api/admin/attachments/upload`、`delete`（软删除）、`reindex`
- `GET /api/admin/trash`、`POST /api/admin/trash/restore`、`POST /api/admin/trash/empty`
- `GET /api/admin/manifest`
- `GET /api/admin/export`、`POST /api/admin/import`、`POST /api/admin/backup`、`GET /api/admin/backups`

页面首次加载时，Vite 插件会把配置注入 `window.__ADMIN_DATA__`。上传、删除、恢复、重新索引、导入后，后台会重新拉取 `/api/admin/data` 与 `/api/admin/manifest` 并更新 `photoLoader`，前端内容无需整页刷新。登录、保存、上传等 API 都由 Vite 开发服务器提供；静态构建（`pnpm build`）没有这些接口，后台会停在登录页。当前后台定位为本地/自托管演示与管理工具；照片只写本地目录，多用户与权限由本仓库的 SQLite/角色系统自行管理。

### 2. 统一附件库

「后台 → 附件库」是照片唯一的归类入口：

- **筛选**：全部、未分类、未分摄影集、指定摄影集、指定分类、指定上传者；支持按文件名或 EXIF 搜索。
- **单张设置**：点击缩略图打开「照片设置」，修改上传者、摄影集（多选）与分类（多选）。
- **批量设置**：勾选多张后，批量加入/移出摄影集、归入/移出分类、应用上传者。
- **上传**：支持多文件上传，写入 `photos/` 后自动调用 builder 重建 manifest 与缩略图，新照片默认上传者为当前登录账号。
- **删除 / 回收站**：按角色权限区分「删除全部照片」与「删除自己投稿的照片」；删除后文件与缩略图移入回收站，可恢复或永久删除，移除 `photoMeta` 与摄影集引用。
- **重新索引**：按 `photos/` 目录重新生成 manifest 与缩略图，用于手动放入照片或外部改动后的同步，不需要重启服务。
- 「未分类」与「未分摄影集」是专门为找照片准备的两个视图，概览页也会显示数量。当前演示数据中保留了 3 张未分类、2 张未分摄影集的照片，方便直接体验这两个入口。
- 个人模式下，上传者筛选与上传者字段会自动隐藏；切换回团队模式后恢复。

摄影集、分类、成员面板已不再直接给照片打标，只保留组织信息与跳转附件库的入口。

### 2.1 回收站与重新索引

- 删除照片时原图与公开副本移动到 `content/trash/<photoId>/`，缩略图暂时保留用于回收站预览；数据库 `trash` 表记录照片信息、原摄影集与可恢复文件列表。
- 回收站支持单张恢复、单张永久删除与「清空回收站」；永久删除会删除文件、缩略图与数据库记录。
- 没有「删除全部照片」权限的账号只能看到并处理自己删除的照片。
- 「重新索引照片」会重新扫描 `photos/`，重建 manifest 与 `public/thumbnails`，完成后自动刷新当前页面数据，不会整页 reload。

### 2.2 数据导出、导入与自动备份

- 「导出数据」下载完整内容配置 JSON（站点、成员、角色、摄影集、分类、照片归属），不包含原始照片文件。
- 「导入数据」会覆盖当前内容配置，并同步 SQLite 账号；导入前建议先导出一份。
- 「立即备份」对 SQLite 执行 `VACUUM INTO content/backups/afilmory-<timestamp>.db`，默认保留最近 10 份；每次保存内容后也会自动备份一次。
- 备份文件是完整数据库（含账号、会话与内容），可直接替换 `content/afilmory.db` 恢复。

### 2.3 首页与关于页

- 首页 `/` 改为全屏精选页：横向排列的竖版照片条，当前照片完全展开、鼠标悬停其他照片会轻微展开，其余保持窄条；右下角是选择条，支持自动轮播。
- 移动端首页自动切换为单张交叉淡入，不再显示手风琴窄条；顶栏只保留搜索与「菜单」按钮，菜单中包含 首页、作品、摄影集、分类、关于、RSS，后台管理放在菜单最后。
- 从「作品」页打开的查看器关闭后会直接回到首页，不再停留在作品页。
- 「后台 → 首页与关于」可设置：
  - 展示方式：随机挑选 / 手动选择（手动模式在后台勾选照片）
  - 展示数量与轮播间隔（秒，前台悬停时暂停）
  - 首页主标题、副标题
  - 关于页：头像 URL、主图照片、年龄、所在地、邮箱、微信、电话、个人简介、设备清单（图片 URL/资产编号/器材/分类/品牌/型号）
- 瀑布流作品页迁移到 `/gallery`，首页不再叠加旧瀑布流；`/photos/:id` 仍复用同一查看器。
- 关于页 `/about` 使用浅色极简正文与站点统一顶栏：头像与简介、主图、所在地与地图入口、联系方式、按分类的设备表格，并链接到预约页。

### 2.4 预约约拍

- 前台 `/booking` 提供约拍表单：称呼、日期、时间、拍摄内容、付费/免费、QQ/微信/邮箱/电话、备注。
- 至少填写一种联系方式；日期/时间/内容会做基础校验，提交成功显示预约编号与「再约一次」。
- 预约写入 SQLite `bookings` 表，状态为 `pending / confirmed / done / cancelled`。
- 「后台 → 预约管理」可查看列表、按状态筛选、切换状态、删除记录、点击复制联系方式；只有拥有「管理成员」权限的账号可见。

### 2.5 深色界面

- 站点取消日间/夜间主题切换，统一使用深色界面。
- 预约页 `/booking` 与关于页 `/about` 使用黑色背景，表单卡片、地图占位与设备表格使用深色面板，保持与首页/作品页一致。
- 顶栏、作品页、摄影集、分类、集合详情、地图、预约与关于页均使用同一套 `--site-*` / `--header-*` CSS 变量。

### 3. 作品页筛选与返回顶部

`/gallery` 作品页右下角的「筛选」玻璃胶囊会打开筛选面板：

- 相机（含厂商/机型清理后的显示名）
- 镜头
- 时间（全部 / 最近 7、30、90 天，或自定义起止日期）
- 上传者（仅团队模式显示）

筛选条件会写入 URL 查询参数，可直接分享。向下滚动约 260px 后，筛选按钮上方出现「返回顶部」圆钮。

### 4. 个人 / 团队模式

在「后台 → 成员与模式」切换：

- 个人模式：只有所有者一个账号，成员表仅显示所有者，其他成员登录会返回 401；首页筛选面板隐藏「上传者」。
- 团队模式：可添加编辑/投稿成员，给每张照片指定上传者，首页展示上传者署名与上传者筛选。

### 5. 摄影集与分类

- 摄影集：成组照片，支持封面、简介、公开/私密，首页顶栏「摄影集」入口。
- 分类：可多选归类，支持颜色与图标，首页顶栏「分类」入口。
- 两个入口都可以在「图库外观」中单独关闭；移动端可从右上角「更多」菜单进入。

### 5.1 在摄影集/分类内查看照片

摄影集与分类详情页使用和首页一致的瀑布流，顶部是统一的玻璃顶栏（返回按钮、站点名、首页/作品/摄影集/分类/关于导航、后台入口）和带背景拼图的大标题区（摄影集/分类名、简介、张数、日期、上传者）。

- 点击缩略图会在当前页面上打开查看器，URL 保持不变。
- 左上角返回按钮位于顶栏下方的内容区，优先返回上一页；没有历史记录时回首页。
- 查看器的上一张/下一张与「N / M」只在当前摄影集或分类内切换。
- 关闭查看器会播放回到被点击缩略图的动画，最终仍停留在当前摄影集/分类页，不会回首页。
- 从首页打开照片时仍保持原有的全部照片浏览与返回首页行为。

### 5.2 入口卡片与顶栏

- 摄影集与分类入口采用「悬浮叠层卡片」：图片后有两层带主题色的旋转/偏移卡片边缘，鼠标悬停会轻微上浮并让边缘回正；图片下方显示标题、张数、简介。
- 卡片颜色：摄影集使用固定调色板，分类优先使用分类设置里的颜色。
- 相册/分类列表、详情、地图与首页共用同一个 `PageHeader` 玻璃顶栏；详情页多一个返回按钮。

### 5.2 摄影集/分类入口与统一顶栏

- 首页、摄影集、分类、集合详情、地图统一使用首页 `PageHeader`（品牌、照片数、摄影集/分类导航、右侧操作）；集合详情与地图额外显示返回按钮。
- 摄影集与分类入口采用 3 层「文件夹」卡片：封面背后露出第 2、3 张照片，鼠标悬停时后层向外展开并轻微旋转，颜色层作为缺图兜底。
- 照片查看器的完整 EXIF 弹窗使用全局 Modal，层级高于查看器；桌面端右侧信息栏可通过右上角 X 收起，再用 `PanelRightOpen` 按钮重新展开。

### 5.2 移动端与订阅

- 移动端首页为单张轮播，可左右滑动切换，也会按后台设置的间隔自动播放；桌面端保留手风琴布局。
- 移动端顶栏只保留搜索与菜单；菜单包含首页、作品、关于、后台管理、摄影集、分类与 RSS，带展开/收起动画。
- `/feed.xml` 与 `/sitemap.xml` 在开发服务器和构建产物中都可用；开发服务器由 Vite 中间件实时从照片 manifest 生成，构建时写入 `dist`。

## 主要新增/修改文件

```text
content/admin-data.json                        首次启动导入用的种子（不再写入）
content/afilmory.db                            SQLite：内容配置 + 账号/会话
apps/web/plugins/vite/admin-data.ts             注入配置 + API 路由 + 权限校验
apps/web/plugins/vite/admin-db.ts                SQLite 内容表 + 用户/会话、scrypt 密码
apps/web/plugins/vite/admin-files.ts             上传/删除文件并重建 manifest
apps/web/src/lib/admin/types.ts                数据类型、默认值、归一化
apps/web/src/lib/admin/store.ts                读写、成员/摄影集/分类查询
apps/web/src/lib/admin/auth.ts                 登录状态、角色能力
apps/web/src/lib/admin/attachments.ts          上传/删除/重建清单客户端
apps/web/src/pages/console/index.tsx           Halo 风格后台（含附件库与角色权限）
apps/web/src/pages/console/login/index.tsx     后台登录页
apps/web/src/pages/albums/**                   摄影集列表与详情
apps/web/src/pages/categories/**               分类列表与详情
apps/web/src/modules/discover/index.tsx        发现页外壳与照片网格
apps/web/src/modules/discover/EntryCard.tsx    摄影集/分类悬浮叠层卡片
apps/web/src/modules/discover/CollectionPage.tsx 集合瀑布流 + 本地查看器
apps/web/src/modules/gallery/PageHeader/**     全站统一顶栏
apps/web/src/modules/gallery/FilterFab.tsx     筛选 FAB、筛选面板、返回顶部
apps/web/src/atoms/app.ts                      gallerySettingAtom（筛选与展示开关）
apps/web/src/hooks/usePhotoViewer.ts           上传者筛选
apps/web/src/config/index.ts                   后台站点设置映射到 siteConfig
```

## 局域网访问

默认只监听 `127.0.0.1`，手机或其他电脑无法访问。改为监听所有网卡：

```bash
pnpm dev:lan
```

等价于 `pnpm --filter @afilmory/web web --host 0.0.0.0 --port 5199`。然后在同一 Wi-Fi / 局域网内访问 `http://<本机局域网 IP>:5199/`。Windows 需要放行入站 TCP 5199：

```powershell
New-NetFirewallRule -DisplayName "Afilmory Dev 5199" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 5199
```

关闭时删除规则：

```powershell
Remove-NetFirewallRule -DisplayName "Afilmory Dev 5199"
```

注意：不要让该端口直接暴露到公网；当前后台登录/保存接口由开发服务器提供，适合局域网内使用。

## Windows 兼容修复

为了在本机 Windows 环境运行，额外修复了：

- `apps/web/vite.config.ts`：路由扫描路径的反斜杠问题（否则找不到页面）。
- `apps/web/plugins/vite/__internal__/constants.ts`：`import.meta.url` 在 Windows 下生成 `C:\C:\...` 的问题。
- `apps/web/src/modules/gallery/PageFooter.tsx`：修正 `siteConfig` 导入路径。
- 复制 `logo.jpg` 到 `apps/web/`，避免 OG/favicon 插件找不到文件。

## 类型检查

```bash
pnpm --filter @afilmory/web exec tsc --noEmit
```

当前通过。
