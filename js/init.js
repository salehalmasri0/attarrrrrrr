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

// تفعيل تكبير أي صورة زيارة عند النقر عليها
document.addEventListener('click', (e) => {
  const img = e.target.closest('img');
  // استثناء الأيقونات الصغيرة إن وجدت
  if (img && img.src && !img.closest('.login-logo')) {
    openModal(`
      <div style="text-align: center; padding: 10px;">
        <h3 style="margin-top: 0; margin-bottom: 12px; font-size: 15px; color: #21295C;">معاينة الصورة بالحجم الكامل</h3>
        <img src="${img.src}" style="max-width: 100%; max-height: 80vh; border-radius: 8px; object-fit: contain; box-shadow: 0 4px 12px rgba(0,0,0,0.15);" />
        <div style="margin-top: 15px;">
          <button class="btn-primary" onclick="closeModal()" style="padding: 8px 24px;">إغلاق</button>
        </div>
      </div>
    `, true);
  }
});
});
