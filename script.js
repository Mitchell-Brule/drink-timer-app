let drinks = 0;
let timer;
let countdown = 0;

document.getElementById('addDrink').addEventListener('click', () => {
  drinks++;
  document.getElementById('statusText').textContent = `You’ve had ${drinks} drinks.`;
  countdown = 60 * 30; // 30 minutes
  startTimer();
});

document.getElementById('reset').addEventListener('click', () => {
  drinks = 0;
  document.getElementById('statusText').textContent = "You’ve had 0 drinks.";
  clearInterval(timer);
  document.getElementById('timer').textContent = "00:00";
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
