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
function saveTaskState() { localStorage.setItem("erinn-tasks", JSON.stringify(taskState)); if (typeof syncToNative === "function") syncToNative(); }

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
    btn.addEventListener("click", () => startTaskById(btn.dataset.id));
  });
  container.querySelectorAll(".btn-task-reset").forEach(btn => {
    btn.addEventListener("click", () => {
      delete taskState[btn.dataset.id];
      saveTaskState(); renderTasks();
    });
  });
}

// 작업 시작/재시작 (메인 UI · PiP 공용)
function startTaskById(id) {
  const task = TASKS.find(t => t.id === id);
  if (!task) return;
  taskState[task.id] = { startedAt: Date.now(), duration: task.duration, notified: false };
  saveTaskState();
  renderTasks();
  if (typeof updatePiP === "function") updatePiP();
}
renderTasks();

// ─── 마비노기 숙제 (매일 6시 / 주간 월요일 6시 리셋) ─────────
const HW_DAILY = [
  "블루밍",
  "베테랑/빛구/로드(크리스탈)",
  "탐험대 보내기",
  "리플레이",
  "탈농",
];
const HW_WEEKLY = [
  { name: "네아르", target: 10 },
  { name: "크롬",   target: 10 },
  { name: "글매",   target: 3  },
  { name: "브리",   target: 7  },
];

// 마비노기 리셋 기준 키 (오전 6시 경계, 주간은 월요일) — 로컬(한국) 시간 기준
function localKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function hwPeriodKeys() {
  const shifted = new Date(Date.now() - 6 * 3600 * 1000); // 오전 6시 경계
  const dayKey = localKey(shifted);
  const d = new Date(shifted);
  const dow = (d.getDay() + 6) % 7; // 월=0
  d.setDate(d.getDate() - dow);
  const weekKey = localKey(d);
  return { dayKey, weekKey };
}

let homework = JSON.parse(localStorage.getItem("erinn-homework") || "{}");
function saveHomework() { localStorage.setItem("erinn-homework", JSON.stringify(homework)); }

function syncHomeworkPeriod() {
  const { dayKey, weekKey } = hwPeriodKeys();
  if (homework.dayKey !== dayKey) { homework.dayKey = dayKey; homework.daily = {}; }
  if (homework.weekKey !== weekKey) { homework.weekKey = weekKey; homework.weekly = {}; }
  if (!homework.daily)  homework.daily = {};
  if (!homework.weekly) homework.weekly = {};
  saveHomework();
}

