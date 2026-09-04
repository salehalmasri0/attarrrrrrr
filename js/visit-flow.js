/* =========================================================
   آلة حالة تنفيذ الزيارة (خطوة بخطوة) للمنسّق
   ========================================================= */

/* ---- Visit flow (state machine per site) ---- */
let vf = null; // current visit flow state
function startVisitFlow(siteId){
  if(!requireRole('coordinator')) return;
  const site = siteById(siteId);
  const today = todayStr();
  let visit = VISITS.find(v=>v.date===today && v.coordId===session.id && v.siteId===siteId && v.status==='in_progress');
  vf = { site, visit, step: visit ? (visit.entryTime? 1:0) : 0, stockInput:{}, tasksChecked: visit? new Set(visit.tasksDone||[]) : new Set() };
  renderVisitModal();
}
function stepsFor(policy){
  return policy==='allowed'
    ? ['entry','before','stock','tasks','notes','after','exit']
    : ['entry','extEntry','stock','tasks','notes','extExit','exit'];
}
function renderVisitModal(){
  const steps = stepsFor(vf.site.photoPolicy);
  const cur = steps[vf.step];
  const trackHtml = steps.map((s,i)=>`<div class="${i<vf.step?'done':(i===vf.step?'now':'')}"></div>`).join('');
  let body = '';
  if(cur==='entry') body = renderEntryStep();
  else if(cur==='before') body = renderPhotoStep('before','📸 صورة الرف — قبل العمل');
  else if(cur==='extEntry') body = renderPhotoStep('extEntry','📸 صورة الموقع من الخارج — عند الدخول');
  else if(cur==='stock') body = renderStockStep();
  else if(cur==='tasks') body = renderTasksStep();
  else if(cur==='notes') body = renderNotesStep();
  else if(cur==='after') body = renderPhotoStep('after','📸 صورة الرف — بعد العمل');
  else if(cur==='extExit') body = renderPhotoStep('extExit','📸 صورة الموقع من الخارج — عند الخروج');
  else if(cur==='exit') body = renderExitStep();

  openModal(`
    <div class="modal-head"><h3>${escapeHtml(vf.site.name)}</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="step-track">${trackHtml}</div>
    ${body}
  `);
  wireVisitStep(cur);
}
function renderEntryStep(){
  return `
    <p class="sub">${vf.site.photoPolicy==='allowed'?'📸 التصوير الداخلي مسموح في هذا الموقع':'🚫 التصوير الداخلي ممنوع — سيتم طلب صور خارجية فقط'}</p>
    <div class="gps-box" id="vf-gps-box"><span id="vf-gps-text">اضغط لتحديد موقعك والتحقق من النطاق</span><button class="btn-gps" id="vf-gps-btn">📍 تحديد موقعي</button></div>
    <button class="btn-primary" id="vf-next" disabled>بدء الزيارة</button>
  `;
}
function renderPhotoStep(key, title){
  const existing = vf.visit && vf.visit.photos ? vf.visit.photos[key] : null;
  return `
    <label>${title}</label>
    <div class="photo-drop" id="vf-drop" style="height:160px;">
      ${existing? `<img src="${existing}">` : '<span class="plus">+</span>'}
      <input type="file" accept="image/*" capture="environment" id="vf-photo-input">
    </div>
    <button class="btn-primary" id="vf-next" ${existing?'':'disabled'}>متابعة</button>
  `;
}
function renderStockStep(){
  const products = vf.site.requiredProducts || [];
  const existing = vf.visit && vf.visit.stock ? vf.visit.stock : [];
  return `
    <p class="sub">أدخل كمية الستوك المتوفرة لكل منتج مطلوب في هذا الموقع.</p>
    ${products.length===0 ? '<div class="empty">لا توجد منتجات محددة لهذا الموقع.</div>' : products.map(p=>{
      const found = existing.find(e=>e.product===p);
      return `<label>${escapeHtml(p)}</label><input type="number" min="0" class="vf-stock-input" data-product="${escapeHtml(p)}" value="${found?found.qty:''}">`;
    }).join('')}
    <button class="btn-primary" id="vf-next">متابعة</button>
  `;
}
function renderTasksStep(){
  const tasks = vf.site.requiredTasks || [];
  return `
    <p class="sub">لا يمكن إنهاء الزيارة قبل إتمام جميع المهام الإلزامية.</p>
    ${tasks.length===0 ? '<div class="empty">لا توجد مهام محددة لهذا الموقع.</div>' : tasks.map(t=>`
      <div class="checkline"><input type="checkbox" class="vf-task-check" data-task="${escapeHtml(t)}" ${vf.tasksChecked.has(t)?'checked':''}><label style="margin:0;">${escapeHtml(t)}</label></div>
    `).join('')}
    <button class="btn-primary" id="vf-next">متابعة</button>
  `;
}
function renderNotesStep(){
  const existing = (vf.visit && vf.visit.notes) || vf.notesInput || '';
  return `
    <p class="sub">ملاحظات اختيارية عن هذه الزيارة (اختياري تمامًا — لا تمنع إكمال الزيارة).</p>
    <label>ملاحظات</label>
    <textarea id="vf-notes" placeholder="مثال: الرف يحتاج صيانة، طلب العميل كمية إضافية...">${escapeHtml(existing)}</textarea>
    <button class="btn-primary" id="vf-next">متابعة</button>
  `;
}
function renderExitStep(){
  return `
    <p class="sub">آخر خطوة: تحديد موقعك عند الخروج لإثبات إنهاء الزيارة.</p>
    <div class="gps-box" id="vf-gps-box2"><span id="vf-gps-text2">اضغط لتحديد موقعك</span><button class="btn-gps" id="vf-gps-btn2">📍 تحديد موقعي</button></div>
    <button class="btn-primary" id="vf-finish" disabled>🚪 إنهاء الزيارة</button>
  `;
}

