/* =========================================================
   لوحة تحكم الإدارة، المراقبة الحيّة، وتقييم أداء المنسّقين
   ========================================================= */

/* =========================================================
   ADMIN — DASHBOARD
   ========================================================= */
function renderAdminDashboard(){
  const main = document.getElementById('main-area');
  const today = todayStr();
  const coordIds = DB.coordinators.filter(c=>c.active).map(c=>c.id);
  let required=0, completed=0, deductionTotal=0;
  const unvisitedList = [];
  coordIds.forEach(cid=>{
    const cov = coverageFor(today, cid);
    required += cov.required.length;
    completed += cov.visitedPlanned.length;
    const ded = deductionFor(today, cid);
    deductionTotal += ded.value;
    cov.unvisited.forEach(sid=>{ const s = siteById(sid); unvisitedList.push({coord: coordById(cid).name, site: s?s.name:sid}); });
  });
  const inProgress = VISITS.filter(v=>v.date===today && v.status==='in_progress').length;
  const activeCoords = new Set(VISITS.filter(v=>v.date===today).map(v=>v.coordId)).size;

  main.innerHTML = `
    <div class="dash-header"><h2>لوحة التحكم — ${fmtDate(today)}</h2></div>
    <div class="stat-grid">
      <div class="stat"><div class="num">${DB.coordinators.length}</div><div class="lbl">إجمالي المنسّقين</div></div>
      <div class="stat"><div class="num">${activeCoords}</div><div class="lbl">منسّقون نشطون اليوم</div></div>
      <div class="stat"><div class="num">${required}</div><div class="lbl">مواقع مطلوبة اليوم</div></div>
      <div class="stat"><div class="num">${completed}</div><div class="lbl">زيارات مكتملة</div></div>
      <div class="stat"><div class="num">${required-completed}</div><div class="lbl">زيارات متبقية</div></div>
      <div class="stat"><div class="num">${inProgress}</div><div class="lbl">زيارات قيد التنفيذ</div></div>
      <div class="stat"><div class="num">${required? Math.round(completed/required*100):0}%</div><div class="lbl">نسبة الإنجاز</div></div>
      <div class="stat warn"><div class="num">${unvisitedList.length}</div><div class="lbl">مواقع لم تتم زيارتها</div></div>
      <div class="stat warn"><div class="num">${deductionTotal}</div><div class="lbl">إجمالي الخصومات المتوقعة (د.أ)</div></div>
    </div>
    ${!isDateClosed(today) ? `<div class="warn-alert">⏳ لم يتم إغلاق جولة اليوم بعد (وقت الإغلاق: ${DB.settings.dayCloseTime}). الأرقام أعلاه "متوقعة" وغير نهائية حتى الإغلاق.</div>` : `<div class="warn-alert" style="background:#F1FAF5;border-color:#CDE9D9;color:var(--success);">✅ تم إغلاق جولة اليوم — الأرقام والخصومات نهائية.</div>`}
    <div class="coverage-card">
      <h3>التغطية حسب المنسّق</h3>
      <div id="cov-list"></div>
    </div>
  `;
  const covList = document.getElementById('cov-list');
  if(coordIds.length===0){ covList.innerHTML = '<div class="empty">لا يوجد منسّقون بعد.</div>'; return; }
  covList.innerHTML = coordIds.map(cid=>{
    const c = coordById(cid);
    const cov = coverageFor(today, cid);
    let cls='none', lbl='لم يبدأ';
    if(cov.onLeave){ cls='partial'; lbl='🏖 مجاز'; }
    else if(cov.required.length && cov.visitedPlanned.length===cov.required.length){cls='full';lbl='مكتمل';}
    else if(cov.visitedPlanned.length>0){cls='partial';lbl='جزئي';}
    return `<div class="coverage-row" style="flex-direction:column;align-items:stretch;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span class="coverage-name">${escapeHtml(c.name)}</span>
        <span style="display:flex;align-items:center;gap:8px;">
          <span class="coverage-frac">${cov.visitedPlanned.length}/${cov.required.length}</span>
          <span class="pill-status ${cls}">${lbl}</span>
        </span>
      </div>
      ${cov.unvisited.length ? `<div class="missed-sites">⚠ لم تتم الزيارة: ${cov.unvisited.map(id=>escapeHtml(siteById(id)?siteById(id).name:id)).join('، ')}</div>` : ''}
    </div>`;
  }).join('');
}