function renderHomework() {
  syncHomeworkPeriod();

  const dailyEl  = document.getElementById("hw-daily");
  const weeklyEl = document.getElementById("hw-weekly");
  if (!dailyEl) return;

  // 매일 할일 (체크박스)
  dailyEl.innerHTML = HW_DAILY.map((name, i) => {
    const done = !!homework.daily[i];
    return `
    <div class="hw-item ${done ? "done" : ""}" data-type="daily" data-idx="${i}">
      <div class="hw-check">${done ? "✓" : ""}</div>
      <div class="hw-name">${name}</div>
    </div>`;
  }).join("");

  // 주간 할일 (카운터)
  weeklyEl.innerHTML = HW_WEEKLY.map((item, i) => {
    const cur  = homework.weekly[i] || 0;
    const done = cur >= item.target;
    return `
    <div class="hw-item ${done ? "done" : ""}" data-idx="${i}">
      <div class="hw-check">${done ? "✓" : ""}</div>
      <div class="hw-name">${item.name}</div>
      <div class="hw-counter-right">
        <button class="hw-cnt-btn hw-minus" data-idx="${i}">−</button>
        <div class="hw-cnt-val">${cur} / ${item.target}릴</div>
        <button class="hw-cnt-btn hw-plus" data-idx="${i}">+</button>
      </div>
    </div>`;
  }).join("");

  // 매일 체크 토글
  dailyEl.querySelectorAll(".hw-item").forEach(el => {
    el.addEventListener("click", () => {
      const idx = el.dataset.idx;
      homework.daily[idx] = !homework.daily[idx];
      saveHomework(); renderHomework();
    });
  });
  // 주간 카운터 +/-
  weeklyEl.querySelectorAll(".hw-plus").forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      const i = btn.dataset.idx;
      homework.weekly[i] = Math.min(HW_WEEKLY[i].target, (homework.weekly[i] || 0) + 1);
      saveHomework(); renderHomework();
    });
  });
  weeklyEl.querySelectorAll(".hw-minus").forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      const i = btn.dataset.idx;
      homework.weekly[i] = Math.max(0, (homework.weekly[i] || 0) - 1);
      saveHomework(); renderHomework();
    });
  });

  // 진행 카운트 표시
  const dDone = HW_DAILY.filter((_, i) => homework.daily[i]).length;
  const wDone = HW_WEEKLY.filter((it, i) => (homework.weekly[i] || 0) >= it.target).length;
  document.getElementById("hw-daily-count").textContent  = `${dDone}/${HW_DAILY.length}`;
  document.getElementById("hw-weekly-count").textContent = `${wDone}/${HW_WEEKLY.length}`;

  // 매일 리셋까지 남은 시간 (오전 6시)
  const dNote = document.getElementById("hw-daily-reset");
  if (dNote) {
    const now = new Date();
    const next6 = new Date(now);
    next6.setHours(6, 0, 0, 0);
    if (now.getHours() >= 6) next6.setDate(next6.getDate() + 1);
    const hrs = Math.floor((next6 - now) / 3600000);
    const mins = Math.floor(((next6 - now) % 3600000) / 60000);
    dNote.textContent = `리셋까지 ${hrs}시간 ${mins}분`;
  }

  // 주간 리셋까지 남은 시간 (월요일 오전 6시)
  const wNote = document.getElementById("hw-weekly-reset");
  if (wNote) {
    const now = new Date();
    const nextMon = new Date(now);
    nextMon.setHours(6, 0, 0, 0);
    // 다음 월요일 오전 6시까지
    let addDays = (8 - now.getDay()) % 7; // 월요일(1)까지 남은 일수
    if (addDays === 0 && now.getHours() >= 6) addDays = 7; // 오늘이 월요일이고 6시 지났으면 다음주
    if (now.getDay() === 1 && now.getHours() < 6) addDays = 0; // 월요일 6시 전이면 오늘
    nextMon.setDate(nextMon.getDate() + addDays);
    const diff = nextMon - now;
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    wNote.textContent = d > 0 ? `리셋까지 ${d}일 ${h}시간` : `리셋까지 ${h}시간`;
  }
}
renderHomework();
// 1분마다 리셋 시점 체크
setInterval(renderHomework, 60000);

// ─── 탭 전환 ──────────────────────────────────────────────
function showTab(name) {
  document.querySelectorAll(".tab-panel").forEach(p => {
    p.style.display = (p.id === "tab-" + name) ? "flex" : "none";
  });
  document.querySelectorAll(".tab-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.tab === name);
  });
  document.getElementById("app").scrollTop = 0;
}
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => showTab(btn.dataset.tab));
});

// ─── 미니 시계 토글 ────────────────────────────────────────
// 맥 앱: 네이티브 항상-위 창 / 크롬·엣지 웹: Document Picture-in-Picture
const miniBtn = document.getElementById("btn-mini-clock");
let miniClockOn = false;
let pipWindow = null;
let pipEls = null;  // { period, time, icon }

function setMiniBtn(on) {
  miniClockOn = on;
  if (!miniBtn) return;
  miniBtn.classList.toggle("on", on);
  miniBtn.textContent = on ? "🕐 미니 시계 끄기" : "🕐 미니 시계 항상 띄우기";
}

