// Геометрия (ровная раскладка)
const FRAME = { W: 1200, H: 600 };
const FLOW  = { COUNT: 5, BOX_W: 180, BOX_H: 72, GAP: 40 };
const COLORS = {
  frameFill: "#0B1220", boxFill:"#0E1628", boxActive:"#0E223A",
  boxBorder:"#1F2A44", txt:"#E5E7EB", dot:"#3B82F6"
};
const META_KEY = 'weFlowV1'; // ключ для item metadata (Web SDK v2 поддерживает метаданные на айтемах) 
let state = { frameId:null, boxIds:[], dotId:null, idx:-1, auto:null };

function centerLayout(frame){ // возвращает координаты центров блоков
  const totalW = FLOW.COUNT*FLOW.BOX_W + (FLOW.COUNT-1)*FLOW.GAP; // 1100
  const leftX  = frame.x - totalW/2 + FLOW.BOX_W/2;
  const y      = frame.y - 40;
  return Array.from({length: FLOW.COUNT}, (_,i)=>({ x:leftX + i*(FLOW.BOX_W+FLOW.GAP), y }));
}

async function notify(text){ await miro.board.notifications.showInfo(text); } // всплывашки на борде

async function buildScene(){
  // 1) создать кадр
  const [frame] = await miro.board.createFrames({
    title: 'Flow Demo — 5 blocks',
    x: 0, y: 0, width: FRAME.W, height: FRAME.H, style: { fillColor: COLORS.frameFill }
  });
  state.frameId = frame.id;

  // 2) разложить блоки
  const centers = centerLayout({x:frame.x, y:frame.y});
  const shapes = [];
  for (let i=0;i<FLOW.COUNT;i++){
    const s = await miro.board.createShape({
      content: `Step ${i+1}`, shape: 'round_rectangle',
      x: centers[i].x, y: centers[i].y, width: FLOW.BOX_W, height: FLOW.BOX_H,
      style: { fillColor: COLORS.boxFill, borderColor: COLORS.boxBorder, borderWidth: 2, fontSize: 16, textAlign: 'center' }
    });
    await s.setMetadata(META_KEY, { role: 'box', index: i });
    shapes.push(s);
    if (i>0) {
      await miro.board.createConnector({
        startItem: { id: shapes[i-1].id }, endItem: { id: s.id },
        shape:'elbowed',
        style:{ strokeColor:'#64748B', strokeWidth:2, strokeStyle:'normal', startStrokeCap:'none', endStrokeCap:'stealth' }
      });
    }
  }
  state.boxIds = shapes.map(s=>s.id);

  // 3) точка сверху над первым
  const first = shapes[0];
  const dot = await miro.board.createShape({
    shape:'circle', content:'', x: first.x, y: first.y - (FLOW.BOX_H/2 + 26),
    width: 20, height:20, style:{ fillColor: COLORS.dot, borderColor: COLORS.dot, borderWidth:2 }
  });
  await dot.setMetadata(META_KEY, { role: 'dot' });
  state.dotId = dot.id;
  state.idx = 0;

  // 4) запомнить метаданные на кадре, чтобы потом быстро находить всё «семейство»
  await frame.setMetadata(META_KEY, { frame:true, boxIds: state.boxIds, dotId: state.dotId });

  // 5) красиво перелететь камерой на кадр
  await miro.board.viewport.zoomTo(frame);

  await notify('Scene built. Use Step / Auto.');
  document.getElementById('status').textContent = 'Scene built.';
}

async function loadSceneFromBoard(){
  // позволяет подхватывать уже нарисованную сцену, если панель закрывали
  const frames = await miro.board.get({ type:'frame' });
  for (const f of frames){
    const meta = await f.getMetadata(META_KEY);
    if (meta?.frame) {
      state.frameId = f.id;
      state.boxIds  = meta.boxIds || [];
      state.dotId   = meta.dotId  || null;
      state.idx     = -1;
      return true;
    }
  }
  return false;
}

async function step(){
  if (!state.frameId) {
    const ok = await loadSceneFromBoard();
    if (!ok) return notify('Build scene first.');
  }
  // получить объекты
  const boxes = await miro.board.getById(...state.boxIds);
  const dot   = await miro.board.getById(state.dotId);
  if (!boxes.length || !dot) return notify('Scene is incomplete.');

  // сброс стилей
  for (const b of boxes) {
    b.style.fillColor = COLORS.boxFill;
    b.style.borderColor = COLORS.boxBorder;
    await b.sync();
  }

  // следующий индекс + подсветка
  state.idx = (state.idx + 1) % boxes.length;
  const target = boxes[state.idx];
  target.style.fillColor = COLORS.boxActive;
  target.style.borderColor = '#3B82F6';
  await target.sync();

  // плавный «сдвиг» точки (5 кадров)
  const start = { x: dot.x, y: dot.y };
  const end   = { x: target.x, y: target.y - (FLOW.BOX_H/2 + 26) };
  const steps = 5;
  for (let i=1;i<=steps;i++){
    const t = i/steps;
    dot.x = start.x + (end.x-start.x)*t;
    dot.y = start.y + (end.y-start.y)*t;
    await dot.sync();
    await new Promise(r=>setTimeout(r, 60));
  }
}

function autoToggle(){
  if (state.auto) { clearInterval(state.auto); state.auto=null; notify('Auto: stopped'); return; }
  state.auto = setInterval(step, 900);
  notify('Auto: started');
}

async function reset(){
  if (!state.frameId) return;
  state.idx = -1;
  await step();
}

// кнопки панели
document.getElementById('build').onclick = buildScene;
document.getElementById('step').onclick  = step;
document.getElementById('auto').onclick  = autoToggle;
document.getElementById('reset').onclick = reset;
