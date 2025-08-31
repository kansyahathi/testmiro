// ====== ДЕМО-НАСТРОЙКИ (после проверки ротируй токен и вынеси на сервер) ======
const TOKEN    = "eyJtaXJvLm9yaWdpbiI6ImV1MDEifQ_iatvz2iENVrYn9VZFr2sGm_6Waw";
const BOARD_ID = "uXjVJObprOI=";

// Геометрия — подобрана так, чтобы было ровно и без наездов
const FRAME = { W: 1200, H: 600 };
const FLOW  = { COUNT: 5, BOX_W: 180, BOX_H: 72, GAP: 40 }; // 5 блоков по 180 + 4 промежутка по 40 = 1100 px
const COLORS = {
  frameFill: "#0B1220",
  boxFill:   "#0E1628",
  boxBorder: "#1F2A44",
  boxActive: "#0E223A",
  txt:       "#E5E7EB",
  dot:       "#3B82F6",
  dot2:      "#22C55E",
  btnFill:   "#111827",
  btnBorder: "#334155",
  conn:      "#64748B"
};

// ====== UI ======
const logEl = () => document.getElementById("log");
function log(msg){ logEl().textContent += "\n" + msg; }
function resetLog(txt=""){ logEl().textContent = txt; }
const sleep = (ms) => new Promise(r=>setTimeout(r,ms));