async function toggleWebPiP() {
  // 이미 열려 있으면 닫기
  if (pipWindow) { pipWindow.close(); return; }

  const pip = await documentPictureInPicture.requestWindow({ width: 200, height: 110 });
  pipWindow = pip;

  const style = pip.document.createElement("style");
  style.textContent = `
    * { margin:0; padding:0; box-sizing:border-box; }
    body { height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center;
      gap:8px; background:#0b1120; color:#fff; font-family:-apple-system,BlinkMacSystemFont,sans-serif; user-select:none; }
    .clock { display:flex; flex-direction:column; align-items:center; }
    .p { font-size:13px; color:#94a3b8; margin-bottom:1px; }
    .t { font-size:38px; font-weight:200; font-variant-numeric:tabular-nums; line-height:1; letter-spacing:-1px; }
    .ic { font-size:16px; margin-top:2px; }
    /* 작업 타이머 */
    .tasks { display:flex; flex-direction:column; gap:4px; width:100%; padding:0 12px; }
    .trow { display:flex; align-items:center; justify-content:space-between;
      background:rgba(255,255,255,0.1); border-radius:8px; padding:4px 8px; }
    .trow .tn { font-size:12px; }
    .trow .tv { font-size:14px; font-weight:700; font-variant-numeric:tabular-nums; }
    .trow.done { background:rgba(245,158,11,0.25); }
    .trestart { background:#16a34a; color:#fff; border:none; border-radius:7px;
      padding:4px 10px; font-size:12px; font-weight:600; cursor:pointer; }
    .trestart:active { background:#15803d; }
    /* 알람 오버레이 */
    .alarm { position:fixed; inset:0; display:none; flex-direction:column; align-items:center; justify-content:center;
      gap:6px; padding:8px; text-align:center; animation:flash 0.6s infinite; }
    .alarm.on { display:flex; }
    @keyframes flash { 0%,100%{background:#dc2626} 50%{background:#ef4444} }
    .alarm .an { font-size:17px; font-weight:700; line-height:1.2; }
    .alarm .at { font-size:12px; color:rgba(255,255,255,0.85); }
    .alarm button { margin-top:4px; background:rgba(255,255,255,0.25); color:#fff; border:none;
      padding:8px 18px; border-radius:20px; font-size:14px; font-weight:600; cursor:pointer; }
  `;
  pip.document.head.appendChild(style);

  const wrap = pip.document.createElement("div"); wrap.className = "clock";
  const period = pip.document.createElement("div"); period.className = "p"; period.textContent = "오전";
  const time   = pip.document.createElement("div"); time.className = "t"; time.textContent = "--:--";
  const icon   = pip.document.createElement("div"); icon.className = "ic"; icon.textContent = "🕐";
  wrap.appendChild(period); wrap.appendChild(time); wrap.appendChild(icon);
  pip.document.body.appendChild(wrap);

  // 작업 타이머 영역
  const tasksEl = pip.document.createElement("div"); tasksEl.className = "tasks";
  pip.document.body.appendChild(tasksEl);

  // 알람 오버레이 (울릴 때 이 창에서 바로 끄기)
  const alarmLayer = pip.document.createElement("div"); alarmLayer.className = "alarm";
  const an = pip.document.createElement("div"); an.className = "an"; an.textContent = "알람";
  const at = pip.document.createElement("div"); at.className = "at"; at.textContent = "";
  const off = pip.document.createElement("button"); off.textContent = "🔕 끄기";
  off.addEventListener("click", () => dismissAlert());
  alarmLayer.appendChild(an); alarmLayer.appendChild(at); alarmLayer.appendChild(off);
  pip.document.body.appendChild(alarmLayer);

  pipEls = { period, time, icon, tasksEl, alarmLayer, an, at };
  updatePiP();
  if (activeAlert) showPiPAlarm(activeAlert);  // 이미 울리는 중이면 표시

  pip.addEventListener("pagehide", () => { pipWindow = null; pipEls = null; setMiniBtn(false); });
  setMiniBtn(true);
}

function fmtMMSS(sec) {
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}

function updatePiP() {
  if (!pipWindow || !pipEls) return;
  const et = getErinnTime(offsetSec);
  const { period, display } = formatErrin(et.hours, et.minutes);
  const theme = getTheme(et.hours, et.minutes);
  pipEls.period.textContent = period;
  pipEls.time.textContent = display;
  pipEls.icon.textContent = theme.icon;
  pipWindow.document.body.style.background = `linear-gradient(135deg, ${theme.from}, ${theme.to})`;

  // 진행 중인 작업 타이머 표시
  const running = (typeof TASKS !== "undefined" ? TASKS : []).filter(t => taskState[t.id]);
  let html = "";
  running.forEach(t => {
    const rem = getRemaining(t.id);
    const done = rem <= 0;
    const right = done
      ? `<button class="trestart" data-id="${t.id}">▶ 재시작</button>`
      : `<span class="tv">${fmtMMSS(rem)}</span>`;
    html += `<div class="trow ${done ? "done" : ""}"><span class="tn">${t.icon} ${t.name.split("\n")[0]}</span>${right}</div>`;
  });
  pipEls.tasksEl.innerHTML = html;

  // 완료된 작업 재시작 버튼
  pipEls.tasksEl.querySelectorAll(".trestart").forEach(btn => {
    btn.addEventListener("click", () => startTaskById(btn.dataset.id));
  });

  // 창 높이 자동 조절 (시계 + 작업 수)
  try {
    const h = 110 + running.length * 32;
    if (pipWindow.innerHeight && Math.abs(pipWindow.innerHeight - h) > 8) {
      pipWindow.resizeTo(pipWindow.outerWidth || 220, h);
    }
  } catch(e) {}
}

