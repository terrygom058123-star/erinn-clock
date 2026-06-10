// ─── 에린 시간 계산 ───────────────────────────────────────
// 현실 36분(2160초) = 에린 1일 / 에린 1시간 = 90초 / 에린 1분 = 1.5초
const BASE_CORRECTION = -7;

function getErinnTime(offsetSec = 0) {
  const now = Math.floor(Date.now() / 1000) + BASE_CORRECTION + offsetSec;
  const s = now % 2160;
  return {
    hours:    Math.floor(s / 90),
    minutes:  Math.floor((s % 90) / 1.5),
    seconds:  Math.floor((s % 1.5) / (1.5 / 60)),
    progress: s / 2160,
  };
}

function pad(n) { return String(n).padStart(2, "0"); }

function formatErrin(h, m) {
  const period = h < 12 ? "오전" : "오후";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return { period, display: `${pad(hh)}:${pad(m)}` };
}

// ─── 색상 그라데이션 ──────────────────────────────────────
function hexToRgb(hex) {
  return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)];
}
function lerpRGB(a, b, t) {
  return `rgb(${Math.round(a[0]+(b[0]-a[0])*t)},${Math.round(a[1]+(b[1]-a[1])*t)},${Math.round(a[2]+(b[2]-a[2])*t)})`;
}
const STOPS = [
  { hour:  0, from:"#06051a", to:"#110d38", bar:"#7c3aed", icon:"🌌", label:"새벽" },
  { hour:  4, from:"#0e0626", to:"#1c1050", bar:"#6d28d9", icon:"🌌", label:"새벽" },
  { hour:  6, from:"#7c2d0a", to:"#c2410c", bar:"#fb923c", icon:"🌅", label:"아침" },
  { hour:  9, from:"#854d0e", to:"#ca8a04", bar:"#fde68a", icon:"🌄", label:"아침" },
  { hour: 12, from:"#1e3a8a", to:"#0369a1", bar:"#fde047", icon:"☀️", label:"낮"  },
  { hour: 16, from:"#1e40af", to:"#0284c7", bar:"#fbbf24", icon:"☀️", label:"낮"  },
  { hour: 18, from:"#7c2d12", to:"#881337", bar:"#f97316", icon:"🌇", label:"저녁" },
  { hour: 20, from:"#0f172a", to:"#1e1b4b", bar:"#818cf8", icon:"🌙", label:"밤"  },
  { hour: 24, from:"#06051a", to:"#110d38", bar:"#7c3aed", icon:"🌌", label:"새벽" },
];
function getTheme(h, m) {
  const frac = h + m / 60;
  let i = STOPS.length - 2;
  for (let j = 0; j < STOPS.length - 1; j++) {
    if (frac >= STOPS[j].hour && frac < STOPS[j+1].hour) { i = j; break; }
  }
  const s1 = STOPS[i], s2 = STOPS[i+1];
  const t = (frac - s1.hour) / (s2.hour - s1.hour);
  return {
    from:  lerpRGB(hexToRgb(s1.from), hexToRgb(s2.from), t),
    to:    lerpRGB(hexToRgb(s1.to),   hexToRgb(s2.to),   t),
    bar:   lerpRGB(hexToRgb(s1.bar),  hexToRgb(s2.bar),  t),
    icon:  t < 0.5 ? s1.icon  : s2.icon,
    label: t < 0.5 ? s1.label : s2.label,
  };
}

// ─── 작업 타이머 ─────────────────────────────────────────────
const TASKS = [
  { id: "bandage",  name: "최고급 수제붕대\n굵은 실뭉치", icon: "🧵", duration: 720  }, // 현실 12분
  { id: "takoyaki", name: "낙지 츄",                     icon: "🐙", duration: 900  }, // 현실 15분
];

let taskState = JSON.parse(localStorage.getItem("erinn-tasks") || "{}");
function saveTaskState() { localStorage.setItem("erinn-tasks", JSON.stringify(taskState)); }

function getRemaining(id) {
  const t = taskState[id];
  if (!t) return null;
  return Math.max(0, t.duration - (Date.now() - t.startedAt) / 1000);
}

