/*
  storage.js
  ----------
  Semua bagian lain dari aplikasi (customer.js, seller.js, app.js) HANYA
  memanggil 4 fungsi ini untuk baca/tulis data: sGet, sSet, sList, sDel.
  Itu sengaja dibuat begitu dari awal, supaya kalau suatu saat kamu mau
  ganti "mesin" penyimpanan lagi (misalnya dari Firebase ke Supabase, atau
  ke backend sendiri), cukup ubah isi file ini saja — file lain tidak perlu disentuh.

  Cara kerja saat ini:
  - Semua data (toko, menu, pesanan, akun penjual, pengaturan) disimpan
    sebagai satu koleksi Firestore bernama "kv" (key-value), satu dokumen
    per key, isinya field "value" berupa JSON string.
  - Ini pendekatan paling sederhana supaya cepat jalan. Kalau nanti datanya
    sudah besar, bisa dirapikan jadi koleksi Firestore yang lebih standar
    (stores, menus, orders terpisah) — tapi fungsi sGet/sSet/sList/sDel di
    kode lain tidak perlu berubah, cukup isi di dalam file ini.
  - Khusus key "session" (dipakai untuk mengingat login penjual di HP itu
    saja), disimpan di localStorage browser, BUKAN ke Firestore — karena
    sifatnya memang per-perangkat, bukan data bersama.
*/

const KV_COLLECTION = 'kv';

async function sGet(key, shared){
  if(key === 'session'){
    const v = localStorage.getItem('session');
    return v ? JSON.parse(v) : null;
  }
  try{
    const doc = await db.collection(KV_COLLECTION).doc(key).get();
    if(!doc.exists) return null;
    return JSON.parse(doc.data().value);
  }catch(e){
    console.error('sGet error:', key, e);
    return null;
  }
}

async function sSet(key, val, shared){
  if(key === 'session'){
    localStorage.setItem('session', JSON.stringify(val));
    return true;
  }
  try{
    await db.collection(KV_COLLECTION).doc(key).set({
      value: JSON.stringify(val),
      updatedAt: Date.now()
    });
    return true;
  }catch(e){
    console.error('sSet error:', key, e);
    return false;
  }
}

async function sDel(key, shared){
  if(key === 'session'){
    localStorage.removeItem('session');
    return;
  }
  try{
    await db.collection(KV_COLLECTION).doc(key).delete();
  }catch(e){
    console.error('sDel error:', key, e);
  }
}

async function sList(prefix, shared){
  try{
    const end = prefix + '\uf8ff';
    const snap = await db.collection(KV_COLLECTION)
      .where(firebase.firestore.FieldPath.documentId(), '>=', prefix)
      .where(firebase.firestore.FieldPath.documentId(), '<', end)
      .get();
    return snap.docs.map(d => d.id);
  }catch(e){
    console.error('sList error:', prefix, e);
    return [];
  }
}
