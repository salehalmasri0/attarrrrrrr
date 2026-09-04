/* =========================================================
   واجهات المنسّق — جولة اليوم وسجل الزيارات
   ========================================================= */

/* =========================================================
   COORDINATOR VIEWS
   ========================================================= */
function renderCoordToday(){
  const main = document.getElementById('main-area');
  const today = todayStr();
  const cov = coverageFor(today, session.id);
  const ded = deductionFor(today, session.id);
  const onLeave = isOnLeave(today, session.id);

  let leaveSection = '';
  if(onLeave){
    const rec = DB.leaves[today][session.id];
    leaveSection = `
    <div class="card" style="background:#FFF7EA;border:1px solid #F4DDAF;">
      <h3>🏖 أنت مسجّل إجازة اليوم</h3>
      <p class="sub" style="margin-top:-4px;">${rec.reason ? 'السبب: '+escapeHtml(rec.reason) : 'لا يوجد سبب مسجّل.'} — لن يُحتسب عليك غياب أو خصم عن هذا اليوم.</p>
      <button class="btn-secondary" id="btn-cancel-leave">إلغاء تسجيل الإجازة</button>
    </div>`;
  } else {
    leaveSection = `
    <div class="card">
      <h3>مجاز اليوم؟</h3>
      <p class="sub" style="margin-top:-4px;">إذا كنت في إجازة اليوم، سجّلها هون حتى ما يُحسب عليك يوم تغيّب أو خصم.</p>
      <label>سبب الإجازة (اختياري)</label>
      <input type="text" id="leave-reason" placeholder="مثال: إجازة سنوية، ظرف طارئ...">
      <button class="btn-secondary" id="btn-mark-leave">🏖 تسجيل إجازة اليوم</button>
    </div>`;
  }

  main.innerHTML = `
    <div class="card">
      <h3>مرحبًا ${escapeHtml(session.name)} 👋</h3>
      <p class="sub">جولة اليوم — ${fmtDate(today)}</p>
      <div class="stat-grid" style="grid-template-columns:repeat(3,1fr);">
        <div class="stat"><div class="num">${cov.required.length}</div><div class="lbl">مواقع مطلوبة</div></div>
        <div class="stat"><div class="num">${cov.visitedPlanned.length}</div><div class="lbl">تم إنجاز</div></div>
        <div class="stat warn"><div class="num">${cov.unvisited.length}</div><div class="lbl">متبقي</div></div>
      </div>
    </div>
    ${leaveSection}
    ${onLeave ? '' : `
    <div class="warn-alert">⚠️ تنبيه مهم: يجب إكمال جميع الزيارات المطلوبة في جدولك اليومي. في حال عدم إكمال الزيارات اليومية المطلوبة، سيتم خصم ${DB.settings.deductionPerSite} دينار أردني عن كل موقع لم تتم زيارته.
    <br><br>الخصم المتوقع حاليًا: <b style="color:${ded.value>0?'var(--danger)':'var(--success)'};">${ded.value} دينار</b>${isDateClosed(today)?' (نهائي)':' (غير نهائي بعد)'}</div>
    <div class="card"><h3>مواقع اليوم</h3><div id="today-sites"></div></div>
    `}
  `;

  if(!onLeave){
    document.getElementById('btn-mark-leave').addEventListener('click', async ()=>{
      const reason = document.getElementById('leave-reason').value.trim();
      if(!DB.leaves[today]) DB.leaves[today] = {};
      DB.leaves[today][session.id] = { reason, markedAt: nowIso() };
      await saveDB(); addAudit('mark_leave', `${session.name} - ${today}${reason?' - '+reason:''}`);
      showToast('✔ تم تسجيل إجازة اليوم');
      renderCoordToday();
    });
  } else {
    document.getElementById('btn-cancel-leave').addEventListener('click', async ()=>{
      delete DB.leaves[today][session.id];
      await saveDB(); addAudit('cancel_leave', `${session.name} - ${today}`);
      showToast('تم إلغاء تسجيل الإجازة');
      renderCoordToday();
    });
  }

  if(onLeave) return;

  const box = document.getElementById('today-sites');
  if(cov.required.length===0){ box.innerHTML='<div class="empty">لا توجد خطة زيارات لك اليوم. تواصل مع الإدارة.</div>'; return; }
  box.innerHTML = cov.required.map(sid=>{
    const s = siteById(sid);
    const done = cov.visitedPlanned.includes(sid);
    const inProg = VISITS.find(v=>v.date===today && v.coordId===session.id && v.siteId===sid && v.status==='in_progress');
    return `<div class="list-item">
      <div class="info">
        <b>${done?'🟢':(inProg?'🟡':'🔵')} ${escapeHtml(s.name)}</b>
        <span>${escapeHtml(s.region)} — ${done?'مكتمل':(inProg?'قيد التنفيذ':'لم تتم الزيارة')}</span>
      </div>
      <button class="btn-ghost" data-start="${sid}" ${done?'disabled':''}>${done?'✔ مكتمل':(inProg?'متابعة':'بدء الزيارة')}</button>
    </div>`;
  }).join('');
  box.querySelectorAll('[data-start]').forEach(b=>b.addEventListener('click', ()=>startVisitFlow(b.dataset.start)));
}

