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

  // 맥OS 시스템 경고창 (Swift 네이티브 앱)
  if (window.webkit?.messageHandlers?.alarm) {
    window.webkit.messageHandlers.alarm.postMessage({ label: alarm.label, period, time: display });
    window.webkit.messageHandlers.playSound.postMessage(null);
  } else if (window.electronAPI) {
    window.electronAPI.triggerAlert({ label: alarm.label, period, time: display });
    window.electronAPI.playSound();
  }

  // 탭 제목 깜빡임
  let blink = false;
  titleBlinkTimer = setInterval(() => {
    document.title = blink ? `🔴 ${alarm.label} - 에린 알람!` : "마비노기 에린시계";
    blink = !blink;
  }, 800);

  // 30초마다 반복
  repeatTimer = setInterval(() => {
    if (window.electronAPI) {
      window.electronAPI.triggerAlert({ label: alarm.label, period, time: display });
      window.electronAPI.playSound();
    }
  }, 30000);
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
