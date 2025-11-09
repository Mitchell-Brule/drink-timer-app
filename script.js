let timerInterval;
let nextDrinkTime = 0;

const startPlanBtn = document.getElementById('startPlan');
const addDrinkBtn = document.getElementById('addDrink');
const resetBtn = document.getElementById('reset');
const statusDiv = document.getElementById('status');
const timerDisplay = document.getElementById('timer');
const drinkStatus = document.getElementById('drinkStatus');

startPlanBtn.addEventListener('click', () => {
  const start = document.getElementById('startTime').value;
  const end = document.getElementById('endTime').value;
  const level = document.getElementById('level').value;

  if (!start || !end) {
    alert('Please select start and end times.');
    return;
  }

  const startMins = toMinutes(start);
  const endMins = toMinutes(end);
  const duration = endMins - startMins;
  let drinksAllowed = { light: 3, tipsy: 5, drunk: 8, obliterated: 12 }[level];
  nextDrinkTime = Math.floor(duration / drinksAllowed);

  statusDiv.classList.remove('hidden');
  drinkStatus.textContent = 'Plan started! Next drink in:';
  startTimer(nextDrinkTime * 60);
});

addDrinkBtn.addEventListener('click', () => {
  startTimer(nextDrinkTime * 60);
});

resetBtn.addEventListener('click', () => {
  clearInterval(timerInterval);
  timerDisplay.textContent = '00:00';
  statusDiv.classList.add('hidden');
});

function startTimer(seconds) {
  clearInterval(timerInterval);
  let remaining = seconds;

  timerInterval = setInterval(() => {
    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    timerDisplay.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    if (remaining <= 0) {
      clearInterval(timerInterval);
      document.body.classList.add('alert');
      drinkStatus.textContent = '🍻 You can have your next drink!';
      notifyUser();
    } else {
      document.body.classList.remove('alert');
      remaining--;
    }
  }, 1000);
}

function toMinutes(time) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

// 🔔 Basic phone notification
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
