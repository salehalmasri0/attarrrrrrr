/* =========================================================
   إدارة المنسّقين (Coordinators Admin)
   ========================================================= */

/* ================= COORDINATORS ADMIN ================= */
let coordFilter = { q:'', region:'' };
function renderCoordsAdmin(){
  const main = document.getElementById('main-area');
  const regions = [...new Set(DB.coordinators.map(c=>c.region).filter(Boolean))];
  main.innerHTML = `
    <div class="card"><h3>المنسّقون (${DB.coordinators.length})</h3>
      <button class="btn-primary" id="btn-new-coord">+ إضافة منسّق</button>
    </div>
    <div class="card">
      <div class="filter-bar">
        <input type="text" id="cf-q" placeholder="🔍 بحث بالاسم أو الرقم الوظيفي" value="${escapeHtml(coordFilter.q)}">
        <select id="cf-region"><option value="">كل المناطق</option>${regions.map(r=>`<option value="${escapeHtml(r)}" ${coordFilter.region===r?'selected':''}>${escapeHtml(r)}</option>`).join('')}</select>
        <button type="button" class="btn-ghost fb-clear" id="cf-clear">مسح الفلاتر</button>
      </div>
      <div id="coords-list"></div>
    </div>
  `;
  document.getElementById('btn-new-coord').addEventListener('click', ()=>openCoordModal(null));
  document.getElementById('cf-q').addEventListener('input', e=>{ coordFilter.q=e.target.value; renderCoordsList(); });
  document.getElementById('cf-region').addEventListener('change', e=>{ coordFilter.region=e.target.value; renderCoordsList(); });
  document.getElementById('cf-clear').addEventListener('click', ()=>{ coordFilter={q:'',region:''}; renderCoordsAdmin(); });
  renderCoordsList();
}
function renderCoordsList(){
  const box = document.getElementById('coords-list');
  let list = DB.coordinators;
  if(coordFilter.q){ const q=coordFilter.q.toLowerCase(); list = list.filter(c=> c.name.toLowerCase().includes(q) || c.employeeNo.toLowerCase().includes(q)); }
  if(coordFilter.region) list = list.filter(c=>c.region===coordFilter.region);
  if(list.length===0){ box.innerHTML='<div class="empty">لا توجد نتائج مطابقة.</div>'; return; }
  box.innerHTML = list.map(c=>{
    const cov = coverageFor(todayStr(), c.id);
    return `<div class="list-item">
      <div class="info">
        <b>${escapeHtml(c.name)} ${c.active?'':'— معطّل'}</b>
        <span>#${escapeHtml(c.employeeNo)} — ${escapeHtml(c.region)} — اليوم: ${cov.visitedPlanned.length}/${cov.required.length}</span>
      </div>
      <div class="actions">
        <button class="icon-btn" data-profile="${c.id}">ملف</button>
        <button class="icon-btn" data-edit="${c.id}">تعديل</button>
      </div>
    </div>`;
  }).join('');
  box.querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click', ()=>openCoordModal(b.dataset.edit)));
  box.querySelectorAll('[data-profile]').forEach(b=>b.addEventListener('click', ()=>openCoordProfile(b.dataset.profile)));
}

