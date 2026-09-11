// ======================================================================
// Fungsi bantu bersama (dipakai oleh customer.js, seller.js, admin.js)
// File: utils.js
// ======================================================================

const STATUS_FLOW = ['pending','diproses','diantar','selesai'];
const STATUS_LABEL = {
  pending:'Menunggu Konfirmasi',
  diproses:'Sedang Disiapkan',
  diantar:'Diantar ke Meja',
  selesai:'Selesai',
  dibatalkan:'Dibatalkan'
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

function circularDist(a, b, total){
  a = Number(a); b = Number(b);
  if(!a || !b) return Infinity;
  const diff = Math.abs(a - b);
  return Math.min(diff, total - diff);
}

function togglePwd(id, btn){
  const input = document.getElementById(id);
  if(!input) return;
  if(input.type === 'password'){ input.type = 'text'; btn.setAttribute('data-lucide','eye-off'); }
  else { input.type = 'password'; btn.setAttribute('data-lucide','eye'); }
  mountIcons();
}

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

/* ======================================================================
   IKON (pengganti emoji)
   ----------------------
   Semua ikon pakai library Lucide (dimuat lewat CDN di index.html sebagai
   variabel global "lucide"). ic('nama-ikon') menghasilkan tag <i> yang
   akan diubah otomatis jadi SVG. WAJIB panggil mountIcons() setiap habis
   mengganti innerHTML, supaya ikon yang baru ditambahkan ikut digambar.
   ====================================================================== */
function ic(name, size){
  size = size || 18;
  return `<i data-lucide="${name}" style="width:${size}px;height:${size}px;vertical-align:-4px;"></i>`;
}
function mountIcons(){
  if(window.lucide && typeof lucide.createIcons === 'function'){
    try{ lucide.createIcons(); }catch(e){ /* abaikan */ }
  }
}
// bintang rating: SVG mandiri (bukan lewat lucide) supaya bisa terisi penuh dengan warna.
function starIcon(filled, size){
  size = size || 14;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.6"><path d="M12 2.5l2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.5l-6.2 3.9 1.6-7-5.4-4.7 7.1-.6z" stroke-linejoin="round"/></svg>`;
}
function renderStars(rating, size){
  rating = Number(rating) || 0;
  let out = '<span class="stars">';
  for(let i = 1; i <= 5; i++){
    out += `<span style="color:${i <= Math.round(rating) ? 'var(--lantern)' : 'var(--text-faint)'};">${starIcon(i <= Math.round(rating), size)}</span>`;
  }
  out += '</span>';
  return out;
}
function ratingBadge(store){
  const count = store && store.ratingCount ? store.ratingCount : 0;
  if(count === 0) return `<span class="rating-badge muted">${starIcon(false,13)} Belum ada rating</span>`;
  const avg = (store.ratingSum / count).toFixed(1);
  return `<span class="rating-badge"><span style="color:var(--lantern);">${starIcon(true,13)}</span> ${avg} <span class="faint">(${count})</span></span>`;
}

/* ======================================================================
   FOTO
   ====================================================================== */
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

/* ======================================================================
   QRIS DINAMIS
   ------------
   QRIS Indonesia memakai format standar EMV QR Code. Satu kode QRIS
   STATIS (yang biasa dicetak & ditempel toko) bisa "disisipi" nominal
   supaya jadi QRIS DINAMIS dengan nominal otomatis terisi -- dan tetap
   bisa dipindai oleh GoPay, OVO, DANA, ShopeePay, LinkAja, atau m-banking
   apa pun, karena semuanya mengikuti standar yang sama. Ini teknik umum
   yang dipakai banyak alat "konversi QRIS statis ke dinamis" open-source.
   Kita TIDAK memproses uangnya sendiri -- pembayaran tetap lewat jalur
   bank/e-wallet pembeli seperti biasa, kita cuma menyusun ulang kode QR-nya.
   ====================================================================== */
function crc16ccitt(str){
  let crc = 0xFFFF;
  for(let i = 0; i < str.length; i++){
    crc ^= (str.charCodeAt(i) << 8);
    for(let j = 0; j < 8; j++){
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
      crc &= 0xFFFF;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}
function qrisFindTag(payload, tag){
  // Cari tag 2-digit di payload EMV QR (format TAG-LEN-VALUE), kembalikan {start,len,value} atau null.
  let i = 0;
  while(i < payload.length - 4){
    const t = payload.substr(i, 2);
    const len = parseInt(payload.substr(i+2, 2), 10);
    if(isNaN(len)) break;
    const value = payload.substr(i+4, len);
    if(t === tag) return { start:i, len, value, fullLen: 4 + len };
    i += 4 + len;
  }
  return null;
}
function qrisRemoveTag(payload, tag){
  const found = qrisFindTag(payload, tag);
  if(!found) return payload;
  return payload.slice(0, found.start) + payload.slice(found.start + found.fullLen);
}
function qrisSetTag(payload, tag, value){
  const lenStr = String(value.length).padStart(2, '0');
  const segment = tag + lenStr + value;
  const found = qrisFindTag(payload, tag);
  if(found){
    return payload.slice(0, found.start) + segment + payload.slice(found.start + found.fullLen);
  }
  // Tag amount (54) idealnya disisipkan sebelum tag currency (53) / country (58).
  const before = qrisFindTag(payload, '53') || qrisFindTag(payload, '58');
  if(before) return payload.slice(0, before.start) + segment + payload.slice(before.start);
  return payload + segment;
}
/*
  buildDynamicQRIS(staticPayload, amount)
  ------------------------------------------
  Ambil teks payload QRIS statis (hasil pindai gambar QRIS toko), sisipkan
  nominal transaksi, tandai sebagai QR dinamis (tag 01 = 12), lalu hitung
  ulang CRC (tag 63) sesuai aturan. Hasilnya teks QRIS baru yang siap
  digambar ulang jadi gambar QR.
*/
function buildDynamicQRIS(staticPayload, amount){
  try{
    let p = staticPayload.trim();
    p = qrisRemoveTag(p, '63'); // buang CRC lama, akan dihitung ulang di akhir
    p = qrisSetTag(p, '01', '12'); // 11 = statis, 12 = dinamis (nominal tetap)
    p = qrisSetTag(p, '54', String(Math.round(amount)));
    p = p + '6304'; // tag+len CRC, isi CRC menyusul
    const crc = crc16ccitt(p);
    return p + crc;
  }catch(e){
    console.error('buildDynamicQRIS error:', e);
    return null;
  }
}
/*
  decodeQRISFromFile(file)
  ---------------------------
  Baca gambar QRIS yang diunggah penjual, kembalikan teks payload-nya
  (pakai library jsQR yang dimuat di index.html web penjual). Kembalikan
  null kalau gagal terbaca (misalnya foto buram) -- fitur nominal otomatis
  jadi tidak aktif, tapi gambar tetap bisa dipakai sebagai QRIS statis biasa.
*/
function decodeQRISFromFile(file){
  return new Promise((resolve) => {
    if(typeof jsQR !== 'function'){ resolve(null); return; }
    const img = new Image();
    const reader = new FileReader();
    reader.onload = e => { img.src = e.target.result; };
    reader.onerror = () => resolve(null);
    img.onload = () => {
      try{
        const canvas = document.createElement('canvas');
        canvas.width = img.width; canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const result = jsQR(imgData.data, canvas.width, canvas.height);
        resolve(result ? result.data : null);
      }catch(err){ resolve(null); }
    };
    img.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}
function qrEncodeURL(text, size){
  size = size || 300;
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=` + encodeURIComponent(text);
}

/* ======================================================================
   LOKASI (opsional, izin GPS browser)
   ------------------------------------
   Karena Lapak Alun-Alun berada di ruang terbuka, GPS ponsel cukup akurat
   untuk sekadar menandai "pembeli kira-kira di titik mana". Ini SELALU
   opsional -- kalau pembeli menolak izin lokasi, alur pesan tetap jalan
   normal pakai nomor meja saja.
   ====================================================================== */
function getLocationOnce(timeoutMs){
  return new Promise((resolve) => {
    if(!navigator.geolocation){ resolve(null); return; }
    const timer = setTimeout(() => resolve(null), timeoutMs || 6000);
    navigator.geolocation.getCurrentPosition(
      pos => { clearTimeout(timer); resolve({lat:pos.coords.latitude, lng:pos.coords.longitude}); },
      () => { clearTimeout(timer); resolve(null); },
      { enableHighAccuracy:true, timeout: timeoutMs || 6000, maximumAge: 60000 }
    );
  });
}
function mapsLink(loc){
  if(!loc) return null;
  return `https://www.google.com/maps?q=${loc.lat},${loc.lng}`;
}

/* ======================================================================
   PENYIMPANAN LOKAL PEMBELI (per perangkat, bukan data bersama)
   ------------------------------------------------------------
   Dipakai supaya pembeli tidak "hilang arah" balik ke halaman input meja
   setelah checkout -- riwayat & pesanan aktif diingat di HP itu sendiri.
   ====================================================================== */
function lsGetJSON(key, fallback){
  try{ const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch(e){ return fallback; }
}
function lsSetJSON(key, val){
  try{ localStorage.setItem(key, JSON.stringify(val)); }catch(e){}
}
function rememberOrder(orderId){
  const list = lsGetJSON('lapak_order_history', []);
  if(!list.includes(orderId)) list.unshift(orderId);
  lsSetJSON('lapak_order_history', list.slice(0, 30));
  localStorage.setItem('lapak_active_order', orderId);
}
function getOrderHistory(){
  return lsGetJSON('lapak_order_history', []);
}
function clearActiveOrder(){
  localStorage.removeItem('lapak_active_order');
}
function getActiveOrderId(){
  return localStorage.getItem('lapak_active_order');
}
