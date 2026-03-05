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

function detectSignals(text) {
  return {
    clearScope: pick(text, ["需求", "范围", "交付", "里程碑", "修复", "功能"]),
    clearBudget: pick(text, ["预算", "￥", "元", "$", "usd", "fixed", "报价"]),
    requiresDeposit: pick(text, ["保证金", "押金", "预付费", "先交费"]),
    asksInvite: pick(text, ["邀请码", "拉人头", "推广返佣"]),
    asksPrivateKey: pick(text, ["私钥", "验证码", "账号密码", "助记词"]),
    mentionsGuaranteeIncome: pick(text, ["稳赚", "保底收益", "躺赚", "日入"])
  };
}

function hardRisk(text) {
  return pick(text, ["博彩", "赌场", "跑分", "代实名"]);
}

async function upsertLead(env, item) {
  const existing = await env.DB.prepare(`SELECT id FROM leads WHERE source_url = ? LIMIT 1`)
    .bind(item.sourceUrl)
    .first();
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

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: "D1 not configured" }, 500);

  const token = request.headers.get("x-admin-token") || "";
  if (!env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) return json({ error: "unauthorized" }, 401);

  const body = await request.json();
  const sources = Array.isArray(body.sources) ? body.sources : [];
  const maxChars = Math.min(Number(body.maxChars || 5000), 20000);

  const out = [];
  for (const src of sources) {
    try {
      const resp = await fetch(src.url, { redirect: "follow" });
      const html = await resp.text();
      const t = stripHtml(html).slice(0, maxChars);
      const title = src.title || titleFromHtml(html);
      const textAll = `${title} ${t}`;

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
        contact: src.contact || "",
        description: t.slice(0, 500),
        notes: src.notes || "auto-import",
        signals: detectSignals(textAll)
      };

      const r = await upsertLead(env, item);
      out.push({ url: src.url, ...r, type: item.type });
    } catch (e) {
      out.push({ url: src.url, error: String(e) });
    }
  }

  return json({ ok: true, results: out });
}

export async function onRequestGet() {
  return json({
    hint: "POST /api/import with x-admin-token and body { sources:[{url, sourcePlatform, sourceName}] }"
  });
}
