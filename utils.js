// ======================================================================
// Fungsi bantu bersama (dipakai oleh customer.js, seller.js, admin.js)
// File: utils.js
// ======================================================================

/*
  utils.js
  --------
  Fungsi bantu kecil yang dipakai bersama. Tidak ada logika tampilan/alur
  di sini, murni fungsi bantu.
*/

const STATUS_FLOW = ['pending','diproses','diantar','selesai'];
const STATUS_LABEL = {
  pending:'Menunggu Konfirmasi',
  diproses:'Sedang Disiapkan',
  diantar:'Diantar ke Meja',
  selesai:'Selesai'
};

function genId(){
  return Date.now().toString(36) + Math.random().toString(36).slice(2,7);
}

function rupiah(n){
  return 'Rp' + Number(n||0).toLocaleString('id-ID');
}

function escapeHtml(s){
  return (s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

async function getTotalTables(){
  const cfg = await sGet('config:totalTables', true);
  return (cfg && cfg.total) ? cfg.total : 16;
}

// Jarak antar dua nomor meja, dihitung melingkar mengikuti bentuk alun-alun
// (dipakai untuk mengurutkan lapak dari yang terdekat, tanpa perlu GPS).
function circularDist(a, b, total){
  a = Number(a); b = Number(b);
  if(!a || !b) return Infinity;
  const diff = Math.abs(a - b);
  return Math.min(diff, total - diff);
}

// Toggle input password antara tersembunyi (••••) dan terlihat (teks biasa).
// Dipakai lewat markup: <div class="pwd-wrap"><input .../><button class="pwd-toggle" onclick="togglePwd('id', this)">Lihat</button></div>
function togglePwd(id, btn){
  const input = document.getElementById(id);
  if(!input) return;
  if(input.type === 'password'){
    input.type = 'text';
    btn.textContent = 'Sembunyikan';
  } else {
    input.type = 'password';
    btn.textContent = 'Lihat';
  }
}

// Menggambar denah alun-alun sederhana dengan meja-meja tersusun melingkar,
// menyorot satu nomor meja tertentu.
function tableMapSVG(highlight, total){
  total = total || 16;
  const w = 280, h = 200, cx = w/2, cy = h/2, rx = 110, ry = 72;
  let dots = '';
  for(let i = 0; i < total; i++){
    const angle = (i/total) * 2 * Math.PI - Math.PI/2;
    const x = cx + rx * Math.cos(angle);
    const y = cy + ry * Math.sin(angle);
    const n = i + 1;
    const active = n === Number(highlight);
    dots += `<g>
      <circle cx="${x}" cy="${y}" r="${active?13:10}" fill="${active?'#D1502F':'#39445570'}" stroke="${active?'#EFA23B':'#43536633'}" stroke-width="${active?2.5:1}"/>
      <text x="${x}" y="${y+4}" font-size="${active?11:9}" text-anchor="middle" fill="${active?'#FBF1DE':'#A9B4C2'}" font-family="sans-serif" font-weight="${active?'700':'400'}">${n}</text>
    </g>`;
  }
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="auto" xmlns="http://www.w3.org/2000/svg">
    <rect x="20" y="14" width="${w-40}" height="${h-28}" rx="18" fill="none" stroke="#43536655" stroke-dasharray="4 5"/>
    <text x="${cx}" y="${cy+3}" text-anchor="middle" font-size="10" fill="#66738355" font-family="sans-serif">ALUN-ALUN</text>
    ${dots}
  </svg>`;
}

/*
  resizeImageToBlob(file, maxDim, quality)
  -----------------------------------------
  Ambil file foto dari <input type="file">, kecilkan ke maksimum "maxDim" px
  di sisi terpanjang, lalu kembalikan sebagai Blob JPEG terkompresi. Dipakai
  sebelum unggah supaya foto tidak berat & cepat dimuat di HP pembeli.
*/
function resizeImageToBlob(file, maxDim, quality){
  maxDim = maxDim || 1000;
  quality = quality || 0.78;
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = e => { img.src = e.target.result; };
    reader.onerror = reject;
    img.onload = () => {
      let { width, height } = img;
      if(width > height && width > maxDim){ height = Math.round(height * (maxDim/width)); width = maxDim; }
      else if(height > maxDim){ width = Math.round(width * (maxDim/height)); height = maxDim; }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Gagal memproses gambar')), 'image/jpeg', quality);
    };
    img.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/*
  previewImageInput(inputEl, imgElId)
  -------------------------------------
  Tampilkan pratinjau langsung saat pengguna memilih file foto, dengan
  menempelkan data URL ke elemen <img id="imgElId">. Murni untuk UX di form.
*/
function previewImageInput(inputEl, imgElId){
  const file = inputEl.files && inputEl.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const img = document.getElementById(imgElId);
    if(img){ img.src = e.target.result; img.style.display = 'block'; }
  };
  reader.readAsDataURL(file);
}

/*
  downloadImageURL(url, filename)
  ---------------------------------
  Unduh gambar dari sebuah URL (misalnya QR code) sebagai file ke perangkat
  pengguna. Coba lewat fetch+blob dulu (biar langsung ke folder unduhan
  dengan nama file yang rapi); kalau gagal (CORS dsb), buka di tab baru
  sebagai jalan keluar supaya pengguna tetap bisa simpan manual.
*/
async function downloadImageURL(url, filename){
  try{
    const res = await fetch(url, { mode:'cors' });
    if(!res.ok) throw new Error('fetch gagal');
    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objUrl; a.download = filename || 'qr.png';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(objUrl), 4000);
  }catch(e){
    window.open(url, '_blank');
  }
}
