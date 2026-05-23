const state = {
  itemsAi: [],
  itemsAll: [],
  itemsAllRaw: [],
  statsAi: [],
  totalAi: 0,
  totalRaw: 0,
  totalAllMode: 0,
  allDedup: true,
  allDataLoaded: false,
  allDataUrl: "data/latest-24h-all.json",
  allDataPromise: null,
  siteFilter: "",
  query: "",
  mode: "ai",
  waytoagiMode: "today",
  waytoagiData: null,
  sourceStatus: null,
  generatedAt: null,
  personalizationEnabled: true,
  personalizationEngine: null,
};

const statsEl = document.getElementById("stats");
const siteSelectEl = document.getElementById("siteSelect");
const sitePillsEl = document.getElementById("sitePills");
const newsListEl = document.getElementById("newsList");
const updatedAtEl = document.getElementById("updatedAt");
const searchInputEl = document.getElementById("searchInput");
const resultCountEl = document.getElementById("resultCount");
const listTitleEl = document.getElementById("listTitle");
const itemTpl = document.getElementById("itemTpl");
const modeAiBtnEl = document.getElementById("modeAiBtn");
const modeAllBtnEl = document.getElementById("modeAllBtn");
const modeHintEl = document.getElementById("modeHint");
const allDedupeWrapEl = document.getElementById("allDedupeWrap");
const allDedupeToggleEl = document.getElementById("allDedupeToggle");
const allDedupeLabelEl = document.getElementById("allDedupeLabel");
const advancedSummaryEl = document.getElementById("advancedSummary");
const sourceHealthEl = document.getElementById("sourceHealth");

const waytoagiUpdatedAtEl = document.getElementById("waytoagiUpdatedAt");
const waytoagiMetaEl = document.getElementById("waytoagiMeta");
const waytoagiListEl = document.getElementById("waytoagiList");
const waytoagiTodayBtnEl = document.getElementById("waytoagiTodayBtn");
const waytoagi7dBtnEl = document.getElementById("waytoagi7dBtn");
const coverageStripEl = document.getElementById("coverageStrip");

const SOURCE_KINDS = {
  official_ai: { label: "官方", tone: "official" },
  aibreakfast: { label: "日报", tone: "newsletter" },
  followbuilders: { label: "Builders/X", tone: "builders" },
  xapi: { label: "X API", tone: "builders" },
  techurls: { label: "聚合", tone: "aggregate" },
  buzzing: { label: "聚合", tone: "aggregate" },
  iris: { label: "聚合", tone: "aggregate" },
  bestblogs: { label: "博客", tone: "blogs" },
  tophub: { label: "聚合", tone: "aggregate" },
  zeli: { label: "聚合", tone: "aggregate" },
  aihubtoday: { label: "AI站点", tone: "aihub" },
  aibase: { label: "AI站点", tone: "aihub" },
  newsnow: { label: "聚合", tone: "aggregate" },
};

function fmtNumber(n) {
  return new Intl.NumberFormat("zh-CN").format(n || 0);
}

