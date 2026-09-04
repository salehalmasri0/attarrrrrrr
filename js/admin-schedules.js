/* =========================================================
   إدارة الجدولة (يومية وشهرية) وأنماط الزيارات الأسبوعية
   ========================================================= */

/* ================= SCHEDULES ADMIN ================= */
let schedMode = 'day'; // 'day' | 'month'
let schedDate = todayStr();
let schedCoordId = null;
let schedPending = [];

let schedMonth = todayStr().slice(0,7); // 'YYYY-MM'
let schedMonthCoordId = null;
let schedWeekPattern = {0:[],1:[],2:[],3:[],4:[],5:[],6:[]}; // weekday(0=Sunday..6=Saturday) -> [siteId,...]
let schedActiveWeekday = 0;
const WEEKDAY_LABELS = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
const WEEKDAY_SHORT = ['أحد','اثنين','ثلاثاء','أربعاء','خميس','جمعة','سبت'];

function renderSchedulesAdmin(){
  const main = document.getElementById('main-area');
  if(!schedCoordId && DB.coordinators[0]) schedCoordId = DB.coordinators[0].id;
  if(!schedMonthCoordId && DB.coordinators[0]) schedMonthCoordId = DB.coordinators[0].id;
  main.innerHTML = `
    <div class="seg-tabs">
      <button type="button" id="seg-day" class="${schedMode==='day'?'active':''}">يوم واحد</button>
      <button type="button" id="seg-month" class="${schedMode==='month'?'active':''}">نمط أسبوعي لكل الشهر</button>
    </div>
    <div id="sched-body"></div>
  `;
  document.getElementById('seg-day').addEventListener('click', ()=>{ schedMode='day'; renderSchedulesAdmin(); });
  document.getElementById('seg-month').addEventListener('click', ()=>{ schedMode='month'; loadWeekPattern(schedMonthCoordId); renderSchedulesAdmin(); });

  if(schedMode==='day') renderDayScheduler(); else renderMonthScheduler();
}

