const toast = document.getElementById("toast");
const statusText = document.getElementById("statusText");
const moodBar = document.getElementById("moodBar");
const comboCount = document.getElementById("comboCount");
const levelBadge = document.getElementById("levelBadge");
const resetRankBtn = document.getElementById("resetRankBtn");
const topViewButtons = Array.from(document.querySelectorAll("[data-topview]"));
const consoleView = document.getElementById("consoleView");
const historyView = document.getElementById("historyView");
const historyList = document.getElementById("historyList");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");

const emotionView = document.getElementById("emotionView");
const reviewView = document.getElementById("reviewView");
const simChatView = document.getElementById("simChatView");
const modeButtons = Array.from(document.querySelectorAll("[data-mode]"));

const companyInput = document.getElementById("companyInput");
const jobInput = document.getElementById("jobInput");
const resumeInput = document.getElementById("resumeInput");
const rejectInput = document.getElementById("rejectInput");
const toneSelect = document.getElementById("toneSelect");
const analyzeBtn = document.getElementById("analyzeBtn");

const comfortText = document.getElementById("comfortText");
const roastText = document.getElementById("roastText");
const reasonList = document.getElementById("reasonList");
const altRoleList = document.getElementById("altRoleList");

const ventBtn = document.getElementById("ventBtn");
const healBtn = document.getElementById("healBtn");

const checklistList = document.getElementById("checklistList");
const checkStat = document.getElementById("checkStat");
const newCheckInput = document.getElementById("newCheckInput");
const addCheckBtn = document.getElementById("addCheckBtn");

const trackTabs = document.getElementById("trackTabs");
const reviewLangSelect = document.getElementById("reviewLangSelect");
const painPointInput = document.getElementById("painPointInput");
const diagnoseBtn = document.getElementById("diagnoseBtn");
const analysisText = document.getElementById("analysisText");
const conceptText = document.getElementById("conceptText");
const actionText = document.getElementById("actionText");
const insightsList = document.getElementById("insightsList");
const resourcesList = document.getElementById("resourcesList");
const codeCard = document.getElementById("codeCard");
const codeText = document.getElementById("codeText");

const chatOverlay = document.getElementById("chatOverlay");
const chatTitle = document.getElementById("chatTitle");
const chatMessages = document.getElementById("chatMessages");
const chatInput = document.getElementById("chatInput");
const sendChatBtn = document.getElementById("sendChatBtn");
const closeChatBtn = document.getElementById("closeChatBtn");

const simMessages = document.getElementById("simMessages");
const simInput = document.getElementById("simInput");
const simSendBtn = document.getElementById("simSendBtn");
const simResetBtn = document.getElementById("simResetBtn");
const simFlavorSelect = document.getElementById("simFlavorSelect");

let currentMode = "emotion";
let selectedTrack = "knowledge";
let successCount = 0;
let moodValue = 18;
let chatFlavor = "heal";
let chatHistory = [];
let simHistory = [];
const PROGRESS_STORAGE_KEY = "arc_progress_v1";
const HISTORY_STORAGE_KEY = "arc_history_v1";
const HISTORY_LIMIT = 120;
let currentTopView = "console";
let historyRecords = [];

function saveProgress() {
  try {
    localStorage.setItem(
      PROGRESS_STORAGE_KEY,
      JSON.stringify({
        successCount,
        moodValue,
      }),
    );
  } catch {
    // Ignore storage write failures (private mode, quota, etc.)
  }
}

function loadProgress() {
  try {
    const raw = localStorage.getItem(PROGRESS_STORAGE_KEY);
    if (!raw) {
      return;
    }
    const parsed = JSON.parse(raw);
    if (typeof parsed.successCount === "number" && Number.isFinite(parsed.successCount)) {
      successCount = Math.max(0, Math.floor(parsed.successCount));
    }
    if (typeof parsed.moodValue === "number" && Number.isFinite(parsed.moodValue)) {
      moodValue = Math.max(8, Math.min(100, parsed.moodValue));
    }
  } catch {
    // Ignore malformed storage and continue with defaults.
  }
}

function saveHistory() {
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(historyRecords));
  } catch {
    // Ignore storage write failures.
  }
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) {
      historyRecords = [];
      return;
    }
    const parsed = JSON.parse(raw);
    historyRecords = Array.isArray(parsed) ? parsed : [];
  } catch {
    historyRecords = [];
  }
}

