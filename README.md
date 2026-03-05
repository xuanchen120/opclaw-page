# SideHustle Radar（副业信息雷达）

现在已升级为：**Cloudflare Pages + Pages Functions + D1**。

- 前端：`public/*`
- API：`functions/api/items.js`
- 数据库：Cloudflare D1（表结构 `schema.sql`）
- 回退机制：若 D1/API 不可用，前端自动回退读取 `data/items.json`

## 当前能力

- 多平台线索展示/筛选/评分
- 默认排除博彩等高风险内容（API 层硬拦截）
- 支持后续自动写入（POST `/api/items`）

## 目录

- `public/index.html` 页面
- `public/app.js` 筛选逻辑（优先读 `/api/items`）
- `functions/api/items.js` API（GET/POST）
- `schema.sql` D1 表结构
- `data/items.json` 静态回退数据

## 一次性配置（Cloudflare）

### 1) 创建 D1 数据库

在 Cloudflare 控制台创建 D1，例如：`sidehustle-radar-db`

### 2) 初始化表结构

在 D1 控制台执行 `schema.sql` 全部 SQL。

### 3) 绑定到 Pages 项目

Pages 项目：`opclaw-page`

- Settings -> Functions -> D1 database bindings
- 新增绑定：
  - Variable name: `DB`
  - D1 database: `sidehustle-radar-db`

### 4) 配置写入令牌（可选，给 POST 用）

Pages 项目 -> Settings -> Environment variables

- `ADMIN_TOKEN` = 你自定义的长随机串

> POST `/api/items` 需要请求头 `x-admin-token: <ADMIN_TOKEN>`

## API

### GET /api/items

返回结构化线索：

```json
{ "items": [...], "total": 123 }
```

### POST /api/items

- Header: `x-admin-token: <ADMIN_TOKEN>`
- Body: 与 `items.json` 单条结构一致

## 开发与部署

### 本地静态预览

```bash
npx serve .
# or
python3 -m http.server 8787
```

### 生产部署

使用 Cloudflare Pages 连接 GitHub 仓库自动部署。

## 风险规则（默认）

硬拦截关键词：`博彩 / 赌场 / 跑分 / 代实名`（不会出现在可做项目列表）。
