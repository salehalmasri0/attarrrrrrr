/* =========================================================
   مركز التنبيهات، سجل العمليات (Audit)، والإعدادات العامة
   (بما فيها حسابات الإدارة)
   ========================================================= */

/* ================= NOTIFICATIONS ================= */
function buildNotifications(){
  const list = [];
  const today = todayStr();
  DB.coordinators.forEach(c=>{
    const cov = coverageFor(today, c.id);
    if(isDateClosed(today) && cov.unvisited.length){
      cov.unvisited.forEach(sid=> list.push({icon:'🔴', text:`${c.name}: لم تتم زيارة ${siteById(sid)?siteById(sid).name:sid}`}));
    } else if(!isDateClosed(today) && !cov.onLeave && cov.required.length>0 && VISITS.filter(v=>v.date===today && v.coordId===c.id).length===0){
      list.push({icon:'🔵', text:`${c.name}: لم يبدأ جولة اليوم بعد (${cov.required.length} مواقع مجدولة)`});
    }
  });
  VISITS.filter(v=>v.date===today).forEach(v=>{
    const site = siteById(v.siteId);
    if(!v.entryGPS){
      list.push({icon:'🔴', text:`${v.coordName}: بدأ زيارة ${v.siteName} بدون تسجيل موقع GPS`});
    }
    if(v.status==='completed' && !v.exitGPS){
      list.push({icon:'🔴', text:`${v.coordName}: أنهى زيارة ${v.siteName} بدون تسجيل موقع الخروج`});
    }
    if(v.status==='in_progress'){
      list.push({icon:'🟡', text:`${v.coordName}: زيارة ${v.siteName} غير مكتملة بعد`});
    }
    if(v.status==='completed'){
      const needPhoto = v.photoPolicy==='allowed' ? !(v.photos.before && v.photos.after) : !(v.photos.extEntry && v.photos.extExit);
      if(needPhoto) list.push({icon:'🔴', text:`${v.coordName}: صورة مطلوبة غير موجودة في ${v.siteName}`});
      if(site && site.requiredTasks && site.requiredTasks.some(t=>!(v.tasksDone||[]).includes(t))){
        list.push({icon:'🔴', text:`${v.coordName}: مهمة إلزامية غير مكتملة في ${v.siteName}`});
      }
      if(site && (site.requiredProducts||[]).length){
        (v.stock||[]).forEach(s=>{ if(s.qty===0) list.push({icon:'🟠', text:`${v.coordName}: نقص ستوك — ${s.product} = 0 في ${v.siteName}`}); });
        if((v.stock||[]).length===0) list.push({icon:'🟠', text:`${v.coordName}: لم يتم تسجيل الستوك في ${v.siteName}`});
      }
    }
  });
  if(pendingSyncCount>0 || !isOnline){
    list.unshift({icon:'🟡', text:`يوجد عمليات بانتظار المزامنة (${pendingSyncCount}) — تحقق من الاتصال بالإنترنت`});
  }
  failedLoginAttempts.forEach(f=>{
    list.push({icon:'🔴', text:`محاولة تسجيل دخول غير صحيحة — ${f.who} — ${fmtTime(f.at)}`});
  });
  return list;
}
function renderNotificationsAdmin(){
  const main = document.getElementById('main-area');
  const list = buildNotifications();
  main.innerHTML = `<div class="card"><h3>مركز التنبيهات (${list.length})</h3>
    ${list.length? list.map(n=>`<div class="missed-alert"><span>${n.icon}</span><span>${escapeHtml(n.text)}</span></div>`).join('') : '<div class="empty">لا توجد تنبيهات حاليًا 🎉</div>'}
  </div>`;
}