/* ---- Single day mode (original behaviour) ---- */
function renderDayScheduler(){
  const body = document.getElementById('sched-body');
  body.innerHTML = `
    <div class="card">
      <h3>الجدولة اليومية</h3>
      <div class="row2">
        <div><label>التاريخ</label><input type="date" id="sc-date" value="${schedDate}"></div>
        <div><label>المنسّق</label><select id="sc-coord">${DB.coordinators.map(c=>`<option value="${c.id}" ${c.id===schedCoordId?'selected':''}>${escapeHtml(c.name)}</option>`).join('')}</select></div>
      </div>
      <label>إضافة موقع للخطة</label>
      <div class="row2">
        <select id="sc-site-pick">${DB.sites.filter(s=>s.active).map(s=>`<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('')}</select>
        <button type="button" class="btn-ghost" id="sc-add" style="flex:0 0 90px;">إضافة</button>
      </div>
      <div class="site-chip-list" id="sc-pending"></div>
      <button class="btn-primary" id="sc-save">حفظ خطة هذا اليوم لهذا المنسّق</button>
      <button class="btn-secondary" id="sc-copy">نسخ خطة الأمس لنفس المنسّق</button>
    </div>
    <div class="card">
      <h3>خطط ${fmtDate(schedDate)}</h3>
      <div id="sc-list"></div>
    </div>
  `;
  schedPending = [...scheduleFor(schedDate, schedCoordId)];
  renderSchedChips();
  renderSchedList();

  document.getElementById('sc-date').addEventListener('change', e=>{ schedDate=e.target.value; renderSchedulesAdmin(); });
  document.getElementById('sc-coord').addEventListener('change', e=>{ schedCoordId=e.target.value; renderSchedulesAdmin(); });
  document.getElementById('sc-add').addEventListener('click', ()=>{
    const sid = document.getElementById('sc-site-pick').value;
    if(!sid || schedPending.includes(sid)) return;
    schedPending.push(sid); renderSchedChips();
  });
  document.getElementById('sc-save').addEventListener('click', async ()=>{
    if(!requireRole('admin')) return;
    if(!DB.schedules[schedDate]) DB.schedules[schedDate]={};
    DB.schedules[schedDate][schedCoordId] = [...schedPending];
    await saveDB(); addAudit('save_schedule', coordById(schedCoordId).name + ' - ' + schedDate);
    renderSchedList(); showToast('✔ تم حفظ خطة الزيارات');
  });
  document.getElementById('sc-copy').addEventListener('click', ()=>{
    const y = new Date(schedDate); y.setDate(y.getDate()-1);
    const ystr = todayStr(y);
    schedPending = [...scheduleFor(ystr, schedCoordId)];
    if(schedPending.length===0) showToast('لا توجد خطة بالأمس لهذا المنسّق');
    renderSchedChips();
  });
}
function renderSchedChips(){
  const box = document.getElementById('sc-pending');
  box.innerHTML = schedPending.map((sid,i)=>{
    const s = siteById(sid);
    return `<span class="site-chip">${escapeHtml(s?s.name:sid)}<button data-i="${i}">✕</button></span>`;
  }).join('');
  box.querySelectorAll('button').forEach(b=>b.addEventListener('click', ()=>{ schedPending.splice(Number(b.dataset.i),1); renderSchedChips(); }));
}
function renderSchedList(){
  const box = document.getElementById('sc-list');
  const map = DB.schedules[schedDate] || {};
  const names = Object.keys(map);
  if(names.length===0){ box.innerHTML='<div class="empty">لا توجد خطط محفوظة لهذا اليوم.</div>'; return; }
  box.innerHTML = names.map(cid=>{
    const c = coordById(cid); if(!c) return '';
    return `<div class="coord-sched-card"><h4>${escapeHtml(c.name)} <span style="color:var(--muted);font-weight:400;">(${map[cid].length} مواقع)</span></h4>
      <div class="site-chip-list">${map[cid].map(sid=>{const s=siteById(sid); return `<span class="site-chip">${escapeHtml(s?s.name:sid)}</span>`;}).join('')}</div></div>`;
  }).join('');
}

/* ---- Weekly-pattern mode: define one week's plan per weekday, repeat across the whole month ---- */
function daysInMonth(yyyyMM){
  const [y,m] = yyyyMM.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}
function dateStrFor(yyyyMM, day){
  const [y,m] = yyyyMM.split('-').map(Number);
  return `${y}-${String(m).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}
function weekdayOf(dateStr){
  return new Date(dateStr + 'T00:00:00').getDay(); // 0=Sunday..6=Saturday
}

function loadWeekPattern(coordId){
  if(!DB.weeklyPatterns) DB.weeklyPatterns = {};
  const saved = DB.weeklyPatterns[coordId];
  schedWeekPattern = {0:[],1:[],2:[],3:[],4:[],5:[],6:[]};
  if(saved){
    for(let d=0; d<7; d++) schedWeekPattern[d] = [...(saved[d]||[])];
  }
  schedActiveWeekday = 0;
}