function fmtTime(iso) {
  if (!iso) return "时间未知";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "时间未知";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function fmtDate(iso) {
  if (!iso) return "未知日期";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function setStats(payload) {
  const cards = [
    ["AI 信号", fmtNumber(payload.total_items)],
    ["站点数", fmtNumber(payload.site_count)],
    ["来源分组", fmtNumber(payload.source_count)],
    ["归档", fmtNumber(payload.archive_total || 0)]
  ];

  statsEl.innerHTML = "";
  cards.forEach(([k, v]) => {
    const node = document.createElement("div");
    node.className = "stat";
    node.innerHTML = `<div class="k">${k}</div><div class="v">${v}</div>`;
    statsEl.appendChild(node);
  });
}

function sourceKind(siteId) {
  return SOURCE_KINDS[siteId] || { label: "来源", tone: "default" };
}

function siteRows() {
  return Array.isArray(state.sourceStatus?.sites) ? state.sourceStatus.sites : [];
}

function siteRow(siteId) {
  return siteRows().find((site) => site.site_id === siteId) || null;
}

function renderCoverageCard(label, value, meta, tone = "") {
  const node = document.createElement("div");
  node.className = `coverage-card ${tone}`.trim();
  const labelEl = document.createElement("span");
  labelEl.className = "coverage-label";
  labelEl.textContent = label;
  const valueEl = document.createElement("strong");
  valueEl.textContent = value;
  const metaEl = document.createElement("span");
  metaEl.className = "coverage-meta";
  metaEl.textContent = meta;
  node.append(labelEl, valueEl, metaEl);
  return node;
}

function renderCoverageStrip(errorMessage = "") {
  if (!coverageStripEl) return;
  coverageStripEl.innerHTML = "";

  const rows = siteRows();
  const failedSites = Array.isArray(state.sourceStatus?.failed_sites) ? state.sourceStatus.failed_sites : [];
  const rss = state.sourceStatus?.rss_opml || {};
  const agentmail = state.sourceStatus?.agentmail || {};
  const xApi = state.sourceStatus?.x_api || {};
  const allCount = Number(state.sourceStatus?.items_before_topic_filter || state.totalAllMode || state.itemsAll.length || 0);
  const coverageCount = Number(state.sourceStatus?.fetched_raw_items || state.totalRaw || allCount || 0);
  const officialCount = Number(siteRow("official_ai")?.item_count || 0);
  const newsletterCount = Number(siteRow("aibreakfast")?.item_count || 0);
  const buildersCount = Number(siteRow("followbuilders")?.item_count || 0);
  const totalSites = rows.length;
  const okSites = Number(state.sourceStatus?.successful_sites || 0);
  const opmlValue = rss.enabled ? `${fmtNumber(rss.ok_feeds || 0)}/${fmtNumber(rss.effective_feed_total || 0)}` : "OPML";
  const opmlMeta = rss.enabled ? "RSS示例/自定义订阅已接入" : "可用OPML批量接入RSS";
  const xApiLabel = xApi.enabled ? `X ${xApi.skipped ? "待窗口" : fmtNumber(xApi.item_count || 0)}` : "X待配置";
  const mailLabel = agentmail.enabled ? `Mail ${fmtNumber(agentmail.item_count || 0)}` : "Mail待配置";
  const advancedMeta = xApi.enabled || agentmail.enabled
    ? `额度保护 · ${xApiLabel} / ${mailLabel}`
    : "X API 与 AgentMail 默认关闭";

  const cards = [
    ["源健康", totalSites ? `${fmtNumber(okSites)}/${fmtNumber(totalSites)}` : "加载中", failedSites.length ? `${fmtNumber(failedSites.length)} 个失败源` : (errorMessage || "内置源正常"), failedSites.length ? "warn" : "ok"],
    ["今日覆盖池", `${fmtNumber(coverageCount)} 条`, allCount ? `全网抓取原始信号 · ${fmtNumber(allCount)} 条入池` : "全网抓取原始信号", "signal"],
    ["AI精选", `${fmtNumber(state.totalAi)} 条`, "24小时强相关信号", "signal"],
    ["官方/日报源池", `${fmtNumber(officialCount + newsletterCount)} 条`, "官方节点 + AI Breakfast", "official"],
    ["Builders/X源池", `${fmtNumber(buildersCount)} 条`, "Follow Builders公开feed", "builders"],
    ["RSS/OPML扩展", opmlValue, opmlMeta, "private"],
    ["高级源", "X / Mail", advancedMeta, "private"],
  ];

  cards.forEach(([label, value, meta, tone]) => {
    coverageStripEl.appendChild(renderCoverageCard(label, value, meta, tone));
  });
}

function renderAdvancedSummary() {
  if (!advancedSummaryEl) return;
  const status = state.sourceStatus;
  const allCount = state.allDedup
    ? (state.totalAllMode || state.itemsAll.length)
    : (state.totalRaw || state.itemsAllRaw.length);
  if (!status) {
    advancedSummaryEl.textContent = `全量 ${fmtNumber(allCount)} 条`;
    return;
  }
  const sites = Array.isArray(status.sites) ? status.sites : [];
  const totalSites = sites.length;
  const okSites = Number(status.successful_sites || 0);
  advancedSummaryEl.textContent = `${fmtNumber(okSites)}/${fmtNumber(totalSites)} 源可用 · 全量 ${fmtNumber(allCount)} 条`;
}

function computeSiteStats(items) {
  const m = new Map();
  items.forEach((item) => {
    if (!m.has(item.site_id)) {
      m.set(item.site_id, { site_id: item.site_id, site_name: item.site_name, count: 0, raw_count: 0 });
    }
    const row = m.get(item.site_id);
    row.count += 1;
    row.raw_count += 1;
  });
  return Array.from(m.values()).sort((a, b) => b.count - a.count || a.site_name.localeCompare(b.site_name, "zh-CN"));
}

function currentSiteStats() {
  if (state.mode === "ai") return state.statsAi || [];
  return computeSiteStats(state.allDedup ? (state.itemsAll || []) : (state.itemsAllRaw || []));
}

function renderSiteFilters() {
  const stats = currentSiteStats();

  siteSelectEl.innerHTML = '<option value="">全部站点</option>';
  stats.forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s.site_id;
    const raw = s.raw_count ?? s.count;
    opt.textContent = `${s.site_name} (${s.count}/${raw})`;
    siteSelectEl.appendChild(opt);
  });
  siteSelectEl.value = state.siteFilter;

  sitePillsEl.innerHTML = "";
  const allPill = document.createElement("button");
  allPill.className = `pill ${state.siteFilter === "" ? "active" : ""}`;
  allPill.textContent = "全部";
  allPill.onclick = () => {
    state.siteFilter = "";
    renderSiteFilters();
    renderList();
  };
  sitePillsEl.appendChild(allPill);

  stats.forEach((s) => {
    const btn = document.createElement("button");
    btn.className = `pill ${state.siteFilter === s.site_id ? "active" : ""}`;
    const raw = s.raw_count ?? s.count;
    btn.textContent = `${s.site_name} ${s.count}/${raw}`;
    btn.onclick = () => {
      state.siteFilter = s.site_id;
      renderSiteFilters();
      renderList();
    };
    sitePillsEl.appendChild(btn);
  });
}

