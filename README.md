# SideHustle Radar（副业信息雷达）

给你做的一个本地可用小工具：把各平台（Telegram、公众号、论坛、招聘站）看到的“赚钱项目”统一收集、打标签、评分、筛选。

## 你能做什么

- 统一收录：把项目线索都丢进 `data/items.json`
- 快速筛选：按平台、项目类型、风险等级、是否程序员可做筛选
- 可信度评分：按「可验证性、预算清晰度、是否预付、是否拉人头」自动给分
- 黑名单词拦截：自动标红高风险词（刷单、保证金、博彩、拉人头等）

## 目录

- `public/index.html` 前端页面（纯静态）
- `public/app.js` 页面逻辑
- `public/styles.css` 样式
- `data/items.json` 你的项目数据（可手工维护）
- `data/items.sample.json` 示例数据

## 使用

1. 先复制示例数据：

```bash
cp data/items.sample.json data/items.json
```

2. 本地启动一个静态服务（任选一个）：

```bash
# Node 方式
npx serve .

# 或 Python 方式
python3 -m http.server 8787
```

3. 浏览器打开：

- `http://localhost:3000/public/`（用 serve 时）
- 或 `http://localhost:8787/public/`

> 页面会自动读取 `../data/items.json`

## 数据格式（items.json）

```json
[
  {
    "id": "tg-001",
    "title": "Laravel 老系统修复",
    "sourcePlatform": "telegram",
    "sourceName": "某副业频道",
    "sourceUrl": "https://t.me/s/example/123",
    "postedAt": "2026-03-05",
    "type": "dev-task",
    "skills": ["php", "laravel", "mysql"],
    "budget": "500-1200 CNY",
    "location": "remote",
    "contact": "@example",
    "description": "修复登录与支付回调，2天内交付",
    "signals": {
      "clearScope": true,
      "clearBudget": true,
      "requiresDeposit": false,
      "asksInvite": false,
      "asksPrivateKey": false,
      "mentionsGuaranteeIncome": false
    },
    "notes": "适合下班后做"
  }
]
```

## 风险与评分规则（内置）

- 基础分 60
- 清晰范围 +15
- 清晰预算 +10
- 要求保证金 -35
- 拉人头/邀请码 -25
- 索要私钥/验证码/账号 -50
- 承诺保底收益 -30

评级：
- `>= 80`：可优先跟进
- `60 ~ 79`：可观察
- `< 60`：高风险，建议跳过

## 你接下来怎么用

你继续发我链接（TG/公众号文章/论坛帖子），我帮你提炼成结构化条目，持续加到 `items.json`。这个站就会越来越好用。
