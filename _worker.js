const HARD_BLOCK_KEYWORDS = ["博彩", "赌场", "跑分", "代实名"];
const SOFT_BLOCK_KEYWORDS = ["mbti", "吃瓜", "抽奖", "表情包", "资源站", "网盘", "福利视频", "黄油", "瓜群", "看片", "短剧", "小说", "测试题"];
const DEV_POSITIVE_KEYWORDS = ["php", "go", "golang", "laravel", "wordpress", "mysql", "api", "接口", "自动化", "脚本", "爬虫", "运维", "部署", "修复", "二开", "开发", "维护"];

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

function pick(text, arr) {
  return arr.some((k) => text.includes(k));
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleFromHtml(html) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1].replace(/\s+/g, " ").trim() : "(无标题)";
}

function detectSkills(text) {
  const map = ["php", "go", "laravel", "mysql", "wordpress", "javascript", "python", "node", "linux"];
  const t = text.toLowerCase();
  return map.filter((x) => t.includes(x));
}

function extractContact(text, sourceName = "") {
  const m = text.match(/@([a-zA-Z0-9_]{4,})/);
  if (!m) return "";
  const found = `@${m[1]}`;
  if (sourceName && found.toLowerCase() === `@${String(sourceName).toLowerCase()}`) return "";
  return found;
}

function isSoftBlocked(text = "") {
  const t = String(text).toLowerCase();
  return SOFT_BLOCK_KEYWORDS.some((k) => t.includes(k));
}

function noteHasCategory(notes = "", category = "") {
  return String(notes).toLowerCase().includes(`category:${String(category).toLowerCase()}`);
}

function isOpportunitySource(notes = "") {
  return noteHasCategory(notes, 'opportunity');
}

function isSavingsSource(notes = "") {
  return noteHasCategory(notes, 'savings');
}

function hasDevIntent(text = "") {
  const t = String(text).toLowerCase();
  return DEV_POSITIVE_KEYWORDS.some((k) => t.includes(k));
}

function extractTelegramPosts(html, defaultPlatform, defaultName, options = {}) {
  const maxPosts = Math.max(1, Math.min(Number(options.maxPosts || 30), 200));
  const chunks = html.split('data-post="').slice(1).slice(0, maxPosts);
  const out = [];
  let minPostNum = null;

  for (const chunk of chunks) {
    const postId = (chunk.split('"')[0] || "").trim(); // e.g. text1024/21785
    if (!postId.includes('/')) continue;
    const [channel, numStr] = postId.split('/');
    const postNum = Number(numStr);
    if (!Number.isNaN(postNum)) {
      if (minPostNum === null || postNum < minPostNum) minPostNum = postNum;
    }

    const dt = (chunk.match(/datetime="([^"]+)"/) || [])[1] || new Date().toISOString();
    const textRaw = (chunk.match(/tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/) || [])[1] || "";
    const text = stripHtml(textRaw);
    if (!text || text.length < 20) continue;

    const title = text.slice(0, 40);
    out.push({
      title,
      sourcePlatform: defaultPlatform || "telegram",
      sourceName: defaultName || channel,
      sourceUrl: `https://t.me/s/${postId}`,
      postedAt: dt.slice(0, 10),
      description: text.slice(0, 500),
      contact: extractContact(text, defaultName || channel),
      rawText: text
    });
  }
  return { posts: out, minPostNum };
}

function detectSignals(text) {
  return {
    clearScope: pick(text, ["需求", "范围", "交付", "里程碑", "修复", "功能", "接口", "开发", "维护"]),
    clearBudget: pick(text, ["预算", "￥", "元", "$", "usd", "fixed", "报价", "k/月", "每月"]),
    requiresDeposit: pick(text, ["保证金", "押金", "预付费", "先交费"]),
    asksInvite: pick(text, ["邀请码", "拉人头", "推广返佣"]),
    asksPrivateKey: pick(text, ["私钥", "验证码", "账号密码", "助记词"]),
    mentionsGuaranteeIncome: pick(text, ["稳赚", "保底收益", "躺赚", "日入"])
  };
}

function hardRisk(text) {
  return pick(text, HARD_BLOCK_KEYWORDS);
}

function executionFieldsCount(item) {
  let n = 0;
  if (item.signals?.clearBudget) n++;
  if (item.contact && item.contact !== "") n++;
  if (item.signals?.clearScope) n++;
  if (pick(`${item.description || ""} ${item.notes || ""}`, ["天", "周", "月", "截止", "ddl"])) n++;
  return n;
}

function isHardBlocked(item) {
  const text = `${item.title || ""} ${item.description || ""} ${item.notes || ""}`;
  if (item.type === "high-risk") return true;
  return HARD_BLOCK_KEYWORDS.some((k) => text.includes(k));
}

function isLowValueNoise(item) {
  const text = `${item.title || ""} ${item.description || ""} ${item.notes || ""}`;
  if (isOpportunitySource(item.notes) || isSavingsSource(item.notes)) return false;
  return isSoftBlocked(text) && !hasDevIntent(text);
}