function renderModeSwitch() {
  modeAiBtnEl.classList.toggle("active", state.mode === "ai");
  modeAllBtnEl.classList.toggle("active", state.mode === "all");
  if (allDedupeWrapEl) allDedupeWrapEl.classList.toggle("show", state.mode === "all");
  if (allDedupeToggleEl) allDedupeToggleEl.checked = state.allDedup;
  if (allDedupeLabelEl) allDedupeLabelEl.textContent = state.allDedup ? "去重开" : "去重关";
  if (state.mode === "ai") {
    modeHintEl.textContent = `AI强相关 · ${fmtNumber(state.totalAi)} 条`;
    if (listTitleEl) listTitleEl.textContent = "AI 信号流";
  } else {
    const allCount = state.allDedup
      ? (state.totalAllMode || state.itemsAll.length)
      : (state.totalRaw || state.itemsAllRaw.length);
    modeHintEl.textContent = `全量 · ${state.allDedup ? "去重开" : "去重关"} · ${fmtNumber(allCount)} 条`;
    if (listTitleEl) listTitleEl.textContent = "全量更新";
  }
  renderAdvancedSummary();
}

function effectiveAllItems() {
  return state.allDedup ? state.itemsAll : state.itemsAllRaw;
}

function modeItems() {
  return state.mode === "all" ? effectiveAllItems() : state.itemsAi;
}

function getFilteredItems() {
  const q = state.query.trim().toLowerCase();
  let filtered = modeItems().filter((item) => {
    if (state.siteFilter && item.site_id !== state.siteFilter) return false;
    if (!q) return true;
    const hay = `${item.title || ""} ${item.title_zh || ""} ${item.title_en || ""} ${item.site_name || ""} ${item.source || ""}`.toLowerCase();
    return hay.includes(q);
  });

  // 应用个性化排序
  if (state.personalizationEnabled && state.personalizationEngine) {
    filtered = filtered.map(item => {
      const tone = sourceKind(item.site_id).tone;
      const personalizedScore = state.personalizationEngine.calculatePersonalizedScore(item, tone);
      return { ...item, _personalizedScore: personalizedScore };
    });

    // 按个性化评分排序（降序）
    filtered.sort((a, b) => {
      const scoreDiff = (b._personalizedScore || 0) - (a._personalizedScore || 0);
      if (Math.abs(scoreDiff) > 0.01) return scoreDiff;
      // 如果评分相近，按时间排序
      const timeA = new Date(a.published_at || a.first_seen_at || 0).getTime();
      const timeB = new Date(b.published_at || b.first_seen_at || 0).getTime();
      return timeB - timeA;
    });
  }

  return filtered;
}

function renderItemNode(item) {
  const node = itemTpl.content.firstElementChild.cloneNode(true);
  node.querySelector(".site").textContent = item.site_name;
  const kind = sourceKind(item.site_id);
  const categoryEl = node.querySelector(".category");
  categoryEl.textContent = kind.label;
  categoryEl.classList.add(`kind-${kind.tone}`);
  node.querySelector(".source").textContent = `分区: ${item.source}`;
  node.querySelector(".time").textContent = fmtTime(item.published_at || item.first_seen_at);

  const titleEl = node.querySelector(".title");
  const zh = (item.title_zh || "").trim();
  const en = (item.title_en || "").trim();
  titleEl.textContent = "";
  if (zh && en && zh !== en) {
    const primary = document.createElement("span");
    primary.textContent = zh;
    const sub = document.createElement("span");
    sub.className = "title-sub";
    sub.textContent = en;
    titleEl.appendChild(primary);
    titleEl.appendChild(sub);
  } else {
    titleEl.textContent = item.title || zh || en;
  }
  titleEl.href = item.url;

  // 添加个性化反馈按钮
  if (state.personalizationEnabled && state.personalizationEngine) {
    const feedbackEl = document.createElement("div");
    feedbackEl.className = "feedback-buttons";

    const interestedBtn = document.createElement("button");
    interestedBtn.className = "feedback-btn feedback-interested";
    interestedBtn.title = "感兴趣";
    interestedBtn.innerHTML = "👍";
    interestedBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleFeedback(item, kind.tone, true, interestedBtn);
    };

    const notInterestedBtn = document.createElement("button");
    notInterestedBtn.className = "feedback-btn feedback-not-interested";
    notInterestedBtn.title = "不感兴趣";
    notInterestedBtn.innerHTML = "👎";
    notInterestedBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleFeedback(item, kind.tone, false, notInterestedBtn);
    };

    feedbackEl.appendChild(interestedBtn);
    feedbackEl.appendChild(notInterestedBtn);

    // 如果有个性化评分，显示出来（调试用）
    if (item._personalizedScore !== undefined && window.location.search.includes('debug')) {
      const scoreEl = document.createElement("span");
      scoreEl.className = "personalized-score";
      scoreEl.textContent = `评分: ${item._personalizedScore.toFixed(3)}`;
      feedbackEl.appendChild(scoreEl);
    }

    node.appendChild(feedbackEl);
  }

  return node;
}

