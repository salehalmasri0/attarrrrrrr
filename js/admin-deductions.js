/* =========================================================
   إدارة الخصومات المالية
   ========================================================= */

/* ================= DEDUCTIONS ADMIN ================= */
let dedFilter = { date:'', coordId:'', status:'' };
function renderDeductionsAdmin(){
  const main = document.getElementById('main-area');
  const dates = [...new Set([...Object.keys(DB.schedules)])].sort().reverse();
  main.innerHTML = `
    <div class="card"><h3>الخصومات</h3><p class="sub">قيمة الخصم الافتراضية: ${DB.settings.deductionPerSite} د.أ عن كل موقع غير مزار — تُحسب نهائيًا عند إغلاق اليوم فقط.</p>
    <div class="filter-bar">
      <select id="df-date"><option value="">كل التواريخ</option>${dates.map(d=>`<option value="${d}" ${dedFilter.date===d?'selected':''}>${fmtDate(d)}</option>`).join('')}</select>
      <select id="df-coord"><option value="">كل المنسّقين</option>${DB.coordinators.map(c=>`<option value="${c.id}" ${dedFilter.coordId===c.id?'selected':''}>${escapeHtml(c.name)}</option>`).join('')}</select>
      <select id="df-status"><option value="">كل الحالات</option>
        <option value="final" ${dedFilter.status==='final'?'selected':''}>نهائي</option>
        <option value="expected" ${dedFilter.status==='expected'?'selected':''}>متوقع</option>
        <option value="has" ${dedFilter.status==='has'?'selected':''}>يوجد خصم</option>
        <option value="none" ${dedFilter.status==='none'?'selected':''}>بدون خصم</option>
      </select>
      <button type="button" class="btn-ghost fb-clear" id="df-clear">مسح الفلاتر</button>
    </div>
    <div class="tbl-wrap"><table class="data-tbl"><thead><tr><th>التاريخ</th><th>المنسّق</th><th>المطلوب</th><th>المكتمل</th><th>غير مزار</th><th>الخصم</th><th>الحالة</th><th></th></tr></thead>
    <tbody id="ded-body"></tbody></table></div></div>`;
  document.getElementById('df-date').addEventListener('change', e=>{ dedFilter.date=e.target.value; renderDeductionsList(); });
  document.getElementById('df-coord').addEventListener('change', e=>{ dedFilter.coordId=e.target.value; renderDeductionsList(); });
  document.getElementById('df-status').addEventListener('change', e=>{ dedFilter.status=e.target.value; renderDeductionsList(); });
  document.getElementById('df-clear').addEventListener('click', ()=>{ dedFilter={date:'',coordId:'',status:''}; renderDeductionsAdmin(); });
  renderDeductionsList();
}
function renderDeductionsList(){
  const body = document.getElementById('ded-body');
  const dates = [...new Set([...Object.keys(DB.schedules)])].sort().reverse();
  let rows = [];
  dates.forEach(date=>{
    if(dedFilter.date && date!==dedFilter.date) return;
    Object.keys(DB.schedules[date]||{}).forEach(cid=>{
      if(dedFilter.coordId && cid!==dedFilter.coordId) return;
      const c = coordById(cid); if(!c) return;
      const cov = coverageFor(date, cid);
      const ded = deductionFor(date, cid);
      rows.push({date, cid, c, cov, ded});
    });
  });
  if(dedFilter.status){
    rows = rows.filter(r=>{
      if(dedFilter.status==='final') return isDateClosed(r.date);
      if(dedFilter.status==='expected') return !isDateClosed(r.date);
      if(dedFilter.status==='has') return r.ded.value>0;
      if(dedFilter.status==='none') return r.ded.value===0;
      return true;
    });
  }
  if(rows.length===0){ body.innerHTML = '<tr><td colspan="8" class="empty">لا توجد بيانات مطابقة.</td></tr>'; return; }
  body.innerHTML = rows.map(r=>`
    <tr>
      <td>${fmtDate(r.date)}</td><td>${escapeHtml(r.c.name)}</td><td>${r.cov.required.length}</td>
      <td>${r.cov.visitedPlanned.length}</td><td>${r.cov.unvisited.length}</td>
      <td style="color:${r.ded.value>0?'var(--danger)':'var(--success)'};font-weight:700;">${r.ded.value} د.أ</td>
      <td>${isDateClosed(r.date)?'نهائي':'متوقع'}</td>
      <td><button class="icon-btn" data-open="${r.date}|${r.cid}">مراجعة</button></td>
    </tr>
  `).join('');
  body.querySelectorAll('[data-open]').forEach(b=>b.addEventListener('click', ()=>{
    const [date,cid] = b.dataset.open.split('|');
    openDeductionModal(date, cid);
  }));
}
function openDeductionModal(date, cid){
  if(!requireRole('admin')) return;
  const c = coordById(cid);
  const cov = coverageFor(date, cid);
  const ded = deductionFor(date, cid);
  openModal(`
    <div class="modal-head"><h3>خصم ${escapeHtml(c.name)} — ${fmtDate(date)}</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    <p>المطلوب: <b>${cov.required.length}</b> — المكتمل: <b>${cov.visitedPlanned.length}</b> — غير مزار: <b>${cov.unvisited.length}</b></p>
    <p>المواقع غير المزارة: ${cov.unvisited.length? cov.unvisited.map(id=>escapeHtml(siteById(id)?siteById(id).name:id)).join('، ') : '—'}</p>
    <p>الخصم الأساسي المحسوب: <b>${ded.base} د.أ</b>${ded.adjusted?' — تم تعديله يدويًا سابقًا':''}</p>
    <label>قيمة الخصم الجديدة (د.أ)</label>
    <input type="number" id="dd-value" value="${ded.value}" min="0">
    <label>سبب التعديل / الإلغاء</label>
    <textarea id="dd-reason" placeholder="مثال: تم إغلاق الموقع اليوم"></textarea>
    <button class="btn-primary" id="dd-save">حفظ التعديل</button>
    <button class="btn-secondary" id="dd-cancel-ded">إلغاء الخصم بالكامل (0 د.أ)</button>
  `, true);
  document.getElementById('dd-save').addEventListener('click', async ()=>{
    if(!requireRole('admin')) return;
    const val = parseFloat(document.getElementById('dd-value').value)||0;
    const reason = document.getElementById('dd-reason').value.trim();
    const key = date+'|'+cid;
    const old = DB.deductionAdjustments[key] ? DB.deductionAdjustments[key].value : ded.base;
    DB.deductionAdjustments[key] = { value: val, reason, admin: session.name, at: nowIso(), cancelled:false };
    await saveDB();
    addAudit('deduction_adjust', `${c.name} | ${date} | من ${old} إلى ${val} | السبب: ${reason||'-'}`);
    closeModal(); renderDeductionsAdmin(); showToast('✔ تم تعديل الخصم');
  });
  document.getElementById('dd-cancel-ded').addEventListener('click', async ()=>{
    if(!requireRole('admin')) return;
    const reason = document.getElementById('dd-reason').value.trim() || 'إلغاء يدوي من الإدارة';
    const key = date+'|'+cid;
    DB.deductionAdjustments[key] = { value:0, reason, admin: session.name, at: nowIso(), cancelled:true };
    await saveDB();
    addAudit('deduction_cancel', `${c.name} | ${date} | السبب: ${reason}`);
    closeModal(); renderDeductionsAdmin(); showToast('✔ تم إلغاء الخصم');
  });
}