function renderTasks() {
  const container = document.getElementById("task-timers");
  if (!container) return;
  container.innerHTML = TASKS.map(task => {
    const rem   = getRemaining(task.id);
    const idle  = rem === null;
    const done  = rem !== null && rem <= 0;
    const running = rem !== null && rem > 0;
    const display = idle ? task.duration : rem;
    const mm = String(Math.floor(display / 60)).padStart(2, "0");
    const ss = String(Math.floor(display % 60)).padStart(2, "0");
    const pct = idle ? 0 : Math.round((1 - rem / taskState[task.id].duration) * 100);

    return `
    <div class="task-card ${running ? "running" : ""} ${done ? "done" : ""}">
      <div class="task-left">
        <span class="task-icon">${task.icon}</span>
        <div>
          <div class="task-name">${task.name.replace("\n", "<br>")}</div>
          <div class="task-sub">현실 ${task.duration/60}분 · 에린 ${task.duration/90}시간</div>
          ${running ? `<div style="margin-top:6px;width:120px;height:4px;background:#0f172a;border-radius:3px;overflow:hidden"><div style="width:${pct}%;height:100%;background:#22c55e;border-radius:3px;transition:width 1s linear"></div></div>` : ""}
        </div>
      </div>
      <div class="task-right">
        <div class="task-countdown ${done ? "done" : ""}">${done ? "✅완료!" : `${mm}:${ss}`}</div>
        ${idle || done
          ? `<button class="btn-task-start" data-id="${task.id}">▶ 시작</button>`
          : `<button class="btn-task-reset" data-id="${task.id}">리셋</button>`}
      </div>
    </div>`;
  }).join("");

  container.querySelectorAll(".btn-task-start").forEach(btn => {
    btn.addEventListener("click", () => {
      const task = TASKS.find(t => t.id === btn.dataset.id);
      taskState[task.id] = { startedAt: Date.now(), duration: task.duration, notified: false };
      saveTaskState(); renderTasks();
    });
  });
  container.querySelectorAll(".btn-task-reset").forEach(btn => {
    btn.addEventListener("click", () => {
      delete taskState[btn.dataset.id];
      saveTaskState(); renderTasks();
    });
  });
}
renderTasks();

// ─── 오디오 (아이폰 PWA 대응) ──────────────────────────────
let audioCtx = null;

function unlockAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  // 무음 재생으로 잠금 해제
  const buf = audioCtx.createBuffer(1, 1, 22050);
  const src = audioCtx.createBufferSource();
  src.buffer = buf;
  src.connect(audioCtx.destination);
  src.start(0);
}
document.addEventListener("touchstart", unlockAudio, { once: true });
document.addEventListener("click",      unlockAudio, { once: true });

function playWebSound() {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  [0, 0.45, 0.9].forEach(offset => {
    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.8, now + offset);
    gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.35);
    osc.start(now + offset);
    osc.stop(now + offset + 0.35);
  });
}

// 알림 권한 요청 (홈 화면 추가 PWA + iOS 16.4 이상에서 동작)
if ("Notification" in window && Notification.permission === "default") {
  Notification.requestPermission();
}
function sendNotification(label, period, display) {
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(`⏰ ${label}`, { body: `에린 ${period} ${display}` });
  }
}

// ─── 상태 ────────────────────────────────────────────────
const DEFAULT_ALARMS = [
  {h:0,  m:20}, {h:1,  m:40}, {h:3,  m:0},  {h:4,  m:20},
  {h:5,  m:40}, {h:7,  m:0},  {h:8,  m:20}, {h:9,  m:40},
  {h:11, m:0},  {h:12, m:20}, {h:13, m:40}, {h:15, m:0},
  {h:16, m:20}, {h:17, m:40}, {h:19, m:0},  {h:20, m:20},
  {h:21, m:40}, {h:23, m:0},
].map((t, i) => ({
  id: "default_" + i,
  label: "굵은 실",
  h: t.h, m: t.m,
  enabled: true,
}));

let alarms = JSON.parse(localStorage.getItem("erinn-alarms") || "null");
if (!alarms || alarms.length === 0) {
  alarms = DEFAULT_ALARMS;
  localStorage.setItem("erinn-alarms", JSON.stringify(alarms));
}
let offsetSec = parseInt(localStorage.getItem("erinn-offset") || "0", 10);
let activeAlert = null;
let titleBlinkTimer = null;
let repeatTimer = null;
const lastTriggered = {};

function saveAlarms() { localStorage.setItem("erinn-alarms", JSON.stringify(alarms)); }

// ─── DOM 참조 ─────────────────────────────────────────────
const clockCard    = document.getElementById("clock-card");
const clockLabel   = document.getElementById("clock-label");
const clockIcon    = document.getElementById("clock-icon");
const clockPeriod  = document.getElementById("clock-period");
const clockDigits  = document.getElementById("clock-digits");
const clockSeconds = document.getElementById("clock-seconds");
const progressFill = document.getElementById("progress-fill");
const progressPct  = document.getElementById("progress-pct");
const realTimeEl   = document.getElementById("real-time");
const alarmList    = document.getElementById("alarm-list");
const alertOverlay = document.getElementById("alert-overlay");
const alertName    = document.getElementById("alert-name");
const alertTimeEl  = document.getElementById("alert-time");
const offsetNote   = document.getElementById("offset-note");