function wireVisitStep(cur){
  const nextBtn = document.getElementById('vf-next');
  if(cur==='entry'){
    document.getElementById('vf-gps-btn').addEventListener('click', ()=>{
      const box = document.getElementById('vf-gps-box'), text = document.getElementById('vf-gps-text');
      text.textContent = 'جارٍ تحديد الموقع...'; box.classList.remove('ok','err');
      if(!navigator.geolocation){ box.classList.add('err'); text.textContent='المتصفح لا يدعم تحديد الموقع'; return; }
      navigator.geolocation.getCurrentPosition(pos=>{
        vf.entryGPS = { lat:pos.coords.latitude, lng:pos.coords.longitude, accuracy:pos.coords.accuracy };
        box.classList.add('ok'); text.textContent = `🟢 تم تسجيل موقعك (${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)})`;
        document.getElementById('vf-next').disabled = false;
      }, ()=>{ box.classList.add('err'); text.textContent = 'تعذّر الوصول للموقع'; }, {enableHighAccuracy:true, timeout:8000});
    });
    nextBtn.addEventListener('click', ()=> advanceStep());
    return;
  }
  if(cur==='before' || cur==='extEntry' || cur==='after' || cur==='extExit'){
    document.getElementById('vf-photo-input').addEventListener('change', e=>{
      const file = e.target.files[0]; if(!file) return;
      const reader = new FileReader();
      reader.onload = ev=>{
        const img = new Image();
        img.onload = ()=>{
          const canvas = document.createElement('canvas');
          const maxW = 260; const scale = Math.min(1, maxW/img.width);
          canvas.width = img.width*scale; canvas.height = img.height*scale;
          canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.55);
          vf['photo_'+cur] = dataUrl;
          document.getElementById('vf-drop').innerHTML = `<img src="${dataUrl}"><input type="file" accept="image/*" capture="environment" id="vf-photo-input">`;
          document.getElementById('vf-next').disabled = false;
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });
    nextBtn.addEventListener('click', ()=> advanceStep());
    return;
  }
  if(cur==='stock'){
    nextBtn.addEventListener('click', ()=>{
      const inputs = document.querySelectorAll('.vf-stock-input');
      vf.stockInput = {};
      inputs.forEach(inp=>{ if(inp.value!=='') vf.stockInput[inp.dataset.product] = parseInt(inp.value)||0; });
      advanceStep();
    });
    return;
  }
  if(cur==='tasks'){
    nextBtn.addEventListener('click', ()=>{
      const required = vf.site.requiredTasks || [];
      const checked = new Set();
      document.querySelectorAll('.vf-task-check').forEach(c=>{ if(c.checked) checked.add(c.dataset.task); });
      if(required.some(t=>!checked.has(t))){ showToast('يجب إتمام جميع المهام الإلزامية قبل المتابعة'); return; }
      vf.tasksChecked = checked;
      advanceStep();
    });
    return;
  }
  if(cur==='notes'){
    nextBtn.addEventListener('click', ()=>{
      vf.notesInput = document.getElementById('vf-notes').value;
      advanceStep();
    });
    return;
  }
  if(cur==='exit'){
    document.getElementById('vf-gps-btn2').addEventListener('click', ()=>{
      const box = document.getElementById('vf-gps-box2'), text = document.getElementById('vf-gps-text2');
      text.textContent = 'جارٍ تحديد الموقع...'; box.classList.remove('ok','err');
      if(!navigator.geolocation){ box.classList.add('err'); text.textContent='المتصفح لا يدعم تحديد الموقع'; return; }
      navigator.geolocation.getCurrentPosition(pos=>{
        vf.exitGPS = { lat:pos.coords.latitude, lng:pos.coords.longitude, accuracy:pos.coords.accuracy };
        box.classList.add('ok'); text.textContent = `تم تسجيل موقع الخروج (${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)})`;
        document.getElementById('vf-finish').disabled = false;
      }, ()=>{ box.classList.add('err'); text.textContent='تعذّر الوصول للموقع'; }, {enableHighAccuracy:true, timeout:8000});
    });
    document.getElementById('vf-finish').addEventListener('click', finishVisit);
    return;
  }
}

function persistVisit(id){
  Promise.resolve(saveVisits([id])).catch(err=>{
    console.warn('Visit save failed/deferred:', err);
    showToast('تمت متابعة الزيارة، وسيتم حفظ البيانات عند توفر الاتصال.');
  });
}

function advanceStep(){
  if(!requireRole('coordinator') || !vf || !vf.site) return;
  const steps = stepsFor(vf.site.photoPolicy);

  // إنشاء سجل الزيارة أولًا، ثم الانتقال فورًا للخطوة التالية.
  // لا ننتظر Firestore حتى لا تتجمد الواجهة عند ضعف/انقطاع الاتصال.
  if(vf.step===0){
    const today = todayStr();
    const seqCount = VISITS.filter(v=>v.date===today && v.coordId===session.id).length;
    vf.visit = {
      id: uid('vs'), date: today, coordId: session.id, coordName: session.name, siteId: vf.site.id, siteName: vf.site.name,
      photoPolicy: vf.site.photoPolicy, entryTime: nowIso(), entryGPS: vf.entryGPS,
      exitTime:null, exitGPS:null, durationSec:null,
      stock:[], tasksDone:[], photos:{}, status:'in_progress', sequenceIndex: seqCount+1
    };
    VISITS.push(vf.visit);
    addAudit('start_visit', `${vf.site.name}`);
  }

  vf.step++;

  // حفظ الصور والستوك والمهام والملاحظات تدريجيًا.
  ['before','extEntry','after','extExit'].forEach(k=>{
    if(vf['photo_'+k]) vf.visit.photos[k]=vf['photo_'+k];
  });
  if(vf.notesInput!==undefined) vf.visit.notes = vf.notesInput;
  if(Object.keys(vf.stockInput||{}).length){
    vf.visit.stock = Object.keys(vf.stockInput).map(p=>({product:p, qty:vf.stockInput[p]}));
  }
  if(vf.tasksChecked && vf.tasksChecked.size) vf.visit.tasksDone = [...vf.tasksChecked];

  // الواجهة تتقدم فورًا، والحفظ يعمل في الخلفية.
  renderVisitModal();
  persistVisit(vf.visit.id);
}

function finishVisit(){
  if(!requireRole('coordinator') || !vf || !vf.visit) return;
  vf.visit.exitTime = nowIso();
  vf.visit.exitGPS = vf.exitGPS;
  vf.visit.durationSec = Math.round((new Date(vf.visit.exitTime) - new Date(vf.visit.entryTime))/1000);
  vf.visit.status = 'completed';

  // لا ننتظر Firestore قبل إغلاق النافذة؛ التسجيل محليًا في VISITS تم بالفعل.
  persistVisit(vf.visit.id);
  addAudit('complete_visit', `${vf.site.name} | مدة ${Math.round(vf.visit.durationSec/60)} دقيقة`);
  closeModal();
  showToast('✔ تم إنهاء الزيارة بنجاح');
  vf = null;
  renderMain();
}