function showPiPAlarm(alarm) {
  if (!pipWindow || !pipEls) return;
  const { period, display } = formatErrin(alarm.h, alarm.m);
  pipEls.an.textContent = "⏰ " + alarm.label;
  pipEls.at.textContent = `에린 ${period} ${display}`;
  pipEls.alarmLayer.classList.add("on");
}
function hidePiPAlarm() {
  if (pipEls) pipEls.alarmLayer.classList.remove("on");
}

if (miniBtn) {
  if (window.webkit?.messageHandlers?.toggleMiniClock) {
    // 맥 네이티브 앱
    miniBtn.addEventListener("click", () => {
      window.webkit.messageHandlers.toggleMiniClock.postMessage(null);
      setMiniBtn(!miniClockOn);
    });
  } else if ("documentPictureInPicture" in window) {
    // 크롬·엣지 등 데스크톱 브라우저
    miniBtn.addEventListener("click", () => {
      toggleWebPiP().catch(() => alert("미니 시계를 열 수 없습니다. 한 번 더 눌러보세요."));
    });
  } else {
    // 아이폰 사파리 등 미지원
    miniBtn.textContent = "🕐 미니 시계 (크롬·엣지·맥 앱 지원)";
    miniBtn.addEventListener("click", () =>
      alert("미니 시계는 PC의 크롬·엣지 브라우저 또는 맥 앱에서 사용할 수 있어요.\n(아이폰 사파리는 지원하지 않습니다)"));
  }
}

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

function saveAlarms() { localStorage.setItem("erinn-alarms", JSON.stringify(alarms)); syncToNative(); }

// ─── 네이티브(맥 앱) 브리지 ───────────────────────────────
// 맥 앱에서는 Swift가 백그라운드에서 알람을 감시하므로(창 가려도 울림)
// JS는 알람/작업 목록만 Swift로 넘긴다.
const NATIVE = !!window.webkit?.messageHandlers?.sync;
function syncToNative() {
  if (!NATIVE) return;
  const enabledAlarms = (alarms || [])
    .filter(a => a.enabled)
    .map(a => ({ id: a.id, label: a.label, h: a.h, m: a.m }));
  const runningTasks = (typeof TASKS !== "undefined" ? TASKS : [])
    .filter(t => taskState[t.id])
    .map(t => ({
      id: t.id,
      label: t.name.replace("\n", " "),
      shortName: t.name.split("\n")[0],
      icon: t.icon,
      endAt: taskState[t.id].startedAt + taskState[t.id].duration * 1000,
    }));
  window.webkit.messageHandlers.sync.postMessage({
    offsetSec, alarms: enabledAlarms, tasks: runningTasks,
  });
}

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
  // 알람 발동 중(웹)에는 카드가 빨갛게 깜빡이므로 배경/라벨을 덮어쓰지 않음
  if (!activeAlert) {
    clockCard.style.background = `linear-gradient(135deg, ${theme.from}, ${theme.to})`;
    clockLabel.textContent  = `에린 시간 · ${theme.label}`;
  }
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

  // 웹 미니 시계(PiP) 갱신
  if (typeof updatePiP === "function") updatePiP();

  const ts = Date.now();
  if (NATIVE) {
    // 맥 앱: Swift가 알람/작업을 백그라운드 감시. JS는 UI 상태(완료 표시)만 갱신.
    TASKS.forEach(task => {
      const t = taskState[task.id];
      if (t && !t.notified && getRemaining(task.id) <= 0) { t.notified = true; saveTaskState(); }
    });
  } else {
    // 웹/아이폰: JS가 직접 감시
    alarms.forEach(alarm => {
      if (!alarm.enabled) return;
      if (et.hours !== alarm.h || et.minutes !== alarm.m) return;
      if (ts - (lastTriggered[alarm.id] || 0) < 90000) return;
      lastTriggered[alarm.id] = ts;
      triggerAlarm(alarm);
    });
    TASKS.forEach(task => {
      const t = taskState[task.id];
      if (!t || t.notified) return;
      if (getRemaining(task.id) <= 0) {
        t.notified = true;
        saveTaskState();
        triggerTaskAlarm(task);
      }
    });
  }
  renderTasks();
}
setInterval(tick, 1000);
tick();