function openCoordModal(id){
  if(!requireRole('admin')) return;
  const c = id ? coordById(id) : { id: uid('co'), name:'', employeeNo:'', pin:'', phone:'', region:'', manager:'مدير المبيعات', active:true };
  openModal(`
    <div class="modal-head"><h3>${id?'تعديل منسّق':'إضافة منسّق'}</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    <label>الاسم</label><input type="text" id="m-cname" value="${escapeHtml(c.name)}">
    <div class="row2"><div><label>الرقم الوظيفي</label><input type="text" id="m-emp" value="${escapeHtml(c.employeeNo)}"></div>
    <div><label>PIN ${id?'(اتركه فارغًا لعدم تغييره)':''}</label><input type="text" id="m-pin" placeholder="${id?'••••':'مثال: 1234'}" autocomplete="off"></div></div>
    <div class="row2"><div><label>الهاتف</label><input type="text" id="m-phone" value="${escapeHtml(c.phone)}"></div>
    <div><label>المنطقة</label><input type="text" id="m-cregion" value="${escapeHtml(c.region)}"></div></div>
    <label>المدير المباشر</label><input type="text" id="m-manager" value="${escapeHtml(c.manager)}">
    <div class="checkline"><input type="checkbox" id="m-cactive" ${c.active?'checked':''}><label style="margin:0;" for="m-cactive">حساب نشط</label></div>
    <button class="btn-primary" id="m-csave">حفظ</button>
    ${id?'<button class="btn-secondary" style="color:var(--danger);border-color:#F3D3CE;" id="m-cdelete">حذف المنسّق</button>':''}
  `);
  document.getElementById('m-csave').addEventListener('click', async ()=>{
    const name = document.getElementById('m-cname').value.trim();
    const emp = document.getElementById('m-emp').value.trim();
    if(!name || !emp) return showToast('الرجاء إدخال الاسم والرقم الوظيفي');
    const pinInput = document.getElementById('m-pin').value.trim();
    if(!id && !pinInput) return showToast('الرجاء إدخال PIN للمنسّق الجديد');
    const pin = pinInput ? await hashSecret(pinInput) : c.pin; // إبقاء PIN الحالي (مجزّأ) إن تُرك فارغًا أثناء التعديل
    const updated = { id:c.id, name, employeeNo: emp, pin,
      phone: document.getElementById('m-phone').value.trim(), region: document.getElementById('m-cregion').value.trim(),
      manager: document.getElementById('m-manager').value.trim(), active: document.getElementById('m-cactive').checked };
    const idx = DB.coordinators.findIndex(x=>x.id===c.id);
    if(idx>=0) DB.coordinators[idx]=updated; else DB.coordinators.push(updated);
    await saveDB(); addAudit(idx>=0?'edit_coord':'add_coord', name);
    closeModal(); renderCoordsAdmin(); showToast('✔ تم الحفظ');
  });
  const delBtn = document.getElementById('m-cdelete');
  if(delBtn) delBtn.addEventListener('click', async ()=>{
    if(!confirm('حذف هذا المنسّق نهائيًا؟')) return;
    DB.coordinators = DB.coordinators.filter(x=>x.id!==c.id);
    await saveDB(); addAudit('delete_coord', c.name);
    closeModal(); renderCoordsAdmin();
  });
}

function openCoordProfile(id){
  const c = coordById(id);
  const today = todayStr();
  const cov = coverageFor(today, id);
  const ded = deductionFor(today, id);
  const perf = computePerformance(id);
  const myVisits = VISITS.filter(v=>v.coordId===id).sort((a,b)=>(b.entryTime||'').localeCompare(a.entryTime||''));
  openModal(`
    <div class="modal-head"><h3>ملف ${escapeHtml(c.name)}</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    <p class="sub">#${escapeHtml(c.employeeNo)} — ${escapeHtml(c.region)} — ${escapeHtml(c.phone||'—')}</p>
    <div class="stat-grid" style="grid-template-columns:repeat(3,1fr);">
      <div class="stat"><div class="num">${cov.required.length}</div><div class="lbl">مطلوب اليوم</div></div>
      <div class="stat"><div class="num">${cov.visitedPlanned.length}</div><div class="lbl">مكتمل</div></div>
      <div class="stat warn"><div class="num">${ded.value}</div><div class="lbl">الخصم (د.أ)</div></div>
    </div>
    <div class="perf-total"><div class="num">${perf.score}%</div><div style="font-size:11px;color:var(--muted);">Performance Score (مستقل عن الخصم)</div></div>
    <div class="perf-bar-wrap"><div class="perf-bar-fill" style="width:${perf.score}%;"></div></div>
    <h3 style="margin-top:10px;">آخر الزيارات</h3>
    ${myVisits.slice(0,8).map(v=>`<div class="visit-card"><div class="visit-top"><div><div class="visit-name">${escapeHtml(v.siteName)}</div><div class="visit-loc">${fmtDate(v.date)} — ${fmtTime(v.entryTime)}</div></div><span class="type-pill ${v.status==='completed'?'done':'progress'}">${v.status==='completed'?'مكتملة':'قيد التنفيذ'}</span></div></div>`).join('') || '<div class="empty">لا توجد زيارات بعد.</div>'}
  `, true);
}