/* ================= LIVE MONITORING ================= */
function renderLiveMonitoring(){
  const main = document.getElementById('main-area');
  const today = todayStr();
  main.innerHTML = `<div class="card"><h3>المراقبة الحية</h3><p class="sub">حالة كل منسّق الآن، بدون أي اعتماد على "التأخير" لأنه لا يوجد وقت إلزامي للزيارات.</p><div id="live-list"></div></div>`;
  const box = document.getElementById('live-list');
  if(DB.coordinators.length===0){ box.innerHTML='<div class="empty">لا يوجد منسّقون بعد.</div>'; return; }
  box.innerHTML = DB.coordinators.map(c=>{
    const myVisits = VISITS.filter(v=>v.date===today && v.coordId===c.id).sort((a,b)=> (b.entryTime||'').localeCompare(a.entryTime||''));
    const cov = coverageFor(today, c.id);
    const inProgress = myVisits.find(v=>v.status==='in_progress');
    let status, dot;
    if(!c.active){ status='معطّل'; dot='red'; }
    else if(cov.onLeave){ status='🏖 مجاز اليوم'; dot='purple'; }
    else if(inProgress){ status='داخل موقع: ' + escapeHtml(inProgress.siteName); dot='green'; }
    else if(myVisits.length===0 && cov.required.length===0){ status='لا يوجد جدول اليوم'; dot='red'; }
    else if(myVisits.length===0){ status='لم يبدأ الجولة'; dot='blue'; }
    else if(cov.visitedPlanned.length===cov.required.length && cov.required.length>0){ status='أكمل الجولة'; dot='purple'; }
    else { status='آخر موقع: ' + escapeHtml(myVisits[0].siteName); dot='yellow'; }
    const last = myVisits[0];
    let detail = '';
    if(inProgress){
      const site = siteById(inProgress.siteId);
      const gpsOk = !!inProgress.entryGPS;
      const reqTasks = site? (site.requiredTasks||[]) : [];
      const doneTasks = (inProgress.tasksDone||[]).length;
      const photoDone = inProgress.photoPolicy==='allowed' ? !!(inProgress.photos&&inProgress.photos.before) : !!(inProgress.photos&&inProgress.photos.extEntry);
      detail = `<div class="mon-grid">
        <span>⏱ دخول: ${fmtTime(inProgress.entryTime)}</span>
        <span>📍 GPS: ${gpsOk?'🟢 تم تسجيله':'⚪ لم يُسجّل بعد'}</span>
        <span>📸 صور: ${photoDone?'🟢 مسجّلة':'⚪ غير مكتملة'}</span>
        <span>✅ مهام: ${doneTasks}/${reqTasks.length}</span>
      </div>`;
    }
    return `<div class="mon-card">
      <div class="mon-top">
        <div><div class="mon-name">${escapeHtml(c.name)}</div><div class="mon-emp">#${escapeHtml(c.employeeNo)} — ${escapeHtml(c.region)}</div></div>
        <div class="mon-status"><span class="dot ${dot}"></span>${status}</div>
      </div>
      <div class="mon-grid">
        <span>آخر GPS: ${last && last.entryGPS ? last.entryGPS.lat.toFixed(4)+', '+last.entryGPS.lng.toFixed(4) : '—'}</span>
        <span>آخر تحديث: ${last ? fmtTime(last.exitTime||last.entryTime) : '—'}</span>
        <span>مكتمل: ${cov.visitedPlanned.length}/${cov.required.length}</span>
        <span>الإنجاز: ${cov.rate}%</span>
      </div>
      ${detail}
    </div>`;
  }).join('');
}

/* ================= PERFORMANCE ADMIN ================= */
function renderPerformanceAdmin(){
  const main = document.getElementById('main-area');
  const w = DB.settings.performanceWeights;
  main.innerHTML = `
    <div class="card">
      <h3>تقييم أداء المنسّقين</h3>
      <p class="sub">التقييم مبني على: الحضور/إنجاز الزيارات ${w.attendance}%، الالتزام بالمهام ${w.tasks}%، الالتزام بـGPS ${w.gps}%، الالتزام بالتصوير ${w.photo}%، تسجيل الستوك ${w.stock}%، جودة الملاحظات ${w.notes}%.
      يمكن تعديل هذه النسب من الإعدادات. <b>ملاحظة: هذا التقييم لا يغيّر قيمة الخصم المالي إطلاقًا — نظامان منفصلان.</b></p>
    </div>
    <div id="perf-list"></div>
  `;
  const box = document.getElementById('perf-list');
  if(DB.coordinators.length===0){ box.innerHTML = '<div class="card"><div class="empty">لا يوجد منسّقون بعد.</div></div>'; return; }
  box.innerHTML = DB.coordinators.map(c=>{
    const p = computePerformance(c.id);
    const barColor = p.score>=85 ? 'var(--success)' : (p.score>=60?'var(--accent)':'var(--danger)');
    return `<div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div><b>${escapeHtml(c.name)}</b><div style="font-size:11.5px;color:var(--muted);">#${escapeHtml(c.employeeNo)} — ${escapeHtml(c.region)}</div></div>
        <button class="icon-btn" data-profile="${c.id}">التفاصيل</button>
      </div>
      <div class="perf-total"><div class="num" style="color:${barColor};">${p.score}%</div><div style="font-size:11px;color:var(--muted);">Performance Score</div></div>
      <div class="perf-bar-wrap"><div class="perf-bar-fill" style="width:${p.score}%;background:${barColor};"></div></div>
      <div class="perf-row"><span>الحضور/الإنجاز</span><span>${p.attendance}%</span></div>
      <div class="perf-row"><span>الالتزام بالمهام</span><span>${p.taskCompliance}%</span></div>
      <div class="perf-row"><span>الالتزام بـGPS</span><span>${p.gpsCompliance}%</span></div>
      <div class="perf-row"><span>الالتزام بالتصوير</span><span>${p.photoCompliance}%</span></div>
      <div class="perf-row"><span>تسجيل الستوك</span><span>${p.stockReporting}%</span></div>
      <div class="perf-row"><span>جودة الملاحظات</span><span>${p.dataQuality}%</span></div>
    </div>`;
  }).join('');
  box.querySelectorAll('[data-profile]').forEach(b=>b.addEventListener('click', ()=>openCoordProfile(b.dataset.profile)));
}