function formatTime(ts) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) {
    return "未知时间";
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function renderHistory() {
  if (!historyList) {
    return;
  }

  if (!historyRecords.length) {
    historyList.innerHTML = '<div class="history-empty">暂无历史记录，先去控制台完成一次分析或对话吧。</div>';
    return;
  }

  historyList.innerHTML = historyRecords
    .map(
      (item) => `
      <article class="history-item">
        <div class="history-meta">
          <span class="history-tag">${escapeHtml(item.tag || "记录")}</span>
          <time>${escapeHtml(formatTime(item.ts))}</time>
        </div>
        <h3>${escapeHtml(item.title || "未命名记录")}</h3>
        <p>${escapeHtml(String(item.detail || "(无详情)"))}</p>
      </article>
    `,
    )
    .join("");
}

function addHistoryRecord({ tag, title, detail }) {
  const entry = {
    tag: String(tag || "记录"),
    title: String(title || "未命名记录"),
    detail: String(detail || ""),
    ts: Date.now(),
  };
  historyRecords.unshift(entry);
  if (historyRecords.length > HISTORY_LIMIT) {
    historyRecords = historyRecords.slice(0, HISTORY_LIMIT);
  }
  saveHistory();
  renderHistory();
}

function switchTopView(view) {
  currentTopView = view === "history" ? "history" : "console";

  if (consoleView) {
    consoleView.classList.toggle("hidden", currentTopView !== "console");
  }
  if (historyView) {
    historyView.classList.toggle("hidden", currentTopView !== "history");
  }

  topViewButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.topview === currentTopView);
  });

  if (currentTopView === "history") {
    setStatus("历史记录模式：可回看你之前的分析与对话片段。");
  } else {
    switchMode(currentMode);
  }
}

function resetRankProgress() {
  successCount = 0;
  moodValue = 18;
  localStorage.removeItem(PROGRESS_STORAGE_KEY);
  updateLevel();
  setMood(18);
  setStatus("段位与连击已重置为初始值。");
  showToast("已重置段位。", true);
}

let checklist = [
  { id: 1, text: "把拒信邮件移出收件箱，避免二次刺激", checked: true },
  { id: 2, text: "写出 3 条本轮可控因素，停止自我归罪", checked: false },
  { id: 3, text: "针对岗位差距补一项技能小项目", checked: false },
  { id: 4, text: "本周继续投递 3 个更匹配岗位", checked: false },
];

function showToast(message) {
  toast.textContent = message;
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 2500);
}

function setStatus(message) {
  statusText.textContent = message;
}

function setMood(value) {
  moodValue = Math.max(8, Math.min(100, value));
  moodBar.style.width = `${moodValue}%`;
  saveProgress();
}

function updateLevel() {
  comboCount.textContent = String(successCount);
  if (successCount >= 8) {
    levelBadge.textContent = "王者反弹体";
  } else if (successCount >= 4) {
    levelBadge.textContent = "黄金抗压者";
  } else if (successCount >= 1) {
    levelBadge.textContent = "白银再出发";
  } else {
    levelBadge.textContent = "青铜复活者";
  }
  saveProgress();
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function convertMathExpression(expr) {
  let output = expr;

  output = output.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, "($1)/($2)");
  output = output.replace(/([A-Za-z0-9])_\{([^{}]+)\}/g, "$1<sub>$2</sub>");
  output = output.replace(/([A-Za-z0-9])_([A-Za-z0-9]+)/g, "$1<sub>$2</sub>");
  output = output.replace(/([A-Za-z0-9])\^\{([^{}]+)\}/g, "$1<sup>$2</sup>");
  output = output.replace(/([A-Za-z0-9])\^([A-Za-z0-9]+)/g, "$1<sup>$2</sup>");

  return output;
}

function renderRichText(value) {
  const escaped = escapeHtml(String(value || ""));

  const withBlockMath = escaped.replace(/\$\$([\s\S]+?)\$\$/g, (_, expr) => {
    return `<div class="math-block">${convertMathExpression(expr)}</div>`;
  });

  const withInlineMath = withBlockMath.replace(/\$([^$]+)\$/g, (_, expr) => {
    return `<span class="math-inline">${convertMathExpression(expr)}</span>`;
  });

  return withInlineMath.replace(/\n/g, "<br>");
}

