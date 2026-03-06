const state = { items: [], filtered: [], page: 1, pageSize: 20, readMap: {}, nowMs: Date.now() };
const devKeywords = ['php', 'go', 'golang', 'laravel', 'wordpress', 'mysql', 'api', '接口', '自动化', '脚本', '爬虫', '运维', '部署', '修复', '二开', '开发', '维护'];

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
function on(id, event, handler) {
  const el = byId(id);
  if (el) el.addEventListener(event, handler);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function setOptions(id, values, selectedValue = "") {
  const sel = byId(id);
  const uniq = [...new Set(values.filter(Boolean))].sort();
  sel.innerHTML = `<option value="">${sel.dataset.placeholder || '全部'}</option>` + uniq.map((v) => {
    const selected = v === selectedValue ? ' selected' : '';
    return `<option value="${escapeHtml(v)}"${selected}>${escapeHtml(v)}</option>`;
  }).join("");
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

function isUnread(it) {
  return !state.readMap[it.id];
}

function isNewLead(it) {
  if (!it.createdAt) return false;
  const t = Date.parse(it.createdAt);
  if (!Number.isFinite(t)) return false;
  return (state.nowMs - t) <= (15 * 60 * 1000);
}

function markRead(id) {
  if (!id) return;
  state.readMap[id] = 1;
  localStorage.setItem('readMap', JSON.stringify(state.readMap));
}

function currentFilters() {
  return {
    q: byId('q').value,
    platform: byId('platform').value,
    type: byId('type').value,
    risk: byId('risk').value,
    skill: byId('skill').value,
    executableOnly: !!byId('executableOnly')?.checked,
    unreadOnly: !!byId('unreadOnly')?.checked,
    pageSize: Number(byId('pageSize')?.value || state.pageSize || 20)
  };
}

function restoreFilters(filters = {}) {
  if (filters.q != null) byId('q').value = filters.q;
  if (filters.platform != null) byId('platform').value = filters.platform;
  if (filters.type != null) byId('type').value = filters.type;
  if (filters.risk != null) byId('risk').value = filters.risk;
  if (filters.skill != null) byId('skill').value = filters.skill;
  if (filters.executableOnly != null) byId('executableOnly').checked = !!filters.executableOnly;
  if (filters.unreadOnly != null) byId('unreadOnly').checked = !!filters.unreadOnly;
  if (filters.pageSize != null) {
    state.pageSize = Number(filters.pageSize) || 20;
    byId('pageSize').value = String(state.pageSize);
  }
}

function rebuildFilterOptions(items, preserved = {}) {
  setOptions('platform', items.map((i) => i.sourcePlatform), preserved.platform || '');
  setOptions('type', items.map((i) => i.type), preserved.type || '');
  setOptions('skill', items.flatMap((i) => i.skills || []), preserved.skill || '');
  if (preserved.platform) byId('platform').value = preserved.platform;
  if (preserved.type) byId('type').value = preserved.type;
  if (preserved.skill) byId('skill').value = preserved.skill;
}

function openDetail(it) {
  markRead(it.id);
  byId('d-title').textContent = it.title || '(无标题)';
  byId('d-meta').textContent = `${it.sourcePlatform || 'unknown'} · ${it.sourceName || 'unknown'} · ${it.postedAt || ''}`;
  byId('d-tags').innerHTML = `${(it.skills || []).map((x) => `<span class="tag tag-soft">${escapeHtml(x)}</span>`).join('')}
    ${it.budget ? `<span class="tag tag-soft">预算: ${escapeHtml(it.budget)}</span>` : ''}
    ${it.type ? `<span class="tag tag-soft">类型: ${escapeHtml(it.type)}</span>` : ''}`;
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
  render();
}

function render() {
  const q = byId("q").value.trim().toLowerCase();
  const p = byId("platform").value;
  const t = byId("type").value;
  const r = byId("risk").value;
  const sk = byId("skill").value;
  const executableOnly = !!byId('executableOnly')?.checked;
  const unreadOnly = !!byId('unreadOnly')?.checked;

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
      if (unreadOnly && !isUnread(it)) return false;
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

  const totalPages = Math.max(1, Math.ceil(arr.length / state.pageSize));
  if (state.page > totalPages) state.page = totalPages;
  const start = (state.page - 1) * state.pageSize;
  const pageArr = arr.slice(start, start + state.pageSize);

  byId('pageInfo').textContent = `第 ${state.page} / ${totalPages} 页`;
  byId('prevPage').disabled = state.page <= 1;
  byId('nextPage').disabled = state.page >= totalPages;

  byId("list").innerHTML = pageArr.map((it) => {
    const s = calcScore(it);
    const unreadBadge = isUnread(it) ? '<span class="tag tag-unread">未读</span>' : '';
    const newBadge = isNewLead(it) ? '<span class="tag tag-new">NEW</span>' : '';
    return `
      <article class="card ${isUnread(it) ? 'card-unread' : ''}">
        <div class="row">
          <div>
            <div class="title">${it.sourceUrl ? `<a href="#" data-action="detail" data-id="${escapeHtml(it.id)}">${escapeHtml(it.title || "(无标题)")}</a>` : escapeHtml(it.title || "(无标题)")}</div>
            <div class="meta">${escapeHtml(it.sourcePlatform || "unknown")} · ${escapeHtml(it.sourceName || "unknown")} · ${escapeHtml(it.postedAt || "")}
              ${unreadBadge}
              ${newBadge}
            </div>
          </div>
          <div>${badge(s)}</div>
        </div>

        <div class="desc">${escapeHtml(it.description || "")}</div>

        <div class="tags">
          ${(it.skills || []).map((x) => `<span class="tag tag-soft">${escapeHtml(x)}</span>`).join("")}
          ${it.budget ? `<span class="tag tag-soft">预算: ${escapeHtml(it.budget)}</span>` : ""}
          ${it.type ? `<span class="tag tag-soft">类型: ${escapeHtml(it.type)}</span>` : ""}
        </div>

        <div class="meta actions-row">
          ${it.contact ? `<span>联系: ${escapeHtml(it.contact)}</span>` : ""}
          ${it.sourceUrl ? `<a href="${escapeHtml(it.sourceUrl)}" target="_blank" rel="noreferrer">原链接</a>` : ""}
          ${it.sourceUrl ? `<button class="tag tag-soft" data-action="open" data-url="${escapeHtml(it.sourceUrl)}" type="button">打开</button>` : ""}
          ${it.sourceUrl ? `<button class="tag tag-soft" data-action="copy" data-url="${escapeHtml(it.sourceUrl)}" type="button">复制链接</button>` : ""}
        </div>

        ${it.notes ? `<div class="meta">备注：${escapeHtml(it.notes)}</div>` : ""}
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

async function refreshImportStatus() {
  try {
    const r = await fetch(`/api/import-status?t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return;
    const d = await r.json();
    const x = d.latest;
    if (!x) {
      byId('importStatus').textContent = '导入状态：暂无记录';
      return;
    }
    byId('importStatus').textContent = `导入状态：${x.created_at} | +${x.inserted_count} 新增 / ${x.skipped_count} 跳过 / ${x.error_count} 错误`;
  } catch (_) {}
}

async function refreshData({ keepPage = true } = {}) {
  const currentPage = state.page;
  const preserved = currentFilters();
  const btn = byId('refreshNow');
  state.nowMs = Date.now();
  try {
    if (btn) {
      btn.disabled = true;
      btn.textContent = '刷新中...';
    }
    const items = await loadFromApi();
    state.items = items;
    rebuildFilterOptions(items, preserved);
    restoreFilters(preserved);
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
  state.readMap = JSON.parse(localStorage.getItem('readMap') || '{}');

  try {
    await refreshData({ keepPage: false });
  } catch (e) {
    const r2 = await fetch('/data/items.json');
    if (!r2.ok) throw e;
    state.items = await r2.json();
    rebuildFilterOptions(state.items, currentFilters());
    render();
    updateLastUpdated();
  }

  ['q', 'platform', 'type', 'risk', 'skill', 'executableOnly', 'unreadOnly'].forEach((id) => on(id, 'input', () => {
    state.page = 1;
    render();
  }));

  on('pageSize', 'input', () => {
    state.pageSize = Number(byId('pageSize')?.value || 20);
    state.page = 1;
    render();
  });

  on('prevPage', 'click', () => {
    if (state.page > 1) {
      state.page -= 1;
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  on('nextPage', 'click', () => {
    if (state.page < Math.max(1, Math.ceil(state.filtered.length / state.pageSize))) {
      state.page += 1;
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  on('refreshNow', 'click', async () => {
    await refreshData({ keepPage: true });
    await refreshImportStatus();
  });

  on('opportunityPreset', 'click', () => {
    byId('q').value = 'category:opportunity freelance remote jobs hiring contract project part-time';
    byId('executableOnly').checked = false;
    byId('unreadOnly').checked = false;
    state.page = 1;
    render();
  });

  on('inspirationPreset', 'click', () => {
    byId('q').value = 'category:inspiration';
    byId('executableOnly').checked = false;
    byId('unreadOnly').checked = false;
    state.page = 1;
    render();
  });

  on('savingsPreset', 'click', () => {
    byId('q').value = 'category:savings freebies coupon deals rebate free';
    byId('executableOnly').checked = false;
    byId('unreadOnly').checked = false;
    state.page = 1;
    render();
  });

  on('devPreset', 'click', () => {
    byId('q').value = `category:opportunity ${devKeywords.join(' ')}`;
    byId('executableOnly').checked = true;
    byId('unreadOnly').checked = false;
    state.page = 1;
    render();
  });

  on('clearPreset', 'click', () => {
    byId('q').value = '';
    byId('platform').value = '';
    byId('type').value = '';
    byId('risk').value = '';
    byId('skill').value = '';
    byId('executableOnly').checked = false;
    byId('unreadOnly').checked = false;
    state.page = 1;
    render();
  });

  on('markAllRead', 'click', () => {
    const start = (state.page - 1) * state.pageSize;
    const pageArr = state.filtered.slice(start, start + state.pageSize);
    pageArr.forEach((item) => markRead(item.id));
    render();
  });

  setInterval(() => {
    refreshData({ keepPage: true }).catch(() => {});
    refreshImportStatus().catch(() => {});
  }, 60 * 1000);

  refreshImportStatus().catch(() => {});

  on('d-close', 'click', () => {
    const modal = byId('detailModal');
    if (modal) modal.style.display = 'none';
  });
  on('detailModal', 'click', (e) => {
    if (e.target?.id === 'detailModal') byId('detailModal').style.display = 'none';
  });
}

init().catch((err) => {
  byId('list').innerHTML = `<div class="card">加载失败：${escapeHtml(String(err))}。请先完成 D1 + Functions 配置。</div>`;
});
