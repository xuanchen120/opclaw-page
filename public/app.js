const state = { items: [], filtered: [] };

const riskKeywords = [
  "刷单", "博彩", "代实名", "跑分", "拉人头", "保底收益", "稳赚", "保证金", "邀请码", "私钥", "验证码"
];

function calcScore(item) {
  let s = 60;
  const g = item.signals || {};
  if (g.clearScope) s += 15;
  if (g.clearBudget) s += 10;
  if (g.requiresDeposit) s -= 35;
  if (g.asksInvite) s -= 25;
  if (g.asksPrivateKey) s -= 50;
  if (g.mentionsGuaranteeIncome) s -= 30;

  const hay = `${item.title || ""} ${item.description || ""} ${item.notes || ""}`;
  for (const k of riskKeywords) if (hay.includes(k)) s -= 15;
  return Math.max(0, Math.min(100, s));
}

function bucket(score) {
  if (score >= 80) return "ok";
  if (score >= 60) return "mid";
  return "bad";
}

function badge(score) {
  const b = bucket(score);
  if (b === "ok") return `<span class="badge score-ok">优先 ${score}</span>`;
  if (b === "mid") return `<span class="badge score-mid">观察 ${score}</span>`;
  return `<span class="badge score-bad">高风险 ${score}</span>`;
}

function byId(id) {
  return document.getElementById(id);
}

function setOptions(id, values) {
  const sel = byId(id);
  const first = sel.innerHTML;
  const uniq = [...new Set(values.filter(Boolean))].sort();
  sel.innerHTML = first + uniq.map((v) => `<option value="${v}">${v}</option>`).join("");
}

function render() {
  const q = byId("q").value.trim().toLowerCase();
  const p = byId("platform").value;
  const t = byId("type").value;
  const r = byId("risk").value;
  const sk = byId("skill").value;

  const arr = state.items
    .filter((it) => {
      const s = calcScore(it);
      const b = bucket(s);
      const txt = `${it.title || ""} ${it.description || ""} ${it.notes || ""} ${(it.skills || []).join(" ")}`.toLowerCase();
      if (q && !txt.includes(q)) return false;
      if (p && it.sourcePlatform !== p) return false;
      if (t && it.type !== t) return false;
      if (r && b !== r) return false;
      if (sk && !(it.skills || []).includes(sk)) return false;
      return true;
    })
    .sort((a, b) => calcScore(b) - calcScore(a));

  state.filtered = arr;

  const ok = arr.filter((i) => bucket(calcScore(i)) === "ok").length;
  const mid = arr.filter((i) => bucket(calcScore(i)) === "mid").length;
  const bad = arr.filter((i) => bucket(calcScore(i)) === "bad").length;

  byId("k-total").textContent = arr.length;
  byId("k-ok").textContent = ok;
  byId("k-mid").textContent = mid;
  byId("k-bad").textContent = bad;

  byId("list").innerHTML =
    arr
      .map((it) => {
        const s = calcScore(it);
        return `
      <article class="card">
        <div class="row">
          <div>
            <div class="title">${it.title || "(无标题)"}</div>
            <div class="meta">${it.sourcePlatform || "unknown"} · ${it.sourceName || "unknown"} · ${it.postedAt || ""}</div>
          </div>
          <div>${badge(s)}</div>
        </div>

        <div class="desc">${it.description || ""}</div>

        <div class="tags">
          ${(it.skills || []).map((x) => `<span class="tag">${x}</span>`).join("")}
          ${it.budget ? `<span class="tag">预算: ${it.budget}</span>` : ""}
          ${it.type ? `<span class="tag">类型: ${it.type}</span>` : ""}
        </div>

        <div class="meta" style="margin-top:8px;">
          ${it.contact ? `联系: ${it.contact} · ` : ""}
          ${it.sourceUrl ? `<a href="${it.sourceUrl}" target="_blank" rel="noreferrer">原链接</a>` : ""}
        </div>

        ${it.notes ? `<div class="meta">备注：${it.notes}</div>` : ""}
      </article>
    `;
      })
      .join("") || `<div class="card">没有匹配结果</div>`;
}

async function loadItems() {
  // 优先读 D1 API，失败回退到静态 JSON
  try {
    const r = await fetch('/api/items?limit=500');
    if (r.ok) {
      const data = await r.json();
      if (Array.isArray(data.items)) return data.items;
    }
  } catch (_) {}

  const resp = await fetch('../data/items.json');
  return resp.json();
}

async function init() {
  const items = await loadItems();
  state.items = items;

  setOptions('platform', items.map((i) => i.sourcePlatform));
  setOptions('type', items.map((i) => i.type));
  setOptions('skill', items.flatMap((i) => i.skills || []));

  ['q', 'platform', 'type', 'risk', 'skill'].forEach((id) => byId(id).addEventListener('input', render));
  render();
}

init().catch((err) => {
  byId('list').innerHTML = `<div class="card">加载失败：${String(err)}</div>`;
});