function renderCoordHistory(){
  const main = document.getElementById('main-area');
  const mine = VISITS.filter(v=>v.coordId===session.id).sort((a,b)=>(b.entryTime||'').localeCompare(a.entryTime||''));
  main.innerHTML = `<div class="card"><h3>سجل زياراتي (${mine.length})</h3>
    ${mine.length? mine.map(v=>{
      const photoCount = v.photos ? Object.keys(v.photos).length : 0;
      return `
      <div class="visit-card">
        <div class="visit-top"><div><div class="visit-name">${escapeHtml(v.siteName)}</div><div class="visit-loc">${fmtDate(v.date)}</div></div>
        <span class="type-pill ${v.status==='completed'?'done':'progress'}">${v.status==='completed'?'مكتملة':'قيد التنفيذ'}</span></div>
        <div class="visit-meta">
          <span>🕒 دخول ${fmtTime(v.entryTime)}</span>
          <span>🚪 خروج ${fmtTime(v.exitTime)}</span>
          <span>📸 ${photoCount} صورة</span>
          <span>📍 ${v.entryGPS?'موقع مسجّل':'بدون موقع'}</span>
        </div>
        <button class="btn-ghost" style="margin-top:8px;width:100%;" data-detail="${v.id}">عرض تفاصيل الزيارة</button>
      </div>`;}).join('') : '<div class="empty">لا توجد زيارات مسجّلة بعد.</div>'}
  </div>`;
  main.querySelectorAll('[data-detail]').forEach(b=>b.addEventListener('click', ()=>viewVisitDetails(b.dataset.detail)));
}

/* ================= VISIT DETAILS MODAL (مشتركة: منسّق + إدارة) ================= */
const VISIT_PHOTO_LABELS = {
  before:   '📸 صورة الرف — قبل العمل',
  after:    '📸 صورة الرف — بعد العمل',
  extEntry: '📸 صورة الموقع من الخارج — عند الدخول',
  extExit:  '📸 صورة الموقع من الخارج — عند الخروج'
};
function gpsLine(gps, label){
  if(!gps) return `<span>${label}: <span style="color:var(--muted);">لم يُسجَّل</span></span>`;
  const url = `https://www.google.com/maps?q=${gps.lat},${gps.lng}`;
  return `<span>${label}: <a href="${url}" target="_blank" rel="noopener">${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)} 🗺️</a></span>`;
}
function viewVisitDetails(visitId){
  const v = VISITS.find(x=>x.id===visitId);
  if(!v){ showToast('تعذّر إيجاد بيانات هذه الزيارة'); return; }
  const site = siteById(v.siteId);
  const photos = v.photos || {};
  const photoKeys = Object.keys(photos).filter(k=>photos[k]);
  const stock = v.stock || [];
  const reqTasks = site ? (site.requiredTasks || []) : [];
  const doneTasks = new Set(v.tasksDone || []);
  const durationTxt = v.durationSec!=null ? `${Math.round(v.durationSec/60)} دقيقة` : '—';

  const photosHtml = photoKeys.length ? `
    <div class="detail-photo-grid">
      ${photoKeys.map(k=>`
        <div class="detail-photo">
          <img src="${photos[k]}" alt="${VISIT_PHOTO_LABELS[k]||k}" onclick="window.open(this.src,'_blank')">
          <div class="detail-photo-cap">${VISIT_PHOTO_LABELS[k] || k}</div>
        </div>`).join('')}
    </div>` : '<div class="empty">لا توجد صور مسجّلة لهذه الزيارة.</div>';

  const stockHtml = stock.length ? `
    <table class="detail-table">
      <thead><tr><th>المنتج</th><th>الكمية</th></tr></thead>
      <tbody>${stock.map(s=>`<tr><td>${escapeHtml(s.product)}</td><td>${s.qty}</td></tr>`).join('')}</tbody>
    </table>` : '<div class="empty">لا يوجد ستوك مسجّل.</div>';

  const tasksHtml = reqTasks.length ? `
    <div>${reqTasks.map(t=>`<div class="checkline"><span>${doneTasks.has(t)?'✅':'⬜'}</span><span>${escapeHtml(t)}</span></div>`).join('')}</div>`
    : '<div class="empty">لا توجد مهام محددة لهذا الموقع.</div>';

  openModal(`
    <div class="modal-head"><h3>${escapeHtml(v.siteName)}</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="visit-meta" style="margin-bottom:10px;">
      <span class="type-pill ${v.status==='completed'?'done':'progress'}">${v.status==='completed'?'مكتملة':'قيد التنفيذ'}</span>
      <span>📅 ${fmtDate(v.date)}</span>
      <span>🕒 دخول ${fmtTime(v.entryTime)}</span>
      <span>🚪 خروج ${fmtTime(v.exitTime)}</span>
      <span>⏱ المدة: ${durationTxt}</span>
    </div>
    <div class="visit-meta" style="margin-bottom:14px;">
      ${gpsLine(v.entryGPS,'📍 موقع الدخول')}
      ${gpsLine(v.exitGPS,'📍 موقع الخروج')}
    </div>
    <h4 style="margin:10px 0 6px;">الصور</h4>
    ${photosHtml}
    <h4 style="margin:14px 0 6px;">الستوك المسجّل</h4>
    ${stockHtml}
    <h4 style="margin:14px 0 6px;">المهام</h4>
    ${tasksHtml}
    <h4 style="margin:14px 0 6px;">الملاحظات</h4>
    <div class="empty" style="padding:12px;${v.notes?'text-align:right;color:var(--text);':''}">${v.notes ? escapeHtml(v.notes) : 'لا توجد ملاحظات.'}</div>
  `, true);
}