// ─── 보정 셀렉트 초기화 ───────────────────────────────────
function buildSelect(el, count, fmt) {
  el.innerHTML = Array.from({length: count}, (_, i) => `<option value="${i}">${fmt(i)}</option>`).join("");
}
function hourFmt(i) {
  const p = i < 12 ? "오전" : "오후";
  const h = i % 12 === 0 ? 12 : i % 12;
  return `${p} ${pad(h)}시`;
}
buildSelect(document.getElementById("calib-hour"), 24, hourFmt);
buildSelect(document.getElementById("calib-min"),  60, i => `${pad(i)}분`);
buildSelect(document.getElementById("new-hour"),   24, hourFmt);
buildSelect(document.getElementById("new-min"),    60, i => `${pad(i)}분`);
document.getElementById("new-hour").value = "13";

// ─── 시계 틱 ─────────────────────────────────────────────
function tick() {
  const et = getErinnTime(offsetSec);
  const { period, display } = formatErrin(et.hours, et.minutes);
  const theme = getTheme(et.hours, et.minutes);

  // 시계 UI
  clockCard.style.background = `linear-gradient(135deg, ${theme.from}, ${theme.to})`;
  clockLabel.textContent  = `에린 시간 · ${theme.label}`;
  clockIcon.textContent   = theme.icon;
  clockPeriod.textContent = period;
  clockDigits.textContent = display;
  clockSeconds.textContent = `${pad(et.seconds)}초`;

  const pct = Math.round(et.progress * 100);
  progressPct.textContent = `에린 하루 ${pct}% 진행`;
  progressFill.style.width = `${pct}%`;
  progressFill.style.backgroundColor = theme.bar;

  const now = new Date();
  realTimeEl.innerHTML = `현실 시간 <span>${now.toLocaleTimeString("ko-KR")}</span>`;

  // 알람 체크
  const ts = Date.now();
  alarms.forEach(alarm => {
    if (!alarm.enabled) return;
    if (et.hours !== alarm.h || et.minutes !== alarm.m) return;
    if (ts - (lastTriggered[alarm.id] || 0) < 90000) return;
    lastTriggered[alarm.id] = ts;
    triggerAlarm(alarm);
  });

  // 작업 타이머 완료 체크
  TASKS.forEach(task => {
    const t = taskState[task.id];
    if (!t || t.notified) return;
    const rem = getRemaining(task.id);
    if (rem <= 0) {
      t.notified = true;
      saveTaskState();
      triggerTaskAlarm(task);
    }
  });
  renderTasks();
}
setInterval(tick, 1000);
tick();

// ─── 알람 발동 ────────────────────────────────────────────
function triggerAlarm(alarm) {
  const { period, display } = formatErrin(alarm.h, alarm.m);
  activeAlert = alarm;

  // 앱 내 빨간 오버레이
  alertName.textContent = alarm.label;
  alertTimeEl.textContent = `에린 ${period} ${display}`;
  alertOverlay.classList.add("active");

  // 맥OS Swift 네이티브 앱
  if (window.webkit?.messageHandlers?.alarm) {
    window.webkit.messageHandlers.alarm.postMessage({ label: alarm.label, period, time: display });
    window.webkit.messageHandlers.playSound.postMessage(null);
  } else if (window.electronAPI) {
    window.electronAPI.triggerAlert({ label: alarm.label, period, time: display });
    window.electronAPI.playSound();
  } else {
    // 아이폰/웹 PWA: 웹 오디오 + 알림
    playWebSound();
    sendNotification(alarm.label, period, display);
  }

  // 탭 제목 깜빡임
  let blink = false;
  titleBlinkTimer = setInterval(() => {
    document.title = blink ? `🔴 ${alarm.label} - 에린 알람!` : "마비노기 에린시계";
    blink = !blink;
  }, 800);

  // 30초마다 반복 (웹 포함)
  repeatTimer = setInterval(() => {
    if (window.webkit?.messageHandlers?.alarm) {
      window.webkit.messageHandlers.playSound.postMessage(null);
    } else if (window.electronAPI) {
      window.electronAPI.triggerAlert({ label: alarm.label, period, time: display });
      window.electronAPI.playSound();
    } else {
      playWebSound();
      sendNotification(alarm.label, period, display);
    }
  }, 30000);
}