function rowToItem(r) {
  return {
    id: r.id,
    title: r.title,
    sourcePlatform: r.source_platform,
    sourceName: r.source_name,
    sourceUrl: r.source_url,
    postedAt: r.posted_at,
    type: r.type,
    skills: JSON.parse(r.skills_json || "[]"),
    budget: r.budget,
    location: r.location,
    contact: r.contact,
    description: r.description,
    notes: r.notes,
    signals: {
      clearScope: !!r.clear_scope,
      clearBudget: !!r.clear_budget,
      requiresDeposit: !!r.requires_deposit,
      asksInvite: !!r.asks_invite,
      asksPrivateKey: !!r.asks_private_key,
      mentionsGuaranteeIncome: !!r.mentions_guarantee_income
    },
    createdAt: r.created_at
  };
}

async function ensureMetaTables(env) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS import_runs (
    id TEXT PRIMARY KEY,
    source_count INTEGER DEFAULT 0,
    inserted_count INTEGER DEFAULT 0,
    skipped_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    summary_json TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`).run();
}

async function handleItems(request, env) {
  if (!env.DB) return json({ error: "D1 not configured" }, 500);
  const u = new URL(request.url);
  const limit = Math.min(parseInt(u.searchParams.get("limit") || "200", 10), 1000);
  const rs = await env.DB.prepare(`SELECT * FROM leads ORDER BY posted_at DESC, created_at DESC LIMIT ?`).bind(limit).all();
  const items = (rs.results || [])
    .map(rowToItem)
    .filter((x) => !isHardBlocked(x))
    .filter((x) => !isLowValueNoise(x));
  return json({ items, total: items.length });
}

async function upsertLead(env, item) {
  const existing = await env.DB.prepare(`SELECT id FROM leads WHERE source_url = ? LIMIT 1`).bind(item.sourceUrl).first();
  if (existing?.id) return { skipped: true, id: existing.id };

  const id = crypto.randomUUID();
  const s = item.signals || {};
  await env.DB.prepare(
    `INSERT INTO leads (
      id, title, source_platform, source_name, source_url, posted_at, type,
      skills_json, budget, location, contact, description, notes,
      clear_scope, clear_budget, requires_deposit, asks_invite, asks_private_key, mentions_guarantee_income
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    item.title,
    item.sourcePlatform,
    item.sourceName,
    item.sourceUrl,
    item.postedAt,
    item.type,
    JSON.stringify(item.skills || []),
    item.budget || "unknown",
    item.location || "remote",
    item.contact || "",
    item.description || "",
    item.notes || "",
    s.clearScope ? 1 : 0,
    s.clearBudget ? 1 : 0,
    s.requiresDeposit ? 1 : 0,
    s.asksInvite ? 1 : 0,
    s.asksPrivateKey ? 1 : 0,
    s.mentionsGuaranteeIncome ? 1 : 0
  ).run();
  return { inserted: true, id };
}

