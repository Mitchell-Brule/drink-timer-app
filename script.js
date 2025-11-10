let timerInterval;
let drinkTimes = [];
let currentDrinkIndex = 0;

// Telegram bot credentials
const bot_token = "7481105387:AAHsNaOFEuMuWan2E1Y44VMrWeiZcxBjCAw";
const chat_id = 7602575312;

const startPlanBtn = document.getElementById('startPlan');
const addDrinkBtn = document.getElementById('addDrink');
const resetBtn = document.getElementById('reset');
const statusDiv = document.getElementById('status');
const timerDisplay = document.getElementById('timer');
const drinkStatus = document.getElementById('drinkStatus');
const drinkListEl = document.getElementById('drinkList');

startPlanBtn.addEventListener('click', () => {
  const start = document.getElementById('startTime').value;
  const end = document.getElementById('endTime').value;
  const level = document.getElementById('level').value;

  if (!start || !end) { alert('Please select start and end times.'); return; }

  const startMins = toMinutes(start);
  const endMins = toMinutes(end);
  const duration = endMins - startMins;
  let drinksAllowed = { light: 3, tipsy: 5, drunk: 8, obliterated: 12 }[level];

  const interval = Math.floor(duration / drinksAllowed);
  drinkTimes = [];
  for (let i = 1; i <= drinksAllowed; i++) {
    drinkTimes.push(startMins + i * interval);
  }

  displayDrinkList();
  statusDiv.classList.remove('hidden');
  currentDrinkIndex = 0;
  startNextDrinkTimer();
});

addDrinkBtn.addEventListener('click', startNextDrinkTimer);

resetBtn.addEventListener('click', () => {
  clearInterval(timerInterval);
  timerDisplay.textContent = '00:00';
  statusDiv.classList.add('hidden');
  document.body.classList.remove('alert');
  drinkListEl.innerHTML = '';
});

function startNextDrinkTimer() {
  if (currentDrinkIndex >= drinkTimes.length) {
    drinkStatus.textContent = "🎉 All drinks completed!";
    return;
  }

  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  let secondsLeft = (drinkTimes[currentDrinkIndex] - nowMins) * 60;
  if (secondsLeft < 0) secondsLeft = 0;

  highlightCurrentDrink();

  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    const mins = Math.floor(secondsLeft / 60);
    const secs = secondsLeft % 60;
    timerDisplay.textContent = `${mins.toString().padStart(2,'0')}:${secs.toString().padStart(2,'0')}`;

    if (secondsLeft <= 0) {
      clearInterval(timerInterval);
      document.body.classList.add('alert');
      drinkStatus.textContent = '🍻 Time for your drink!';
      sendTelegramAlert();
      notifyUser();
      currentDrinkIndex++;
      highlightCurrentDrink();
    } else {
      document.body.classList.remove('alert');
      secondsLeft--;
    }
  }, 1000);
}

function highlightCurrentDrink() {
  drinkListEl.childNodes.forEach((li, index) => {
    if(index === currentDrinkIndex) li.classList.add('currentDrink');
    else li.classList.remove('currentDrink');
  });
}

function displayDrinkList() {
  drinkListEl.innerHTML = '';
  drinkTimes.forEach(time => {
    const hours = Math.floor(time / 60);
    const minutes = time % 60;
    const li = document.createElement('li');
    li.textContent = `${hours.toString().padStart(2,'0')}:${minutes.toString().padStart(2,'0')}`;
    drinkListEl.appendChild(li);
  });
}

function toMinutes(time) {
  const [h,m] = time.split(':').map(Number);
  return h*60 + m;
}

// 🔔 Browser notification
function notifyUser() {
  if (Notification.permission === 'granted') {
    new Notification('Drink Timer', { body: 'Time for your next drink! 🍺' });
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        new Notification('Drink Timer', { body: 'Time for your next drink! 🍺' });
      }
    });
  }
}

// 📩 Telegram alert
function sendTelegramAlert() {
  fetch(`https://api.telegram.org/bot${bot_token}/sendMessage?chat_id=${chat_id}&text=Time for your drink! 🍺`);
}

