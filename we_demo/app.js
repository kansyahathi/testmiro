// Minimal SVG flow renderer for two side-by-side flows.
// No dependencies.

const THEME = {
  bg:        getCSS('--bg'),
  panel:     getCSS('--panel'),
  stroke:    getCSS('--stroke'),
  text:      getCSS('--text'),
  muted:     getCSS('--muted'),
  accent:    getCSS('--accent'),
  accent2:   getCSS('--accent2'),
  box:       getCSS('--box'),
  boxActive: getCSS('--boxActive'),
  boxBorder: getCSS('--boxBorder'),
  conn:      getCSS('--conn')
};

function getCSS(varName){
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
}

function $(sel){ return document.querySelector(sel); }

// Utility: create SVG element
function elSVG(name, attrs={}){
  const e = document.createElementNS("http://www.w3.org/2000/svg", name);
  for (const k in attrs){ e.setAttribute(k, attrs[k]); }
  return e;
}

// Layout config
const LAYOUT = {
  width: 1100,
  height: 520,
  leftCx:  300,
  rightCx: 800,
  cy: 240,
  dx: 120,
  boxW: 110,
  boxH: 64,
};

// Flow nodes order
const NODES = ["Start","Action 1","Wait","Action 2","Finish"];

// Build one flow (side = 'left' | 'right')
function buildFlow(svg, side, opts){
  // Define markers (arrows) once
  ensureDefs(svg);

  const cx = side === 'left' ? LAYOUT.leftCx : LAYOUT.rightCx;
  const cy = LAYOUT.cy;
  const {dx, boxW: w, boxH: h} = LAYOUT;

  const group = elSVG('g', { 'data-side': side });
  svg.appendChild(group);

  const nodes = [];
  for (let i=0;i<5;i++){
    const x = cx + (i-2)*dx;
    const y = cy;
    const rect = elSVG('rect', {
      x: x - w/2, y: y - h/2, rx: 10, ry: 10,
      width: w, height: h,
      fill: THEME.box, stroke: THEME.boxBorder, 'stroke-width': 2
    });
    group.appendChild(rect);

    const label = elSVG('text', {
      x, y: y+5,
      'text-anchor': 'middle',
      'font-size': 14,
      'fill': THEME.text,
      'font-family': 'system-ui, -apple-system, Segoe UI, Roboto, Arial'
    });
    label.textContent = NODES[i];
    group.appendChild(label);

    nodes.push({x,y,w,h,rect,label});
  }

  // connectors
  for (let i=0;i<4;i++){
    const a = nodes[i], b = nodes[i+1];
    const line = elSVG('line', {
      x1: a.x + w/2, y1: a.y,
      x2: b.x - w/2, y2: b.y,
      stroke: THEME.conn, 'stroke-width': 2,
      'marker-end': 'url(#arrow)'
    });
    group.appendChild(line);
  }

  // extra dotted "calc" for WE on step 1
  if (side==='right' && opts.showCalc){
    // Start->A1, A1->Wait
    for (let i=0;i<2;i++){
      const a = nodes[i], b = nodes[i+1];
      const dline = elSVG('line', {
        x1: a.x + w/2, y1: a.y-8,
        x2: b.x - w/2, y2: b.y-8,
        stroke: THEME.accent, 'stroke-width': 2,
        'stroke-dasharray': '6 6',
        'marker-end': 'url(#arrowAccent)'
      });
      group.appendChild(dline);
    }
  }

  // dot marker
  const dot = elSVG('circle', {
    cx: nodes[0].x, cy: nodes[0].y - (h/2 + 18),
    r: 8, fill: side==='left' ? THEME.accent2 : THEME.accent,
    stroke: side==='left' ? THEME.accent2 : THEME.accent, 'stroke-width': 2
  });
  group.appendChild(dot);

  // log box
  const log = elSVG('rect', {
    x: cx - 220, y: cy + 110, width: 440, height: 120, rx: 10, ry:10,
    fill: THEME.panel, stroke: THEME.stroke, 'stroke-width': 1
  });
  group.appendChild(log);
  const logText = elSVG('text', {
    x: cx - 200, y: cy + 135,
    'font-size': 12, 'fill': THEME.muted
  });
  logText.innerHTML = '';
  group.appendChild(logText);

  function setLog(lines){
    // multi-line text as tspans
    while (logText.firstChild) logText.removeChild(logText.firstChild);
    lines.forEach((ln, idx)=>{
      const t = elSVG('tspan', { x: (cx - 200), dy: idx===0 ? 0 : 16 });
      t.textContent = ln;
      logText.appendChild(t);
    });
  }

  return {group, nodes, dot, setLog};
}

