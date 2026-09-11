/*
  customer.js
  -----------
  Semua tampilan & aksi untuk web PEMBELI:
  input/scan meja -> daftar toko -> menu -> keranjang -> bayar -> status pesanan (+ riwayat).
  Bergantung pada: state & go() dari app.js, sGet/sSet/sList/sDel dari storage.js,
  fungsi bantu & ikon dari utils.js, dan SELLER_SITE_URL dari site-config.js.
*/

let menuCache = {};
const CATS = [
  { id:'makanan', label:'Makanan', icon:'utensils' },
  { id:'minuman', label:'Minuman', icon:'cup-soda' },
  { id:'snack', label:'Snack', icon:'cookie' },
  { id:'lainnya', label:'Lainnya', icon:'sparkles' },
];
function catMeta(id){ return CATS.find(c => c.id === id) || {label:'Lainnya', icon:'utensils'}; }

/* ---------- bottom nav ---------- */
function bottomNav(active){
  return `<div class="tabbar tabbar-2">
    <button class="${active==='home'?'active':''}" onclick="go('cust-stores',{table:state.table})">${ic('home',20)}<span>Beranda</span></button>
    <button class="${active==='orders'?'active':''}" onclick="go('cust-orders')">${ic('receipt',20)}<span>Pesanan</span></button>
  </div>`;
}

/* ---------- halaman utama: input/scan nomor meja ---------- */
function viewCustTable(){
  return `
  <div class="hero-card">
    <div class="ic-circle" style="width:56px;height:56px;border-radius:50%;margin:0 auto 14px;color:var(--lantern);">${ic('store',30)}</div>
    <h1>LAPAK ALUN-ALUN</h1>
    <p>Pesan jajanan tanpa perlu<br>meninggalkan meja</p>
  </div>
  <div class="content">
    <div class="card">
      <h3 style="display:flex;align-items:center;gap:8px;">${ic('map-pin',17)} Lokasi Pesanan</h3>
      <div class="field" style="margin-top:10px;">
        <label>Nomor Meja</label>
        <input id="tableInput" type="number" min="1" max="30" placeholder="Masukkan nomor meja">
      </div>
      <p class="muted" style="margin:-6px 0 14px;display:flex;gap:6px;align-items:flex-start;">${ic('info',14)} <span>Scan QR di meja untuk mengisi otomatis.</span></p>
      <button class="btn btn-primary" onclick="submitTable()">Lanjutkan ${ic('arrow-right',16)}</button>
    </div>
    <div class="link-note">
      <p class="muted">Punya lapak?<br><a href="${SELLER_SITE_URL}" target="_blank">Masuk sebagai penjual →</a></p>
    </div>
  </div>`;
}
async function submitTable(){
  const v = document.getElementById('tableInput').value;
  if(!v || v < 1){ alert('Isi nomor meja dulu ya.'); return; }
  localStorage.setItem('lapak_table', v);
  go('cust-stores', {table:v});
  // minta izin lokasi belakangan, tidak menahan alur (opsional & senyap kalau ditolak)
  const loc = await getLocationOnce();
  if(loc) state.location = loc;
}

