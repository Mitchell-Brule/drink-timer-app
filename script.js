/* Drink Timer — lbs, 12hr, male/female, BAC, speed control, saved profile, telegram (optional) */

/* -------- localStorage keys -------- */
const LS_SETTINGS = 'dt_v3_settings';
const LS_SCHEDULE = 'dt_v3_schedule';
const LS_COUNT = 'dt_v3_count';
const LS_SPEED = 'dt_v3_speed';

const $ = id => document.getElementById(id);

/* UI elements */
const startBtn = $('startPlan');
const clearBtn = $('clearPlan');
const planSection = $('planSection');
const scheduleList = $('scheduleList');
const planSummary = $('planSummary');
const planSub = $('planSub');
const nextTimeEl = $('nextTime');
const countdownEl = $('countdown');
const drinksCountEl = $('drinksCount');
const addDrinkBtn = $('addDrink');
const undoDrinkBtn = $('undoDrink');
const resetCountBtn = $('resetCount');
const bacValEl = $('bacVal');
const bacLabelEl = $('bacLabel');

let schedule = [];     // {time:timestamp, sent:boolean}
let tickInterval = null;
let count = parseInt(localStorage.getItem(LS_COUNT) || '0');
let speedMultiplier = parseFloat(localStorage.getItem(LS_SPEED) || '1.0'); // <1 = faster, >1 = slower

drinksCountEl.innerText = count;

/* load settings if any */
const saved = JSON.parse(localStorage.getItem(LS_SETTINGS) || '{}');
if (saved.weight) $('weight').value = saved.weight;
if (saved.age) $('age').value = saved.age;
if (saved.sex) $('sex').value = saved.sex;
if (saved.level) $('level').value = saved.level;
if (saved.startTime) $('startTime').value = saved.startTime;
if (saved.endTime) $('endTime').value = saved.endTime;
if (saved.tgToken) $('tgToken').value = saved.tgToken;
if (saved.tgChat) $('tgChat').value = saved.tgChat;

/* load schedule */
const savedSchedule = JSON.parse(localStorage.getItem(LS_SCHEDULE) || 'null');
if (savedSchedule && savedSchedule.length) { schedule = savedSchedule; renderPlan(); startTick(); }

/* ask notification permission early */
if (Notification && Notification.permission === 'default') {
  Notification.requestPermission().catch(()=>{});
}

/* helpers */
function nowMs(){ return Date.now(); }
function saveSettings() {
  const s = {
    weight: $('weight').value,
    age: $('age').value,
    sex: $('sex').value,
    level: $('level').value,
    startTime: $('startTime').value,
    endTime: $('endTime').value,
    tgToken: $('tgToken').value,
    tgChat: $('tgChat').value
  };
  localStorage.setItem(LS_SETTINGS, JSON.stringify(s));
  return s;
}

function toTimestampToday(timeStr) {
  // input "HH:MM" (24hr) from <input type=time>, returns ms for today (wrap next day)
  const [h,m] = timeStr.split(':').map(Number);
  const now = new Date();
  const t = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
  return t.getTime();
}

function format12(ts) {
  const d = new Date(ts);
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  if (h === 0) h = 12;
  if (h > 12) h = h - 12;
  return `${h}:${String(m).padStart(2,'0')} ${ampm}`;
}

/* schedule creation logic (lbs, adjusted by level & weight) */
function createSchedule(settings) {
  let start = toTimestampToday(settings.startTime);
  let end = toTimestampToday(settings.endTime);
  if (end <= start) end += 24*3600*1000;
  const totalMinutes = Math.round((end - start)/60000);
  const hours = totalMinutes/60;

  const perHour = { light:1.0, tipsy:1.5, drunk:2.0, obliterated:3.0 }[settings.level] || 1.5;
  let drinksAllowed = Math.max(1, Math.round(perHour * hours));

  // small weight tweak: +1 per ~40 lb above 150
  const w = parseFloat(settings.weight) || 150;
  const extra = Math.floor(Math.max(0, (w - 150)/40));
  drinksAllowed += extra;
  drinksAllowed = Math.max(1, Math.min(drinksAllowed, 40));

  const intervalMin = (totalMinutes / drinksAllowed) * speedMultiplier;

  // start scheduling from max(start, now)
  const startNow = Math.max(start, nowMs());
  const arr = [];
  for (let i=0;i<drinksAllowed;i++){
    const t = startNow + Math.round(i * intervalMin * 60000);
    arr.push({ time: t, sent: false });
  }
  return {arr, drinksAllowed, intervalMin, totalMinutes};
}