function ensureDefs(svg){
  let defs = svg.querySelector('defs');
  if (!defs){
    defs = elSVG('defs');
    svg.appendChild(defs);

    const arrow = elSVG('marker', { id:'arrow', viewBox:'0 0 10 10', refX:'10', refY:'5', markerWidth:'10', markerHeight:'10', orient:'auto-start-reverse' });
    arrow.appendChild(elSVG('path', { d:'M 0 0 L 10 5 L 0 10 z', fill: THEME.conn }));
    defs.appendChild(arrow);

    const arrowAcc = elSVG('marker', { id:'arrowAccent', viewBox:'0 0 10 10', refX:'10', refY:'5', markerWidth:'10', markerHeight:'10', orient:'auto-start-reverse' });
    arrowAcc.appendChild(elSVG('path', { d:'M 0 0 L 10 5 L 0 10 z', fill: THEME.accent }));
    defs.appendChild(arrowAcc);
  }
}

function moveDot(dot, from, to, steps=10, cb){
  const dx = (to.x - from.x)/steps;
  const dy = (to.y - from.y)/steps;
  let i=0;
  const tick = ()=>{
    i++;
    dot.setAttribute('cx', +dot.getAttribute('cx') + dx);
    dot.setAttribute('cy', +dot.getAttribute('cy') + dy);
    if (i<steps) requestAnimationFrame(tick); else cb && cb();
  };
  tick();
}

// Build a page scene
function buildScene(config){
  const svg = elSVG('svg', { width: '100%', height:'520', viewBox: `0 0 ${LAYOUT.width} ${LAYOUT.height}` });
  $('.stage').appendChild(svg);

  const left = buildFlow(svg, 'left',  { showCalc:false });
  const right= buildFlow(svg, 'right', { showCalc: !!config.showCalcRight });

  // Highlight per step
  function highlightStep(step){
    function setActive(flow, idx){
      flow.nodes.forEach((n,i)=>{
        n.rect.setAttribute('fill', i===idx ? THEME.boxActive : THEME.box);
        n.rect.setAttribute('stroke', i===idx ? THEME.accent : THEME.boxBorder);
      });
    }
    if (config.mode==='step1'){
      setActive(left, 0);
      setActive(right,0);
      left.setLog(["Elsa: Step 1 — Start (v1)", "Instance walks block-by-block."]);
      right.setLog(["WE: Step 1 — Start → pre-calc to nearest Wait", "Dotted path shows calculation."]);
    }
    if (config.mode==='step2'){
      setActive(left, 2); // Wait
      setActive(right,2);
      left.setLog(["Elsa: Step 2 — In Wait", "Next → Action 2 when released."]);
      right.setLog(["WE: Step 2 — In Wait (version checked on entry)", "Action fires from wait context."]);
    }
    if (config.mode==='step3'){
      setActive(left, 3); // Action 2
      setActive(right,3);
      left.setLog(["Elsa: Step 3 — Wait → Action 2", "Version change doesn't affect current instance."]);
      right.setLog(["WE: Step 3 — Action 2 (post-wait)", "If version updated during wait → new version applies."]);
    }
  }

  highlightStep(config.mode);

  // Interactive: Step animates dots toward the highlighted node
  let animIndex = 0;
  function handleStep(){
    const targetIdx = config.mode==='step1' ? 0 : config.mode==='step2' ? 2 : 3;
    const flows = [left, right];
    flows.forEach(f=>{
      const startPos = { x:+f.dot.getAttribute('cx'), y:+f.dot.getAttribute('cy') };
      const to = f.nodes[targetIdx];
      const endPos = { x: to.x, y: to.y - (LAYOUT.boxH/2 + 18) };
      moveDot(f.dot, startPos, endPos, 12);
    });
    animIndex++;
  }

  $('#btn-step')?.addEventListener('click', handleStep);
  $('#btn-reset')?.addEventListener('click', ()=>{
    [left,right].forEach(f=>{
      const start = f.nodes[0];
      f.dot.setAttribute('cx', start.x);
      f.dot.setAttribute('cy', start.y - (LAYOUT.boxH/2 + 18));
    });
    highlightStep(config.mode);
  });
}

// Page boot
document.addEventListener('DOMContentLoaded', () => {
  // Page determines mode from data-mode attr on <body>
  const mode = document.body.getAttribute('data-mode') || 'step1';
  const showCalc = (mode==='step1');
  buildScene({ mode, showCalcRight: showCalc });
});