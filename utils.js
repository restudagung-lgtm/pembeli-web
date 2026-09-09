// ======================================================================
// 🟢 WEB PEMBELI  (folder: pembeli/)
// File: utils.js
// ======================================================================

/*
  utils.js
  --------
  Fungsi bantu kecil yang dipakai bersama oleh customer.js dan seller.js.
  Tidak ada logika tampilan/alur di sini, murni fungsi bantu.
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

