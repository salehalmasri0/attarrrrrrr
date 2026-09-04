/* =========================================================
   طبقة البيانات (Data Layer) — القيم الافتراضية، التحميل، الحفظ،
   المزامنة، وحسابات التغطية/الخصم/الأداء
   ========================================================= */

function defaultDB(){
  return {
    settings:{
      adminUsers:[{username:'admin', password:'240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', name:'مدير المبيعات'}],
      deductionPerSite: 1,
      dayCloseTime: '20:00',
      closedDates: [],
      performanceWeights: { attendance:40, tasks:20, gps:15, photo:10, stock:10, notes:5 }
    },
    sites: [],
    coordinators: [],
    schedules: {},
    deductionAdjustments: {},
    auditLogs: [],
    weeklyPatterns: {},
    leaves: {}
  };
}

async function loadAll(){
  try{
    const snap = await CORE_DOC.get();
    DB = snap.exists ? snap.data() : null;
  }catch(e){ console.error(e); DB = null; }
  if(!DB){ DB = defaultDB(); await saveDB(); }
  if(!DB.settings.performanceWeights) DB.settings.performanceWeights = { attendance:40, tasks:20, gps:15, photo:10, stock:10, notes:5 };
  if(!DB.weeklyPatterns) DB.weeklyPatterns = {};
  if(!DB.leaves) DB.leaves = {};
  if(DB.settings.closedDates===undefined) DB.settings.closedDates = [];
  try{
    const qs = await VISITS_COL.get();
    VISITS = qs.docs.map(d=>d.data());
  }catch(e){ console.error(e); VISITS = []; }
}

/* ================= OFFLINE / SYNC =================
   الحفظ لا يجب أن يجمّد واجهة المنسّق. Firestore قد ينتظر الشبكة في بعض
   حالات Safari / iOS أو قبل اكتمال تفعيل IndexedDB. لذلك نستخدم مهلة قصيرة
   للحفظ من جهة الواجهة، مع إبقاء عملية Firestore في الخلفية، ونسمح للزيارة
   بالانتقال فورًا إلى الخطوة التالية. */
async function saveDB(){
  try{
    await CORE_DOC.set(DB);
    markSynced();
  }catch(e){ console.error(e); markPending(); }
}

async function saveVisits(visitIds){
  const toSave = visitIds ? VISITS.filter(v=>visitIds.includes(v.id)) : VISITS;
  if(!toSave.length) return;

  try{
    const batch = fdb.batch();
    toSave.forEach(v=> batch.set(VISITS_COL.doc(v.id), v));

    // لا نسمح لـ commit أن يجمّد شاشة الزيارة.
    // Firestore/IndexedDB قد يكمل الكتابة لاحقًا حتى لو انتهت هذه المهلة.
    const commitPromise = batch.commit();
    let timedOut = false;
    const timeoutPromise = new Promise(resolve=>setTimeout(()=>{
      timedOut = true;
      resolve();
    }, 2500));

    await Promise.race([commitPromise, timeoutPromise]);

    if(timedOut){
      console.warn('Firestore commit timed out; visit remains locally available and will sync when possible.');
      markPending();
      // لا ننتظر commitPromise هنا حتى لا تتجمد واجهة الزيارة.
      commitPromise.then(()=>{
        if(pendingSyncCount>0) pendingSyncCount = Math.max(0, pendingSyncCount-1);
        updateSyncBadge();
      }).catch(e=>console.error('Background visit sync failed:', e));
      return;
    }

    markSynced();
  }catch(e){
    console.error('saveVisits failed:', e);
    markPending();
  }
}

async function clearVisitsCollection(){
  try{
    const qs = await VISITS_COL.get();
    if(qs.empty) return;
    const batch = fdb.batch();
    qs.docs.forEach(d=> batch.delete(d.ref));
    await batch.commit();
  }catch(e){ console.error(e); }
}
function markPending(){ pendingSyncCount++; updateSyncBadge(); }
function markSynced(){ if(pendingSyncCount>0) pendingSyncCount = Math.max(0, pendingSyncCount-1); updateSyncBadge(); }
function updateSyncBadge(){
  const b = document.getElementById('sync-badge');
  if(!b) return;
  if(!isOnline){ b.textContent = '🔴 غير متصل — العمل محليًا'; b.className = 'sync-badge pending'; }
  else if(pendingSyncCount>0){ b.textContent = '🟡 مزامنة معلّقة'; b.className = 'sync-badge pending'; }
  else { b.textContent = '🟢 متصل ومتزامن'; b.className = 'sync-badge online'; }
}
async function retryPendingSync(){
  if(!isOnline) return;
  try{ await saveDB(); await saveVisits(); pendingSyncCount = 0; }
  catch(e){ markPending(); }
  updateSyncBadge();
}
window.addEventListener('online', ()=>{ isOnline = true; updateSyncBadge(); showToast('🟢 عاد الاتصال — جارٍ المزامنة'); retryPendingSync(); });
window.addEventListener('offline', ()=>{ isOnline = false; updateSyncBadge(); showToast('🔴 انقطع الاتصال — سيتم العمل محليًا حتى تعود الشبكة'); });