function handleFeedback(item, tone, isInterested, button) {
  if (!state.personalizationEngine) return;

  if (isInterested) {
    state.personalizationEngine.markInterested(item, tone);
    button.classList.add("clicked");
    setTimeout(() => {
      button.classList.remove("clicked");
      button.classList.add("active");
    }, 300);
  } else {
    state.personalizationEngine.markNotInterested(item, tone);
    button.classList.add("clicked");
    setTimeout(() => {
      button.classList.remove("clicked");
      button.classList.add("active");
    }, 300);
  }

  // 重新渲染列表以应用新的排序
  setTimeout(() => {
    renderList();
  }, 500);
}

function buildSourceGroupNode(source, items) {
  const section = document.createElement("section");
  section.className = "source-group";
  const header = document.createElement("header");
  header.className = "source-group-head";
  const title = document.createElement("h3");
  title.textContent = source;
  const count = document.createElement("span");
  count.textContent = `${fmtNumber(items.length)} 条`;
  const listEl = document.createElement("div");
  listEl.className = "source-group-list";
  header.append(title, count);
  section.append(header, listEl);
  items.forEach((item) => listEl.appendChild(renderItemNode(item)));
  return section;
}

function groupBySource(items) {
  const groupMap = new Map();
  items.forEach((item) => {
    const key = item.source || "未分区";
    if (!groupMap.has(key)) {
      groupMap.set(key, []);
    }
    groupMap.get(key).push(item);
  });

  return Array.from(groupMap.entries()).sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], "zh-CN"));
}

function renderGroupedBySource(items) {
  const groups = groupBySource(items);
  const frag = document.createDocumentFragment();

  groups.forEach(([source, groupItems]) => {
    frag.appendChild(buildSourceGroupNode(source, groupItems));
  });

  newsListEl.appendChild(frag);
}

function renderGroupedBySiteAndSource(items) {
  const siteMap = new Map();
  items.forEach((item) => {
    if (!siteMap.has(item.site_id)) {
      siteMap.set(item.site_id, {
        siteName: item.site_name || item.site_id,
        items: [],
      });
    }
    siteMap.get(item.site_id).items.push(item);
  });

  const sites = Array.from(siteMap.entries()).sort((a, b) => {
    const byCount = b[1].items.length - a[1].items.length;
    if (byCount !== 0) return byCount;
    return a[1].siteName.localeCompare(b[1].siteName, "zh-CN");
  });

  const frag = document.createDocumentFragment();
  sites.forEach(([, site]) => {
    const siteSection = document.createElement("section");
    siteSection.className = "site-group";
    const header = document.createElement("header");
    header.className = "site-group-head";
    const title = document.createElement("h3");
    title.textContent = site.siteName;
    const count = document.createElement("span");
    count.textContent = `${fmtNumber(site.items.length)} 条`;
    const siteListEl = document.createElement("div");
    siteListEl.className = "site-group-list";
    header.append(title, count);
    siteSection.append(header, siteListEl);

    const sourceGroups = groupBySource(site.items);
    sourceGroups.forEach(([source, groupItems]) => {
      siteListEl.appendChild(buildSourceGroupNode(source, groupItems));
    });
    frag.appendChild(siteSection);
  });

  newsListEl.appendChild(frag);
}

function renderList() {
  const filtered = getFilteredItems();
  resultCountEl.textContent = `${fmtNumber(filtered.length)} 条`;

  newsListEl.innerHTML = "";

  if (!filtered.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "当前筛选条件下没有结果。";
    newsListEl.appendChild(empty);
    return;
  }

  if (state.siteFilter) {
    renderGroupedBySource(filtered);
    return;
  }

  renderGroupedBySiteAndSource(filtered);
}

function waytoagiViews(waytoagi) {
  const updates7d = Array.isArray(waytoagi?.updates_7d) ? waytoagi.updates_7d : [];
  const latestDate = waytoagi?.latest_date || (updates7d.length ? updates7d[0].date : null);
  const updatesToday = Array.isArray(waytoagi?.updates_today) && waytoagi.updates_today.length
    ? waytoagi.updates_today
    : (latestDate ? updates7d.filter((u) => u.date === latestDate) : []);
  return { updates7d, updatesToday, latestDate };
}

