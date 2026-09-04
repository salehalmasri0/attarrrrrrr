/* =========================================================
   إعدادات Firebase — خاصة بمشروعك على Firebase Console
   =========================================================
   ملاحظة أمان مهمة (اقرأها قبل الرفع على GitHub):
   مفتاح apiKey هنا ليس سرًا حقيقيًا من الناحية الفنية — جوجل توضح رسميًا أن
   مفاتيح Firebase للويب مصمَّمة لتكون مرئية في كود المتصفح، والحماية الفعلية
   لبياناتك تأتي من "قواعد أمان Firestore" (ملف firestore.rules في جذر
   المشروع) وليس من إخفاء هذا المفتاح.
   لذلك هذا الملف يُرفع على GitHub بشكل طبيعي ليعمل الموقع فور رفعه.
   إن كنت تفضّل رغم ذلك عدم رفعه (مثلاً لتبديل مشروع Firebase بين نسخة
   تجريبية وأخرى حقيقية دون تعديل الكود)، أضف السطر التالي إلى .gitignore:
     js/firebase-config.js
   وارفع بدلاً منه js/firebase-config.example.js كقالب فقط.
   راجع README.md لشرح كامل حول قواعد الأمان الموصى بها. */

const firebaseConfig = {
  apiKey: "AIzaSyCaefZbjK7zYg6-QEfEv6s3eFc0e3fumQI",
  authDomain: "project-6b05bc61-2858-47bc-a59.firebaseapp.com",
  projectId: "project-6b05bc61-2858-47bc-a59",
  storageBucket: "project-6b05bc61-2858-47bc-a59.firebasestorage.app",
  messagingSenderId: "380949656518",
  appId: "1:380949656518:web:4a89cbe0cc94507547b8c7",
  measurementId: "G-TE8NBG5T52"
};
firebase.initializeApp(firebaseConfig);
const fdb = firebase.firestore();

/* تفعيل التخزين المحلي (IndexedDB) — هذا هو ما يسمح فعليًا للمنسّق بمتابعة
   العمل بدون إنترنت ثم مزامنة البيانات تلقائيًا عند عودة الاتصال.
   (في النسخة السابقة كان هذا موصوفًا في تعليق داخل الكود لكنه لم يكن مُفعّلاً
   فعليًا — Firestore لا يفعّله تلقائيًا، يجب استدعاء enablePersistence). */
fdb.enablePersistence({ synchronizeTabs: true }).catch(err=>{
  if(err.code === 'failed-precondition'){
    console.warn('تعذّر تفعيل التخزين المحلي بسبب فتح أكثر من تبويب في نفس الوقت.');
  } else if(err.code === 'unimplemented'){
    console.warn('هذا المتصفح لا يدعم التخزين المحلي لـ Firestore (سيعمل التطبيق لكن بدون دعم وضع عدم الاتصال).');
  }
});

const CORE_DOC = fdb.collection('app').doc('core'); // مستند واحد لكل شيء عدا الزيارات
const VISITS_COL = fdb.collection('visits'); // كل زيارة = مستند مستقل (يفادي حد 1MB لكل مستند)