// ====== REST helper ======
async function api(path, opts={}){
  const url = `https://api.miro.com/v2${path}`;
  const res = await fetch(url, {
    headers: { "Authorization": `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    ...opts
  });
  const text = await res.text();
  let data; try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  return { ok: res.ok, status: res.status, data };
}

// ====== Очистка борда (с пагинацией, лимит 50) ======
async function wipeBoard(){
  resetLog("Wipe: start…");
  let cursor = null, total = 0;

  while (true) {
    const params = new URLSearchParams();
    params.set('limit', '50');
    if (cursor) params.set('cursor', cursor);

    const r = await api(`/boards/${BOARD_ID}/items?${params.toString()}`);
    if (!r.ok) throw new Error(`List items failed ${r.status}: ${JSON.stringify(r.data)}`);

    const items = r.data.data || [];
    if (items.length === 0) break;

    for (const it of items) {
      const del = await api(`/boards/${BOARD_ID}/items/${it.id}`, { method: "DELETE" });
      if (del.status === 429) { await sleep(400); }
      log(`deleted ${it.type || 'item'} ${it.id} [${del.status}]`);
      total++;
    }

    cursor = r.data.cursor || null;
    if (!cursor) break;
  }

  log(`Wipe: done. Deleted ${total} items.`);
}

// ====== Создание элементов ======
async function createFrame(title, x, y){
  const r = await api(`/boards/${BOARD_ID}/frames`, {
    method:"POST",
    body: JSON.stringify({
      data:{ title },
      position:{ x, y },
      geometry:{ width: FRAME.W, height: FRAME.H },
      style:{ fillColor: COLORS.frameFill }
    })
  });
  if(!r.ok) throw new Error("createFrame: " + JSON.stringify(r.data));
  return r.data;
}

async function createShape({content, shape="round_rectangle", x, y, w=160, h=60, fill=COLORS.boxFill, border=COLORS.boxBorder, bw=2, fontSize=16, align="center"}){
  const r = await api(`/boards/${BOARD_ID}/shapes`, {
    method:"POST",
    body: JSON.stringify({
      data:{ content, shape },
      position:{ x, y },
      geometry:{ width: w, height: h },
      style:{ fillColor: fill, borderColor: border, borderWidth: bw, fontSize, textAlign: align }
    })
  });
  if(!r.ok) throw new Error("createShape: " + JSON.stringify(r.data));
  return r.data;
}

async function createConn(startItemId, endItemId, { dotted=false, color=COLORS.conn } = {}){
  const r = await api(`/boards/${BOARD_ID}/connectors`, {
    method:"POST",
    body: JSON.stringify({
      shape: "elbowed",
      style: {
        strokeColor: color,
        strokeWidth: 2,
        strokeStyle: dotted ? "dotted" : "normal",
        startStrokeCap: "none",
        endStrokeCap: "stealth"
      },
      startItem: { id: startItemId },
      endItem:   { id: endItemId }
    })
  });
  if(!r.ok) throw new Error("createConn: " + JSON.stringify(r.data));
  return r.data;
}

// ====== Сцена (один кадр, 5 блоков, точка и псевдо-кнопка) ======
const Scene = {
  frame: null,
  boxes: [],     // [{id, position, style}, ...]
  dot:   null,   // shape circle
  idx:   0,      // текущий индекс 0..4
  button: null   // «кнопка» на борде (декорация)
};

function layoutPositions(frameX, frameY){
  // центр кадра — (frameX, frameY)
  const totalW = FLOW.COUNT * FLOW.BOX_W + (FLOW.COUNT - 1) * FLOW.GAP; // 1100
  const leftX  = frameX - totalW/2 + FLOW.BOX_W/2; // первая коробка
  const y      = frameY - 40; // чуть выше центра по вертикали

  const xs = Array.from({length: FLOW.COUNT}, (_,i) => leftX + i*(FLOW.BOX_W + FLOW.GAP));
  return { xs, y };
}

async function buildScene(){
  resetLog("Build: start…");
  // Не чистим весь борд, чтобы случайно не снести чужое. Но можно включить, если нужно:
  // await wipeBoard();

  // Создаём новый кадр в центре (0,0)
  Scene.frame = await createFrame("Flow Demo — 5 blocks", 0, 0);

  const { xs, y } = layoutPositions(Scene.frame.position.x, Scene.frame.position.y);

  // Блоки
  Scene.boxes = [];
  for(let i=0;i<FLOW.COUNT;i++){
    const box = await createShape({
      content: `Step ${i+1}`,
      x: xs[i], y: y,
      w: FLOW.BOX_W, h: FLOW.BOX_H
    });
    Scene.boxes.push(box);
    if(i>0){
      await createConn(Scene.boxes[i-1].id, box.id, { dotted:false });
    }
  }

  // Точка-маркер (над первым блоком)
  Scene.idx = 0;
  Scene.dot = await createShape({
    content:"", shape:"circle",
    x: Scene.boxes[0].position.x,
    y: Scene.boxes[0].position.y - (FLOW.BOX_H/2 + 26),
    w: 20, h: 20,
    fill: COLORS.dot, border: COLORS.dot, bw: 2
  });

  // Псевдо-кнопка внутри кадра (для вида)
  Scene.button = await createShape({
    content:"▶ Run step (use page button)",
    x: Scene.frame.position.x,
    y: Scene.frame.position.y + FRAME.H/2 - 50,
    w: 320, h: 46,
    fill: COLORS.btnFill, border: COLORS.btnBorder, bw: 1, fontSize: 14
  });

  // Подпись/легенда
  await createShape({
    content:"Маркер двигается по блокам по нажатию «Step». Когда подключим SDK, перенесём клик внутрь Miro.",
    shape:"rectangle",
    x: Scene.frame.position.x,
    y: Scene.frame.position.y + 160,
    w: 900, h: 100,
    fill: "#0F172A", border: "#334155", bw: 1, fontSize: 12, align: "left"
  });

  log("Build: done. Нажимай «Step» или «Auto».");
}

// ====== Переместить маркер к следующему блоку ======
async function step(){
  if(!Scene.frame || !Scene.boxes.length || !Scene.dot){
    log("Сначала нажми Build scene.");
    return;
  }
  // сброс подсветки всех
  for(const box of Scene.boxes){
    await api(`/boards/${BOARD_ID}/items/${box.id}`, {
      method:"PATCH",
      body: JSON.stringify({ style: { fillColor: COLORS.boxFill, borderColor: COLORS.boxBorder } })
    });
  }

  // следующий индекс
  Scene.idx = (Scene.idx + 1) % Scene.boxes.length;
  const target = Scene.boxes[Scene.idx];

  // подсветим активный бокс
  await api(`/boards/${BOARD_ID}/items/${target.id}`, {
    method:"PATCH",
    body: JSON.stringify({ style: { fillColor: COLORS.boxActive, borderColor: "#3B82F6" } })
  });

  // двинем точку над ним
  await api(`/boards/${BOARD_ID}/items/${Scene.dot.id}`, {
    method:"PATCH",
    body: JSON.stringify({
      position: { x: target.position.x, y: target.position.y - (FLOW.BOX_H/2 + 26) }
    })
  });

  log(`Step → ${Scene.idx+1}`);
}

// ====== Автопрокрутка ======
let autoTimer = null;
async function autoRun(){
  if(autoTimer){ clearInterval(autoTimer); autoTimer=null; log("Auto: stopped"); return; }
  log("Auto: started");
  autoTimer = setInterval(step, 900);
}

// ====== Reset (вернуть маркер к первому блоку) ======
async function reset(){
  if(!Scene.frame || !Scene.boxes.length || !Scene.dot){ return; }
  Scene.idx = -1; // чтобы первый step поставил на индекс 0
  // вернём всем базовый стиль
  for(const box of Scene.boxes){
    await api(`/boards/${BOARD_ID}/items/${box.id}`, {
      method:"PATCH",
      body: JSON.stringify({ style: { fillColor: COLORS.boxFill, borderColor: COLORS.boxBorder } })
    });
  }
  await step();
}

// ====== Кнопки ======
document.getElementById("btn-build").addEventListener("click", () => {
  buildScene().catch(e => log("ERR build: " + e.message));
});
document.getElementById("btn-step").addEventListener("click", () => {
  step().catch(e => log("ERR step: " + e.message));
});
document.getElementById("btn-auto").addEventListener("click", () => {
  autoRun();
});
document.getElementById("btn-reset").addEventListener("click", () => {
  reset().catch(e => log("ERR reset: " + e.message));
});
document.getElementById("btn-wipe").addEventListener("click", () => {
  wipeBoard().catch(e => log("ERR wipe: " + e.message));
});