function setRichText(node, value) {
  node.innerHTML = renderRichText(value);
}

function switchMode(mode) {
  if (mode === "review") {
    currentMode = "review";
  } else if (mode === "simchat") {
    currentMode = "simchat";
  } else {
    currentMode = "emotion";
  }

  const isEmotion = currentMode === "emotion";
  const isReview = currentMode === "review";
  const isSimChat = currentMode === "simchat";

  emotionView.classList.toggle("hidden", !isEmotion);
  reviewView.classList.toggle("hidden", !isReview);
  simChatView.classList.toggle("hidden", !isSimChat);

  modeButtons.forEach((btn) => {
    if (btn.dataset.mode === currentMode) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  if (isEmotion) {
    setStatus("情绪模式已就绪：先做分析，再定行动。");
  } else if (isReview) {
    setStatus("复盘模式已就绪：开始定位卡点。");
  } else {
    setStatus("拟真聊天已就绪：可以开始连续对话练习。");
  }
}

function renderChecklist() {
  checklistList.innerHTML = checklist
    .map(
      (item) => `
      <div class="check-item ${item.checked ? "done" : ""}" data-id="${item.id}">
        <span class="check-dot">${item.checked ? "✓" : ""}</span>
        <span class="check-text">${escapeHtml(item.text)}</span>
      </div>
    `,
    )
    .join("");

  const done = checklist.filter((item) => item.checked).length;
  checkStat.textContent = `已完成 ${done}/${checklist.length}`;
}

function pushChecklistItem() {
  const text = (newCheckInput.value || "").trim();
  if (!text) {
    return;
  }
  checklist.push({ id: Date.now(), text, checked: false });
  newCheckInput.value = "";
  renderChecklist();
}

checklistList.addEventListener("click", (event) => {
  const item = event.target.closest(".check-item");
  if (!item) {
    return;
  }
  const id = Number(item.dataset.id);
  checklist = checklist.map((row) => (row.id === id ? { ...row, checked: !row.checked } : row));
  renderChecklist();
});

addCheckBtn.addEventListener("click", pushChecklistItem);
newCheckInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    pushChecklistItem();
  }
});

function normalizePlanToChecklist(plan) {
  const rows = [];

  if (Array.isArray(plan)) {
    plan.forEach((weekItem, weekIndex) => {
      const weekLabel = weekItem && weekItem.week ? String(weekItem.week) : `第${weekIndex + 1}周`;
      const tasks = Array.isArray(weekItem?.tasks) ? weekItem.tasks : [];

      if (tasks.length === 0 && weekItem?.goal) {
        rows.push({ text: `${weekLabel}：${String(weekItem.goal)}` });
      }

      tasks.forEach((task) => {
        rows.push({ text: `${weekLabel} · ${String(task)}` });
      });
    });
  } else if (typeof plan === "string" && plan.trim()) {
    plan
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line) => rows.push({ text: line }));
  }

  if (rows.length === 0) {
    rows.push({ text: "本周先补齐核心短板，再做一次模拟复盘" });
  }

  checklist = rows.slice(0, 14).map((item, idx) => ({
    id: Date.now() + idx,
    text: item.text,
    checked: false,
  }));

  renderChecklist();
}

function renderAnalysisList(node, items) {
  if (!Array.isArray(items) || items.length === 0) {
    node.innerHTML = '<div class="analysis-item"><strong>提示</strong><p>暂无结构化分析，请稍后重试。</p></div>';
    return;
  }

  node.innerHTML = items
    .map((item, index) => {
      if (typeof item === "string") {
        return `<div class="analysis-item"><strong>原因 ${index + 1}</strong><p>${escapeHtml(item)}</p></div>`;
      }
      const title = escapeHtml(item.title || `原因 ${index + 1}`);
      const detail = escapeHtml(item.detail || "-");
      const confidence = item.confidence !== undefined ? `（置信度 ${escapeHtml(item.confidence)}）` : "";
      return `<div class="analysis-item"><strong>${title}${confidence}</strong><p>${detail}</p></div>`;
    })
    .join("");
}

