/* =========================================================
   المصادقة (Auth)، صلاحيات الوصول (RBAC)، التنقّل بين التبويبات،
   ومساعد النوافذ المنبثقة (Modal)
   ========================================================= */

/* ================= AUTH ================= */
document.getElementById('role-admin-btn').addEventListener('click', ()=>{
  document.getElementById('role-admin-btn').classList.add('active');
  document.getElementById('role-coord-btn').classList.remove('active');
  document.getElementById('login-admin-form').style.display='block';
  document.getElementById('login-coord-form').style.display='none';
});
document.getElementById('role-coord-btn').addEventListener('click', ()=>{
  document.getElementById('role-coord-btn').classList.add('active');
  document.getElementById('role-admin-btn').classList.remove('active');
  document.getElementById('login-coord-form').style.display='block';
  document.getElementById('login-admin-form').style.display='none';
});

document.getElementById('btn-login').addEventListener('click', async ()=>{
  const errEl = document.getElementById('login-err');
  errEl.textContent = '';
  const loginBtn = document.getElementById('btn-login');
  loginBtn.disabled = true;
  try{
    const isAdmin = document.getElementById('role-admin-btn').classList.contains('active');
    if(isAdmin){
      const u = document.getElementById('lg-admin-user').value.trim();
      const p = document.getElementById('lg-admin-pass').value;
      if (!DB || !DB.settings) {
  errEl.textContent = 'جاري الاتصال بقاعدة البيانات... يرجى الانتظار والمحاولة ثانية';
  return;
}
const found = DB.settings.adminUsers?.find(a=>a.username===u);
      const ok = found ? await verifySecret(found.password, p) : false;
      if(!found || !ok){
        errEl.textContent = 'اسم المستخدم أو كلمة المرور غير صحيحة';
        failedLoginAttempts.unshift({at: nowIso(), who: 'admin: '+u});
        failedLoginAttempts.length = Math.min(failedLoginAttempts.length, 20);
        return;
      }
      // ترقية صامتة لأي كلمة مرور قديمة غير مجزّأة إلى SHA-256 عند أول دخول ناجح
      if(!looksHashed(found.password)){ found.password = await hashSecret(p); await saveDB(); }
      session = { role:'admin', name: found.name, username: found.username };
    } else {
      const emp = document.getElementById('lg-coord-emp').value.trim();
      const pin = document.getElementById('lg-coord-pin').value;
      const found = DB.coordinators.find(c=>c.employeeNo===emp);
      const ok = found ? await verifySecret(found.pin, pin) : false;
      if(!found || !ok){
        errEl.textContent = 'الرقم الوظيفي أو PIN غير صحيح';
        failedLoginAttempts.unshift({at: nowIso(), who: 'منسّق: '+emp});
        failedLoginAttempts.length = Math.min(failedLoginAttempts.length, 20);
        return;
      }
      if(!found.active){ errEl.textContent = 'هذا الحساب معطّل، راجع الإدارة'; return; }
      if(!looksHashed(found.pin)){ found.pin = await hashSecret(pin); await saveDB(); }
      session = { role:'coordinator', name: found.name, id: found.id, employeeNo: found.employeeNo };
    }
    addAudit('login', session.role + ' - ' + session.name);
    enterApp();
  } finally {
    loginBtn.disabled = false;
  }
});

document.getElementById('btn-logout').addEventListener('click', ()=>{
  addAudit('logout', session ? session.name : '');
  session = null;
  document.getElementById('app-root').style.display='none';
  document.getElementById('login-screen').style.display='flex';
});

function enterApp(){
  document.getElementById('login-screen').style.display='none';
  document.getElementById('app-root').style.display='flex';
  document.getElementById('hdr-user').textContent = session.name;
  document.getElementById('hdr-role').textContent = session.role==='admin' ? 'مدير مبيعات' : ('منسّق مبيعات #' + session.employeeNo);
  document.getElementById('app-root').classList.toggle('wide', session.role==='admin');
  document.getElementById('tabs-admin').style.display = session.role==='admin' ? 'flex':'none';
  document.getElementById('tabs-coord').style.display = session.role==='coordinator' ? 'flex':'none';
  updateSyncBadge();
  const firstTab = session.role==='admin' ? 'a-dashboard' : 'c-today';
  setActiveTab(firstTab);
}

document.querySelectorAll('.tabs').forEach(box=>{
  box.addEventListener('click', (e)=>{
    const tab = e.target.closest('.tab');
    if(!tab) return;
    setActiveTab(tab.dataset.tab);
  });
});
document.getElementById('sidebar-admin').addEventListener('click', (e)=>{
  const item = e.target.closest('.side-item');
  if(!item) return;
  setActiveTab(item.dataset.tab);
});

function setActiveTab(tabId){
  activeTab = tabId;
  document.querySelectorAll('.tab').forEach(t=> t.classList.toggle('active', t.dataset.tab===tabId));
  document.querySelectorAll('.side-item').forEach(t=> t.classList.toggle('active', t.dataset.tab===tabId));
  renderMain();
}

/* ================= RBAC GUARD =================
   دفاع مضاعف: حتى لو استُدعيت أي دالة إدارية مباشرة (وليس فقط عبر إخفاء
   الأزرار)، يتم التحقق من الدور قبل التنفيذ ورفض أي وصول غير مصرح به. */
function requireRole(role){
  if(!session || session.role!==role){
    addAudit('unauthorized_attempt', `محاولة وصول لمنطقة (${role}) بدور (${session?session.role:'غير مسجل'})`);
    showToast('🚫 غير مصرح لك بهذا الإجراء');
    return false;
  }
  return true;
}
const ADMIN_TABS = new Set(['a-dashboard','a-live','a-sites','a-coords','a-schedules','a-performance','a-deductions','a-reports','a-notifications','a-audit','a-settings']);
const COORD_TABS = new Set(['c-today','c-history']);

function renderMain(){
  const main = document.getElementById('main-area');
  if(ADMIN_TABS.has(activeTab) && !requireRole('admin')){ main.innerHTML = '<div class="empty">🚫 هذه الصفحة مخصصة للإدارة فقط.</div>'; return; }
  if(COORD_TABS.has(activeTab) && !requireRole('coordinator')){ main.innerHTML = '<div class="empty">🚫 هذه الصفحة مخصصة للمنسّقين فقط.</div>'; return; }
  const renderers = {
    'a-dashboard': renderAdminDashboard,
    'a-live': renderLiveMonitoring,
    'a-sites': renderSitesAdmin,
    'a-coords': renderCoordsAdmin,
    'a-schedules': renderSchedulesAdmin,
    'a-performance': renderPerformanceAdmin,
    'a-deductions': renderDeductionsAdmin,
    'a-reports': renderReportsAdmin,
    'a-notifications': renderNotificationsAdmin,
    'a-audit': renderAuditAdmin,
    'a-settings': renderSettingsAdmin,
    'c-today': renderCoordToday,
    'c-history': renderCoordHistory,
  };
  main.innerHTML = '';
  (renderers[activeTab] || function(){ main.innerHTML='<div class="empty">—</div>'; })();
}

/* ================= MODAL HELPER ================= */
function openModal(html, wide){
  const root = document.getElementById('modal-root');
  root.innerHTML = `<div class="modal-overlay ${wide?'wide-modal':''}" id="modal-ov"><div class="modal-box">${html}</div></div>`;
  document.getElementById('modal-ov').addEventListener('click', (e)=>{ if(e.target.id==='modal-ov') closeModal(); });
}
function closeModal(){ document.getElementById('modal-root').innerHTML=''; }


