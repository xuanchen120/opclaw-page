const state = { items: [], filtered: [], page: 1, pageSize: 20 };

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

function byId(id) { return document.getElementById(id); }

function setOptions(id, values) {
  const sel = byId(id);
  const first = sel.innerHTML;
  const uniq = [...new Set(values.filter(Boolean))].sort();
  sel.innerHTML = first + uniq.map((v) => `<option value="${v}">${v}</option>`).join("");
}

function execFieldCount(it) {
  let n = 0;
  if (it.signals?.clearBudget) n++;
  if (it.contact) n++;
  if (it.signals?.clearScope) n++;
  const text = `${it.description || ''} ${it.notes || ''}`;
  if (/[0-9]+\s*(天|周|月)|截止|ddl/i.test(text)) n++;
  return n;
}

function openDetail(it) {
  byId('d-title').textContent = it.title || '(无标题)';
  byId('d-meta').textContent = `${it.sourcePlatform || 'unknown'} · ${it.sourceName || 'unknown'} · ${it.postedAt || ''}`;
  byId('d-tags').innerHTML = `${(it.skills || []).map((x) => `<span class="tag">${x}</span>`).join('')}
    ${it.budget ? `<span class="tag">预算: ${it.budget}</span>` : ''}
    ${it.type ? `<span class="tag">类型: ${it.type}</span>` : ''}`;
  byId('d-desc').textContent = it.description || '';
  byId('d-notes').textContent = it.notes ? `备注：${it.notes}` : '';
  byId('d-link').href = it.sourceUrl || '#';

  const copyBtn = byId('d-copy');
  copyBtn.onclick = async () => {
    try {
      await navigator.clipboard.writeText(it.sourceUrl || '');
      copyBtn.textContent = '已复制';
      setTimeout(() => (copyBtn.textContent = '复制链接'), 1200);
    } catch (_) {
      copyBtn.textContent = '复制失败';
      setTimeout(() => (copyBtn.textContent = '复制链接'), 1200);
    }
  };

  byId('detailModal').style.display = 'block';
}

function render() {
  const q = byId("q").value.trim().toLowerCase();
  const p = byId("platform").value;
  const t = byId("type").value;
  const r = byId("risk").value;
  const sk = byId("skill").value;
  const executableOnly = !!byId('executableOnly')?.checked;

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
      if (executableOnly && execFieldCount(it) < 2) return false;
      return true;
    })
    .sort((a, b) => calcScore(b) - calcScore(a));

  const ok = arr.filter((i) => bucket(calcScore(i)) === "ok").length;
  const mid = arr.filter((i) => bucket(calcScore(i)) === "mid").length;
  const bad = arr.filter((i) => bucket(calcScore(i)) === "bad").length;

  byId("k-total").textContent = arr.length;
  byId("k-ok").textContent = ok;
  byId("k-mid").textContent = mid;
  byId("k-bad").textContent = bad;

  const totalPages = Math.max(1, Math.ceil(arr.length / state.pageSize));
  if (state.page > totalPages) state.page = totalPages;
  const start = (state.page - 1) * state.pageSize;
  const pageArr = arr.slice(start, start + state.pageSize);

  byId('pageInfo').textContent = `第 ${state.page} / ${totalPages} 页`;
  byId('prevPage').disabled = state.page <= 1;
  byId('nextPage').disabled = state.page >= totalPages;

  byId("list").innerHTML = pageArr.map((it) => {
    const s = calcScore(it);
    return `
      <article class="card">
        <div class="row">
          <div>
            <div class="title">${it.sourceUrl ? `<a href="#" data-action="detail" data-id="${it.id}">${it.title || "(无标题)"}</a>` : (it.title || "(无标题)")}</div>
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

        <div class="meta" style="margin-top:8px; display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
          ${it.contact ? `<span>联系: ${it.contact}</span>` : ""}
          ${it.sourceUrl ? `<a href="${it.sourceUrl}" target="_blank" rel="noreferrer">原链接</a>` : ""}
          ${it.sourceUrl ? `<button class="tag" data-action="open" data-url="${it.sourceUrl}" style="cursor:pointer;background:transparent;">打开</button>` : ""}
          ${it.sourceUrl ? `<button class="tag" data-action="copy" data-url="${it.sourceUrl}" style="cursor:pointer;background:transparent;">复制链接</button>` : ""}
        </div>

        ${it.notes ? `<div class="meta">备注：${it.notes}</div>` : ""}
      </article>
    `;
  }).join("") || `<div class="card">没有匹配结果</div>`;

  byId('list').querySelectorAll('a[data-action="detail"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const id = a.getAttribute('data-id');
      const it = state.items.find(x => x.id === id);
      if (it) openDetail(it);
    });
  });

  byId('list').querySelectorAll('button[data-action="open"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const url = btn.getAttribute('data-url');
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
    });
  });

  byId('list').querySelectorAll('button[data-action="copy"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const url = btn.getAttribute('data-url') || '';
      try {
        await navigator.clipboard.writeText(url);
        btn.textContent = '已复制';
        setTimeout(() => (btn.textContent = '复制链接'), 1200);
      } catch (_) {
        btn.textContent = '复制失败';
        setTimeout(() => (btn.textContent = '复制链接'), 1200);
      }
    });
  });
}