/* ---------- daftar toko, diurutkan dari yang terdekat ---------- */
async function renderCustStores(){
  const app = document.getElementById('app');
  app.innerHTML = `
  <div class="topbar"><button class="backbtn" onclick="go('cust-table')">${ic('arrow-left',18)}</button><div><h2>Pilih Lapak</h2><div class="sub">${ic('map-pin',12)} Meja ${state.table}</div></div></div>
  <div class="content">
    <div class="search-box">${ic('search',16)}<input id="storeSearch" placeholder="Cari makanan atau lapak..." oninput="filterStores()"></div>
    <div class="chip-row" id="storeChips"></div>
    <div class="section-title">Lapak di sekitar kamu</div>
    <div id="storeList"><div class="empty">Memuat toko…</div></div>
  </div>${bottomNav('home')}`;
  document.getElementById('storeChips').innerHTML =
    `<div class="chip active" onclick="pickStoreCat(this,'')">Semua</div>` +
    CATS.map(c => `<div class="chip" onclick="pickStoreCat(this,'${c.id}')">${ic(c.icon,14)} ${c.label}</div>`).join('');
  mountIcons();

  const keys = await sList('store:', true);
  const stores = (await Promise.all(keys.map(k => sGet(k, true)))).filter(Boolean);
  const totalTables = await getTotalTables();
  const withDist = stores.map(s => ({...s, _dist: circularDist(state.table, s.nearTable, totalTables)}));
  withDist.sort((a,b) => a._dist - b._dist);
  state._storesCache = withDist;
  state._storeCat = '';
  drawStoreList(withDist);
}
function pickStoreCat(el, cat){
  document.querySelectorAll('#storeChips .chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  state._storeCat = cat;
  filterStores();
}
function filterStores(){
  const q = (document.getElementById('storeSearch').value || '').toLowerCase();
  const cat = state._storeCat || '';
  let list = state._storesCache || [];
  if(cat) list = list.filter(s => (s.category||'') === cat);
  if(q) list = list.filter(s => (s.name||'').toLowerCase().includes(q) || (s.desc||'').toLowerCase().includes(q));
  drawStoreList(list);
}
function drawStoreList(stores){
  const el = document.getElementById('storeList');
  if(stores.length === 0){
    el.innerHTML = `<div class="empty">${ic('store',30)}<br>Belum ada toko yang cocok.<br>Ajak pedagang di sekitarmu untuk daftar lewat web penjual.</div>`;
    mountIcons();
    return;
  }
  el.innerHTML = stores.map((s,i) => {
    const isNearest = i === 0 && s._dist !== Infinity;
    let distLabel;
    if(s._dist === Infinity) distLabel = 'Lokasi toko belum ditandai';
    else if(s._dist === 0) distLabel = 'Tepat di sekitar mejamu';
    else distLabel = '≈ ' + s._dist + ' meja dari kamu';
    const thumb = s.photoURL ? `background-image:url('${s.photoURL}')` : '';
    return `
    <div class="store-card" onclick="openStore('${s.id}','${(s.name||'').replace(/'/g,"\\'")}')">
      <div class="store-thumb" style="${thumb}">${s.photoURL ? '' : ic(catMeta(s.category).icon, 24)}</div>
      <div class="store-info">
        <div class="row" style="align-items:flex-start;">
          <h3>${escapeHtml(s.name)}</h3>
          ${isNearest ? '<span class="badge badge-diproses">Terdekat</span>' : ''}
        </div>
        <div style="margin:2px 0 4px;">${ratingBadge(s)}</div>
        <p class="muted" style="margin:0 0 4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(s.desc || 'Belum ada deskripsi')}</p>
        <p class="faint" style="display:flex;align-items:center;gap:4px;">${ic('map-pin',11)} ${distLabel}</p>
      </div>
      <div class="store-arrow">${ic('chevron-right',18)}</div>
    </div>`;
  }).join('');
  mountIcons();
}
function openStore(id, name){
  state.cart = {};
  go('cust-menu', {storeId:id, storeName:name});
}

/* ---------- pilihan menu dari toko yang dipilih ---------- */
async function renderCustMenu(){
  const app = document.getElementById('app');
  const store = await sGet('store:' + state.storeId, true);
  state._menuStore = store;
  app.innerHTML = `
  <div class="topbar"><button class="backbtn" onclick="go('cust-stores',{table:state.table})">${ic('arrow-left',18)}</button><div><h2>${escapeHtml(state.storeName)}</h2><div class="sub">${ratingBadge(store)} · ${ic('map-pin',12)} Meja ${state.table}</div></div></div>
  <div class="content">
    <div class="search-box">${ic('search',16)}<input id="menuSearch" placeholder="Cari menu..." oninput="filterMenu()"></div>
    <div class="chip-row" id="menuChips"></div>
    <div class="section-title">Menu</div>
    <div id="menuList"><div class="empty">Memuat menu…</div></div>
  </div>`;
  document.getElementById('menuChips').innerHTML =
    `<div class="chip active" onclick="pickMenuCat(this,'')">Semua</div>` +
    CATS.map(c => `<div class="chip" onclick="pickMenuCat(this,'${c.id}')">${ic(c.icon,14)} ${c.label}</div>`).join('');
  mountIcons();

  const keys = await sList('menu:' + state.storeId + ':', true);
  const items = (await Promise.all(keys.map(k => sGet(k, true)))).filter(Boolean).filter(m => m.available !== false);
  items.forEach(m => { menuCache[m.id] = m; });
  state._menuCache = items;
  state._menuCat = '';
  drawMenuList(items);
  renderCartBar();
}
function pickMenuCat(el, cat){
  document.querySelectorAll('#menuChips .chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  state._menuCat = cat;
  filterMenu();
}
function filterMenu(){
  const q = (document.getElementById('menuSearch').value || '').toLowerCase();
  const cat = state._menuCat || '';
  let list = state._menuCache || [];
  if(cat) list = list.filter(m => m.category === cat);
  if(q) list = list.filter(m => (m.name||'').toLowerCase().includes(q));
  drawMenuList(list);
}
function drawMenuList(items){
  const el = document.getElementById('menuList');
  if(items.length === 0){
    el.innerHTML = `<div class="empty">${ic('utensils',30)}<br>Tidak ada menu yang cocok.</div>`;
    mountIcons();
    return;
  }
  el.innerHTML = items.map(m => {
    const qty = (state.cart[m.id] || {}).qty || 0;
    const thumb = m.photoURL ? `background-image:url('${m.photoURL}')` : '';
    return `<div class="menu-card">
      <div class="menu-thumb" style="${thumb}">${m.photoURL ? '' : ic(catMeta(m.category).icon, 24)}</div>
      <div class="menu-info">
        <div class="menu-name">${escapeHtml(m.name)}</div>
        <div class="menu-price">${rupiah(m.price)}</div>
      </div>
      <div class="menu-side" id="side-${m.id}">
        ${qty > 0 ? `<div class="qty-stepper"><button onclick="changeQty('${m.id}', -1)">−</button><span id="qty-${m.id}">${qty}</span><button onclick="changeQty('${m.id}', 1)">+</button></div>`
                   : `<button class="addbtn" onclick="changeQty('${m.id}', 1)">+</button>`}
      </div>
    </div>`;
  }).join('');
}

function changeQty(menuId, delta){
  const menu = menuCache[menuId];
  if(!menu) return;
  if(!state.cart[menuId]) state.cart[menuId] = {qty:0, menu};
  state.cart[menuId].qty = Math.max(0, state.cart[menuId].qty + delta);
  if(state.cart[menuId].qty === 0) delete state.cart[menuId];

  if(state.view === 'cust-cart'){ renderCustCart(); return; }
  const side = document.getElementById('side-' + menuId);
  if(side){
    const qty = state.cart[menuId] ? state.cart[menuId].qty : 0;
    side.innerHTML = qty > 0
      ? `<div class="qty-stepper"><button onclick="changeQty('${menuId}', -1)">−</button><span id="qty-${menuId}">${qty}</span><button onclick="changeQty('${menuId}', 1)">+</button></div>`
      : `<button class="addbtn" onclick="changeQty('${menuId}', 1)">+</button>`;
  }
  renderCartBar();
}

function renderCartBar(){
  let bar = document.getElementById('cartbar');
  const totalQty = Object.values(state.cart).reduce((a,c) => a + c.qty, 0);
  const totalPrice = Object.values(state.cart).reduce((a,c) => a + c.qty * (c.menu ? c.menu.price : 0), 0);
  if(!bar){
    bar = document.createElement('div');
    bar.id = 'cartbar';
    bar.className = 'cartbar';
    document.getElementById('app').appendChild(bar);
  }
  if(totalQty === 0){ bar.style.display = 'none'; return; }
  bar.style.display = 'flex';
  bar.innerHTML = `
    <div class="cartbar-ic">${ic('shopping-cart',18)}</div>
    <div class="cartbar-info" style="flex:1;">
      <span class="cartbar-qty">${totalQty} item</span>
      <span class="cartbar-price">${rupiah(totalPrice)}</span>
    </div>
    <button class="btn btn-primary" onclick="go('cust-cart')">Lihat</button>`;
  mountIcons();
}

/* ---------- keranjang ---------- */
function renderCustCart(){
  const app = document.getElementById('app');
  const entries = Object.entries(state.cart);
  const total = entries.reduce((a,[,c]) => a + c.qty * (c.menu ? c.menu.price : 0), 0);
  app.innerHTML = `
  <div class="topbar"><button class="backbtn" onclick="go('cust-menu',{storeId:state.storeId,storeName:state.storeName})">${ic('arrow-left',18)}</button><div><h2>Keranjang</h2><div class="sub">${escapeHtml(state.storeName)} · Meja ${state.table}</div></div></div>
  <div class="content">
    ${entries.length === 0 ? `<div class="empty">${ic('shopping-cart',30)}<br>Keranjang masih kosong.</div>` : `
    <div class="section-title">Pesanan kamu</div>
    ${entries.map(([id,c]) => `
      <div class="menu-card">
        <div class="menu-thumb" style="${c.menu.photoURL ? `background-image:url('${c.menu.photoURL}')` : ''}">${c.menu.photoURL ? '' : ic(catMeta(c.menu.category).icon,24)}</div>
        <div class="menu-info">
          <div class="menu-name">${escapeHtml(c.menu.name)}</div>
          <div class="menu-price">${rupiah(c.menu.price)} × ${c.qty}</div>
        </div>
        <div class="menu-side">
          <div class="qty-stepper"><button onclick="changeQty('${id}', -1)">−</button><span id="qty-${id}">${c.qty}</span><button onclick="changeQty('${id}', 1)">+</button></div>
        </div>
      </div>`).join('')}
    <div class="section-title">Detail Pembayaran</div>
    <div class="card">
      <div class="row" style="margin-bottom:8px;"><span class="muted">Subtotal</span><span>${rupiah(total)}</span></div>
      <div class="row" style="margin-bottom:8px;"><span class="muted">Biaya layanan</span><span>Rp0</span></div>
      <div class="row" style="padding-top:10px;border-top:1px solid var(--line);"><strong>TOTAL</strong><strong style="color:var(--lantern);">${rupiah(total)}</strong></div>
    </div>
    <button class="btn btn-primary" onclick="go('cust-checkout')">Lanjut Bayar ${ic('arrow-right',16)}</button>
    `}
  </div>`;
  mountIcons();
}

/* ---------- checkout / bayar ---------- */
async function renderCustCheckout(){
  const app = document.getElementById('app');
  const entries = Object.entries(state.cart);
  const total = entries.reduce((a,[,c]) => a + c.qty * (c.menu ? c.menu.price : 0), 0);
  const store = await sGet('store:' + state.storeId, true);
  state._checkoutStore = store;
  state._pm = state._pm || 'tunai';
  const hasQris = !!(store && (store.qrisPayload || store.qrisImage));
  app.innerHTML = `
  <div class="topbar"><button class="backbtn" onclick="go('cust-cart')">${ic('arrow-left',18)}</button><div><h2>Pembayaran</h2><div class="sub">Total ${rupiah(total)}</div></div></div>
  <div class="content">
    <div class="section-title">Pilih metode pembayaran</div>
    <div id="pmTunai" class="paymethod selected" onclick="choosePM('tunai')">
      <div class="pm-ic">${ic('banknote',20)}</div>
      <div class="pm-info"><div class="pm-title">Tunai</div><div class="pm-sub">Bayar saat pesanan diantar</div></div>
      <div class="pm-check">${ic('check',13)}</div>
    </div>
    <div id="pmQris" class="paymethod ${hasQris ? '' : 'disabled'}" onclick="${hasQris ? "choosePM('qris')" : ''}">
      <div class="pm-ic">${ic('qr-code',20)}</div>
      <div class="pm-info">
        <div class="pm-title">QRIS</div>
        <div class="pm-sub">${hasQris ? 'Satu kode, semua e-wallet & m-banking' : 'Belum tersedia dari toko ini'}</div>
        ${hasQris ? `<div class="wallet-row"><span class="wallet-chip">GoPay</span><span class="wallet-chip">OVO</span><span class="wallet-chip">DANA</span><span class="wallet-chip">ShopeePay</span><span class="wallet-chip">m-Banking</span></div>` : ''}
      </div>
      <div class="pm-check">${ic('check',13)}</div>
    </div>

    <div id="qrisArea"></div>

    <div class="section-title">Detail Pesanan</div>
    <div class="card">
      <div class="row" style="margin-bottom:8px;"><span class="muted">Meja</span><strong>No. ${state.table}</strong></div>
      <div class="row" style="margin-bottom:8px;"><span class="muted">Lapak</span><strong>${escapeHtml(state.storeName)}</strong></div>
      <div class="row" style="padding-top:8px;border-top:1px solid var(--line);"><span class="muted">Total</span><strong style="color:var(--lantern);">${rupiah(total)}</strong></div>
    </div>
    <button class="btn btn-primary" id="payBtn" onclick="confirmPay()">Bayar Sekarang</button>
  </div>`;
  mountIcons();
}
function choosePM(pm){
  state._pm = pm;
  document.getElementById('pmTunai').classList.toggle('selected', pm === 'tunai');
  document.getElementById('pmQris').classList.toggle('selected', pm === 'qris');
  const area = document.getElementById('qrisArea');
  const entries = Object.entries(state.cart);
  const total = entries.reduce((a,[,c]) => a + c.qty * (c.menu ? c.menu.price : 0), 0);
  const store = state._checkoutStore;
  if(pm === 'qris' && store){
    if(store.qrisPayload){
      const dyn = buildDynamicQRIS(store.qrisPayload, total);
      const imgUrl = dyn ? qrEncodeURL(dyn, 320) : store.qrisImage;
      area.innerHTML = `<div class="qris-box">
        <img src="${imgUrl}" alt="QRIS ${escapeHtml(store.name)}">
        <div class="qris-amount">${rupiah(total)}</div>
        <div class="qris-store">Nominal sudah otomatis terisi · scan pakai GoPay/OVO/DANA/ShopeePay/m-banking apa pun</div>
      </div>`;
    } else if(store.qrisImage){
      area.innerHTML = `<div class="qris-box">
        <img src="${store.qrisImage}" alt="QRIS ${escapeHtml(store.name)}">
        <div class="qris-amount">${rupiah(total)}</div>
        <div class="qris-store">Cocokkan nominal saat bayar manual · ${escapeHtml(store.name)}</div>
      </div>`;
    } else { area.innerHTML = ''; }
  } else {
    area.innerHTML = '';
  }
  mountIcons();
}

async function confirmPay(){
  const pm = state._pm || 'tunai';
  const entries = Object.entries(state.cart);
  if(entries.length === 0){ alert('Keranjang kosong.'); return; }
  const total = entries.reduce((a,[,c]) => a + c.qty * (c.menu ? c.menu.price : 0), 0);
  const orderId = genId();
  const order = {
    id: orderId,
    table: state.table,
    storeId: state.storeId,
    storeName: state.storeName,
    items: entries.map(([id,c]) => ({id, name:c.menu.name, price:c.menu.price, qty:c.qty})),
    total,
    paymentMethod: pm,
    paymentStatus: pm === 'qris' ? 'lunas' : 'bayar_ditempat',
    status: 'pending',
    location: state.location || null,
    createdAt: Date.now()
  };
  const btn = document.getElementById('payBtn');
  if(btn){ btn.textContent = 'Memproses…'; btn.disabled = true; }
  await sSet('order:' + orderId, order, true);
  state.cart = {};
  rememberOrder(orderId);
  go('cust-order', {orderId});
}

/* ---------- status pesanan (gabungan struk + lacak, auto-refresh) ---------- */
async function renderCustOrder(){
  const app = document.getElementById('app');
  async function draw(){
    const order = await sGet('order:' + state.orderId, true);
    if(!order){
      app.innerHTML = `
      <div class="topbar"><button class="backbtn" onclick="go('cust-orders')">${ic('arrow-left',18)}</button><div><h2>Status Pesanan</h2></div></div>
      <div class="content"><div class="empty">${ic('alert-triangle',30)}<br>Pesanan tidak ditemukan. Mungkin sudah lama atau tautannya salah.</div>
      <button class="btn btn-outline" onclick="go('cust-orders')">Lihat Pesanan Lain</button></div>`;
      mountIcons();
      stopTracking();
      return;
    }
    if(order.status === 'selesai' || order.status === 'dibatalkan'){
      if(getActiveOrderId() === order.id) clearActiveOrder();
    }
    const idx = STATUS_FLOW.indexOf(order.status);
    const canceled = order.status === 'dibatalkan';
    const iconByStatus = {pending:'clock', diproses:'utensils', diantar:'truck', selesai:'check-circle-2', dibatalkan:'x-circle'};
    const descByStatus = {
      pending:'Pesananmu sedang menunggu dikonfirmasi oleh lapak.',
      diproses:'Lapak sedang menyiapkan pesananmu.',
      diantar:'Pesanan dalam perjalanan ke mejamu.',
      selesai:'Pesanan sudah sampai. Selamat menikmati!',
      dibatalkan:'Pesanan ini sudah dibatalkan.'
    };
    app.innerHTML = `
    <div class="topbar"><button class="backbtn" onclick="go('cust-orders')">${ic('arrow-left',18)}</button><div><h2>Status Pesanan</h2><div class="sub">#${order.id.toUpperCase()}</div></div></div>
    <div class="content">
      <div class="status-hero">
        <div class="status-ic st-${order.status}">${ic(iconByStatus[order.status] || 'clock', 32)}</div>
        <h2>${STATUS_LABEL[order.status]}</h2>
        <p>${descByStatus[order.status]}</p>
      </div>

      ${!canceled ? `
      <div class="card">
        <div class="track">
          ${STATUS_FLOW.map((s,i) => `<div class="tstep ${i<=idx?'done':''}"><div class="dot">${i<=idx ? ic('check',13) : (i+1)}</div><p>${STATUS_LABEL[s]}</p></div>`).join('')}
        </div>
      </div>` : ''}

      <div class="card">
        <div class="row" style="margin-bottom:6px;"><strong>${escapeHtml(order.storeName)}</strong><span class="muted">Meja ${order.table}</span></div>
        <div class="dashed" style="border-top:1px solid var(--line);margin:8px 0;"></div>
        ${order.items.map(it => `<div class="rline muted" style="display:flex;justify-content:space-between;"><span>${it.qty}× ${escapeHtml(it.name)}</span><span>${rupiah(it.price*it.qty)}</span></div>`).join('')}
        <div class="dashed" style="border-top:1px solid var(--line);margin:8px 0;"></div>
        <div class="row"><strong>Total</strong><strong style="color:var(--lantern);">${rupiah(order.total)}</strong></div>
        <div class="row" style="margin-top:6px;"><span class="muted">Pembayaran</span><span class="badge badge-${order.paymentStatus}">${order.paymentMethod === 'qris' ? 'QRIS' : 'Tunai'} ${order.paymentStatus === 'lunas' ? '· Lunas' : '· Di tempat'}</span></div>
      </div>

      ${order.status === 'pending' ? `
      <button class="btn btn-danger" onclick="cancelOrder('${order.id}')">${ic('x-circle',16)} Batalkan Pesanan</button>
      <p class="faint" style="text-align:center;margin-top:8px;">Bisa dibatalkan selama lapak belum mulai menyiapkan.</p>
      ` : ''}

      ${order.status === 'selesai' && !order.ratingSubmitted ? `
      <div class="card" style="text-align:center;">
        <h3>Beri Rating Lapak Ini</h3>
        <p class="muted">Bagaimana pesananmu dari ${escapeHtml(order.storeName)}?</p>
        <div class="rate-picker" id="ratePicker">
          ${[1,2,3,4,5].map(n => `<button onclick="setRateHover(${n})" data-star="${n}">${starIcon(false,26)}</button>`).join('')}
        </div>
        <button class="btn btn-primary" id="submitRateBtn" onclick="submitRating('${order.id}','${order.storeId}')" disabled>Kirim Rating</button>
      </div>` : ''}
      ${order.status === 'selesai' && order.ratingSubmitted ? `<div class="card" style="text-align:center;">${renderStars(order.ratingValue, 20)}<p class="muted" style="margin-top:6px;">Terima kasih atas rating kamu!</p></div>` : ''}

      <div style="height:6px;"></div>
      <button class="btn btn-outline" onclick="go('cust-menu',{storeId:order.storeId,storeName:order.storeName})">Pesan Lagi dari Lapak Ini</button>
    </div>`;
    mountIcons();
  }
  await draw();
  stopTracking();
  state.trackInterval = setInterval(draw, 4000);
}

let _rateValue = 0;
function setRateHover(n){
  _rateValue = n;
  document.querySelectorAll('#ratePicker button').forEach(b => {
    const s = Number(b.dataset.star);
    b.innerHTML = starIcon(s <= n, 26);
    b.classList.toggle('active', s <= n);
  });
  document.getElementById('submitRateBtn').disabled = false;
}
async function submitRating(orderId, storeId){
  if(!_rateValue) return;
  const order = await sGet('order:' + orderId, true);
  if(!order || order.ratingSubmitted) return;
  order.ratingSubmitted = true;
  order.ratingValue = _rateValue;
  await sSet('order:' + orderId, order, true);
  const store = await sGet('store:' + storeId, true);
  if(store){
    store.ratingSum = (store.ratingSum || 0) + _rateValue;
    store.ratingCount = (store.ratingCount || 0) + 1;
    await sSet('store:' + storeId, store, true);
  }
  _rateValue = 0;
  go('cust-order', {orderId});
}

async function cancelOrder(orderId){
  if(!confirm('Batalkan pesanan ini? Tindakan ini tidak bisa dibatalkan lagi.')) return;
  const order = await sGet('order:' + orderId, true);
  if(!order || order.status !== 'pending'){ alert('Pesanan sudah mulai diproses dan tidak bisa dibatalkan lagi.'); go('cust-order',{orderId}); return; }
  order.status = 'dibatalkan';
  await sSet('order:' + orderId, order, true);
  clearActiveOrder();
  go('cust-order', {orderId});
}

/* ---------- daftar riwayat pesanan (tab "Pesanan") ---------- */
async function renderCustOrdersList(){
  const app = document.getElementById('app');
  const ids = getOrderHistory();
  app.innerHTML = `
  <div class="topbar"><div><h2>Pesanan Saya</h2><div class="sub">Riwayat pesanan di perangkat ini</div></div></div>
  <div class="content" id="ordersListContent"><div class="empty">Memuat…</div></div>
  ${bottomNav('orders')}`;
  mountIcons();

  if(ids.length === 0){
    document.getElementById('ordersListContent').innerHTML = `<div class="empty">${ic('receipt',30)}<br>Belum ada pesanan dari perangkat ini.</div>
    <button class="btn btn-primary" onclick="go('cust-table')">Mulai Pesan</button>`;
    mountIcons();
    return;
  }
  const orders = (await Promise.all(ids.map(id => sGet('order:' + id, true)))).filter(Boolean);
  const iconByStatus = {pending:'clock', diproses:'utensils', diantar:'truck', selesai:'check-circle-2', dibatalkan:'x-circle'};
  document.getElementById('ordersListContent').innerHTML = orders.map(o => `
    <div class="order-list-card" onclick="go('cust-order',{orderId:'${o.id}'})">
      <div class="ol-ic">${ic(iconByStatus[o.status] || 'clock', 20)}</div>
      <div class="ol-info">
        <h3>${escapeHtml(o.storeName)}</h3>
        <p class="muted" style="margin:0;">${o.items.length} item · ${rupiah(o.total)} · Meja ${o.table}</p>
      </div>
      <span class="badge badge-${o.status}">${STATUS_LABEL[o.status]}</span>
    </div>`).join('');
  mountIcons();
}