function renderWaytoagi(waytoagi) {
  const { updates7d, updatesToday, latestDate } = waytoagiViews(waytoagi);
  if (waytoagiTodayBtnEl) waytoagiTodayBtnEl.classList.toggle("active", state.waytoagiMode === "today");
  if (waytoagi7dBtnEl) waytoagi7dBtnEl.classList.toggle("active", state.waytoagiMode === "7d");
  waytoagiUpdatedAtEl.textContent = `更新时间：${fmtTime(waytoagi.generated_at)}`;

  waytoagiMetaEl.innerHTML = "";
  const rootLink = document.createElement("a");
  rootLink.href = waytoagi.root_url || "#";
  rootLink.target = "_blank";
  rootLink.rel = "noopener noreferrer";
  rootLink.textContent = "主页面";
  const historyLink = document.createElement("a");
  historyLink.href = waytoagi.history_url || "#";
  historyLink.target = "_blank";
  historyLink.rel = "noopener noreferrer";
  historyLink.textContent = "历史更新页";
  const todayCount = document.createElement("span");
  todayCount.textContent = `最近更新日(${latestDate || "--"})：${fmtNumber(waytoagi.count_today || updatesToday.length)} 条`;
  const weekCount = document.createElement("span");
  weekCount.textContent = `近 7 日：${fmtNumber(waytoagi.count_7d || updates7d.length)} 条`;
  [rootLink, "·", historyLink, "·", todayCount, "·", weekCount].forEach((part) => {
    if (typeof part === "string") {
      const sep = document.createElement("span");
      sep.textContent = part;
      waytoagiMetaEl.appendChild(sep);
    } else {
      waytoagiMetaEl.appendChild(part);
    }
  });

  waytoagiListEl.innerHTML = "";
  if (waytoagi.has_error) {
    const div = document.createElement("div");
    div.className = "waytoagi-error";
    div.textContent = waytoagi.error || "WaytoAGI 数据加载失败";
    waytoagiListEl.appendChild(div);
    return;
  }

  const updates = state.waytoagiMode === "today" ? updatesToday : updates7d;
  if (!updates.length) {
    const div = document.createElement("div");
    div.className = "waytoagi-empty";
    div.textContent = state.waytoagiMode === "today"
      ? "最近更新日没有更新，可切换到近7日查看。"
      : (waytoagi.warning || "近 7 日没有更新");
    waytoagiListEl.appendChild(div);
    return;
  }

  updates.forEach((u) => {
    const row = document.createElement("a");
    row.className = "waytoagi-item";
    row.href = u.url || "#";
    row.target = "_blank";
    row.rel = "noopener noreferrer";
    const dateEl = document.createElement("span");
    dateEl.className = "d";
    dateEl.textContent = fmtDate(u.date);
    const titleEl = document.createElement("span");
    titleEl.className = "t";
    titleEl.textContent = u.title;
    row.append(dateEl, titleEl);
    waytoagiListEl.appendChild(row);
  });
}

function renderMetric(label, value, tone = "") {
  const node = document.createElement("div");
  node.className = `health-metric ${tone}`.trim();
  const labelEl = document.createElement("span");
  labelEl.className = "health-label";
  labelEl.textContent = label;
  const valueEl = document.createElement("strong");
  valueEl.textContent = value;
  node.append(labelEl, valueEl);
  return node;
}

function renderIssueList(title, items) {
  const wrap = document.createElement("div");
  wrap.className = "health-issue";
  const titleEl = document.createElement("div");
  titleEl.className = "health-issue-title";
  titleEl.textContent = title;
  const list = document.createElement("ul");
  items.slice(0, 6).forEach((item) => {
    const li = document.createElement("li");
    li.textContent = typeof item === "string" ? item : JSON.stringify(item);
    list.appendChild(li);
  });
  if (items.length > 6) {
    const li = document.createElement("li");
    li.textContent = `另有 ${fmtNumber(items.length - 6)} 项`;
    list.appendChild(li);
  }
  wrap.append(titleEl, list);
  return wrap;
}

