let drinks = 0;
let drinkTimes = [];
let currentIndex = 0;
let timer;

const TELEGRAM_TOKEN = "YOUR_TOKEN_HERE"; 
const CHAT_ID = "YOUR_CHAT_ID_HERE"; 

document.getElementById("startPlan").addEventListener("click", () => {
  const start = document.getElementById("startTime").value;
  const end = document.getElementById("endTime").value;
  const level = document.getElementById("drunkLevel").value;

  if (!start || !end) {
    alert("Enter start and end times");
    return;
  }

  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let startMins = sh * 60 + sm;
  let endMins = eh * 60 + em;
  if (endMins <= startMins) endMins += 24 * 60;

  const duration = endMins - startMins;
  let drinkCount = level === "light" ? duration / 60 :
                   level === "tipsy" ? duration / 45 :
                   level === "drunk" ? duration / 30 :
                   duration / 20;

  drinkCount = Math.floor(drinkCount);
  const interval = duration / drinkCount;

  drinkTimes = [];
  for (let i = 0; i < drinkCount; i++) {
    const mins = startMins + Math.round(i * interval);
    const h = Math.floor(mins / 60) % 24;
    const m = mins % 60;
    drinkTimes.push(`${h.toString().padStart(2,"0")}:${m.toString().padStart(2,"0")}`);
  }

  showDrinkPlan();
  currentIndex = 0;
  checkNextDrink();
});

function showDrinkPlan() {
  const container = document.getElementById("drinkPlan");
  container.innerHTML = "<h3>🍺 Drink Plan</h3>";
  drinkTimes.forEach((time, i) => {
    const div = document.createElement("div");
    div.textContent = `${i + 1}. ${time}`;
    div.classList.add("drink-time");
    container.appendChild(div);
  });
}

function checkNextDrink() {
  clearInterval(timer);
  timer = setInterval(() => {
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    const currentTime = `${h.toString().padStart(2,"0")}:${m.toString().padStart(2,"0")}`;

    const divs = document.querySelectorAll(".drink-time");
    divs.forEach(d => d.classList.remove("active"));

    if (currentIndex < drinkTimes.length && currentTime === drinkTimes[currentIndex]) {
      divs[currentIndex].classList.add("active");
      sendTelegramMessage(`🍺 Time for drink #${currentIndex + 1}!`);
      showNotification(`Drink #${currentIndex + 1}`, "It's time for your next drink!");
      currentIndex++;
    }
  }, 30000); // check every 30 sec
}

function sendTelegramMessage(text) {
  fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: CHAT_ID, text }),
  });
}

function showNotification(title, body) {
  if (Notification.permission === "granted") {
    new Notification(title, { body });
  } else if (Notification.permission !== "denied") {
    Notification.requestPermission().then(permission => {
      if (permission === "granted") {
        new Notification(title, { body });
      }
    });
  }
}

