/* =========================================================
   قالب إعدادات Firebase — انسخ هذا الملف باسم firebase-config.js
   وضع فيه بيانات مشروعك من Firebase Console:
   Project settings → General → Your apps → SDK setup and configuration
   ========================================================= */

const firebaseConfig = {
  apiKey: "ضع-قيمتك-هنا",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.firebasestorage.app",
  messagingSenderId: "0000000000",
  appId: "1:0000000000:web:xxxxxxxxxxxxxxxx",
  measurementId: "G-XXXXXXXXXX"
};
firebase.initializeApp(firebaseConfig);
const fdb = firebase.firestore();

fdb.enablePersistence({ synchronizeTabs: true }).catch(err=>{
  if(err.code === 'failed-precondition'){
    console.warn('تعذّر تفعيل التخزين المحلي بسبب فتح أكثر من تبويب في نفس الوقت.');
  } else if(err.code === 'unimplemented'){
    console.warn('هذا المتصفح لا يدعم التخزين المحلي لـ Firestore.');
  }
});

const CORE_DOC = fdb.collection('app').doc('core');
const VISITS_COL = fdb.collection('visits');
