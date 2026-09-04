/* =========================================================
   إدارة المواقع (Sites Admin)
   ========================================================= */

/* ================= SITES ADMIN ================= */
let siteFilter = { q:'', region:'', policy:'' };
function renderSitesAdmin(){
  const main = document.getElementById('main-area');
  const regions = [...new Set(DB.sites.map(s=>s.region).filter(Boolean))];
  main.innerHTML = `
    <div class="card">
      <h3>المواقع (${DB.sites.length})</h3>
      <button class="btn-primary" id="btn-new-site">+ إضافة موقع جديد</button>
    </div>
    <div class="card">
      <div class="filter-bar">
        <input type="text" id="sf-q" placeholder="🔍 بحث باسم الموقع أو الكود" value="${escapeHtml(siteFilter.q)}">
        <select id="sf-region"><option value="">كل المناطق</option>${regions.map(r=>`<option value="${escapeHtml(r)}" ${siteFilter.region===r?'selected':''}>${escapeHtml(r)}</option>`).join('')}</select>
        <select id="sf-policy"><option value="">كل سياسات التصوير</option>
          <option value="allowed" ${siteFilter.policy==='allowed'?'selected':''}>تصوير داخلي مسموح</option>
          <option value="prohibited" ${siteFilter.policy==='prohibited'?'selected':''}>تصوير داخلي ممنوع</option>
        </select>
        <button type="button" class="btn-ghost fb-clear" id="sf-clear">مسح الفلاتر</button>
      </div>
      <div id="sites-list"></div>
    </div>
  `;
  document.getElementById('btn-new-site').addEventListener('click', ()=>openSiteModal(null));
  document.getElementById('sf-q').addEventListener('input', e=>{ siteFilter.q=e.target.value; renderSitesList(); });
  document.getElementById('sf-region').addEventListener('change', e=>{ siteFilter.region=e.target.value; renderSitesList(); });
  document.getElementById('sf-policy').addEventListener('change', e=>{ siteFilter.policy=e.target.value; renderSitesList(); });
  document.getElementById('sf-clear').addEventListener('click', ()=>{ siteFilter={q:'',region:'',policy:''}; renderSitesAdmin(); });
  renderSitesList();
}
function renderSitesList(){
  const box = document.getElementById('sites-list');
  let list = DB.sites;
  if(siteFilter.q){ const q=siteFilter.q.toLowerCase(); list = list.filter(s=> s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q)); }
  if(siteFilter.region) list = list.filter(s=>s.region===siteFilter.region);
  if(siteFilter.policy) list = list.filter(s=>s.photoPolicy===siteFilter.policy);
  if(list.length===0){ box.innerHTML='<div class="empty">لا توجد نتائج مطابقة.</div>'; return; }
  box.innerHTML = list.map(s=>`
    <div class="list-item">
      <div class="info">
        <b>${escapeHtml(s.name)} <span style="font-weight:400;color:var(--muted);">(${escapeHtml(s.code)})</span></b>
        <span>${escapeHtml(s.region)} — ${s.photoPolicy==='allowed'?'📸 تصوير داخلي مسموح':'🚫 تصوير داخلي ممنوع'} ${s.active?'':'— معطّل'}</span>
      </div>
      <div class="actions">
        <button class="icon-btn" data-edit="${s.id}">تعديل</button>
        <button class="icon-btn" data-del="${s.id}">حذف</button>
      </div>
    </div>
  `).join('');
  box.querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click', ()=>openSiteModal(b.dataset.edit)));
  box.querySelectorAll('[data-del]').forEach(b=>b.addEventListener('click', async ()=>{
    if(!requireRole('admin')) return;
    if(!confirm('حذف هذا الموقع؟')) return;
    DB.sites = DB.sites.filter(s=>s.id!==b.dataset.del);
    await saveDB(); addAudit('delete_site', b.dataset.del); renderSitesList();
  }));
}

function openSiteModal(id){
  if(!requireRole('admin')) return;
  const s = id ? siteById(id) : { id: uid('st'), name:'', code:'', client:'', region:'', address:'', photoPolicy:'allowed', requiredTasks:[], requiredProducts:[], active:true };
  openModal(`
    <div class="modal-head"><h3>${id?'تعديل موقع':'إضافة موقع'}</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    <label>اسم الموقع</label><input type="text" id="m-name" value="${escapeHtml(s.name)}">
    <div class="row2"><div><label>كود الموقع</label><input type="text" id="m-code" value="${escapeHtml(s.code)}"></div>
    <div><label>العميل</label><input type="text" id="m-client" value="${escapeHtml(s.client)}"></div></div>
    <label>المنطقة</label><input type="text" id="m-region" value="${escapeHtml(s.region)}">
    <label>العنوان</label><input type="text" id="m-address" value="${escapeHtml(s.address)}">
    <label>سياسة التصوير</label>
    <div class="pill-toggle">
      <button type="button" data-pol="allowed" class="${s.photoPolicy==='allowed'?'on':''}">📸 تصوير داخلي مسموح</button>
      <button type="button" data-pol="prohibited" class="${s.photoPolicy==='prohibited'?'on':''}">🚫 تصوير داخلي ممنوع</button>
    </div>
    <label>المهام المطلوبة (سطر لكل مهمة)</label>
    <textarea id="m-tasks">${escapeHtml((s.requiredTasks||[]).join('\\n'))}</textarea>
    <label>المنتجات المطلوبة للستوك (سطر لكل منتج)</label>
    <textarea id="m-products">${escapeHtml((s.requiredProducts||[]).join('\\n'))}</textarea>
    <div class="checkline"><input type="checkbox" id="m-active" ${s.active?'checked':''}><label style="margin:0;" for="m-active">الموقع نشط</label></div>
    <button class="btn-primary" id="m-save">حفظ الموقع</button>
  `, true);
  let pol = s.photoPolicy;
  document.querySelectorAll('[data-pol]').forEach(b=>b.addEventListener('click', ()=>{
    pol = b.dataset.pol;
    document.querySelectorAll('[data-pol]').forEach(x=>x.classList.toggle('on', x.dataset.pol===pol));
  }));
  document.getElementById('m-save').addEventListener('click', async ()=>{
    const name = document.getElementById('m-name').value.trim();
    if(!name) return showToast('الرجاء إدخال اسم الموقع');
    const updated = {
      id: s.id, name, code: document.getElementById('m-code').value.trim(),
      client: document.getElementById('m-client').value.trim(), region: document.getElementById('m-region').value.trim(),
      address: document.getElementById('m-address').value.trim(),
      photoPolicy: pol,
      requiredTasks: document.getElementById('m-tasks').value.split('\\n').map(x=>x.trim()).filter(Boolean),
      requiredProducts: document.getElementById('m-products').value.split('\\n').map(x=>x.trim()).filter(Boolean),
      active: document.getElementById('m-active').checked
    };
    const idx = DB.sites.findIndex(x=>x.id===s.id);
    if(idx>=0) DB.sites[idx]=updated; else DB.sites.push(updated);
    await saveDB(); addAudit(idx>=0?'edit_site':'add_site', name);
    closeModal(); renderSitesAdmin(); showToast('✔ تم حفظ الموقع');
  });
}