/* render plan UI */
function renderPlan() {
  if (!schedule || schedule.length === 0) {
    planSection.classList.add('hidden');
    return;
  }
  planSection.classList.remove('hidden');
  const first = schedule[0], last = schedule[schedule.length-1];
  planSummary.innerText = `${schedule.length} drinks • ${format12(first.time)} → ${format12(last.time)}`;
  planSub.innerText = `Speed x${speedMultiplier.toFixed(2)} • Saved profile auto-filled next time.`;

  scheduleList.innerHTML = '';
  const now = nowMs();
  schedule.forEach((it, idx) => {
    const li = document.createElement('li');
    li.className = (it.time <= now ? 'past' : '') + (Math.abs(it.time - now) < 1000 ? ' now' : '');
    const timeStr = format12(it.time);
    li.innerHTML = `<div>Drink ${idx+1}</div><div>${timeStr}${it.sent ? ' ✓' : ''}</div>`;
    scheduleList.appendChild(li);
  });

  drinksCountEl.innerText = count;
  localStorage.setItem(LS_SCHEDULE, JSON.stringify(schedule));
  localStorage.setItem(LS_COUNT, String(count));
  localStorage.setItem(LS_SPEED, String(speedMultiplier));
}

/* BAC calculator — Widmark formula (approx)
   N = number of standard drinks
   r = 0.73 (male), 0.66 (female)
   W = weight in pounds
   hours = hours since first scheduled drink (or since first recorded drink)
   BAC = (N * 5.14 / (W * r)) - 0.015 * hours
*/
function estimateBAC(drinksTaken, settings) {
  const W = parseFloat(settings.weight) || 150;
  const r = settings.sex === 'female' ? 0.66 : 0.73;
  // approximate drinksTaken (number)
  const hours = (() => {
    // time since first scheduled drink or now if not scheduled: compute hours elapsed from first plan item
    if (schedule && schedule.length) {
      const first = schedule[0].time;
      const hrs = Math.max(0, (Date.now() - first) / 3600000);
      return hrs;
    }
    return 0;
  })();

  const N = drinksTaken;
  const bac = (N * 5.14 / (W * r)) - (0.015 * hours);
  return Math.max(0, bac);
}

function bacLabel(bac) {
  if (bac < 0.03) return 'Light';
  if (bac < 0.06) return 'Buzzed';
  if (bac < 0.10) return 'Tipsy';
  if (bac < 0.20) return 'Impaired';
  return 'Very intoxicated';
}

/* tick loop — check schedule every second */
function startTick() {
  if (tickInterval) clearInterval(tickInterval);
  tickInterval = setInterval(async () => {
    const now = nowMs();
    // update countdown (next)
    const next = schedule.find(s => !s.sent && s.time >= now);
    if (next) {
      const d = Math.max(0, Math.round((next.time - now)/1000));
      nextTimeEl.innerText = format12(next.time);
      countdownEl.innerText = `${Math.floor(d/60)}:${String(d%60).padStart(2,'0')}`;
    } else {
      nextTimeEl.innerText = '--:--';
      countdownEl.innerText = '--:--';
    }

    // mark due items
    for (let i=0;i<schedule.length;i++){
      const it = schedule[i];
      if (!it.sent && now >= it.time - 500) {
        it.sent = true;
        count += 1;
        localStorage.setItem(LS_COUNT, String(count));
        renderPlan();

        // show local notification
        showNotification('Drink Timer', `Time for drink #${i+1} — ${format12(it.time)}`);

        // flash UI class (optional)
        document.body.classList.add('flash');
        setTimeout(()=>document.body.classList.remove('flash'), 2500);

        // send Telegram (client or via proxy)
        const settings = JSON.parse(localStorage.getItem(LS_SETTINGS) || '{}');
        const proxyUrl = settings.proxyUrl;
        const text = `Drink Timer: Time for drink #${i+1} — ${format12(it.time)}`;
        if (proxyUrl) {
          // recommended: proxy handles token securely
          try {
            await fetch(proxyUrl, {
              method:'POST', headers:{'content-type':'application/json'},
              body: JSON.stringify({ text })
            });
          } catch(e){ console.warn('proxy failed', e); }
        } else if (settings.tgToken && settings.tgChat) {
          // client-side send (token exposed in client) — only for quick testing
          try {
            const token = settings.tgToken.trim();
            const chat = settings.tgChat.trim();
            const url = `https://api.telegram.org/bot${token}/sendMessage?chat_id=${encodeURIComponent(chat)}&text=${encodeURIComponent(text)}`;
            await fetch(url);
          } catch(e){ console.warn('tg send failed', e); }
        }
      }
    }

    // update BAC display
    const settings = JSON.parse(localStorage.getItem(LS_SETTINGS) || '{}');
    const bac = estimateBAC(count, settings);
    bacValEl.innerText = bac.toFixed(3);
    bacLabelEl.innerText = bacLabel(bac);

  }, 1000);
}