function renderSourceHealth(errorMessage = "") {
  if (!sourceHealthEl) return;
  sourceHealthEl.innerHTML = "";

  const status = state.sourceStatus;
  if (!status) {
    const empty = document.createElement("div");
    empty.className = "health-empty";
    empty.textContent = errorMessage || "源状态未生成";
    sourceHealthEl.appendChild(empty);
    renderAdvancedSummary();
    return;
  }

  const sites = Array.isArray(status.sites) ? status.sites : [];
  const failedSites = Array.isArray(status.failed_sites) ? status.failed_sites : [];
  const zeroSites = Array.isArray(status.zero_item_sites) ? status.zero_item_sites : [];
  const rss = status.rss_opml || {};
  const agentmail = status.agentmail || {};
  const xApi = status.x_api || {};
  const failedFeeds = Array.isArray(rss.failed_feeds) ? rss.failed_feeds : [];
  const skippedFeeds = Array.isArray(rss.skipped_feeds) ? rss.skipped_feeds : [];
  const replacedFeeds = Array.isArray(rss.replaced_feeds) ? rss.replaced_feeds : [];

  const metricGrid = document.createElement("div");
  metricGrid.className = "health-grid";
  metricGrid.append(
    renderMetric("内置源", `${fmtNumber(status.successful_sites || 0)}/${fmtNumber(sites.length)}`, failedSites.length ? "warn" : "ok"),
    renderMetric("RSS", rss.enabled ? `${fmtNumber(rss.ok_feeds || 0)}/${fmtNumber(rss.effective_feed_total || 0)}` : "未启用"),
    renderMetric("X API", xApi.enabled ? (xApi.skipped ? "待窗口" : `${fmtNumber(xApi.item_count || 0)}条`) : "未启用", xApi.error ? "bad" : ""),
    renderMetric("AgentMail", agentmail.enabled ? `${fmtNumber(agentmail.item_count || 0)}封` : "未启用", agentmail.error ? "bad" : ""),
    renderMetric("失败源", fmtNumber(failedSites.length + failedFeeds.length), failedSites.length || failedFeeds.length ? "bad" : "ok"),
    renderMetric("替换/跳过", `${fmtNumber(replacedFeeds.length)}/${fmtNumber(skippedFeeds.length)}`)
  );
  sourceHealthEl.appendChild(metricGrid);

  const issues = document.createElement("div");
  issues.className = "health-issues";
  if (failedSites.length) issues.appendChild(renderIssueList("失败站点", failedSites));
  if (zeroSites.length) issues.appendChild(renderIssueList("零结果站点", zeroSites));
  if (failedFeeds.length) issues.appendChild(renderIssueList("失败 RSS", failedFeeds));
  if (skippedFeeds.length) {
    issues.appendChild(renderIssueList("跳过 RSS", skippedFeeds.map((item) => `${item.feed_url} · ${item.reason || "skipped"}`)));
  }

  if (issues.childElementCount) {
    sourceHealthEl.appendChild(issues);
  } else {
    const ok = document.createElement("div");
    ok.className = "health-ok";
    ok.textContent = "源状态正常";
    sourceHealthEl.appendChild(ok);
  }

  // 添加RSS订阅源详细状态
  if (rss.enabled && Array.isArray(rss.feeds) && rss.feeds.length > 0) {
    const rssSection = document.createElement("details");
    rssSection.className = "health-details";
    rssSection.open = failedFeeds.length > 0; // 如果有失败的就默认展开

    const rssSummary = document.createElement("summary");
    rssSummary.textContent = `RSS 订阅源详情 (${rss.ok_feeds || 0}/${rss.feeds.length})`;
    rssSection.appendChild(rssSummary);

    const rssTable = document.createElement("div");
    rssTable.className = "source-table";

    rss.feeds.forEach((feed) => {
      const row = document.createElement("div");
      row.className = `source-row ${feed.ok ? 'source-ok' : 'source-fail'}`;

      const statusIcon = document.createElement("span");
      statusIcon.className = "source-status";
      statusIcon.textContent = feed.ok ? '✓' : '✗';

      const info = document.createElement("div");
      info.className = "source-info";

      const title = document.createElement("div");
      title.className = "source-title";
      title.textContent = feed.feed_title || feed.feed_url;

      const meta = document.createElement("div");
      meta.className = "source-meta";
      if (feed.ok) {
        meta.textContent = `${feed.item_count} 条 · ${feed.duration_ms}ms`;
      } else {
        meta.textContent = feed.error || '抓取失败';
      }

      info.appendChild(title);
      info.appendChild(meta);
      row.appendChild(statusIcon);
      row.appendChild(info);
      rssTable.appendChild(row);
    });

    rssSection.appendChild(rssTable);
    sourceHealthEl.appendChild(rssSection);
  }

  // 添加内置源详细状态
  if (sites.length > 0) {
    const sitesSection = document.createElement("details");
    sitesSection.className = "health-details";

    const sitesSummary = document.createElement("summary");
    sitesSummary.textContent = `内置数据源详情 (${status.successful_sites || 0}/${sites.length})`;
    sitesSection.appendChild(sitesSummary);

    const sitesTable = document.createElement("div");
    sitesTable.className = "source-table";

    sites.forEach((site) => {
      const row = document.createElement("div");
      row.className = `source-row ${site.ok ? 'source-ok' : 'source-fail'}`;

      const statusIcon = document.createElement("span");
      statusIcon.className = "source-status";
      statusIcon.textContent = site.ok ? '✓' : '✗';

      const info = document.createElement("div");
      info.className = "source-info";

      const title = document.createElement("div");
      title.className = "source-title";
      title.textContent = site.site_name || site.site_id;

      const meta = document.createElement("div");
      meta.className = "source-meta";
      if (site.ok) {
        meta.textContent = `${site.item_count} 条 · ${site.duration_ms}ms`;
      } else {
        meta.textContent = site.error || '抓取失败';
      }

      info.appendChild(title);
      info.appendChild(meta);
      row.appendChild(statusIcon);
      row.appendChild(info);
      sitesTable.appendChild(row);
    });

    sitesSection.appendChild(sitesTable);
    sourceHealthEl.appendChild(sitesSection);
  }

  renderAdvancedSummary();
}

async function loadNewsData() {
  const res = await fetch(`./data/latest-24h.json?t=${Date.now()}`);
  if (!res.ok) throw new Error(`加载 latest-24h.json 失败: ${res.status}`);
  return res.json();
}

async function loadAllModeData() {
  if (state.allDataLoaded) return;
  if (!state.allDataPromise) {
    state.allDataPromise = fetch(`./${state.allDataUrl}?t=${Date.now()}`)
      .then((res) => {
        if (!res.ok) throw new Error(`加载 latest-24h-all.json 失败: ${res.status}`);
        return res.json();
      })
      .then((payload) => {
        state.itemsAllRaw = payload.items_all_raw || payload.items_all || state.itemsAi;
        state.itemsAll = payload.items_all || state.itemsAi;
        state.totalRaw = payload.total_items_raw || state.itemsAllRaw.length;
        state.totalAllMode = payload.total_items_all_mode || state.itemsAll.length;
        state.allDataLoaded = true;
      })
      .catch((err) => {
        state.allDataPromise = null;
        throw err;
      });
  }
  return state.allDataPromise;
}

