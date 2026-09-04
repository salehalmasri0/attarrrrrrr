/* =========================================================
   التهيئة الأولية عند تحميل الصفحة
   ========================================================= */

/* =========================================================
   INIT
   ========================================================= */
function clearLoginFields(){
  ['lg-admin-user','lg-admin-pass','lg-coord-emp','lg-coord-pin'].forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.value = '';
  });
}
clearLoginFields();
window.addEventListener('load', ()=>{ clearLoginFields(); setTimeout(clearLoginFields, 60); setTimeout(clearLoginFields, 300); });

(async function init(){
  await loadAll();
})();