/* ================= AUDIT LOG ================= */
function renderAuditAdmin(){
  const main = document.getElementById('main-area');
  main.innerHTML = `<div class="card"><h3>سجل العمليات</h3><div class="tbl-wrap"><table class="data-tbl">
    <thead><tr><th>الوقت</th><th>المستخدم</th><th>الدور</th><th>العملية</th><th>التفاصيل</th></tr></thead>
    <tbody>${DB.auditLogs.slice(0,150).map(l=>`<tr><td>${new Date(l.at).toLocaleString('ar-JO')}</td><td>${escapeHtml(l.user)}</td><td>${l.role==='admin'?'إدارة':'منسّق'}</td><td>${escapeHtml(l.action)}</td><td>${escapeHtml(l.details)}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">لا يوجد سجل بعد.</td></tr>'}</tbody>
  </table></div></div>`;
}

/* ================= SETTINGS ================= */
function renderSettingsAdmin(){
  const main = document.getElementById('main-area');
  const w2 = DB.settings.performanceWeights;
  main.innerHTML = `
    <div class="card">
      <h3>الإعدادات العامة</h3>
      <label>قيمة الخصم لكل موقع غير مزار (د.أ)</label>
      <input type="number" id="st-ded" value="${DB.settings.deductionPerSite}" min="0" step="0.5">
      <label>وقت إغلاق الجولة اليومية</label>
      <input type="time" id="st-close" value="${DB.settings.dayCloseTime}">
      <button class="btn-primary" id="st-save">حفظ الإعدادات</button>
      <button class="btn-secondary" id="st-close-today">🔒 إغلاق جولة اليوم الآن يدويًا</button>
    </div>
    <div class="card">
      <h3>أوزان تقييم الأداء (Performance Score)</h3>
      <p class="sub">هذه النسب مستقلة تمامًا عن نظام الخصم المالي ولا تؤثر عليه بأي شكل.</p>
      <div class="row2"><div><label>الحضور/إنجاز الزيارات %</label><input type="number" id="pw-attendance" value="${w2.attendance}" min="0" max="100"></div>
      <div><label>الالتزام بالمهام %</label><input type="number" id="pw-tasks" value="${w2.tasks}" min="0" max="100"></div></div>
      <div class="row2"><div><label>الالتزام بـGPS %</label><input type="number" id="pw-gps" value="${w2.gps}" min="0" max="100"></div>
      <div><label>الالتزام بالتصوير %</label><input type="number" id="pw-photo" value="${w2.photo}" min="0" max="100"></div></div>
      <div class="row2"><div><label>تسجيل الستوك %</label><input type="number" id="pw-stock" value="${w2.stock}" min="0" max="100"></div>
      <div><label>جودة الملاحظات %</label><input type="number" id="pw-notes" value="${w2.notes}" min="0" max="100"></div></div>
      <button class="btn-primary" id="pw-save">حفظ أوزان التقييم</button>
    </div>
    <div class="card">
      <h3>مسح البيانات والبدء من جديد</h3>
      <p class="sub">يمسح كل المواقع والمنسّقين والجداول والزيارات الحالية نهائيًا، ويترك النظام فارغًا لإدخال بيانات الشركة الحقيقية من البداية (من صفحتَي "المواقع" و"المنسّقين").</p>
      <button class="btn-secondary" style="color:var(--danger);border-color:#F3D3CE;" id="st-reset">مسح كل البيانات والبدء من صفر</button>
    </div>
    <div class="card">
      <h3>حسابات الإدارة</h3>
      <p class="sub">لأسباب أمنية، غيّر كلمة مرور المدير الافتراضية قبل تسليم النظام للاستخدام الفعلي.</p>
      <div id="admin-users-list"></div>
      <label>اسم مستخدم جديد أو حالي</label>
      <input type="text" id="au-username" placeholder="مثال: admin">
      <label>كلمة المرور الجديدة</label>
      <input type="password" id="au-password" placeholder="كلمة مرور قوية">
      <label>الاسم الظاهر</label>
      <input type="text" id="au-name" placeholder="مثال: مراقب المبيعات">
      <button class="btn-primary" id="au-save">حفظ / تحديث حساب المدير</button>
    </div>
  `;
  document.getElementById('st-save').addEventListener('click', async ()=>{
    if(!requireRole('admin')) return;
    DB.settings.deductionPerSite = parseFloat(document.getElementById('st-ded').value)||1;
    DB.settings.dayCloseTime = document.getElementById('st-close').value || '20:00';
    await saveDB(); addAudit('update_settings', 'خصم='+DB.settings.deductionPerSite+' إغلاق='+DB.settings.dayCloseTime);
    showToast('✔ تم حفظ الإعدادات');
  });
  document.getElementById('pw-save').addEventListener('click', async ()=>{
    if(!requireRole('admin')) return;
    DB.settings.performanceWeights = {
      attendance: parseFloat(document.getElementById('pw-attendance').value)||0,
      tasks: parseFloat(document.getElementById('pw-tasks').value)||0,
      gps: parseFloat(document.getElementById('pw-gps').value)||0,
      photo: parseFloat(document.getElementById('pw-photo').value)||0,
      stock: parseFloat(document.getElementById('pw-stock').value)||0,
      notes: parseFloat(document.getElementById('pw-notes').value)||0,
    };
    await saveDB(); addAudit('update_settings', 'تحديث أوزان تقييم الأداء');
    showToast('✔ تم حفظ أوزان التقييم'); renderSettingsAdmin();
  });
  document.getElementById('st-close-today').addEventListener('click', async ()=>{
    if(!requireRole('admin')) return;
    const today = todayStr();
    if(!DB.settings.closedDates.includes(today)) DB.settings.closedDates.push(today);
    await saveDB(); addAudit('close_day', today);
    showToast('✔ تم إغلاق جولة اليوم — الخصومات أصبحت نهائية');
  });
  document.getElementById('st-reset').addEventListener('click', async ()=>{
    if(!requireRole('admin')) return;
    if(!confirm('سيتم مسح كل المواقع والمنسّقين والجداول والزيارات نهائيًا وبشكل لا رجعة فيه. متابعة؟')) return;
    if(!confirm('تأكيد أخير: هل أنت متأكد؟ هذا الإجراء لا يمكن التراجع عنه.')) return;
    const keepAdmins = DB.settings.adminUsers;
    await clearVisitsCollection(); VISITS = [];
    DB = defaultDB();
    DB.settings.adminUsers = keepAdmins; // keep current admin login working
    await saveDB();
    showToast('✔ تم مسح البيانات — النظام جاهز لإدخال بيانات الشركة الفعلية');
    renderSettingsAdmin();
  });

  renderAdminUsersList();
  document.getElementById('au-save').addEventListener('click', async ()=>{
    if(!requireRole('admin')) return;
    const username = document.getElementById('au-username').value.trim();
    const password = document.getElementById('au-password').value;
    const name = document.getElementById('au-name').value.trim() || 'مدير';
    if(!username || !password){ showToast('الرجاء إدخال اسم مستخدم وكلمة مرور'); return; }
    if(password.length < 6){ showToast('كلمة المرور لازم تكون 6 أحرف على الأقل'); return; }
    const hashedPassword = await hashSecret(password);
    const idx = DB.settings.adminUsers.findIndex(a=>a.username===username);
    if(idx>=0){ DB.settings.adminUsers[idx] = {username, password: hashedPassword, name}; }
    else{ DB.settings.adminUsers.push({username, password: hashedPassword, name}); }
    await saveDB(); addAudit('update_admin_account', username);
    document.getElementById('au-password').value = '';
    showToast('✔ تم حفظ حساب المدير');
    renderAdminUsersList();
  });
}

function renderAdminUsersList(){
  const box = document.getElementById('admin-users-list');
  if(!box) return;
  box.innerHTML = DB.settings.adminUsers.map(a=>`
    <div class="coord-sched-card"><h4>${escapeHtml(a.name)} <span style="color:var(--muted);font-weight:400;">(${escapeHtml(a.username)})</span></h4></div>
  `).join('');
}