function triggerTaskAlarm(task) {
  // 오버레이 표시
  alertName.textContent = task.name.replace("\n", " · ");
  alertTimeEl.textContent = "작업 완료! 🎉";
  alertOverlay.classList.add("active");

  // 소리
  if (window.webkit?.messageHandlers?.playSound) {
    window.webkit.messageHandlers.playSound.postMessage(null);
  } else {
    playWebSound();
    sendNotification(task.name.replace("\n", " · "), "", "작업 완료! 🎉");
  }

  // 탭 제목 깜빡임
  let blink = false;
  titleBlinkTimer = setInterval(() => {
    document.title = blink ? `🔴 ${task.name.split("\n")[0]} 완료!` : "마비노기 에린시계";
    blink = !blink;
  }, 800);
}

function dismissAlert() {
  activeAlert = null;
  alertOverlay.classList.remove("active");
  clearInterval(titleBlinkTimer);
  clearInterval(repeatTimer);
  document.title = "마비노기 에린시계";
}

alertOverlay.addEventListener("click", dismissAlert);
document.getElementById("alert-dismiss").addEventListener("click", e => { e.stopPropagation(); dismissAlert(); });

// ─── 알람 목록 렌더링 ─────────────────────────────────────
function renderAlarms() {
  if (alarms.length === 0) {
    alarmList.innerHTML = `<div class="alarm-empty">알람이 없어요.<br><span style="color:#475569">+ 추가 버튼으로 에린 시간 알람을 설정하세요.</span></div>`;
    return;
  }
  alarmList.innerHTML = alarms.map(a => {
    const { period, display } = formatErrin(a.h, a.m);
    return `<div class="alarm-item ${a.enabled ? "" : "disabled"}" data-id="${a.id}">
      <div class="alarm-left">
        <span class="alarm-emoji">${a.enabled ? "🔔" : "🔕"}</span>
        <div>
          <div class="alarm-name">${a.label}</div>
          <div class="alarm-sub">에린 ${period} ${display}</div>
        </div>
      </div>
      <div class="alarm-right">
        <button class="toggle ${a.enabled ? "on" : ""}" data-id="${a.id}">
          <span class="toggle-dot"></span>
        </button>
        <button class="btn-del" data-id="${a.id}">✕</button>
      </div>
    </div>`;
  }).join("");

  alarmList.querySelectorAll(".toggle").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const alarm = alarms.find(a => a.id === id);
      if (alarm) { alarm.enabled = !alarm.enabled; saveAlarms(); renderAlarms(); }
    });
  });
  alarmList.querySelectorAll(".btn-del").forEach(btn => {
    btn.addEventListener("click", () => {
      alarms = alarms.filter(a => a.id !== btn.dataset.id);
      saveAlarms(); renderAlarms();
    });
  });
}
renderAlarms();

// ─── 모달 ─────────────────────────────────────────────────
const backdrop = document.getElementById("modal-backdrop");
document.getElementById("btn-add").addEventListener("click", () => backdrop.classList.add("open"));
backdrop.addEventListener("click", e => { if (e.target === backdrop) backdrop.classList.remove("open"); });

document.getElementById("btn-confirm").addEventListener("click", () => {
  const label = document.getElementById("new-label").value.trim();
  const h = parseInt(document.getElementById("new-hour").value, 10);
  const m = parseInt(document.getElementById("new-min").value, 10);
  const { period, display } = formatErrin(h, m);
  alarms.push({
    id: Date.now().toString(),
    label: label || `에린 ${pad(h)}:${pad(m)}`,
    h, m,
    enabled: true,
  });
  saveAlarms();
  renderAlarms();
  document.getElementById("new-label").value = "";
  backdrop.classList.remove("open");
});

// ─── 설정 ─────────────────────────────────────────────────
document.getElementById("btn-settings").addEventListener("click", () => {
  document.getElementById("settings-panel").classList.toggle("open");
});

document.getElementById("btn-calibrate").addEventListener("click", () => {
  const h = parseInt(document.getElementById("calib-hour").value, 10);
  const m = parseInt(document.getElementById("calib-min").value, 10);
  const target = h * 90 + m * 1.5;
  const nowSec = Math.floor(Date.now() / 1000);
  const current = nowSec % 2160;
  let diff = target - current;
  if (diff < -1080) diff += 2160;
  if (diff >  1080) diff -= 2160;
  offsetSec = Math.round(diff);
  localStorage.setItem("erinn-offset", String(offsetSec));
  offsetNote.style.display = "block";
  offsetNote.textContent = `보정 적용됨 (${offsetSec > 0 ? "+" : ""}${offsetSec}초)`;
  tick();
});