function renderMonthScheduler(){
  const body = document.getElementById('sched-body');
  if(!DB.weeklyPatterns) DB.weeklyPatterns = {};
  if(schedMonthCoordId && !Object.keys(schedWeekPattern).some(d=>schedWeekPattern[d].length)){
    // first open for this session: try to load any saved pattern
    loadWeekPattern(schedMonthCoordId);
  }
  const totalDays = daysInMonth(schedMonth);
  body.innerHTML = `
    <div class="card">
      <h3>النمط الأسبوعي لخطة الزيارات</h3>
      <p class="sub">حدّد مواقع كل يوم من أيام الأسبوع مرة واحدة (مثال: خطة الأسبوع الأول)، والنظام رح يكرر نفس النمط تلقائيًا على باقي أسابيع الشهر المختار. اليوم اللي ما تحطله مواقع بيُعتبر يوم عطلة بدون زيارات مطلوبة.</p>
      <div class="row2">
        <div><label>المنسّق</label><select id="wp-coord">${DB.coordinators.map(c=>`<option value="${c.id}" ${c.id===schedMonthCoordId?'selected':''}>${escapeHtml(c.name)}</option>`).join('')}</select></div>
        <div><label>الشهر</label><input type="month" id="wp-month" value="${schedMonth}"></div>
      </div>

      <label>اختر اليوم لتحديد مواقعه</label>
      <div class="weekday-toggles" id="wp-day-tabs">
        ${WEEKDAY_LABELS.map((lbl,i)=>`<button type="button" data-day="${i}" class="${i===schedActiveWeekday?'active-day':''} ${schedWeekPattern[i].length?'has-sites':''}">${lbl}${schedWeekPattern[i].length?` (${schedWeekPattern[i].length})`:''}</button>`).join('')}
      </div>

      <label>مواقع يوم ${WEEKDAY_LABELS[schedActiveWeekday]}</label>
      <div class="row2">
        <select id="wp-site-pick">${DB.sites.filter(s=>s.active).map(s=>`<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('')}</select>
        <button type="button" class="btn-ghost" id="wp-add" style="flex:0 0 90px;">إضافة</button>
      </div>
      <div class="site-chip-list" id="wp-pending"></div>

      <button class="btn-primary" id="wp-apply" style="margin-top:14px;">تطبيق النمط على كل أيام شهر ${escapeHtml(monthLabel(schedMonth))} (${totalDays} يومًا)</button>
      <button class="btn-secondary" id="wp-clear-month">مسح جدولة هذا الشهر كاملة لهذا المنسّق</button>
    </div>
    <div class="card">
      <h3 id="wp-cal-title">نظرة على شهر ${escapeHtml(monthLabel(schedMonth))} — ${coordById(schedMonthCoordId)?escapeHtml(coordById(schedMonthCoordId).name):''}</h3>
      <div class="month-cal" id="wp-cal"></div>
    </div>
  `;
  renderWeekPendingChips();
  renderMonthCalendarPreview();

  document.getElementById('wp-coord').addEventListener('change', e=>{
    schedMonthCoordId = e.target.value;
    loadWeekPattern(schedMonthCoordId);
    renderMonthScheduler();
  });
  document.getElementById('wp-month').addEventListener('change', e=>{ schedMonth = e.target.value; renderMonthScheduler(); });

  document.getElementById('wp-day-tabs').querySelectorAll('button').forEach(b=>{
    b.addEventListener('click', ()=>{
      schedActiveWeekday = Number(b.dataset.day);
      renderMonthScheduler();
    });
  });

  document.getElementById('wp-add').addEventListener('click', ()=>{
    const sid = document.getElementById('wp-site-pick').value;
    if(!sid || schedWeekPattern[schedActiveWeekday].includes(sid)) return;
    schedWeekPattern[schedActiveWeekday].push(sid);
    renderWeekPendingChips();
    // refresh the weekday tab counts without a full re-render (keeps focus/scroll stable)
    const tabBtn = document.querySelector(`#wp-day-tabs button[data-day="${schedActiveWeekday}"]`);
    if(tabBtn){ tabBtn.textContent = `${WEEKDAY_LABELS[schedActiveWeekday]} (${schedWeekPattern[schedActiveWeekday].length})`; tabBtn.classList.add('has-sites'); }
  });

  document.getElementById('wp-apply').addEventListener('click', async ()=>{
    if(!requireRole('admin')) return;
    const hasAnySites = Object.values(schedWeekPattern).some(arr=>arr.length>0);
    if(!hasAnySites){ showToast('حدّد مواقع ليوم واحد على الأقل قبل التطبيق'); return; }
    if(!confirm(`سيتم استبدال خطة شهر ${monthLabel(schedMonth)} بالكامل لهذا المنسّق بالنمط الأسبوعي الحالي. متابعة؟`)) return;

    const total = daysInMonth(schedMonth);
    for(let day=1; day<=total; day++){
      const dateStr = dateStrFor(schedMonth, day);
      const wd = weekdayOf(dateStr);
      if(!DB.schedules[dateStr]) DB.schedules[dateStr] = {};
      DB.schedules[dateStr][schedMonthCoordId] = [...schedWeekPattern[wd]];
    }
    // persist the weekly pattern itself for reuse next month
    DB.weeklyPatterns[schedMonthCoordId] = {0:[],1:[],2:[],3:[],4:[],5:[],6:[]};
    for(let d=0; d<7; d++) DB.weeklyPatterns[schedMonthCoordId][d] = [...schedWeekPattern[d]];

    await saveDB();
    addAudit('apply_weekly_pattern', `${coordById(schedMonthCoordId).name} - ${monthLabel(schedMonth)}`);
    renderMonthCalendarPreview();
    showToast(`✔ تم تطبيق النمط الأسبوعي على ${total} يومًا من الشهر`);
  });

  document.getElementById('wp-clear-month').addEventListener('click', async ()=>{
    if(!requireRole('admin')) return;
    if(!confirm('هل تريد مسح خطة هذا الشهر بالكامل لهذا المنسّق؟')) return;
    const total = daysInMonth(schedMonth);
    let cleared=0;
    for(let day=1; day<=total; day++){
      const dateStr = dateStrFor(schedMonth, day);
      if(DB.schedules[dateStr] && DB.schedules[dateStr][schedMonthCoordId]){
        delete DB.schedules[dateStr][schedMonthCoordId];
        cleared++;
      }
    }
    await saveDB();
    addAudit('clear_month_schedule', `${coordById(schedMonthCoordId).name} - ${schedMonth}`);
    renderMonthCalendarPreview();
    showToast(`تم مسح خطة ${cleared} يومًا`);
  });
}

