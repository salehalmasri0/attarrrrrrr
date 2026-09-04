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

function renderReportsAdmin(){
  const main = document.getElementById('main-area');
  main.innerHTML = [
    '<div class="card report-card">',
      '<div class="report-heading"><div><h3>التقرير اليومي</h3><p class="sub">ملف Excel مرتب مع الصور والتفاصيل التشغيلية</p></div><span class="report-badge">Excel + صور</span></div>',
      '<div class="report-controls"><div><label for="rep-date">تاريخ التقرير</label><input type="date" id="rep-date" value="' + todayStr() + '"></div><button class="btn-primary report-export-btn" id="rep-export">⬇ تصدير التقرير</button></div>',
      '<div class="report-status" id="rep-status" aria-live="polite">سيحتوي الملف على 4 أوراق، والصور داخل ورقة تفاصيل الزيارات.</div>',
    '</div>'
  ].join('');
  document.getElementById('rep-export').addEventListener('click', async ()=>{
    await exportExcel(document.getElementById('rep-date').value);
  });
}


function loadExcelJS(){
  if(window.ExcelJS) return Promise.resolve(window.ExcelJS);
  if(window.__excelJsPromise) return window.__excelJsPromise;
  window.__excelJsPromise = new Promise((resolve, reject)=>{
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/exceljs@4.4.0/dist/exceljs.min.js';
    script.onload = ()=> window.ExcelJS ? resolve(window.ExcelJS) : reject(new Error('ExcelJS unavailable'));
    script.onerror = ()=> reject(new Error('ExcelJS failed to load'));
    document.head.appendChild(script);
  });
  return window.__excelJsPromise;
}

function setReportStatus(message, type){
  const status = document.getElementById('rep-status');
  if(!status) return;
  status.textContent = message;
  status.className = 'report-status' + (type ? ' ' + type : '');
}

function styleReportHeader(row){
  row.height = 28;
  row.eachCell(cell=>{
    cell.font = { bold:true, color:{argb:'FFFFFFFF'} };
    cell.fill = { type:'pattern', pattern:'solid', fgColor:{argb:'FF065A82'} };
    cell.alignment = { vertical:'middle', horizontal:'right', wrapText:true };
  });
}

function styleReportSheet(sheet, widths, freezeRows){
  sheet.views = [{ rightToLeft:true, state:'frozen', ySplit:freezeRows || 0 }];
  sheet.columns = widths.map(width=>({ width }));
  sheet.eachRow(row=>row.eachCell(cell=>{
    cell.alignment = { vertical:'middle', horizontal:'right', wrapText:true };
    cell.border = {
      top:{style:'thin',color:{argb:'FFE1E9EF'}}, bottom:{style:'thin',color:{argb:'FFE1E9EF'}},
      left:{style:'thin',color:{argb:'FFE1E9EF'}}, right:{style:'thin',color:{argb:'FFE1E9EF'}}
    };
  }));
}

function addReportImage(workbook, sheet, value, rowNumber, columnNumber){
  if(typeof value !== 'string' || value.indexOf('data:image/') !== 0) return false;
  const match = value.match(/^data:image\/([a-zA-Z0-9+]+);base64,/);
  if(!match) return false;
  const extension = match[1].toLowerCase() === 'png' ? 'png' : 'jpeg';
  const imageId = workbook.addImage({ base64:value, extension });
  sheet.addImage(imageId, {
    tl:{ col:columnNumber - 1, row:rowNumber - 1 },
    ext:{ width:126, height:78 }
  });
  return true;
}