document.getElementById("btn-load-defaults").addEventListener("click", () => {
  if (!confirm("기존 알람을 모두 지우고 굵은 실 알람 18개로 교체할까요?")) return;
  alarms = DEFAULT_ALARMS.map(a => ({ ...a, id: Date.now().toString() + Math.random() }));
  saveAlarms();
  renderAlarms();
  document.getElementById("settings-panel").classList.remove("open");
});

// ─── 경매장 시세 ─────────────────────────────────────────────
const API_KEY = "test_aeb9189847680d8f952caea4a7fb64961fd9f8398b33c45d051cabd4557c44abefe8d04e6d233bd35cf2fabdeb93fb0d";
const MARKET_ITEMS = [
  { name: "최고급 수제 붕대",  icon: "🩹", category: "소모품" },
  { name: "질겅질겅 낙지츄",  icon: "🐙", category: "식품", showOptions: ["방어","보호","마법 방어","마법 보호"] },
  { name: "고급 옷감",        icon: "🪡", category: "천옷/방직" },
  { name: "향기로운 꿀 우유", icon: "🍯", category: "식품" },
];

async function fetchMarketItem(itemName) {
  const enc = encodeURIComponent(itemName);
  const headers = { "x-nxopen-api-key": API_KEY };
  try {
    const [listRes, histRes] = await Promise.all([
      fetch(`https://open.api.nexon.com/mabinogi/v1/auction/keyword-search?keyword=${enc}`, { headers }),
      fetch(`https://open.api.nexon.com/mabinogi/v1/auction/history?item_name=${enc}`, { headers }),
    ]);
    const listData = await listRes.json();
    const histData = await histRes.json();

    const listings = listData.auction_item || [];
    const history  = histData.auction_history || [];

    const lowestNow   = listings.length ? Math.min(...listings.map(i => i.auction_price_per_unit)) : null;
    const totalNow    = listings.reduce((s, i) => s + i.item_count, 0);
    const latestTrade = history.length ? history[0].auction_price_per_unit : null;
    const firstOptions = listings.length ? (listings[0].item_option || []) : [];

    return { lowestNow, totalNow, latestTrade, listings: listings.length, firstOptions };
  } catch(e) {
    return null;
  }
}

function priceStr(n) {
  if (n == null) return null;
  if (n >= 10000) return `${(n/10000).toFixed(1).replace(/\.0$/,"")}만골드`;
  return `${n.toLocaleString()}골드`;
}

async function loadMarket() {
  const container = document.getElementById("market-list");
  const updatedEl = document.getElementById("market-updated");
  if (!container) return;

  container.innerHTML = `<div class="market-loading">⏳ 시세 불러오는 중...</div>`;

  const results = await Promise.all(MARKET_ITEMS.map(item => fetchMarketItem(item.name)));

  container.innerHTML = MARKET_ITEMS.map((item, i) => {
    const r = results[i];
    const lowStr   = r?.lowestNow  != null ? priceStr(r.lowestNow)   : null;
    const tradeStr = r?.latestTrade != null ? priceStr(r.latestTrade) : null;
    const countStr = r?.totalNow   != null ? `매물 ${r.totalNow.toLocaleString()}개` : "";

    // 방어/보호 관련 옵션 추출 (첫 번째 매물 기준)
    let optionStr = "";
    if (item.showOptions && r?.firstOptions?.length) {
      const matched = r.firstOptions
        .filter(o => o.option_type === "사용 효과" &&
                     item.showOptions.some(k => o.option_value?.includes(k)))
        .map(o => o.option_value);
      if (matched.length) optionStr = matched.join(" · ");
    }

    return `
    <div class="market-card">
      <div class="market-left">
        <span class="market-icon">${item.icon}</span>
        <div>
          <div class="market-name">${item.name}</div>
          <div class="market-category">${countStr || "매물 없음"}</div>
          ${optionStr ? `<div class="market-option">${optionStr}</div>` : ""}
        </div>
      </div>
      <div class="market-right">
        ${lowStr
          ? `<div class="market-price">${lowStr}</div>
             <div class="market-history">최근 거래 ${tradeStr ?? "없음"}</div>`
          : `<div class="market-price none">매물 없음</div>
             <div class="market-history">최근 거래 ${tradeStr ?? "없음"}</div>`
        }
      </div>
    </div>`;
  }).join("");

  const now = new Date();
  updatedEl.textContent = `${now.toLocaleTimeString("ko-KR")} 기준`;
}

loadMarket();
// 3분마다 자동 갱신
setInterval(loadMarket, 180000);

document.getElementById("btn-refresh-market").addEventListener("click", loadMarket);