// ─── 알람 발동 (팝업 대신 시계 카드 빨강 깜빡임) ─────────────
function flashClockCard(label, sub) {
  clockCard.style.background = "";              // CSS 애니메이션이 색 제어
  clockCard.classList.add("alarm-flash");
  // 어떤 알람인지(이름 + 에린 시각) + 끄기 안내
  clockLabel.textContent = sub ? `⏰ ${label} · ${sub} · 눌러서 끄기`
                               : `⏰ ${label} · 눌러서 끄기`;
}
function clearClockFlash() {
  clockCard.classList.remove("alarm-flash");
}

function dismissAlert() {
  activeAlert = null;
  clearClockFlash();
  if (typeof hidePiPAlarm === "function") hidePiPAlarm();
  clearInterval(titleBlinkTimer); titleBlinkTimer = null;
  clearInterval(repeatTimer);     repeatTimer = null;
  document.title = "마비노기 에린시계";
  if (typeof renderAlarms === "function") renderAlarms();  // 강조 해제
}

function triggerAlarm(alarm) {
  // 기존 타이머 무조건 정리 후 시작 (누적 방지)
  dismissAlert();

  const { period, display } = formatErrin(alarm.h, alarm.m);
  activeAlert = alarm;

  flashClockCard(alarm.label, `에린 ${period} ${display}`);
  if (typeof showPiPAlarm === "function") showPiPAlarm(alarm);  // PiP 미니 시계에도 표시
  renderAlarms();  // 목록에서 울리는 알람 강조

  // 소리는 발동 시 한 번만
  if (window.electronAPI) {
    window.electronAPI.triggerAlert({ label: alarm.label, period, time: display });
    window.electronAPI.playSound();
  } else {
    playWebSound();
    sendNotification(alarm.label, period, display);
  }

  let blink = false;
  titleBlinkTimer = setInterval(() => {
    document.title = blink ? `🔴 ${alarm.label} - 에린 알람!` : "마비노기 에린시계";
    blink = !blink;
  }, 800);

  // 30초 후 자동으로 멈춤 (안 끄고 놔둬도 계속 울리지 않도록)
  repeatTimer = setTimeout(() => dismissAlert(), 30000);
}

function triggerTaskAlarm(task) {
  dismissAlert();
  activeAlert = { id: "task_" + task.id, label: task.name.split("\n")[0] };

  flashClockCard(task.name.split("\n")[0], "작업 완료! 🎉");

  // 소리 한 번만
  playWebSound();
  sendNotification(task.name.replace("\n", " · "), "", "작업 완료! 🎉");

  let blink = false;
  titleBlinkTimer = setInterval(() => {
    document.title = blink ? `🔴 ${task.name.split("\n")[0]} 완료!` : "마비노기 에린시계";
    blink = !blink;
  }, 800);

  // 30초 후 자동으로 멈춤
  repeatTimer = setTimeout(() => dismissAlert(), 30000);
}

// 시계 카드를 누르면 알람 끄기 (발동 중일 때만)
clockCard.addEventListener("click", () => { if (activeAlert) dismissAlert(); });
// 기존 오버레이(있으면)도 닫기 호환
if (alertOverlay) alertOverlay.addEventListener("click", dismissAlert);
const alertDismissBtn = document.getElementById("alert-dismiss");
if (alertDismissBtn) alertDismissBtn.addEventListener("click", e => { e.stopPropagation(); dismissAlert(); });