async function exportExcel(date){
  if(!requireRole('admin')) return;
  if(!date){ showToast('الرجاء اختيار تاريخ التقرير'); return; }
  try{ await loadExcelJS(); }catch(error){ console.error('ExcelJS load failed:', error); showToast('تعذّر تحميل أداة Excel — أعد تحميل الصفحة'); setReportStatus('تعذّر تحميل أداة إنشاء Excel.', 'error'); return; }

  const coordIds = Object.keys(DB.schedules[date] || {});
  if(coordIds.length===0){ showToast('لا توجد خطة محفوظة لهذا التاريخ'); setReportStatus('لا توجد خطة محفوظة لهذا التاريخ.', 'error'); return; }

  const exportBtn = document.getElementById('rep-export');
  if(exportBtn){ exportBtn.disabled = true; exportBtn.textContent = '⏳ جارٍ إنشاء التقرير...'; }
  setReportStatus('جارٍ تجهيز البيانات والصور داخل ملف Excel...', 'loading');

  try{
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'نظام العطار';
    workbook.created = new Date();
    workbook.modified = new Date();

    const summaryRows = [];
    let totalReq=0, totalDone=0, totalUnv=0, totalDed=0;
    coordIds.forEach(cid=>{
      const c = coordById(cid); if(!c) return;
      const cov = coverageFor(date, cid);
      const ded = deductionFor(date, cid);
      summaryRows.push([fmtDate(date), c.name, c.employeeNo, cov.required.length, cov.visitedPlanned.length, cov.unvisited.length, cov.rate+'%', ded.value]);
      totalReq+=cov.required.length; totalDone+=cov.visitedPlanned.length; totalUnv+=cov.unvisited.length; totalDed+=ded.value;
    });

    const ws1 = workbook.addWorksheet('ملخص يومي', { views:[{rightToLeft:true}] });
    ws1.mergeCells('A1:H1'); ws1.getCell('A1').value = 'ملخص يومي — تقرير زيارات المنسقين';
    ws1.getCell('A1').font = {bold:true, size:16, color:{argb:'FFFFFFFF'}};
    ws1.getCell('A1').fill = {type:'pattern', pattern:'solid', fgColor:{argb:'FF21295C'}};
    ws1.getCell('A1').alignment = {horizontal:'center', vertical:'middle'}; ws1.getRow(1).height = 32;
    [['التاريخ',fmtDate(date)],['إجمالي المنسقين',coordIds.length],['إجمالي المواقع المطلوبة',totalReq],['إجمالي الزيارات المكتملة',totalDone],['إجمالي المواقع غير المزارة',totalUnv],['نسبة الإنجاز الإجمالية',totalReq?Math.round(totalDone/totalReq*100)+'%':'0%'],['إجمالي الخصم (د.أ)',totalDed]].forEach(item=>ws1.addRow(item));
    ws1.addRow([]);
    const summaryHeader = ws1.addRow(['التاريخ','المنسّق','الرقم الوظيفي','المواقع المطلوبة','المكتملة','غير المزارة','نسبة الإنجاز','الخصم (د.أ)']);
    styleReportHeader(summaryHeader);
    summaryRows.forEach(values=>ws1.addRow(values));
    styleReportSheet(ws1,[16,24,16,18,14,16,16,16],9);

    const detailHeaders = ['التاريخ','المنسّق','الرقم الوظيفي','الموقع','وقت الدخول','وقت الخروج','مدة الزيارة (دقيقة)','GPS الدخول','GPS الخروج','موقع الدخول مسجّل','سياسة التصوير','حالة الصور','الستوك','المهام المنفذة','الملاحظات','حالة الزيارة','ترتيب الزيارة','صورة الدخول','صورة الخروج'];
    const ws2 = workbook.addWorksheet('تفاصيل الزيارات', { views:[{rightToLeft:true, state:'frozen', ySplit:1}] });
    const detailHeader = ws2.addRow(detailHeaders); styleReportHeader(detailHeader);
    const detailVisits = VISITS.filter(v=>v.date===date).sort((a,b)=>(a.sequenceIndex||0)-(b.sequenceIndex||0));
    if(detailVisits.length===0){ ws2.addRow(['لا توجد زيارات مسجلة لهذا التاريخ']); }
    detailVisits.forEach(v=>{
      const c = coordById(v.coordId);
      const entryPhoto = v.photoPolicy==='allowed' ? v.photos && v.photos.before : v.photos && v.photos.extEntry;
      const exitPhoto = v.photoPolicy==='allowed' ? v.photos && v.photos.after : v.photos && v.photos.extExit;
      const row = ws2.addRow([
        fmtDate(v.date), v.coordName || '', c?c.employeeNo:'', v.siteName || '', fmtTime(v.entryTime), fmtTime(v.exitTime),
        v.durationSec ? Math.round(v.durationSec/60) : '', v.entryGPS ? v.entryGPS.lat.toFixed(5)+','+v.entryGPS.lng.toFixed(5) : '',
        v.exitGPS ? v.exitGPS.lat.toFixed(5)+','+v.exitGPS.lng.toFixed(5) : '', v.entryGPS?'نعم':'لا', v.photoPolicy==='allowed'?'مسموح':'ممنوع',
        v.photoPolicy==='allowed' ? ((v.photos&&v.photos.before&&v.photos.after)?'مكتملة':'ناقصة') : ((v.photos&&v.photos.extEntry&&v.photos.extExit)?'مكتملة':'ناقصة'),
        (v.stock||[]).map(s=>s.product+':'+s.qty).join(' / '), (v.tasksDone||[]).join(' / '), v.notes || '',
        v.status==='completed'?'مكتملة':'قيد التنفيذ', v.sequenceIndex||'', '', ''
      ]);
      row.height = 86;
      addReportImage(workbook, ws2, entryPhoto, row.number, 18);
      addReportImage(workbook, ws2, exitPhoto, row.number, 19);
    });
    styleReportSheet(ws2,[14,22,15,24,13,13,16,21,21,17,14,14,28,28,30,15,14,19,19],1);
    ws2.autoFilter = { from:'A1', to:'S1' };

    const unvisitedRows = [];
    coordIds.forEach(cid=>{
      const c = coordById(cid); const cov = coverageFor(date, cid);
      cov.unvisited.forEach(sid=>unvisitedRows.push([c.name, siteById(sid)?siteById(sid).name:sid, fmtDate(date), isDateClosed(date)?'نهائي':'متوقع', DB.settings.deductionPerSite]));
    });
    const ws3 = workbook.addWorksheet('مواقع غير مزارة', { views:[{rightToLeft:true, state:'frozen', ySplit:1}] });
    const unvisitedHeader = ws3.addRow(['المنسّق','الموقع','التاريخ','الحالة','الخصم (د.أ)']); styleReportHeader(unvisitedHeader);
    (unvisitedRows.length?unvisitedRows:[['لا توجد مواقع غير مزارة','','','','']]).forEach(values=>ws3.addRow(values));
    styleReportSheet(ws3,[24,30,16,14,16],1);

    const dedRows = coordIds.map(cid=>{
      const c = coordById(cid); const cov = coverageFor(date, cid); const ded = deductionFor(date, cid); const adj = DB.deductionAdjustments[date+'|'+cid];
      return [c.name,c.employeeNo,fmtDate(date),cov.unvisited.length,ded.value,isDateClosed(date)?'نهائي':'متوقع',adj?(adj.reason||''):'',adj?(adj.admin||''):''];
    });
    dedRows.push(['الإجمالي','','',totalUnv,totalDed,'','','']);
    const ws4 = workbook.addWorksheet('الخصومات', { views:[{rightToLeft:true, state:'frozen', ySplit:1}] });
    const dedHeader = ws4.addRow(['المنسّق','الرقم الوظيفي','التاريخ','عدد المواقع غير المزارة','قيمة الخصم (د.أ)','الحالة','السبب','عدّل بواسطة']); styleReportHeader(dedHeader);
    dedRows.forEach(values=>ws4.addRow(values)); styleReportSheet(ws4,[24,16,16,22,20,14,30,20],1);

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = 'تقرير_زيارات_'+date+'.xlsx';
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 1000);
    addAudit('export_excel', date);
    setReportStatus('تم إنشاء التقرير وإضافة صور الزيارات داخله.', 'success');
    showToast('✔ تم تنزيل التقرير مع الصور');
  }catch(error){
    console.error('Excel export failed:', error);
    setReportStatus('حدث خطأ أثناء إنشاء التقرير. حاول مرة أخرى.', 'error');
    showToast('تعذّر إنشاء التقرير');
  }finally{
    if(exportBtn){ exportBtn.disabled = false; exportBtn.textContent = '⬇ تصدير التقرير'; }
  }
}