async function loadWaytoagiData() {
  try {
    const res = await fetch(`./data/waytoagi-7d.json?t=${Date.now()}`);
    if (!res.ok) {
      console.warn(`waytoagi-7d.json 暂未生成 (${res.status})，等待 GitHub Actions 完成...`);
      return null;
    }
    return res.json();
  } catch (error) {
    console.warn('waytoagi-7d.json 加载失败:', error.message);
    return null;
  }
}

async function loadSourceStatusData() {
  try {
    const res = await fetch(`./data/source-status.json?t=${Date.now()}`);
    if (!res.ok) {
      console.warn(`source-status.json 暂未生成 (${res.status})，等待 GitHub Actions 完成...`);
      return null;
    }
    return res.json();
  } catch (error) {
    console.warn('source-status.json 加载失败:', error.message);
    return null;
  }
}

async function init() {
  // 初始化个性化引擎
  if (typeof PersonalizationEngine !== 'undefined') {
    state.personalizationEngine = new PersonalizationEngine();
    console.log('PersonalizationEngine initialized:', state.personalizationEngine.getStats());
  } else {
    console.warn('PersonalizationEngine not loaded, personalization disabled');
    state.personalizationEnabled = false;
  }

  const [newsResult, waytoagiResult, statusResult] = await Promise.allSettled([
    loadNewsData(),
    loadWaytoagiData(),
    loadSourceStatusData(),
  ]);

  if (newsResult.status === "fulfilled") {
    const payload = newsResult.value;
    state.itemsAi = payload.items_ai || payload.items || [];
    state.itemsAllRaw = payload.items_all_raw || payload.items_all || [];
    state.itemsAll = payload.items_all || [];
    state.statsAi = payload.site_stats || [];
    state.totalAi = payload.total_items || state.itemsAi.length;
    state.totalRaw = payload.total_items_raw || state.itemsAllRaw.length;
    state.totalAllMode = payload.total_items_all_mode || state.itemsAll.length;
    state.allDataUrl = payload.all_mode_data_url || state.allDataUrl;
    state.allDataLoaded = Boolean(payload.items_all || payload.items_all_raw);
    state.generatedAt = payload.generated_at;

    setStats(payload);
    renderModeSwitch();
    renderCoverageStrip();
    renderSiteFilters();
    renderList();
    updatedAtEl.textContent = `更新时间：${fmtTime(state.generatedAt)}`;
  } else {
    updatedAtEl.textContent = "新闻数据加载失败";
    newsListEl.innerHTML = `<div class="empty">${newsResult.reason.message}</div>`;
    renderCoverageStrip(newsResult.reason.message);
  }

  if (statusResult.status === "fulfilled") {
    state.sourceStatus = statusResult.value;
    renderSourceHealth();
    renderCoverageStrip();
  } else {
    renderSourceHealth(statusResult.reason.message);
    renderCoverageStrip(statusResult.reason.message);
  }

  if (waytoagiResult.status === "fulfilled") {
    state.waytoagiData = waytoagiResult.value;
    renderWaytoagi(state.waytoagiData);
  } else {
    waytoagiUpdatedAtEl.textContent = "加载失败";
    waytoagiListEl.innerHTML = `<div class="waytoagi-error">${waytoagiResult.reason.message}</div>`;
  }
}

searchInputEl.addEventListener("input", (e) => {
  state.query = e.target.value;
  renderList();
});

siteSelectEl.addEventListener("change", (e) => {
  state.siteFilter = e.target.value;
  renderSiteFilters();
  renderList();
});

modeAiBtnEl.addEventListener("click", () => {
  state.mode = "ai";
  renderModeSwitch();
  renderSiteFilters();
  renderList();
});

modeAllBtnEl.addEventListener("click", async () => {
  state.mode = "all";
  renderModeSwitch();
  newsListEl.innerHTML = "";
  const loading = document.createElement("div");
  loading.className = "empty";
  loading.textContent = "正在加载全量更新...";
  newsListEl.appendChild(loading);
  try {
    await loadAllModeData();
    renderSiteFilters();
    renderList();
  } catch (err) {
    newsListEl.innerHTML = "";
    const failed = document.createElement("div");
    failed.className = "empty";
    failed.textContent = err.message;
    newsListEl.appendChild(failed);
  }
});

if (allDedupeToggleEl) {
  allDedupeToggleEl.addEventListener("change", (e) => {
    state.allDedup = Boolean(e.target.checked);
    renderModeSwitch();
    renderSiteFilters();
    renderList();
  });
}

if (waytoagiTodayBtnEl) {
  waytoagiTodayBtnEl.addEventListener("click", () => {
    state.waytoagiMode = "today";
    if (state.waytoagiData) renderWaytoagi(state.waytoagiData);
  });
}

if (waytoagi7dBtnEl) {
  waytoagi7dBtnEl.addEventListener("click", () => {
    state.waytoagiMode = "7d";
    if (state.waytoagiData) renderWaytoagi(state.waytoagiData);
  });
}