// ─── 알람 목록 렌더링 ─────────────────────────────────────
function renderAlarms() {
  if (alarms.length === 0) {
    alarmList.innerHTML = `<div class="alarm-empty">알람이 없어요.<br><span style="color:#475569">+ 추가 버튼으로 에린 시간 알람을 설정하세요.</span></div>`;
    return;
  }
  alarmList.innerHTML = alarms.map(a => {
    const { period, display } = formatErrin(a.h, a.m);
    const ringing = activeAlert && activeAlert.id === a.id;
    return `<div class="alarm-item ${a.enabled ? "" : "disabled"} ${ringing ? "ringing" : ""}" data-id="${a.id}">
      <div class="alarm-left">
        <span class="alarm-emoji">${ringing ? "🔴" : (a.enabled ? "🔔" : "🔕")}</span>
        <div>
          <div class="alarm-name">${a.label}${ringing ? " · 울리는 중" : ""}</div>
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
  syncToNative();
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
const DEFAULT_MARKET_ITEMS = [
  { name: "최고급 수제 붕대",  icon: "🩹" },
  { name: "질겅질겅 낙지츄",  icon: "🐙", showOptions: ["방어","보호","마법 방어","마법 보호"] },
  { name: "고급 옷감",        icon: "🪡" },
  { name: "향기로운 꿀 우유", icon: "🍯" },
];

let MARKET_ITEMS = JSON.parse(localStorage.getItem("erinn-market-items") || "null") || DEFAULT_MARKET_ITEMS;
function saveMarketItems() { localStorage.setItem("erinn-market-items", JSON.stringify(MARKET_ITEMS)); }

async function fetchWithTimeout(url, options, ms = 8000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { ...options, signal: ctrl.signal });
    clearTimeout(id);
    return res;
  } catch(e) { clearTimeout(id); throw e; }
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function priceStr(n) {
  if (n == null) return null;
  if (n >= 10000) return `${(n/10000).toFixed(1).replace(/\.0$/,"")}만골드`;
  return `${n.toLocaleString()}골드`;
}

// 이름별 마지막 시세 캐시 (localStorage 유지)
let marketCache = JSON.parse(localStorage.getItem("erinn-market-cache") || "{}");
function saveMarketCache() { localStorage.setItem("erinn-market-cache", JSON.stringify(marketCache)); }

// 매물(현재 시세)만 조회 — 거래내역은 상세창에서 별도 조회 (요청 수 절반)
// 반환: { status: "ok"|"ratelimit"|"error", ... }
async function fetchListing(itemName) {
  const enc = encodeURIComponent(itemName);
  const headers = { "x-nxopen-api-key": API_KEY };
  try {
    const res = await fetchWithTimeout(
      `https://open.api.nexon.com/mabinogi/v1/auction/keyword-search?keyword=${enc}`,
      { headers }
    );
    if (res.status === 429) return { status: "ratelimit" };
    if (!res.ok)            return { status: "error" };

    const data = await res.json();
    const listings = data.auction_item || [];
    const sorted = [...listings].sort((a, b) => a.auction_price_per_unit - b.auction_price_per_unit);
    return {
      status: "ok",
      lowestNow: sorted.length ? sorted[0].auction_price_per_unit : null,
      totalNow:  listings.reduce((s, i) => s + i.item_count, 0),
      firstOptions: sorted.length ? (sorted[0].item_option || []) : [],
      top10: sorted.slice(0, 10),
      updatedAt: Date.now(),
    };
  } catch(e) {
    return { status: "error" };
  }
}

let loadingMarket = false;

// 새로고침 버튼을 누를 때만 실제 API 조회 (자동 조회 없음 → 한도 보호)
async function loadMarket() {
  if (loadingMarket) return;
  loadingMarket = true;
  renderMarket("loading");

  let rateLimited = false;
  for (const item of MARKET_ITEMS) {
    const r = await fetchListing(item.name);
    if (r.status === "ratelimit") { rateLimited = true; break; } // 더 두드리지 않고 중단
    if (r.status === "ok") { marketCache[item.name] = r; }       // error면 기존 캐시 유지
    await sleep(500);
  }
  saveMarketCache();
  loadingMarket = false;
  renderMarket(rateLimited ? "ratelimit" : "done");
}

