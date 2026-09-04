/* =========================================================
   الأمان — تجزئة (Hash) كلمات المرور وأرقام PIN
   =========================================================
   ملاحظة صادقة عن حدود هذا النظام:
   هذا تطبيق يعمل بالكامل من المتصفح (Frontend فقط) بدون أي خادم خاص، لذلك
   "تسجيل الدخول" هنا هو تحقّق داخل المتصفح من بيانات مخزّنة في Firestore،
   وليس نظام مصادقة حقيقي مثل Firebase Authentication.
   تجزئة كلمات المرور وPIN بـ SHA-256 تمنع تخزين/تسريب القيم كنص واضح إن
   انكشفت قاعدة البيانات (وهي تحسين حقيقي وضروري)، لكنها لا تُغني إطلاقًا عن
   ضبط قواعد أمان Firestore (راجع firestore.rules وREADME) التي تبقى خط
   الدفاع الأهم. لأمان كامل على مستوى المستخدم يُنصح مستقبلاً بترحيل تسجيل
   الدخول إلى Firebase Authentication (راجع قسم "خطوات مستقبلية" في README).
   ========================================================= */

async function hashSecret(value){
  const data = new TextEncoder().encode(String(value));
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2,'0')).join('');
}

// قيمة مجزّأة بـ SHA-256 تكون دائمًا 64 حرف hex — نستخدم هذا لتمييز
// القيم المجزّأة عن أي بيانات قديمة غير مجزّأة (نص عادي) قد تكون محفوظة
// مسبقًا في قاعدة البيانات، حتى تعمل الترقية التلقائية دون كسر الحسابات القديمة.
function looksHashed(value){
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
}

// يتحقق من قيمة مُدخلة (كلمة مرور أو PIN) مقابل القيمة المخزّنة، سواء كانت
// مجزّأة (الوضع الطبيعي) أو نص عادي (بيانات قديمة قبل هذا التحديث).
async function verifySecret(stored, input){
  if(!stored) return false;
  if(looksHashed(stored)) return (await hashSecret(input)) === stored;
  return stored === input; // توافقية مع بيانات قديمة غير مجزّأة
}