function renderAltRoles(items) {
  if (!Array.isArray(items) || items.length === 0) {
    altRoleList.innerHTML = '<div class="analysis-item"><strong>暂无替代岗位</strong><p>建议先根据分析补齐一项关键能力再投递。</p></div>';
    return;
  }

  altRoleList.innerHTML = items
    .map((item, index) => {
      if (typeof item === "string") {
        return `<div class="analysis-item"><strong>建议岗位 ${index + 1}</strong><p>${escapeHtml(item)}</p></div>`;
      }
      const role = escapeHtml(item.role || `建议岗位 ${index + 1}`);
      const reason = escapeHtml(item.reason || "-");
      const action = escapeHtml(item.next_action || "-");
      return `<div class="analysis-item"><strong>${role}</strong><p>原因：${reason}</p><p>下一步：${action}</p></div>`;
    })
    .join("");
}

async function runReboundAnalysis() {
  const companyName = (companyInput.value || "").trim();
  const jobDesc = (jobInput.value || "").trim();
  const resumeText = (resumeInput.value || "").trim();
  const rejectText = (rejectInput.value || "").trim();
  const tone = toneSelect.value || "高情商";

  if (!jobDesc) {
    showToast("请先输入目标职位要求。");
    return;
  }
  if (!resumeText) {
    showToast("请先输入你的简历内容。");
    return;
  }
  if (!rejectText) {
    showToast("请先输入拒信文本或被拒经历。");
    return;
  }

  analyzeBtn.disabled = true;
  analyzeBtn.textContent = "分析中...";
  setStatus("正在分析岗位匹配差距，并生成反弹计划...");

  try {
    const body = new URLSearchParams();
    body.set("company_name", companyName || "这家公司");
    body.set("job_desc", jobDesc);
    body.set("resume_text", resumeText);
    body.set("reject_text", rejectText);
    body.set("tone", tone);

    const response = await fetch("/api/rebound", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: body.toString(),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || `请求失败（HTTP ${response.status}）`);
    }

    comfortText.textContent = String(data.comfort || "-");
    roastText.textContent = String(data.reverse_roast || "-");

    const analysis = Array.isArray(data.analysis) ? data.analysis : [];
    renderAnalysisList(reasonList, analysis);

    normalizePlanToChecklist(data.rebound_plan);
    renderAltRoles(Array.isArray(data.alt_roles) ? data.alt_roles : []);

    setMood(moodValue + 18);
    successCount += 1;
    updateLevel();
    addHistoryRecord({
      tag: "情绪粉碎",
      title: `${companyName || "目标公司"} 落选复盘`,
      detail: `风格：${tone}；拒信摘要：${rejectText.slice(0, 70)}${rejectText.length > 70 ? "..." : ""}`,
    });
    setStatus("分析完成：已生成归因、计划与替代岗位建议。");
    showToast("分析完成，先执行清单第1项。", true);
  } catch (error) {
    showToast(error.message || "分析失败，请稍后重试。");
    setStatus("分析失败：请检查 AI 配置或稍后重试。");
  } finally {
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = "开始分析：原因 + 计划";
  }
}

function appendMessage(role, text) {
  const node = document.createElement("div");
  node.className = `msg ${role}`;
  node.textContent = text;
  chatMessages.appendChild(node);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function openChat(flavor) {
  const input = (rejectInput.value || "").trim();
  if (!input) {
    showToast("请先输入拒信文本或经历。", true);
    return;
  }

  chatFlavor = flavor;
  chatHistory = [];
  chatMessages.innerHTML = "";
  chatTitle.textContent = flavor === "vent" ? "发疯实验室：火力全开" : "治愈空间：温暖拥抱";
  chatOverlay.classList.remove("hidden");
  sendChat(input);
}

function closeChat() {
  chatOverlay.classList.add("hidden");
}

async function sendChat(message) {
  const trimmed = String(message || "").trim();
  if (!trimmed) {
    return;
  }

  appendMessage("user", trimmed);

  sendChatBtn.disabled = true;
  sendChatBtn.textContent = "发送中...";
  setStatus(chatFlavor === "vent" ? "发疯模式进行中：正在生成高能回击。" : "治愈模式进行中：正在生成安抚回复。");

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        flavor: chatFlavor,
        message: trimmed,
        history: chatHistory,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || `请求失败（HTTP ${response.status}）`);
    }

    const reply = String(data.reply || "").trim();
    appendMessage("ai", reply || "我在，继续说。");

    chatHistory.push({ role: "user", text: trimmed });
    chatHistory.push({ role: "assistant", text: reply });

    setMood(moodValue + 12);
    successCount += 1;
    updateLevel();
    addHistoryRecord({
      tag: chatFlavor === "vent" ? "发疯对话" : "治愈对话",
      title: "情绪对话片段",
      detail: `你：${trimmed.slice(0, 60)}${trimmed.length > 60 ? "..." : ""}`,
    });
  } catch (error) {
    showToast(error.message || "聊天失败，请稍后重试。");
    setStatus("聊天失败：请检查服务配置后重试。");
  } finally {
    sendChatBtn.disabled = false;
    sendChatBtn.textContent = "发送";
  }
}

