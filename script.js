// Drink Timer v2 : schedule + notifications + Telegram (client or secure server proxy)
// Persistent storage keys
const LS_SETTINGS = 'dt_settings_v2';
const LS_SCHEDULE = 'dt_schedule_v2';
const LS_COUNT = 'dt_count_v2';

const $ = id => document.getElementById(id);

// elements
const startBtn = $('startPlan');
const clearBtn = $('clearPlan');
const planSection = $('planSection');
const scheduleList = $('scheduleList');
const planSummary = $('planSummary');
const nextTime = $('nextTime');
const drinksCountEl = $('drinksCount');
const addDrinkBtn = $('addDrink');
const resetCountBtn = $('resetCount');

let schedule = []; // {time:timestamp, sent:boolean}
let count = parseInt(localStorage.getItem(LS_COUNT)) || 0;
drinksCountEl.innerText = count;

// load saved settings
const saved = JSON.parse(localStorage.getItem(LS_SETTINGS) || '{}');
if (saved.weight) $('weight').value = saved.weight;
if (saved.age) $('age').value = saved.age;
if (saved.level) $('level').value = saved.level;
if (saved.startTime) $('startTime').value = saved.startTime;
if (saved.endTime) $('endTime').value = saved.endTime;
if (saved.tgToken) $('tgToken').value = saved.tgToken;
if (saved.tgChat) $('tgChat').value = saved.tgChat;

// load schedule if present
const savedSchedule = JSON.parse(localStorage.getItem(LS_SCHEDULE) || 'null');
if (savedSchedule && savedSchedule.length) {
  schedule = savedSchedule;
  renderPlan();
  startTick();
}

// permission for notifications
if (Notification.permission === 'default') {
  Notification.requestPermission().catch(() => {});
}

// helpers
function parseTimeToToday(timeStr) {
  // timeStr "HH:MM"
  const [h, m] = timeStr.split(':').map(Number);
  const now = new Date();
  const t = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
  return t.getTime();
}

function nowMs(){ return Date.now(); }

function saveSettings() {
  const s = {
    weight: $('weight').value,
    age: $('age').value,
    level: $('level').value,
    startTime: $('startTime').value,
    endTime: $('endTime').value,
    tgToken: $('tgToken').value,
    tgChat: $('tgChat').value
  };
  localStorage.setItem(LS_SETTINGS, JSON.stringify(s));
  return s;
}

function createSchedule(settings) {
  // compute duration in minutes between start and end (wrap next day if needed)
  let start = parseTimeToToday(settings.startTime);
  let end = parseTimeToToday(settings.endTime);
  if (end <= start) end += 24*3600*1000;
  const totalMinutes = Math.round((end - start)/60000);
  const hours = totalMinutes/60;

  // base drinks per hour by level
  const perHour = { light:1.0, tipsy:1.5, drunk:2.0, obliterated:3.0 }[settings.level] || 1.5;
  let drinksAllowed = Math.max(1, Math.round(perHour * hours));

  // small adjustment by weight: +1 per ~20kg above 70
  const w = parseFloat(settings.weight) || 70;
  const extra = Math.floor(Math.max(0, (w - 70) / 20));
  drinksAllowed += extra;

  // ensure not absurd
  drinksAllowed = Math.max(1, Math.min(drinksAllowed, 30));

  const intervalMin = totalMinutes / drinksAllowed;

  // schedule times starting at max(start, now)
  const startNow = Math.max(start, nowMs());
  const arr = [];
  for (let i=0;i<drinksAllowed;i++){
    const t = startNow + Math.round(i * intervalMin * 60000);
    arr.push({ time: t, sent: false });
  }
  return {arr, drinksAllowed, intervalMin, totalMinutes};
}

