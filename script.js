let drinks = 0;
let timer;
let countdown = 0;
let drinkInterval = 0;
let totalAllowed = 0;

document.getElementById('startPlan').addEventListener('click', () => {
  const start = document.getElementById('startTime').value;
  const end = document.getElementById('endTime').value;
  const weight = parseFloat(document.getElementById('weight').value);
  const level = document.getElementById('drunkLevel').value;

  if (!start || !end || !weight) {
    alert("Please fill in weight, start and end time.");
    return;
  }

  const startHour = parseInt(start.split(':')[0]);
  const endHour = parseInt(end.split(':')[0]);
  let duration = endHour - startHour;
  if (duration <= 0) duration += 24;

  // Adjust allowed drinks by desired level
  if (level === 'light') totalAllowed = Math.round(duration * 1);
  if (level === 'tipsy') totalAllowed = Math.round(duration * 1.5);
  if (level === 'drunk') totalAllowed = Math.round(duration * 2);

  drinkInterval = Math.floor((duration * 60) / totalAllowed);

  document.getElementById('limitText').textContent =
    `Plan allows ~${totalAllowed} drinks between now and your end time. One every ${drinkInterval} min.`;

  document.getElementById('drinkingSection').style.display = 'block';
});

document.getElementById('addDrink').addEventListener('click', () => {
  drinks++;
  document.getElementById('statusText').textContent = `You’ve had ${drinks} drinks.`;
  countdown = drinkInterval * 60; // convert minutes to seconds
  startTimer();

  if (drinks >= totalAllowed) {
    alert("You've reached your planned drink limit!");
  }
});

document.getElementById('reset').addEventListener('click', () => {
  drinks = 0;
  clearInterval(timer);
  document.getElementById('statusText').textContent = "You’ve had 0 drinks.";
  document.getElementById('timer').textContent = "00:00";
  document.getElementById('limitText').textContent = "";
  document.getElementById('drinkingSection').style.display = 'none';
});

function startTimer() {
  clearInterval(timer);
  timer = setInterval(() => {
    if (countdown > 0) {
      countdown--;
      let min = Math.floor(countdown / 60);
      let sec = countdown % 60;
      document.getElementById('timer').textContent = `${min}:${sec.toString().padStart(2, '0')}`;
    } else {
      clearInterval(timer);
      alert("You can have your next drink!");
    }
  }, 1000);
}