async function loadFromApi() {
  const r = await fetch(`/api/items?limit=1000&t=${Date.now()}`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`API错误: ${r.status}`);
  const ct = r.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    throw new Error('API未返回JSON（当前可能仍在静态部署模式）');
  }
  const data = await r.json();
  return data.items || [];
}

function updateLastUpdated() {
  const d = new Date();
  byId('lastUpdated').textContent = `最后更新：${d.toLocaleString('zh-CN', { hour12: false })}`;
}

async function refreshData({ keepPage = true } = {}) {
  const currentPage = state.page;
  const btn = byId('refreshNow');
  try {
    if (btn) {
      btn.disabled = true;
      btn.textContent = '刷新中...';
    }
    const items = await loadFromApi();
    state.items = items;

    // 每次刷新后重建筛选项
    byId('platform').innerHTML = '<option value="">全部平台</option>';
    byId('type').innerHTML = '<option value="">全部类型</option>';
    byId('skill').innerHTML = '<option value="">全部技能</option>';
    setOptions('platform', items.map((i) => i.sourcePlatform));
    setOptions('type', items.map((i) => i.type));
    setOptions('skill', items.flatMap((i) => i.skills || []));

    if (keepPage) state.page = currentPage;
    render();
    updateLastUpdated();
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '立即刷新';
    }
  }
}

async function init() {
  try {
    await refreshData({ keepPage: false });
  } catch (e) {
    // 开发兜底：避免白屏
    const r2 = await fetch('/data/items.json');
    if (!r2.ok) throw e;
    state.items = await r2.json();
    setOptions('platform', state.items.map((i) => i.sourcePlatform));
    setOptions('type', state.items.map((i) => i.type));
    setOptions('skill', state.items.flatMap((i) => i.skills || []));
    render();
    updateLastUpdated();
  }

  ['q', 'platform', 'type', 'risk', 'skill', 'executableOnly'].forEach((id) => byId(id).addEventListener('input', () => {
    state.page = 1;
    render();
  }));

  byId('pageSize').addEventListener('input', () => {
    state.pageSize = Number(byId('pageSize').value || 20);
    state.page = 1;
    render();
  });
  byId('prevPage').addEventListener('click', () => {
    if (state.page > 1) {
      state.page -= 1;
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });
  byId('nextPage').addEventListener('click', () => {
    state.page += 1;
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  byId('refreshNow').addEventListener('click', () => refreshData({ keepPage: true }));
  setInterval(() => {
    refreshData({ keepPage: true }).catch(() => {});
  }, 60 * 1000);

  byId('d-close').addEventListener('click', () => (byId('detailModal').style.display = 'none'));
  byId('detailModal').addEventListener('click', (e) => {
    if (e.target?.id === 'detailModal') byId('detailModal').style.display = 'none';
  });
}

init().catch((err) => {
  byId('list').innerHTML = `<div class="card">加载失败：${String(err)}。请先完成 D1 + Functions 配置。</div>`;
});