function addAudit(action, details){
  DB.auditLogs.unshift({
    id: uid('log'), at: nowIso(),
    user: session ? session.name : 'system',
    role: session ? session.role : '-',
    action, details: details || ''
  });
  if(DB.auditLogs.length > 500) DB.auditLogs.length = 500;
  saveDB();
}

function scheduleFor(date, coordId){
  return (DB.schedules[date] && DB.schedules[date][coordId]) ? DB.schedules[date][coordId] : [];
}
function siteById(id){ return DB.sites.find(s=>s.id===id); }
function coordById(id){ return DB.coordinators.find(c=>c.id===id); }

function isDateClosed(date){
  const today = todayStr();
  if(date < today) return true;
  if(DB.settings.closedDates.includes(date)) return true;
  if(date === today){
    const [h,m] = (DB.settings.dayCloseTime||'23:59').split(':').map(Number);
    const closeAt = new Date(); closeAt.setHours(h,m,0,0);
    if(new Date() >= closeAt) return true;
  }
  return false;
}

function completedSitesForVisit(date, coordId){
  return new Set(VISITS.filter(v=>v.date===date && v.coordId===coordId && v.status==='completed').map(v=>v.siteId));
}

function isOnLeave(date, coordId){
  return !!(DB.leaves && DB.leaves[date] && DB.leaves[date][coordId]);
}

function coverageFor(date, coordId){
  const required = scheduleFor(date, coordId);
  if(isOnLeave(date, coordId)){
    return { required, visitedPlanned:[], unvisited:[], rate:100, onLeave:true };
  }
  const completed = completedSitesForVisit(date, coordId);
  const visitedPlanned = required.filter(id=>completed.has(id));
  const unvisited = required.filter(id=>!completed.has(id));
  return { required, visitedPlanned, unvisited, rate: required.length? Math.round(visitedPlanned.length/required.length*100):0, onLeave:false };
}

function deductionFor(date, coordId){
  if(isOnLeave(date, coordId)){
    return { value:0, base:0, adjusted:false, onLeave:true, unvisited:[] };
  }
  const key = date+'|'+coordId;
  const adj = DB.deductionAdjustments[key];
  const cov = coverageFor(date, coordId);
  const base = cov.unvisited.length * (DB.settings.deductionPerSite||1);
  if(adj && !adj.cancelled) return { value: adj.value, base, adjusted:true, reason: adj.reason, unvisited: cov.unvisited };
  if(adj && adj.cancelled) return { value: 0, base, adjusted:true, cancelled:true, reason: adj.reason, unvisited: cov.unvisited };
  return { value: base, base, adjusted:false, unvisited: cov.unvisited };
}

function computePerformance(coordId){
  const w = DB.settings.performanceWeights;
  const dates = Object.keys(DB.schedules);
  let reqTotal=0, doneTotal=0;
  dates.forEach(d=>{
    const cov = coverageFor(d, coordId);
    reqTotal += cov.required.length; doneTotal += cov.visitedPlanned.length;
  });
  const attendance = reqTotal? (doneTotal/reqTotal*100) : 0;

  const myVisits = VISITS.filter(v=>v.coordId===coordId && v.status==='completed');
  let taskOk=0, gpsOk=0, photoOk=0, stockOk=0, notesOk=0;
  myVisits.forEach(v=>{
    const site = siteById(v.siteId);
    const reqTasks = site? (site.requiredTasks||[]) : [];
    if(reqTasks.length===0 || reqTasks.every(t=>(v.tasksDone||[]).includes(t))) taskOk++;
    const entryOk = !!v.entryGPS;
    const exitOk = !!v.exitGPS;
    if(entryOk && exitOk) gpsOk++;
    const needPhoto = v.photoPolicy==='allowed' ? (v.photos&&v.photos.before&&v.photos.after) : (v.photos&&v.photos.extEntry&&v.photos.extExit);
    if(needPhoto) photoOk++;
    const reqProducts = site? (site.requiredProducts||[]) : [];
    if(reqProducts.length===0 || (v.stock&&v.stock.length>0)) stockOk++;
    if(v.notes && v.notes.trim()) notesOk++;
  });
  const n = myVisits.length || 1;
  const taskCompliance = myVisits.length? (taskOk/n*100) : 100;
  const gpsCompliance = myVisits.length? (gpsOk/n*100) : 100;
  const photoCompliance = myVisits.length? (photoOk/n*100) : 100;
  const stockReporting = myVisits.length? (stockOk/n*100) : 100;
  const dataQuality = myVisits.length? (notesOk/n*100) : 0;

  const score = (attendance*w.attendance + taskCompliance*w.tasks + gpsCompliance*w.gps +
                 photoCompliance*w.photo + stockReporting*w.stock + dataQuality*w.notes) / 100;
  return {
    attendance: Math.round(attendance), taskCompliance: Math.round(taskCompliance),
    gpsCompliance: Math.round(gpsCompliance), photoCompliance: Math.round(photoCompliance),
    stockReporting: Math.round(stockReporting), dataQuality: Math.round(dataQuality),
    score: Math.round(score*10)/10
  };
}
