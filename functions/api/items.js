const HARD_BLOCK_KEYWORDS = ["博彩", "赌场", "跑分", "代实名"];

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

function isHardBlocked(item) {
  const text = `${item.title || ""} ${item.description || ""} ${item.notes || ""}`;
  if (item.type === "high-risk") return true;
  return HARD_BLOCK_KEYWORDS.some((k) => text.includes(k));
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

async function listItems(env, request) {
  if (!env.DB) {
    return json({ error: "D1 not configured" }, 500);
  }

  const u = new URL(request.url);
  const limit = Math.min(parseInt(u.searchParams.get("limit") || "200", 10), 1000);

  const rs = await env.DB.prepare(
    `SELECT * FROM leads ORDER BY posted_at DESC, created_at DESC LIMIT ?`
  ).bind(limit).all();

  const items = (rs.results || []).map(rowToItem).filter((x) => !isHardBlocked(x));
  return json({ items, total: items.length });
}

async function createItem(env, request) {
  if (!env.DB) return json({ error: "D1 not configured" }, 500);

  const token = request.headers.get("x-admin-token") || "";
  if (!env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) {
    return json({ error: "unauthorized" }, 401);
  }

  const body = await request.json();
  const item = body || {};
  const signals = item.signals || {};
  const id = item.id || crypto.randomUUID();

  await env.DB.prepare(
    `INSERT OR REPLACE INTO leads (
      id, title, source_platform, source_name, source_url, posted_at, type,
      skills_json, budget, location, contact, description, notes,
      clear_scope, clear_budget, requires_deposit, asks_invite, asks_private_key, mentions_guarantee_income
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    item.title || "",
    item.sourcePlatform || "unknown",
    item.sourceName || "unknown",
    item.sourceUrl || "",
    item.postedAt || new Date().toISOString().slice(0, 10),
    item.type || "unknown",
    JSON.stringify(item.skills || []),
    item.budget || "unknown",
    item.location || "remote",
    item.contact || "",
    item.description || "",
    item.notes || "",
    signals.clearScope ? 1 : 0,
    signals.clearBudget ? 1 : 0,
    signals.requiresDeposit ? 1 : 0,
    signals.asksInvite ? 1 : 0,
    signals.asksPrivateKey ? 1 : 0,
    signals.mentionsGuaranteeIncome ? 1 : 0
  ).run();

  return json({ ok: true, id });
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === "GET") return listItems(env, request);
  if (request.method === "POST") return createItem(env, request);

  return json({ error: "method not allowed" }, 405);
}