/* notification helper */
function showNotification(title, body) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body, icon: './icon-192.png' });
  } else {
    // request and fallback
    if ('Notification' in window && Notification.permission !== 'denied') {
      Notification.requestPermission().then(p => { if (p === 'granted') new Notification(title, { body }); else alert(body); });
    } else alert(body);
  }
}

/* UI actions */
startBtn.addEventListener('click', () => {
  const settings = saveSettings();
  if (!settings.startTime || !settings.endTime) { alert('Pick start and end times'); return; }
  const {arr, drinksAllowed, intervalMin} = createSchedule(settings);
  schedule = arr;
  localStorage.setItem(LS_SCHEDULE, JSON.stringify(schedule));
  renderPlan();
  startTick();
  alert(`Plan created: ${drinksAllowed} drinks — approx every ${Math.round(intervalMin)} min (speed x${speedMultiplier.toFixed(2)})`);
});

clearBtn.addEventListener('click', () => {
  if (!confirm('Clear current plan?')) return;
  schedule = [];
  localStorage.removeItem(LS_SCHEDULE);
  renderPlan();
  if (tickInterval) clearInterval(tickInterval);
});

addDrinkBtn.addEventListener('click', () => {
  count += 1;
  localStorage.setItem(LS_COUNT, String(count));
  renderPlan();
});
undoDrinkBtn.addEventListener('click', () => {
  count = Math.max(0, count - 1);
  localStorage.setItem(LS_COUNT, String(count));
  renderPlan();
});
resetCountBtn.addEventListener('click', () => {
  if (!confirm('Reset drinks consumed to 0?')) return;
  count = 0; localStorage.setItem(LS_COUNT, String(count)); renderPlan();
});

/* speed controls — adjust speedMultiplier and rebuild schedule from now for remaining drinks */
$('speedUp').addEventListener('click', () => adjustSpeed(0.8)); // faster
$('speedDown').addEventListener('click', () => adjustSpeed(1.25)); // slower

function adjustSpeed(factor) {
  speedMultiplier = Math.max(0.4, Math.min(2.5, speedMultiplier * factor));
  localStorage.setItem(LS_SPEED, String(speedMultiplier));
  // rebuild remaining schedule starting from next unsent index
  const settings = saveSettings();
  if (!schedule || schedule.length === 0) return;
  const nextIdx = schedule.findIndex(s => !s.sent);
  if (nextIdx === -1) return;
  const remaining = schedule.length - nextIdx;
  const now = nowMs();
  // estimate remaining total minutes from original last item
  const last = schedule[schedule.length - 1].time;
  const remainingMinutes = Math.max(1, Math.round((last - now)/60000));
  const intervalMin = (remainingMinutes / remaining) * speedMultiplier;
  // rebuild times
  for (let i=0;i<remaining;i++){
    schedule[nextIdx + i].time = now + Math.round(i * intervalMin * 60000);
    // keep sent flag false for those
    schedule[nextIdx + i].sent = false;
  }
  localStorage.setItem(LS_SCHEDULE, JSON.stringify(schedule));
  renderPlan();
}

/* initial render */
renderPlan();

/* save helper (stores settings) */
function saveSettings() {
  const s = {
    weight: $('weight').value,
    age: $('age').value,
    sex: $('sex').value,
    level: $('level').value,
    startTime: $('startTime').value,
    endTime: $('endTime').value,
    tgToken: $('tgToken').value,
    tgChat: $('tgChat').value,
    proxyUrl: (JSON.parse(localStorage.getItem(LS_SETTINGS) || '{}').proxyUrl) || ''
  };
  localStorage.setItem(LS_SETTINGS, JSON.stringify(s));
  return s;
}

/* expose simple console helper to set proxyUrl (if you want), e.g.:
   localStorage.setItem('dt_v3_settings', JSON.stringify({...JSON.parse(localStorage.getItem('dt_v3_settings')||'{}'), proxyUrl:'https://your-proxy/on-send'}))
*/