async function handleImport(request, env) {
  if (!env.DB) return json({ error: "D1 not configured" }, 500);
  await ensureMetaTables(env);

  const token = request.headers.get("x-admin-token") || "";
  if (!env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) {
    return json({ error: "unauthorized" }, 401);
  }

  const body = await request.json();
  const sources = Array.isArray(body.sources) ? body.sources : [];
  const maxChars = Math.min(Number(body.maxChars || 5000), 20000);

  const out = [];
  for (const src of sources) {
    try {
      const resp = await fetch(src.url, { redirect: "follow" });
      const html = await resp.text();

      // Telegram 渠道：按帖子粒度拆分
      if ((src.sourcePlatform || '').toLowerCase() === 'telegram' || src.url.includes('t.me/s/')) {
        const { posts, minPostNum } = extractTelegramPosts(html, src.sourcePlatform || 'telegram', src.sourceName || 'telegram', {
          maxPosts: src.maxPosts || 80
        });

        let inserted = 0;
        let skipped = 0;
        for (const p of posts) {
          const textAll = `${p.title} ${p.rawText}`;
          if (!isOpportunitySource(src.notes) && !isSavingsSource(src.notes) && isSoftBlocked(textAll) && !hasDevIntent(textAll)) {
            skipped++;
            continue;
          }
          const item = {
            title: p.title,
            sourcePlatform: p.sourcePlatform,
            sourceName: p.sourceName,
            sourceUrl: p.sourceUrl,
            postedAt: p.postedAt,
            type: hardRisk(textAll) ? 'high-risk' : (src.type || 'info-content'),
            skills: src.skills?.length ? src.skills : detectSkills(textAll),
            budget: src.budget || 'unknown',
            location: src.location || 'remote',
            contact: src.contact || p.contact || '',
            description: p.description,
            notes: src.notes || 'auto-import:telegram-post',
            signals: detectSignals(textAll)
          };

          const execScore = executionFieldsCount(item);
          if (execScore < 2 && item.type !== 'high-risk') {
            item.type = 'info-content';
            item.notes = `${item.notes || ''} | downgraded:low-executable`;
          }

          const r = await upsertLead(env, item);
          if (r.inserted) inserted++;
          if (r.skipped) skipped++;
        }

        // 向前翻页继续抓更早消息（最多5页）
        let page = 0;
        let cursor = minPostNum;
        while (page < 5 && cursor && (src.deepFetch !== false)) {
          const olderUrl = `${src.url}?before=${cursor}`;
          const r2 = await fetch(olderUrl, { redirect: 'follow' });
          const h2 = await r2.text();
          const older = extractTelegramPosts(h2, src.sourcePlatform || 'telegram', src.sourceName || 'telegram', {
            maxPosts: src.maxPosts || 80
          });
          if (!older.posts.length) break;

          for (const p of older.posts) {
            const textAll = `${p.title} ${p.rawText}`;
            if (!isOpportunitySource(src.notes) && !isSavingsSource(src.notes) && isSoftBlocked(textAll) && !hasDevIntent(textAll)) {
              skipped++;
              continue;
            }
            const item = {
              title: p.title,
              sourcePlatform: p.sourcePlatform,
              sourceName: p.sourceName,
              sourceUrl: p.sourceUrl,
              postedAt: p.postedAt,
              type: hardRisk(textAll) ? 'high-risk' : (src.type || 'info-content'),
              skills: src.skills?.length ? src.skills : detectSkills(textAll),
              budget: src.budget || 'unknown',
              location: src.location || 'remote',
              contact: src.contact || p.contact || '',
              description: p.description,
              notes: src.notes || 'auto-import:telegram-post',
              signals: detectSignals(textAll)
            };
            const execScore = executionFieldsCount(item);
            if (execScore < 2 && item.type !== 'high-risk') {
              item.type = 'info-content';
              item.notes = `${item.notes || ''} | downgraded:low-executable`;
            }
            const r = await upsertLead(env, item);
            if (r.inserted) inserted++;
            if (r.skipped) skipped++;
          }

          if (!older.minPostNum || older.minPostNum >= cursor) break;
          cursor = older.minPostNum;
          page++;
        }

        out.push({ url: src.url, mode: 'telegram-posts', parsed: posts.length, inserted, skipped, pages: page + 1 });
        continue;
      }

      // 普通网页：整页一条
      const t = stripHtml(html).slice(0, maxChars);
      const title = src.title || titleFromHtml(html);
      const textAll = `${title} ${t}`;

      if (!isOpportunitySource(src.notes) && !isSavingsSource(src.notes) && isSoftBlocked(textAll) && !hasDevIntent(textAll)) {
        out.push({ url: src.url, skipped: true, reason: 'soft-blocked-noise', mode: 'single-page' });
        continue;
      }

      const item = {
        title,
        sourcePlatform: src.sourcePlatform || "web",
        sourceName: src.sourceName || "import",
        sourceUrl: src.url,
        postedAt: new Date().toISOString().slice(0, 10),
        type: hardRisk(textAll) ? "high-risk" : (src.type || "info-content"),
        skills: src.skills?.length ? src.skills : detectSkills(textAll),
        budget: src.budget || "unknown",
        location: src.location || "remote",
        contact: src.contact || extractContact(t, src.sourceName || "") || "",
        description: t.slice(0, 500),
        notes: src.notes || "auto-import",
        signals: detectSignals(textAll)
      };

      const execScore = executionFieldsCount(item);
      if (execScore < 2 && item.type !== 'high-risk') {
        item.type = 'info-content';
        item.notes = `${item.notes || ''} | downgraded:low-executable`;
      }

      const r = await upsertLead(env, item);
      out.push({ url: src.url, ...r, type: item.type, executableFields: execScore, mode: 'single-page' });
    } catch (e) {
      out.push({ url: src.url, error: String(e) });
    }
  }

  const insertedCount = out.reduce((n, x) => n + (Number(x.inserted) || 0), 0);
  const skippedCount = out.reduce((n, x) => n + (Number(x.skipped) || 0), 0);
  const errorCount = out.filter((x) => !!x.error).length;

  const runId = crypto.randomUUID();
  await env.DB.prepare(`INSERT INTO import_runs (id, source_count, inserted_count, skipped_count, error_count, summary_json)
    VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(runId, out.length, insertedCount, skippedCount, errorCount, JSON.stringify(out))
    .run();

  return json({ ok: true, runId, results: out, stats: { insertedCount, skippedCount, errorCount } });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/items" && request.method === "GET") {
      return handleItems(request, env);
    }

    if (url.pathname === "/api/import" && request.method === "POST") {
      return handleImport(request, env);
    }

    if (url.pathname === "/api/import" && request.method === "GET") {
      return json({
        hint: "POST /api/import with x-admin-token and body { sources:[{url, sourcePlatform, sourceName}] }"
      });
    }

    if (url.pathname === "/api/import-status" && request.method === "GET") {
      if (!env.DB) return json({ error: "D1 not configured" }, 500);
      await ensureMetaTables(env);
      const rs = await env.DB.prepare(`SELECT id, source_count, inserted_count, skipped_count, error_count, created_at
        FROM import_runs ORDER BY created_at DESC LIMIT 20`).all();
      const rows = rs.results || [];
      return json({
        latest: rows[0] || null,
        runs: rows
      });
    }

    return env.ASSETS.fetch(request);
  }
};
