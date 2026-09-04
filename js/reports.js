/* =========================================================
   التقارير وتصدير Excel
   ========================================================= */

/* ================= REPORTS / EXCEL ================= */
function renderReportsAdmin(){
  const main = document.getElementById('main-area');
  main.innerHTML = `
    <div class="card">
      <h3>التقرير اليومي (Excel)</h3>
      <label>اختر التاريخ</label>
      <input type="date" id="rep-date" value="${todayStr()}">
      <button class="btn-primary" id="rep-export">⬇ تصدير تقرير Excel كامل</button>
      <p class="footer-note">يحتوي التقرير على 4 صفحات: ملخص يومي، تفاصيل الزيارات، المواقع غير المزارة، والخصومات.</p>
    </div>
  `;
  document.getElementById('rep-export').addEventListener('click', ()=>{
    exportExcel(document.getElementById('rep-date').value);
  });
}
function exportExcel(date){
  if(!requireRole('admin')) return;
  const coordIds = Object.keys(DB.schedules[date] || {});
  if(coordIds.length===0){ showToast('لا توجد خطة محفوظة لهذا التاريخ'); return; }

  const summaryRows = [];
  let totalReq=0, totalDone=0, totalUnv=0, totalDed=0;
  coordIds.forEach(cid=>{
    const c = coordById(cid); if(!c) return;
    const cov = coverageFor(date, cid);
    const ded = deductionFor(date, cid);
    summaryRows.push({ 'التاريخ': fmtDate(date), 'المنسّق': c.name, 'الرقم الوظيفي': c.employeeNo, 'المواقع المطلوبة': cov.required.length, 'المكتملة': cov.visitedPlanned.length,
      'غير المزارة': cov.unvisited.length, 'نسبة الإنجاز': cov.rate+'%', 'الخصم النهائي (د.أ)': ded.value });
    totalReq+=cov.required.length; totalDone+=cov.visitedPlanned.length; totalUnv+=cov.unvisited.length; totalDed+=ded.value;
  });

  const summarySheetData = [
    ['ملخص يومي — تقرير زيارات المنسقين'],
    ['التاريخ', fmtDate(date)],
    ['إجمالي المنسقين', coordIds.length],
    ['إجمالي المواقع المطلوبة', totalReq],
    ['إجمالي الزيارات المكتملة', totalDone],
    ['إجمالي المواقع غير المزارة', totalUnv],
    ['نسبة الإنجاز الإجمالية', totalReq? Math.round(totalDone/totalReq*100)+'%':'0%'],
    ['إجمالي الخصم (د.أ)', totalDed],
    [],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(summarySheetData);
  XLSX.utils.sheet_add_json(ws1, summaryRows, {origin:-1});

  const detailRows = [];
  VISITS.filter(v=>v.date===date).sort((a,b)=>(a.sequenceIndex||0)-(b.sequenceIndex||0)).forEach(v=>{
    const c = coordById(v.coordId);
    detailRows.push({
      'التاريخ': fmtDate(v.date), 'المنسّق': v.coordName, 'الرقم الوظيفي': c?c.employeeNo:'', 'الموقع': v.siteName,
      'وقت الدخول': fmtTime(v.entryTime), 'وقت الخروج': fmtTime(v.exitTime),
      'مدة الزيارة (دقيقة)': v.durationSec ? Math.round(v.durationSec/60) : '',
      'GPS الدخول': v.entryGPS ? v.entryGPS.lat.toFixed(5)+','+v.entryGPS.lng.toFixed(5) : '',
      'GPS الخروج': v.exitGPS ? v.exitGPS.lat.toFixed(5)+','+v.exitGPS.lng.toFixed(5) : '',
      'موقع الدخول مسجّل': v.entryGPS ? 'نعم' : 'لا',
      'سياسة التصوير': v.photoPolicy==='allowed'?'مسموح':'ممنوع',
      'حالة الصور': v.photoPolicy==='allowed' ? ((v.photos.before&&v.photos.after)?'مكتملة':'ناقصة') : ((v.photos.extEntry&&v.photos.extExit)?'مكتملة':'ناقصة'),
      'الستوك': (v.stock||[]).map(s=>s.product+':'+s.qty).join(' / '),
      'المهام المنفذة': (v.tasksDone||[]).join(' / '),
      'الملاحظات': v.notes || '',
      'حالة الزيارة': v.status==='completed'?'مكتملة':'قيد التنفيذ',
      'ترتيب الزيارة الفعلي': v.sequenceIndex||''
    });
  });
  const ws2 = XLSX.utils.json_to_sheet(detailRows.length?detailRows:[{'ملاحظة':'لا توجد زيارات مسجلة لهذا التاريخ'}]);

  const unvisitedRows = [];
  coordIds.forEach(cid=>{
    const c = coordById(cid); const cov = coverageFor(date, cid);
    cov.unvisited.forEach(sid=>{
      unvisitedRows.push({ 'المنسّق': c.name, 'الموقع': siteById(sid)?siteById(sid).name:sid, 'التاريخ': fmtDate(date), 'الحالة': isDateClosed(date)?'نهائي':'متوقع', 'الخصم (د.أ)': DB.settings.deductionPerSite });
    });
  });
  const ws3 = XLSX.utils.json_to_sheet(unvisitedRows.length?unvisitedRows:[{'ملاحظة':'لا توجد مواقع غير مزارة'}]);

  const dedRows = coordIds.map(cid=>{
    const c = coordById(cid); const cov = coverageFor(date, cid); const ded = deductionFor(date, cid);
    const key = date+'|'+cid; const adj = DB.deductionAdjustments[key];
    return { 'المنسّق': c.name, 'الرقم الوظيفي': c.employeeNo, 'التاريخ': fmtDate(date), 'عدد المواقع غير المزارة': cov.unvisited.length,
      'قيمة الخصم (د.أ)': ded.value, 'الحالة': isDateClosed(date)?'نهائي':'متوقع',
      'السبب': adj? (adj.reason||'') : '', 'عدّل بواسطة': adj? (adj.admin||'') : '' };
  });
  dedRows.push({ 'المنسّق':'الإجمالي', 'الرقم الوظيفي':'', 'التاريخ':fmtDate(date), 'عدد المواقع غير المزارة': totalUnv, 'قيمة الخصم (د.أ)': totalDed, 'الحالة':'', 'السبب':'', 'عدّل بواسطة':'' });
  const ws4 = XLSX.utils.json_to_sheet(dedRows);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws1, 'ملخص يومي');
  XLSX.utils.book_append_sheet(wb, ws2, 'تفاصيل الزيارات');
  XLSX.utils.book_append_sheet(wb, ws3, 'مواقع غير مزارة');
  XLSX.utils.book_append_sheet(wb, ws4, 'الخصومات');
  XLSX.writeFile(wb, `تقرير_زيارات_${date}.xlsx`);
  addAudit('export_excel', date);
  showToast('✔ تم تنزيل التقرير');
}