async function requestChatReply({ flavor, message, history }) {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      flavor,
      message,
      history,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `请求失败（HTTP ${response.status}）`);
  }
  return String(data.reply || "").trim();
}

function appendSimMessage(role, text) {
  const node = document.createElement("div");
  node.className = `msg ${role}`;
  node.textContent = text;
  simMessages.appendChild(node);
  simMessages.scrollTop = simMessages.scrollHeight;
}

async function sendSimMessage(message) {
  const trimmed = String(message || "").trim();
  if (!trimmed) {
    return;
  }

  appendSimMessage("user", trimmed);
  simSendBtn.disabled = true;
  simSendBtn.textContent = "发送中...";
  setStatus("拟真聊天进行中：AI 正在组织回应。");

  try {
    const reply = await requestChatReply({
      flavor: simFlavorSelect.value || "heal",
      message: trimmed,
      history: simHistory,
    });

    appendSimMessage("ai", reply || "收到，我们继续。\n");
    simHistory.push({ role: "user", text: trimmed });
    simHistory.push({ role: "assistant", text: reply });

    setMood(moodValue + 6);
    successCount += 1;
    updateLevel();
    addHistoryRecord({
      tag: "拟真聊天",
      title: `风格：${simFlavorSelect.value === "vent" ? "高能嘴替" : "理性教练"}`,
      detail: `你：${trimmed.slice(0, 60)}${trimmed.length > 60 ? "..." : ""}`,
    });
  } catch (error) {
    showToast(error.message || "拟真聊天失败，请稍后重试。");
    setStatus("拟真聊天失败：请检查服务配置后重试。");
  } finally {
    simSendBtn.disabled = false;
    simSendBtn.textContent = "发送";
  }
}

function resetSimChat() {
  simHistory = [];
  simMessages.innerHTML = "";
  appendSimMessage("ai", "你好，我是你的拟真对话搭子。你可以直接开始提问或演练表达。");
  setStatus("拟真聊天已重置：开始新一轮对话。");
}

ventBtn.addEventListener("click", () => openChat("vent"));
healBtn.addEventListener("click", () => openChat("heal"));
analyzeBtn.addEventListener("click", runReboundAnalysis);
closeChatBtn.addEventListener("click", closeChat);
simSendBtn.addEventListener("click", () => {
  const text = simInput.value;
  simInput.value = "";
  sendSimMessage(text);
});
simResetBtn.addEventListener("click", resetSimChat);

simInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    const text = simInput.value;
    simInput.value = "";
    sendSimMessage(text);
  }
});

sendChatBtn.addEventListener("click", () => {
  const text = chatInput.value;
  chatInput.value = "";
  sendChat(text);
});

chatInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    const text = chatInput.value;
    chatInput.value = "";
    sendChat(text);
  }
});

chatOverlay.addEventListener("click", (event) => {
  if (event.target === chatOverlay) {
    closeChat();
  }
});

trackTabs.addEventListener("click", (event) => {
  const button = event.target.closest(".track-btn");
  if (!button) {
    return;
  }
  selectedTrack = button.dataset.track === "algo" ? "algo" : "knowledge";
  trackTabs.querySelectorAll(".track-btn").forEach((node) => node.classList.remove("active"));
  button.classList.add("active");

  const langLabel = languageLabel(reviewLangSelect.value);

  if (selectedTrack === "algo") {
    painPointInput.placeholder = `请输入你今日遇到的 ${langLabel} 算法难题（如 LRU、三数之和、动态规划...）`;
  } else {
    painPointInput.placeholder = `记录你在 ${langLabel} 八股中的卡点（如并发、内存模型、框架原理...）`;
  }
});

