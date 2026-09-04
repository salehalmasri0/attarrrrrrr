/* =========================================================
   الحالة العامة (Global State) والدوال المساعدة العامة
   ========================================================= */

let DB = null; // كل شيء عدا الزيارات نفسها
let VISITS = []; // الزيارات (منفصلة لتخفيف حجم القراءة/الكتابة)

let session = null; // {role:'admin'|'coordinator', name, id, employeeNo}
let activeTab = null;
let failedLoginAttempts = []; // {at, who} — تُستخدم في مركز التنبيهات فقط، لا تُخزّن دائمًا
let pendingSyncCount = 0; // عدد عمليات الحفظ التي فشلت بسبب انقطاع الاتصال وبانتظار المزامنة
let isOnline = navigator.onLine;

function uid(prefix){ return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
function todayStr(d){ d = d || new Date(); return d.toISOString().slice(0,10); }
function nowIso(){ return new Date().toISOString(); }
function fmtTime(iso){ if(!iso) return '—'; return new Date(iso).toLocaleTimeString('ar-JO',{hour:'2-digit',minute:'2-digit'}); }
function fmtDate(d){ return new Date(d).toLocaleDateString('ar-JO'); }
function escapeHtml(str){ return String(str==null?'':str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function showToast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(window.__toastT);
  window.__toastT = setTimeout(()=>t.classList.remove('show'), 2400);
}
function haversineMeters(lat1,lng1,lat2,lng2){
  if([lat1,lng1,lat2,lng2].some(v=>v==null||isNaN(v))) return null;
  const R = 6371000, toRad = x=>x*Math.PI/180;
  const dLat = toRad(lat2-lat1), dLng = toRad(lng2-lng1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

