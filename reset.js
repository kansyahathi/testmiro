// === Настройки (пока захардкожено, потом можно вынести в .env или конфиг) ===
const TOKEN = "eyJtaXJvLm9yaWdpbiI6ImV1MDEifQ_iatvz2iENVrYn9VZFr2sGm_6Waw";
const BOARD_ID = "uXjVJObprOI=";

// === Вспомогательная функция логов ===
function log(msg) {
  const pre = document.getElementById("log");
  pre.textContent += `\n${msg}`;
}

// === Очистить борд ===
async function clearBoard() {
  const url = `https://api.miro.com/v2/boards/${BOARD_ID}/items`;

  const res = await fetch(url, {
    headers: { "Authorization": `Bearer ${TOKEN}` }
  });

  if (!res.ok) {
    throw new Error(`Ошибка получения элементов: ${res.status}`);
  }

  const data = await res.json();

  // Удалим все элементы поочередно
  for (const item of data.data) {
    const del = await fetch(`https://api.miro.com/v2/boards/${BOARD_ID}/items/${item.id}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${TOKEN}` }
    });
    log(`Удален элемент ${item.id}, статус ${del.status}`);
  }
}

// === Создать новый белый фрейм ===
async function createFrame() {
  const url = `https://api.miro.com/v2/boards/${BOARD_ID}/frames`;

  const body = {
    data: { title: "New Clean Frame ✅" },
    position: { x: 0, y: 0 },
    geometry: { width: 900, height: 520 },
    style: { fillColor: "#FFFFFF" }
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const data = await res.json();
  log(`Создан фрейм: ${JSON.stringify(data, null, 2)}`);
}

// === Основная функция ===
async function resetBoard() {
  try {
    document.getElementById("log").textContent = "Старт очистки борда...";
    await clearBoard();
    await createFrame();
    log("Борд очищен и новый фрейм создан ✅");
  } catch (err) {
    log("Ошибка: " + err.message);
  }
}

// === Привязка кнопки ===
document.getElementById("resetBtn").addEventListener("click", resetBoard);