function languageLabel(value) {
  const mapping = {
    java: "Java",
    cpp: "C++",
    python: "Python",
    go: "Go",
    javascript: "JavaScript",
  };
  return mapping[value] || "Java";
}

function refreshDiagnosisPlaceholder() {
  const langLabel = languageLabel(reviewLangSelect.value);

  if (selectedTrack === "algo") {
    painPointInput.placeholder = `请输入你今日遇到的 ${langLabel} 算法难题（如 LRU、三数之和、动态规划...）`;
  } else {
    painPointInput.placeholder = `记录你在 ${langLabel} 八股中的卡点（如并发、内存模型、框架原理...）`;
  }
}

reviewLangSelect.addEventListener("change", refreshDiagnosisPlaceholder);

function renderMiniList(node, items, renderLink = false) {
  node.innerHTML = (items || [])
    .map((item) => {
      if (renderLink) {
        const text = escapeHtml(item.text || "资源");
        const link = escapeHtml(item.link || "#");
        const type = escapeHtml(item.type || "file");
        return `<div class="mini-item"><a href="${link}" target="_blank" rel="noreferrer">${text}</a><span class="meta">类型：${type}</span></div>`;
      }
      const user = escapeHtml(item.user || "匿名用户");
      const title = escapeHtml(item.title || "经验分享");
      const stats = escapeHtml(item.stats || "-");
      return `<div class="mini-item"><strong>${title}</strong><span class="meta">${user} · ${stats}</span></div>`;
    })
    .join("");
}

async function runDiagnosis() {
  const painPoint = (painPointInput.value || "").trim();
  const language = (reviewLangSelect.value || "java").trim().toLowerCase();
  if (!painPoint) {
    showToast("请先输入你当前的卡点。");
    return;
  }

  diagnoseBtn.disabled = true;
  diagnoseBtn.textContent = "诊断中...";
  setStatus("复盘进行中：正在提炼关键问题与训练路径。");

  try {
    const response = await fetch("/api/diagnose", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        track: selectedTrack,
        language,
        pain_point: painPoint,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || `请求失败（HTTP ${response.status}）`);
    }

    setRichText(analysisText, String(data.analysis || ""));
    setRichText(conceptText, String(data.concept || "-"));
    setRichText(actionText, String(data.action || "-"));

    if (selectedTrack === "algo") {
      codeCard.classList.remove("hidden");
      codeText.textContent = String(data.code || "");
    } else {
      codeCard.classList.add("hidden");
      codeText.textContent = "";
    }

    renderMiniList(insightsList, data.insights || [], false);
    renderMiniList(resourcesList, data.resources || [], true);

    setMood(moodValue + 14);
    successCount += 1;
    updateLevel();
    addHistoryRecord({
      tag: "硬核复盘",
      title: `${selectedTrack === "algo" ? "算法手撕" : "八股"} · ${languageLabel(language)}`,
      detail: `问题：${painPoint.slice(0, 70)}${painPoint.length > 70 ? "..." : ""}`,
    });
    setStatus("复盘完成：已生成诊断与训练建议。");
    showToast("诊断完成，建议立即执行第一条行动项。");
  } catch (error) {
    showToast(error.message || "诊断失败，请稍后重试。");
    setStatus("诊断失败：请检查服务配置后重试。");
  } finally {
    diagnoseBtn.disabled = false;
    diagnoseBtn.textContent = "AI 深度诊断与靶向学习";
  }
}

diagnoseBtn.addEventListener("click", runDiagnosis);

modeButtons.forEach((button) => {
  button.addEventListener("click", () => switchMode(button.dataset.mode));
});

topViewButtons.forEach((button) => {
  button.addEventListener("click", () => switchTopView(button.dataset.topview));
});

if (clearHistoryBtn) {
  clearHistoryBtn.addEventListener("click", () => {
    historyRecords = [];
    saveHistory();
    renderHistory();
    showToast("历史记录已清空。");
  });
}

if (resetRankBtn) {
  resetRankBtn.addEventListener("click", resetRankProgress);
}

loadProgress();
loadHistory();
renderChecklist();
renderHistory();
updateLevel();
setMood(moodValue);
switchMode("emotion");
switchTopView("console");
refreshDiagnosisPlaceholder();
resetSimChat();