init();

// ============================================
// AI Filter Configuration Management
// ============================================

const AIFilterConfig = {
  storageKey: 'ai_filter_config',
  
  // 加载配置
  load() {
    const stored = localStorage.getItem(this.storageKey);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error('Failed to parse AI filter config:', e);
      }
    }
    return {
      apiKey: '',
      enabled: false,
      baseUrl: 'https://api.easyrouter.ai/v1'
    };
  },
  
  // 保存配置
  save(config) {
    localStorage.setItem(this.storageKey, JSON.stringify(config));
  },
  
  // 清除配置
  clear() {
    localStorage.removeItem(this.storageKey);
  },
  
  // 更新UI状态
  updateUI(config) {
    const statusBadge = document.getElementById('filterStatusBadge');
    const statusText = document.getElementById('filterStatusText');
    const apiKeyInput = document.getElementById('apiKeyInput');
    const enableToggle = document.getElementById('enableFilterToggle');
    
    if (!statusBadge || !statusText) return;
    
    if (config.enabled && config.apiKey) {
      statusBadge.textContent = '已启用';
      statusBadge.className = 'status-badge active';
      statusText.textContent = 'AI智能筛选已启用（三级白名单系统）';
    } else if (config.apiKey) {
      statusBadge.textContent = '已配置';
      statusBadge.className = 'status-badge inactive';
      statusText.textContent = 'API密钥已配置，但AI筛选未启用';
    } else {
      statusBadge.textContent = '未配置';
      statusBadge.className = 'status-badge';
      statusText.textContent = 'AI智能筛选未启用';
    }
    
    if (apiKeyInput) {
      apiKeyInput.value = config.apiKey || '';
    }
    if (enableToggle) {
      enableToggle.checked = config.enabled || false;
    }
  },
  
  // 显示消息
  showMessage(message, type = 'info') {
    const msgEl = document.getElementById('configMessage');
    if (!msgEl) return;
    
    msgEl.textContent = message;
    msgEl.className = `config-message ${type}`;
    msgEl.style.display = 'block';
    
    setTimeout(() => {
      msgEl.style.display = 'none';
    }, 5000);
  },
  
  // 测试API连接
  async testConnection(apiKey) {
    if (!apiKey) {
      this.showMessage('请先输入API密钥', 'error');
      return false;
    }
    
    this.showMessage('正在测试连接...', 'info');
    
    try {
      const response = await fetch('https://api.easyrouter.ai/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
      
      if (response.ok) {
        this.showMessage('✅ 连接成功！API密钥有效', 'success');
        return true;
      } else {
        this.showMessage(`❌ 连接失败：${response.status} ${response.statusText}`, 'error');
        return false;
      }
    } catch (error) {
      this.showMessage(`❌ 连接失败：${error.message}`, 'error');
      return false;
    }
  },
  
  // 初始化
  init() {
    const config = this.load();
    this.updateUI(config);
    
    // 密钥可见性切换
    const toggleBtn = document.getElementById('toggleApiKeyBtn');
    const apiKeyInput = document.getElementById('apiKeyInput');
    
    if (toggleBtn && apiKeyInput) {
      toggleBtn.addEventListener('click', () => {
        if (apiKeyInput.type === 'password') {
          apiKeyInput.type = 'text';
          toggleBtn.textContent = '🙈';
        } else {
          apiKeyInput.type = 'password';
          toggleBtn.textContent = '👁️';
        }
      });
    }
    
    // 保存配置
    const saveBtn = document.getElementById('saveConfigBtn');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        const apiKey = apiKeyInput?.value.trim() || '';
        const enabled = document.getElementById('enableFilterToggle')?.checked || false;
        
        if (enabled && !apiKey) {
          this.showMessage('启用AI筛选需要先配置API密钥', 'error');
          return;
        }
        
        const newConfig = {
          apiKey,
          enabled,
          baseUrl: 'https://api.easyrouter.ai/v1'
        };
        
        this.save(newConfig);
        this.updateUI(newConfig);
        this.showMessage('✅ 配置已保存！刷新页面后生效', 'success');
        
        // 提示用户需要后端配置
        if (apiKey && enabled) {
          setTimeout(() => {
            this.showMessage(
              '⚠️ 注意：前端配置仅用于显示。要真正启用AI筛选，需要在服务器端配置.env文件',
              'info'
            );
          }, 3000);
        }
      });
    }
    
    // 测试连接
    const testBtn = document.getElementById('testConfigBtn');
    if (testBtn) {
      testBtn.addEventListener('click', () => {
        const apiKey = apiKeyInput?.value.trim() || '';
        this.testConnection(apiKey);
      });
    }
    
    // 清除配置
    const clearBtn = document.getElementById('clearConfigBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (confirm('确定要清除所有AI筛选配置吗？')) {
          this.clear();
          this.updateUI({ apiKey: '', enabled: false });
          this.showMessage('配置已清除', 'info');
        }
      });
    }
  }
};

// 在页面加载时初始化配置管理
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    AIFilterConfig.init();
  });
} else {
  AIFilterConfig.init();
}