function renderPlan() {
  // update UI from schedule
  if (!schedule || schedule.length === 0) {
    planSection.classList.add('hidden');
    return;
  }
  planSection.classList.remove('hidden');
  // summary
  const first = schedule[0];
  const last = schedule[schedule.length-1];
  const summary = `${schedule.length} drinks • from ${new Date(schedule[0].time).toLocaleTimeString()} to ${new Date(last.time).toLocaleTimeString()}`;
  planSummary.innerText = summary;

  // list
  scheduleList.innerHTML = '';
  const now = nowMs();
  schedule.forEach((item, idx) => {
    const li = document.createElement('li');
    li.className = (item.time <= now ? 'past' : '') + (Math.abs(item.time - now) < 1000 ? ' now' : '');
    const timeStr = new Date(item.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    li.innerHTML = `<div>Drink ${idx+1}</div><div>${timeStr}${item.sent ? ' ✓' : ''}</div>`;
    scheduleList.appendChild(li);
  });
  // set nextTime display
  const next = schedule.find(s => !s.sent && s.time >= now);
  if (next) {
    const d = Math.max(0, Math.round((next.time - now)/1000));
    nextTime.innerText = formatSeconds(d);
  } else {
    nextTime.innerText = '--:--';
  }
  drinksCountEl.innerText = count;
  localStorage.setItem(LS_SCHEDULE, JSON.stringify(schedule));
  localStorage.setItem(LS_COUNT, String(count));
}

function formatSeconds(s) {
  const m = Math.floor(s/60); const sec = s % 60;
  return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

// main - start plan
startBtn.addEventListener('click', () => {
  const settings = saveSettings();
  if (!settings.startTime || !settings.endTime) { alert('Pick start and end times'); return; }
  const {arr, drinksAllowed, intervalMin} = createSchedule(settings);
  schedule = arr;
  localStorage.setItem(LS_SCHEDULE, JSON.stringify(schedule));
  renderPlan();
  startTick();
  alert(`Plan created: ${drinksAllowed} drinks — every ≈ ${Math.round(intervalMin)} min`);
});

// clear
clearBtn.addEventListener('click', () => {
  if (!confirm('Clear plan and saved schedule?')) return;
  schedule = [];
  localStorage.removeItem(LS_SCHEDULE);
  planSection.classList.add('hidden');
  renderPlan();
});

// manual drink count
addDrinkBtn.addEventListener('click', () => {
  count = count + 1;
  localStorage.setItem(LS_COUNT, String(count));
  renderPlan();
});
// reset count
resetCountBtn.addEventListener('click', () => {
  if (!confirm('Reset drinks consumed to 0?')) return;
  count = 0;
  localStorage.setItem(LS_COUNT, String(count));
  renderPlan();
});

// tick: every second check schedule
let tickInterval = null;
function startTick() {
  if (tickInterval) clearInterval(tickInterval);
  tickInterval = setInterval(() => {
    const now = nowMs();
    // update countdown for next
    renderPlan();

    // check for due items not sent
    schedule.forEach(async (it, idx) => {
      if (!it.sent && now >= it.time - 500) {
        // mark sent
        it.sent = true;
        count = count + 1;
        localStorage.setItem(LS_COUNT, String(count));
        localStorage.setItem(LS_SCHEDULE, JSON.stringify(schedule));
        renderPlan();

        // show notification
        showLocalNotification('Drink Timer', `Time for drink #${idx+1} — ${new Date(it.time).toLocaleTimeString()}`);

        // highlight (brief)
        flashNow();

        // send Telegram (if configured)
        const settings = JSON.parse(localStorage.getItem(LS_SETTINGS) || '{}');
        // Prefer secure proxy endpoint if you've deployed it:
        const proxyUrl = settings.proxyUrl; // optional
        if (proxyUrl) {
          // POST to your proxy; it should have TELEGRAM_BOT_TOKEN and CHAT_ID in env
          try {
            await fetch(proxyUrl, {
              method:'POST',
              headers:{'content-type':'application/json'},
              body: JSON.stringify({ text: `Drink Timer: Time for drink #${idx+1} (${new Date(it.time).toLocaleTimeString()})` })
            });
          } catch(e){ console.warn('proxy send failed', e); }
        } else if (settings.tgToken && settings.tgChat) {
          // Direct client-side Telegram send (NOT SECURE — token exposed in client)
          try {
            const token = settings.tgToken.trim();
            const chat = settings.tgChat.trim();
            const text = encodeURIComponent(`Drink Timer: Time for drink #${idx+1} — ${new Date(it.time).toLocaleTimeString()}`);
            const url = `https://api.telegram.org/bot${token}/sendMessage?chat_id=${chat}&text=${text}`;
            await fetch(url);
          } catch(e){ console.warn('tg client send failed', e); }
        }
      }
    });
  }, 1000);
}

// local notification helper
function showLocalNotification(title, body) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body, icon: './icon-192.png' });
  } else {
    // fallback alert
    try { alert(body); } catch(e) { console.log('notify', body); }
  }
}

function flashNow() {
  document.body.classList.add('flash');
  setTimeout(()=>document.body.classList.remove('flash'), 3000);
}

// small UI effect via CSS class (add to body when firing)
(function injectFlashStyles(){
  const s = document.createElement('style');
  s.innerHTML = `
    body.flash { box-shadow: 0 0 40px 8px rgba(0,255,145,0.06); border-top:4px solid rgba(0,255,145,0.12); }
  `;
  document.head.appendChild(s);
})();

// auto render any loaded plan
renderPlan();
