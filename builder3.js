// ====== Настройки (для демо захардкожено; потом вынесем) ======
const TOKEN    = "eyJtaXJvLm9yaWdpbiI6ImV1MDEifQ_iatvz2iENVrYn9VZFr2sGm_6Waw";
const BOARD_ID = "uXjVJObprOI=";

const logEl = () => document.getElementById("log");
function log(msg){ logEl().textContent += "\n" + msg; }
function resetLog(txt=""){ document.getElementById("log").textContent = txt; }

async function api(path, opts={}){
  const url = `https://api.miro.com/v2${path}`;
  const res = await fetch(url, {
    headers: { "Authorization": `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    ...opts
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  return { ok: res.ok, status: res.status, data };
}

// ====== Удаление всего с борда (с пагинацией) ======
async function wipeBoard(){
  resetLog("Wipe: start…");
  let cursor = null, total=0;
  do{
    const q = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "?limit=100";
    const r = await api(`/boards/${BOARD_ID}/items${q}`);
    if(!r.ok) throw new Error(`List items failed ${r.status}: ${JSON.stringify(r.data)}`);
    const items = r.data.data || [];
    for(const it of items){
      const del = await api(`/boards/${BOARD_ID}/items/${it.id}`, { method:"DELETE" });
      total++; log(`deleted ${it.type || 'item'} ${it.id} [${del.status}]`);
    }
    cursor = r.data.cursor || null;
  } while(cursor);
  log(`Wipe: done. Deleted ${total} items.`);
}

// ====== Хелперы создания ======
async function createFrame(title, x, y){
  const r = await api(`/boards/${BOARD_ID}/frames`, {
    method:"POST",
    body: JSON.stringify({
      data:{ title },
      position:{ x, y },
      geometry:{ width: 1100, height: 640 },
      style:{ fillColor: "#0B1220" } // тёмный фон кадра
    })
  });
  if(!r.ok) throw new Error("createFrame: " + JSON.stringify(r.data));
  return r.data;
}

async function createShape({content, shape="round_rectangle", x, y, w=160, h=60, fill="#111827", border="#1F2937", bw=2, fontSize=14}){
  const r = await api(`/boards/${BOARD_ID}/shapes`, {
    method:"POST",
    body: JSON.stringify({
      data:{ content, shape },
      position:{ x, y },
      geometry:{ width: w, height: h },
      style:{ fillColor: fill, borderColor: border, borderWidth: bw, fontSize }
    })
  });
  if(!r.ok) throw new Error("createShape: " + JSON.stringify(r.data));
  return r.data;
}

async function createDiamond({content, x, y, w=130, h=90}){
  return createShape({ content, shape:"rhombus", x, y, w, h, fill:"#0D1326", border:"#3B82F6", bw:2, fontSize:14 });
}

async function createConn(aId, bId, dotted=false, color="#64748B"){
  const r = await api(`/boards/${BOARD_ID}/connectors`, {
    method:"POST",
    body: JSON.stringify({
      startItem: { id: aId },
      endItem:   { id: bId },
      style: {
        color,
        lineEndStyle: "filled_arrow",
        lineThickness: 2,
        lineStyle: dotted ? "dotted" : "normal"
      }
    })
  });
  if(!r.ok) throw new Error("createConn: " + JSON.stringify(r.data));
  return r.data;
}

// ====== Рисуем «схему потока» в одном кадре ======
async function drawMiniFlow(frameCenterX, frameCenterY, { showCalc=false, step=1, side="left" }){
  // координаты для двух мини-схем (лево/право) внутри кадра
  const cx = side==="left" ? frameCenterX - 260 : frameCenterX + 260;
  const cy = frameCenterY - 80;
  const dx = 180;

  const start  = await createShape({ content:"Start",    x: cx - 2*dx, y: cy });
  const a1     = await createShape({ content:"Action 1", x: cx - dx,   y: cy });
  const wait   = await createDiamond({ content: side==="left" ? "Wait" : "Wait 1", x: cx, y: cy });
  const a2     = await createShape({ content:"Action 2", x: cx + dx,   y: cy });
  const finish = await createShape({ content:"Finish",   x: cx + 2*dx, y: cy, fill:"#0E1B0E", border:"#16A34A" });

  await createConn(start.id, a1.id);
  await createConn(a1.id,    wait.id);
  await createConn(wait.id,  a2.id);
  await createConn(a2.id,    finish.id);

  // пунктир «расчёта» для правой стороны
  if(side==="right" && showCalc){
    await createConn(start.id, a1.id, true, "#60A5FA");
    await createConn(a1.id,    wait.id, true, "#60A5FA");
  }

  // «точка» — где сейчас «находимся» на этом шаге
  let dotTarget = start;
  if(step===2) dotTarget = side==="left" ? a1 : wait;
  if(step===3) dotTarget = side==="left" ? wait : a2;

  await createShape({ content:"", shape:"circle", x: dotTarget.position.x, y: dotTarget.position.y, w:18, h:18, fill: side==="left" ? "#22C55E" : "#3B82F6", border: side==="left" ? "#22C55E" : "#3B82F6", bw:2 });

  // лог-плашка
  const logY = frameCenterY + 160;
  const logText = (side==="left")
    ? (step===1 ? "Elsa: шаг 1 — Start (v1)\nИнстанс движется блок за блоком." :
       step===2 ? "Elsa: шаг 2 — Action 1\nДальше → Wait (ожидание)." :
                  "Elsa: шаг 3 — Wait → Action 2\nИзменение версии не влияет на текущий инстанс.")
    : (step===1 ? "WE: шаг 1 — Start → расчёт маршрута до ближайшего Wait." :
       step===2 ? "WE: шаг 2 — в Wait (версия проверена на входе).\nДействие выполняется «выстрелом»." :
                  "WE: шаг 3 — Action 2 → далее.\nЕсли версия обновлена в ожидании — применится новая.");

  await createShape({ content: "Log:\n" + logText, shape:"rectangle",
    x: cx, y: logY, w: 440, h: 140, fill:"#0F172A", border:"#334155", bw:1, fontSize:12 });
}

// ====== Собрать 3 шага (кадра) ======
async function build3(){
  resetLog("Build: start…");

  // сначала подчистим (мягко)
  await wipeBoard();

  // Центры кадров: три фрейма слева-направо
  const y = 0;
  const frames = [
    { title:"Step 1 — Start & Calc", x:-1400, step:1, showCalc:true },
    { title:"Step 2 — Wait",         x:   0, step:2, showCalc:false },
    { title:"Step 3 — Action 2",     x: 1400, step:3, showCalc:false },
  ];

  for(const f of frames){
    const fr = await createFrame(f.title, f.x, y);
    // в каждом кадре рисуем левую и правую мини-схему
    await drawMiniFlow(fr.position.x, fr.position.y, { step:f.step, showCalc:f.showCalc, side:"left"  });
    await drawMiniFlow(fr.position.x, fr.position.y, { step:f.step, showCalc:f.showCalc, side:"right" });
    log(`created frame: ${fr.data?.title || f.title}`);
  }

  log("Build: done. Открой Presentation и листай → получится «анимация» по шагам.");
}

// ====== Кнопки ======
document.getElementById("btn-build").addEventListener("click", () => {
  build3().catch(e => log("ERR build: " + e.message));
});
document.getElementById("btn-wipe").addEventListener("click", () => {
  wipeBoard().catch(e => log("ERR wipe: " + e.message));
});
