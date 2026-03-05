# SideHustle Radar（副业信息雷达）

已切到**开发直连模式**：
- 前端只读 API（不再回退静态 JSON）
- 后端：Cloudflare Pages Functions + D1
- 支持自动抓取导入（`/api/import`）

## 架构

- 前端：`public/*`
- 列表 API：`functions/api/items.js`
- 自动导入 API：`functions/api/import.js`
- D1 表结构：`schema.sql`

## 一次性配置

### 1) D1
创建数据库：`sidehustle-radar-db`，执行 `schema.sql`。

### 2) Pages 绑定
Pages 项目：`opclaw-page`

- Functions -> D1 Bindings：`DB` -> `sidehustle-radar-db`
- Environment Variables：`ADMIN_TOKEN` = 一段长随机串

## API

### GET /api/items?limit=500
返回项目列表（已自动过滤高风险词，如博彩/跑分/代实名）。

### POST /api/import
自动抓取并入库（去重：`source_url`）

Header：
- `x-admin-token: <ADMIN_TOKEN>`

Body 示例：

```json
{
  "sources": [
    {
      "url": "https://t.me/s/text1024",
      "sourcePlatform": "telegram",
      "sourceName": "text1024"
    },
    {
      "url": "https://example.com/article",
      "sourcePlatform": "wechat",
      "sourceName": "公众号示例"
    }
  ]
}
```

返回示例：

```json
{
  "ok": true,
  "results": [
    {"url":"...","inserted":true,"id":"..."},
    {"url":"...","skipped":true,"id":"..."}
  ]
}
```

## 自动抓取建议

你可以在外部定时任务（GitHub Actions / cron / 任何 webhook）定期调用 `/api/import`。

例如每 1~3 小时抓一次你白名单里的频道/网页。

## 风险策略

- API 层硬拦截关键词：`博彩 / 赌场 / 跑分 / 代实名`
- 这些内容不会进入可做项目列表