function renderWeekPendingChips(){
  const box = document.getElementById('wp-pending');
  const list = schedWeekPattern[schedActiveWeekday];
  if(list.length===0){ box.innerHTML = '<div class="empty" style="padding:10px 0;">لا توجد مواقع مضافة لهذا اليوم — يُعتبر يوم عطلة.</div>'; return; }
  box.innerHTML = list.map((sid,i)=>{
    const s = siteById(sid);
    return `<span class="site-chip">${escapeHtml(s?s.name:sid)}<button data-i="${i}">✕</button></span>`;
  }).join('');
  box.querySelectorAll('button').forEach(b=>b.addEventListener('click', ()=>{
    schedWeekPattern[schedActiveWeekday].splice(Number(b.dataset.i),1);
    renderWeekPendingChips();
    const tabBtn = document.querySelector(`#wp-day-tabs button[data-day="${schedActiveWeekday}"]`);
    if(tabBtn){
      const n = schedWeekPattern[schedActiveWeekday].length;
      tabBtn.textContent = n ? `${WEEKDAY_LABELS[schedActiveWeekday]} (${n})` : WEEKDAY_LABELS[schedActiveWeekday];
      tabBtn.classList.toggle('has-sites', n>0);
    }
  }));
}

function monthLabel(yyyyMM){
  const [y,m] = yyyyMM.split('-').map(Number);
  return new Date(y, m-1, 1).toLocaleDateString('ar-JO', {month:'long', year:'numeric'});
}

function renderMonthCalendarPreview(){
  const cal = document.getElementById('wp-cal');
  if(!cal) return;
  const total = daysInMonth(schedMonth);
  const firstWd = weekdayOf(dateStrFor(schedMonth,1));
  let html = WEEKDAY_SHORT.map(l=>`<div class="mc-head">${l}</div>`).join('');
  for(let i=0;i<firstWd;i++) html += `<div></div>`;
  for(let day=1; day<=total; day++){
    const dateStr = dateStrFor(schedMonth, day);
    const planned = (DB.schedules[dateStr] && DB.schedules[dateStr][schedMonthCoordId]) ? DB.schedules[dateStr][schedMonthCoordId].length : 0;
    html += `<div class="mc-cell ${planned>0?'has-plan':''}" data-date="${dateStr}" title="${fmtDate(dateStr)}">
      <div class="mc-daynum">${day}</div>
      ${planned>0?`<div class="mc-count">${planned} مواقع</div>`:'<div class="mc-count">عطلة</div>'}
    </div>`;
  }
  cal.innerHTML = html;
  cal.querySelectorAll('.mc-cell').forEach(cell=>{
    cell.addEventListener('click', ()=>{
      const d = cell.dataset.date;
      if(!d) return;
      schedDate = d;
      schedCoordId = schedMonthCoordId;
      schedMode = 'day';
      renderSchedulesAdmin();
    });
  });
}



