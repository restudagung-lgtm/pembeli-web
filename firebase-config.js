/*
  GANTI SEMUA NILAI DI BAWAH INI dengan config project Firebase kamu sendiri.

  Cara ambil config:
  1. Buka https://console.firebase.google.com -> buat/pilih project.
  2. Klik ikon gerigi (Project settings) di kiri atas.
  3. Scroll ke bagian "Your apps" -> klik ikon web ( </> ) untuk daftarkan app web baru.
  4. Firebase akan menampilkan objek firebaseConfig -> salin ke bawah ini.
  5. Aktifkan Firestore: menu kiri "Build" -> "Firestore Database" -> "Create database"
     -> pilih lokasi server terdekat (misal asia-southeast2 / Jakarta) -> mulai di "test mode" dulu.

  Lihat README.md untuk panduan lengkap langkah demi langkah + aturan keamanan Firestore.
*/
const firebaseConfig = {
   apiKey: "AIzaSyAZq7NS68p54bGpM1C8m86pFybEul0WnPQ",
  authDomain: "lapak-alunalun.firebaseapp.com",
  projectId: "lapak-alunalun",
  storageBucket: "lapak-alunalun.firebasestorage.app",
  messagingSenderId: "465227413068",
  appId: "1:465227413068:web:4641e234eaacf5946ae6e9"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
