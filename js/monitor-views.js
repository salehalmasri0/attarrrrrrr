/* =========================================================
   واجهات المراقب — اطلاع فقط على الأداء والزيارات والصور
   ========================================================= */
function renderMonitorPerformance(){
  const main = document.getElementById('main-area');
  const today = todayStr();
  const coords = DB.coordinators.filter(c=>c.active);
  let required=0, completed=0;
  coords.forEach(c=>{ const cov=coverageFor(today,c.id); required+=cov.required.length; completed+=cov.visitedPlanned.length; });
  const todayVisits = VISITS.filter(v=>v.date===today).length;
  const inProgress = VISITS.filter(v=>v.date===today && v.status==='in_progress').length;
  main.innerHTML = `
    <div class='card'>
      <div class='dash-header'><h2>لوحة الأداء — ${fmtDate(today)}</h2><span class='type-pill done'>اطلاع فقط</span></div>
      <div class='stat-grid'>
        <div class='stat'><div class='num'>${coords.length}</div><div class='lbl'>المنسّقون النشطون</div></div>
        <div class='stat'><div class='num'>${todayVisits}</div><div class='lbl'>زيارات اليوم</div></div>
        <div class='stat'><div class='num'>${completed}/${required}</div><div class='lbl'>الزيارات المكتملة</div></div>
        <div class='stat'><div class='num'>${inProgress}</div><div class='lbl'>قيد التنفيذ</div></div>
      </div>
    </div>
    <div class='card'><h3>تقييم أداء المنسّقين</h3><p class='sub'>هذه الشاشة للقراءة فقط. لا يمكن للمراقب تعديل البيانات أو إعدادات النظام.</p><div id='monitor-perf-list'></div></div>
  `;
  const box = document.getElementById('monitor-perf-list');
  if(!coords.length){ box.innerHTML='<div class=' + "'empty'" + '>لا يوجد منسّقون نشطون بعد.</div>'; return; }
  box.innerHTML = coords.map(c=>{
    const p=computePerformance(c.id);
    const barColor=p.score>=85?'var(--success)':(p.score>=60?'var(--accent)':'var(--danger)');
    return `<div class='card' style='margin:10px 0;border:1px solid var(--line);'>
      <div style='display:flex;justify-content:space-between;align-items:center;gap:10px;'><div><b>${escapeHtml(c.name)}</b><div style='font-size:11.5px;color:var(--muted);'>#${escapeHtml(c.employeeNo)} — ${escapeHtml(c.region)}</div></div><strong style='color:${barColor};font-size:20px;'>${p.score}%</strong></div>
      <div class='perf-bar-wrap'><div class='perf-bar-fill' style='width:${p.score}%;background:${barColor};'></div></div>
      <div class='perf-row'><span>الحضور/الإنجاز</span><span>${p.attendance}%</span></div>
      <div class='perf-row'><span>المهام</span><span>${p.taskCompliance}%</span></div>
      <div class='perf-row'><span>GPS</span><span>${p.gpsCompliance}%</span></div>
      <div class='perf-row'><span>التصوير</span><span>${p.photoCompliance}%</span></div>
      <div class='perf-row'><span>الستوك والملاحظات</span><span>${Math.round((p.stockReporting+p.dataQuality)/2)}%</span></div>
    </div>`;
  }).join('');
}

function renderMonitorVisits(){
  const main=document.getElementById('main-area');
  main.innerHTML=`<div class='card'><h3>الزيارات والصور</h3><p class='sub'>استعرض الزيارات المسجّلة وافتح تفاصيلها وصورها بدون تعديل.</p><div class='filter-bar'><input type='date' id='monitor-date'><button class='btn-ghost' id='monitor-date-clear'>كل التواريخ</button></div><div id='monitor-visits-list'></div></div>`;
  const dateInput=document.getElementById('monitor-date');
  const renderList=()=>{
    const date=dateInput.value;
    const visits=VISITS.filter(v=>!date||v.date===date).sort((a,b)=>(b.entryTime||'').localeCompare(a.entryTime||''));
    const box=document.getElementById('monitor-visits-list');
    if(!visits.length){ box.innerHTML='<div class="empty">لا توجد زيارات مطابقة.</div>'; return; }
    box.innerHTML=visits.map(v=>{
      const photoCount=v.photos?Object.values(v.photos).filter(Boolean).length:0;
      return `<div class='visit-card'><div class='visit-top'><div><div class='visit-name'>${escapeHtml(v.siteName)}</div><div class='visit-loc'>${fmtDate(v.date)} — ${escapeHtml(v.coordName||'')}</div></div><span class='type-pill ${v.status==='completed'?'done':'progress'}'>${v.status==='completed'?'مكتملة':'قيد التنفيذ'}</span></div><div class='visit-meta'><span>🕒 ${fmtTime(v.entryTime)}</span><span>📸 ${photoCount} صورة</span><span>📍 ${v.entryGPS?'موقع مسجّل':'بدون موقع'}</span></div><button class='btn-ghost' style='margin-top:8px;width:100%;' data-monitor-visit='${escapeHtml(v.id)}'>عرض الزيارة والصور</button></div>`;
    }).join('');
    box.querySelectorAll('[data-monitor-visit]').forEach(b=>b.addEventListener('click',()=>viewVisitDetails(b.dataset.monitorVisit)));
  };
  dateInput.addEventListener('change',renderList);
  document.getElementById('monitor-date-clear').addEventListener('click',()=>{ dateInput.value=''; renderList(); });
  renderList();
}