function renderMarket(state) {
  const container = document.getElementById("market-list");
  const updatedEl = document.getElementById("market-updated");
  if (!container) return;

  container.innerHTML = MARKET_ITEMS.map((item, i) => {
    const c = marketCache[item.name];
    const lowStr   = c?.lowestNow != null ? priceStr(c.lowestNow) : null;
    const countStr = c?.totalNow  != null ? `매물 ${c.totalNow.toLocaleString()}개` : "";
    const hasData  = !!c;

    let optionStr = "";
    if (item.showOptions && c?.firstOptions?.length) {
      const matched = c.firstOptions
        .filter(o => o.option_type === "사용 효과" &&
                     item.showOptions.some(k => o.option_value?.includes(k)))
        .map(o => o.option_value);
      if (matched.length) optionStr = matched.join(" · ");
    }

    const priceBlock = !hasData
      ? `<div class="market-price none">${state === "loading" ? "불러오는 중…" : "—"}</div>`
      : lowStr
        ? `<div class="market-price">${lowStr}</div>`
        : `<div class="market-price none">매물 없음</div>`;

    return `
    <div class="market-card" data-idx="${i}" style="cursor:pointer">
      <div class="market-left">
        <span class="market-icon">${item.icon}</span>
        <div>
          <div class="market-name">${item.name}</div>
          <div class="market-category">${hasData ? (countStr || "매물 없음") : "—"}</div>
          ${optionStr ? `<div class="market-option">${optionStr}</div>` : ""}
        </div>
      </div>
      <div class="market-right">
        ${priceBlock}
        <div style="display:flex;flex-direction:column;align-items:center;gap:6px;margin-left:6px">
          <span style="font-size:16px;color:#475569">›</span>
          <button class="btn-market-del" data-idx="${i}" style="background:none;border:none;color:#334155;font-size:14px;cursor:pointer;line-height:1;padding:2px">✕</button>
        </div>
      </div>
    </div>`;
  }).join("");

  container.querySelectorAll(".market-card").forEach(card => {
    card.addEventListener("click", () => openMarketDetail(parseInt(card.dataset.idx)));
  });
  container.querySelectorAll(".btn-market-del").forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.idx);
      MARKET_ITEMS.splice(idx, 1);
      saveMarketItems();
      renderMarket("done");
    });
  });

  if (state === "loading") {
    updatedEl.textContent = "⏳ 불러오는 중...";
  } else if (state === "ratelimit") {
    updatedEl.innerHTML = `<span style="color:#f59e0b">⚠️ 넥슨 API 요청 한도 초과 · 잠시 후 🔄 다시 눌러주세요</span>`;
  } else if (state === "cached") {
    const anyData = MARKET_ITEMS.some(it => marketCache[it.name]);
    updatedEl.innerHTML = anyData
      ? `<span style="color:#64748b">저장된 시세 · 🔄 눌러 최신 가격 확인</span>`
      : `<span style="color:#64748b">🔄 새로고침을 눌러 시세를 불러오세요</span>`;
  } else {
    updatedEl.textContent = `${new Date().toLocaleTimeString("ko-KR")} 기준`;
  }
}

// ─── 경매장 상세 모달 ─────────────────────────────────────
async function openMarketDetail(idx) {
  const item = MARKET_ITEMS[idx];
  const c    = marketCache[item.name];
  const top10 = c?.top10 || [];

  document.getElementById("mdetail-title").textContent = `${item.icon} ${item.name}`;
  document.getElementById("mdetail-count").textContent =
    top10.length ? `최저가 상위 ${top10.length}개` : "매물 없음";

  const listEl = document.getElementById("mdetail-list");
  if (!top10.length) {
    listEl.innerHTML = `<div style="text-align:center;color:#475569;padding:24px">매물이 없습니다</div>`;
  } else {
    const minPrice = top10[0].auction_price_per_unit;
    listEl.innerHTML = top10.map((entry, i) => {
      const p    = entry.auction_price_per_unit;
      const diff = p - minPrice;
      const diffStr = diff > 0 ? `<span style="color:#ef4444;font-size:11px">+${diff.toLocaleString()}</span>` : `<span style="color:#22c55e;font-size:11px">최저</span>`;
      const expire = entry.date_auction_expire
        ? new Date(entry.date_auction_expire).toLocaleString("ko-KR", { month:"numeric", day:"numeric", hour:"numeric", minute:"numeric" })
        : "";
      // 아이템 옵션 중 사용효과만 추출
      const opts = (entry.item_option || [])
        .filter(o => o.option_type === "사용 효과")
        .map(o => o.option_value).join(" · ");

      return `
      <div class="mdetail-row">
        <div class="mdetail-num">${i + 1}</div>
        <div class="mdetail-info">
          <div class="mdetail-price">${p.toLocaleString()}골드 ${diffStr}</div>
          ${opts ? `<div class="mdetail-opts">${opts}</div>` : ""}
          <div class="mdetail-meta">수량 ${entry.item_count}개 · ${expire}</div>
        </div>
      </div>`;
    }).join("");
  }

  document.getElementById("market-detail-modal").classList.add("open");
}

document.getElementById("mdetail-close").addEventListener("click", () => {
  document.getElementById("market-detail-modal").classList.remove("open");
});
document.getElementById("market-detail-modal").addEventListener("click", e => {
  if (e.target === e.currentTarget) e.currentTarget.classList.remove("open");
});

// 시작 시엔 저장된 시세만 표시 (API 조회 안 함). 새로고침 버튼을 눌러야 갱신
renderMarket("cached");
document.getElementById("btn-refresh-market").addEventListener("click", loadMarket);

// ─── 경매장 검색 추가 ─────────────────────────────────────
document.getElementById("btn-market-search").addEventListener("click", () => {
  document.getElementById("market-search-modal").classList.add("open");
  document.getElementById("market-search-input").focus();
});
document.getElementById("market-search-modal").addEventListener("click", e => {
  if (e.target === e.currentTarget) e.currentTarget.classList.remove("open");
});
document.getElementById("msearch-close").addEventListener("click", () => {
  document.getElementById("market-search-modal").classList.remove("open");
});

document.getElementById("btn-msearch-go").addEventListener("click", doMarketSearch);
document.getElementById("market-search-input").addEventListener("keydown", e => {
  if (e.key === "Enter") doMarketSearch();
});

async function doMarketSearch() {
  const keyword = document.getElementById("market-search-input").value.trim();
  if (!keyword) return;
  const resultEl = document.getElementById("msearch-results");
  resultEl.innerHTML = `<div style="text-align:center;color:#475569;padding:20px">⏳ 검색 중...</div>`;

  const enc = encodeURIComponent(keyword);
  const headers = { "x-nxopen-api-key": API_KEY };
  try {
    const res  = await fetchWithTimeout(
      `https://open.api.nexon.com/mabinogi/v1/auction/keyword-search?keyword=${enc}`, { headers }
    );
    const data = await res.json();
    const items = data.auction_item || [];

    // 아이템명 기준 중복 제거 + 최저가 집계
    const map = {};
    items.forEach(it => {
      const n = it.item_name;
      if (!map[n]) map[n] = { name: n, prices: [], count: 0 };
      map[n].prices.push(it.auction_price_per_unit);
      map[n].count += it.item_count;
    });
    const unique = Object.values(map).sort((a, b) => Math.min(...a.prices) - Math.min(...b.prices));

    if (!unique.length) {
      resultEl.innerHTML = `<div style="text-align:center;color:#475569;padding:20px">검색 결과 없음</div>`;
      return;
    }

    resultEl.innerHTML = unique.map(it => {
      const low = Math.min(...it.prices);
      const already = MARKET_ITEMS.some(m => m.name === it.name);
      return `
      <div class="msearch-row">
        <div>
          <div style="font-size:14px;font-weight:600;color:#e2e8f0">${it.name}</div>
          <div style="font-size:12px;color:#64748b;margin-top:2px">최저 ${low.toLocaleString()}골드 · 매물 ${it.count}개</div>
        </div>
        ${already
          ? `<span style="font-size:12px;color:#475569">추가됨</span>`
          : `<button class="btn-msearch-add" data-name="${it.name}" style="background:#4f46e5;color:white;border:none;padding:6px 14px;border-radius:10px;font-size:13px;cursor:pointer">+ 추가</button>`
        }
      </div>`;
    }).join("");

    resultEl.querySelectorAll(".btn-msearch-add").forEach(btn => {
      btn.addEventListener("click", () => {
        const name = btn.dataset.name;
        if (MARKET_ITEMS.some(m => m.name === name)) return;
        MARKET_ITEMS.push({ name, icon: "🏷️" });
        saveMarketItems();
        btn.textContent = "✓ 추가됨";
        btn.disabled = true;
        btn.style.background = "#334155";
        loadMarket();
      });
    });
  } catch(e) {
    resultEl.innerHTML = `<div style="text-align:center;color:#ef4444;padding:20px">오류가 발생했습니다</div>`;
  }
}

// ─── 시작 시 맥 앱에 알람/작업 목록 전달 ───
syncToNative();
