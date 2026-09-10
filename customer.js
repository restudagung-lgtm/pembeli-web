/*
  customer.js
  -----------
  Semua tampilan & aksi untuk web PEMBELI (situs berdiri sendiri):
  input/scan meja -> daftar toko -> menu -> keranjang -> bayar -> struk -> lacak status.
  Bergantung pada: state & go() dari app.js, sGet/sSet/sList/sDel dari storage.js,
  fungsi bantu dari utils.js, dan SELLER_SITE_URL dari site-config.js.
*/

let menuCache = {};
const CATS = [
  { id:'makanan', label:'🍔 Makanan' },
  { id:'minuman', label:'🥤 Minuman' },
  { id:'snack', label:'🍟 Snack' },
  { id:'lainnya', label:'✨ Lainnya' },
];
function catLabel(id){ const c = CATS.find(c => c.id === id); return c ? c.label.replace(/^\S+\s/, '') : 'Lainnya'; }
function catEmoji(id){ const c = CATS.find(c => c.id === id); return c ? c.label.split(' ')[0] : '🍽️'; }

/* ---------- halaman utama: input/scan nomor meja ---------- */
function viewCustTable(){
  return `
  <div class="hero-card">
    <div class="lamp">🏮</div>
    <h1>LAPAK ALUN-ALUN</h1>
    <p>Pesan jajanan tanpa perlu<br>meninggalkan meja</p>
  </div>
  <div class="content">
    <div class="card">
      <h3>📍 Lokasi Pesanan</h3>
      <div class="field" style="margin-top:10px;">
        <label>Nomor Meja</label>
        <input id="tableInput" type="number" min="1" max="30" placeholder="🪑 Masukkan nomor meja">
      </div>
      <p class="muted" style="margin:-6px 0 14px;">ℹ️ Scan QR di meja untuk mengisi otomatis.</p>
      <button class="btn btn-primary" onclick="submitTable()">Lanjutkan →</button>
    </div>
    <div class="link-note">
      <p class="muted">Punya lapak?<br><a href="${SELLER_SITE_URL}" target="_blank">Masuk sebagai penjual →</a></p>
    </div>
  </div>`;
}
function submitTable(){
  const v = document.getElementById('tableInput').value;
  if(!v || v < 1){ alert('Isi nomor meja dulu ya.'); return; }
  go('cust-stores', {table:v});
}

/* ---------- daftar toko, diurutkan dari yang terdekat ---------- */
async function renderCustStores(){
  const app = document.getElementById('app');
  app.innerHTML = `
  <div class="topbar"><button class="backbtn" onclick="go('cust-table')">←</button><div><h2>Pilih Lapak</h2><div class="sub">📍 Meja ${state.table}</div></div></div>
  <div class="content">
    <div class="search-box"><span class="ic">🔍</span><input id="storeSearch" placeholder="Cari makanan atau lapak..." oninput="filterStores()"></div>
    <div class="chip-row" id="storeChips"></div>
    <div class="section-title">Lapak di sekitar kamu</div>
    <div id="storeList"><div class="empty">Memuat toko…</div></div>
  </div>`;
  document.getElementById('storeChips').innerHTML =
    `<div class="chip active" data-cat="" onclick="pickStoreCat(this,'')">Semua</div>` +
    CATS.map(c => `<div class="chip" data-cat="${c.id}" onclick="pickStoreCat(this,'${c.id}')">${c.label}</div>`).join('');

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
    el.innerHTML = `<div class="empty"><span class="empty-ic">🏮</span>Belum ada toko yang cocok.<br>Ajak pedagang di sekitarmu untuk daftar lewat web penjual.</div>`;
    return;
  }
  el.innerHTML = stores.map((s,i) => {
    const isNearest = i === 0 && s._dist !== Infinity;
    let distLabel;
    if(s._dist === Infinity) distLabel = 'Lokasi toko belum ditandai';
    else if(s._dist === 0) distLabel = 'Tepat di sekitar mejamu';
    else distLabel = '≈ ' + s._dist + ' meja dari kamu';
    const thumb = s.photoURL
      ? `background-image:url('${s.photoURL}')`
      : '';
    return `
    <div class="store-card" onclick="openStore('${s.id}','${(s.name||'').replace(/'/g,"\\'")}')">
      <div class="store-thumb" style="${thumb}">${s.photoURL ? '' : (catEmoji(s.category)||'🏮')}</div>
      <div class="store-info">
        <div class="row" style="align-items:flex-start;">
          <h3>${escapeHtml(s.name)}</h3>
          ${isNearest ? '<span class="badge badge-diproses">Terdekat</span>' : ''}
        </div>
        <p class="muted" style="margin:0 0 4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(s.desc || 'Belum ada deskripsi')}</p>
        <p class="faint">📍 ${distLabel}</p>
      </div>
      <div class="store-arrow">→</div>
    </div>`;
  }).join('');
}
function openStore(id, name){
  state.cart = {};
  go('cust-menu', {storeId:id, storeName:name});
}

/* ---------- pilihan menu dari toko yang dipilih ---------- */
async function renderCustMenu(){
  const app = document.getElementById('app');
  app.innerHTML = `
  <div class="topbar"><button class="backbtn" onclick="go('cust-stores',{table:state.table})">←</button><div><h2>${escapeHtml(state.storeName)}</h2><div class="sub">📍 Meja ${state.table}</div></div></div>
  <div class="content">
    <div class="search-box"><span class="ic">🔍</span><input id="menuSearch" placeholder="Cari menu..." oninput="filterMenu()"></div>
    <div class="chip-row" id="menuChips"></div>
    <div class="section-title">Menu</div>
    <div id="menuList"><div class="empty">Memuat menu…</div></div>
  </div>`;
  const keys = await sList('menu:' + state.storeId + ':', true);
  const items = (await Promise.all(keys.map(k => sGet(k, true)))).filter(Boolean).filter(m => m.available !== false);
  items.forEach(m => { menuCache[m.id] = m; });
  state._menuCache = items;
  state._menuCat = '';

  const cats = [...new Set(items.map(m => m.category).filter(Boolean))];
  document.getElementById('menuChips').innerHTML = cats.length ? (
    `<div class="chip active" data-cat="" onclick="pickMenuCat(this,'')">Semua</div>` +
    cats.map(c => `<div class="chip" data-cat="${c}" onclick="pickMenuCat(this,'${c}')">${catLabel(c)}</div>`).join('')
  ) : '';

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
    el.innerHTML = `<div class="empty"><span class="empty-ic">🍽️</span>Toko ini belum menambahkan menu.</div>`;
    return;
  }
  el.innerHTML = items.map(m => {
    const qty = (state.cart[m.id] || {}).qty || 0;
    const thumb = m.photoURL ? `background-image:url('${m.photoURL}')` : '';
    return `<div class="menu-card">
      <div class="menu-thumb" style="${thumb}">${m.photoURL ? '' : (catEmoji(m.category)||'🍽️')}</div>
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

  if(state.view === 'cust-cart'){
    renderCustCart();
    return;
  }
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
    <div class="cartbar-ic">🛒</div>
    <div class="cartbar-info" style="flex:1;">
      <span class="cartbar-qty">${totalQty} item</span>
      <span class="cartbar-price">${rupiah(totalPrice)}</span>
    </div>
    <button class="btn btn-primary" onclick="go('cust-cart')">Lihat</button>`;
}

/* ---------- keranjang ---------- */
function renderCustCart(){
  const app = document.getElementById('app');
  const entries = Object.entries(state.cart);
  const total = entries.reduce((a,[,c]) => a + c.qty * (c.menu ? c.menu.price : 0), 0);
  app.innerHTML = `
  <div class="topbar"><button class="backbtn" onclick="go('cust-menu',{storeId:state.storeId,storeName:state.storeName})">←</button><div><h2>Keranjang</h2><div class="sub">${escapeHtml(state.storeName)} · Meja ${state.table}</div></div></div>
  <div class="content">
    ${entries.length === 0 ? '<div class="empty"><span class="empty-ic">🛒</span>Keranjang masih kosong.</div>' : `
    <div class="section-title">Pesanan kamu</div>
    ${entries.map(([id,c]) => `
      <div class="menu-card">
        <div class="menu-thumb" style="${c.menu.photoURL ? `background-image:url('${c.menu.photoURL}')` : ''}">${c.menu.photoURL ? '' : (catEmoji(c.menu.category)||'🍽️')}</div>
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
    <button class="btn btn-primary" onclick="go('cust-checkout')">Lanjut Bayar →</button>
    `}
  </div>`;
}

/* ---------- checkout / bayar ---------- */
async function renderCustCheckout(){
  const app = document.getElementById('app');
  const entries = Object.entries(state.cart);
  const total = entries.reduce((a,[,c]) => a + c.qty * (c.menu ? c.menu.price : 0), 0);
  const store = await sGet('store:' + state.storeId, true);
  state._checkoutStore = store;
  state._pm = state._pm || 'tunai';
  app.innerHTML = `
  <div class="topbar"><button class="backbtn" onclick="go('cust-cart')">←</button><div><h2>Pembayaran</h2><div class="sub">Total ${rupiah(total)}</div></div></div>
  <div class="content">
    <div class="section-title">Pilih metode pembayaran</div>
    <div id="pmTunai" class="paymethod selected" onclick="choosePM('tunai')">
      <div class="pm-ic">💵</div>
      <div class="pm-info"><div class="pm-title">Tunai</div><div class="pm-sub">Bayar saat pesanan diantar</div></div>
      <div class="pm-check">✓</div>
    </div>
    <div id="pmQris" class="paymethod ${store && store.qrisImage ? '' : 'disabled'}" onclick="${store && store.qrisImage ? "choosePM('qris')" : ''}">
      <div class="pm-ic">▣</div>
      <div class="pm-info"><div class="pm-title">QRIS</div><div class="pm-sub">${store && store.qrisImage ? 'Bayar menggunakan QRIS toko' : 'Belum tersedia dari toko ini'}</div></div>
      <div class="pm-check">✓</div>
    </div>

    <div id="qrisArea"></div>

    <div class="section-title">Detail Pesanan</div>
    <div class="card">
      <div class="row" style="margin-bottom:8px;"><span class="muted">Meja</span><strong>No. ${state.table}</strong></div>
      <div class="row" style="margin-bottom:8px;"><span class="muted">Lapak</span><strong>${escapeHtml(state.storeName)}</strong></div>
      <div class="row" style="padding-top:8px;border-top:1px solid var(--line);"><span class="muted">Total</span><strong style="color:var(--lantern);">${rupiah(total)}</strong></div>
    </div>
    <button class="btn btn-primary" onclick="confirmPay()">Bayar Sekarang</button>
  </div>`;
}
function choosePM(pm){
  state._pm = pm;
  document.getElementById('pmTunai').classList.toggle('selected', pm === 'tunai');
  document.getElementById('pmQris').classList.toggle('selected', pm === 'qris');
  const area = document.getElementById('qrisArea');
  const entries = Object.entries(state.cart);
  const total = entries.reduce((a,[,c]) => a + c.qty * (c.menu ? c.menu.price : 0), 0);
  if(pm === 'qris' && state._checkoutStore && state._checkoutStore.qrisImage){
    area.innerHTML = `<div class="qris-box">
      <img src="${state._checkoutStore.qrisImage}" alt="QRIS ${escapeHtml(state._checkoutStore.name)}">
      <div class="qris-amount">${rupiah(total)}</div>
      <div class="qris-store">Scan pakai e-wallet / m-banking apapun · ${escapeHtml(state._checkoutStore.name)}</div>
    </div>`;
  } else {
    area.innerHTML = '';
  }
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
    createdAt: Date.now()
  };
  const btn = document.querySelector('.btn-primary');
  if(btn){ btn.textContent = 'Memproses…'; btn.disabled = true; }
  await sSet('order:' + orderId, order, true);
  state.cart = {};
  go('cust-receipt', {lastOrderId: orderId});
}

/* ---------- struk pembelian ---------- */
async function renderCustReceipt(){
  const app = document.getElementById('app');
  const order = await sGet('order:' + state.lastOrderId, true);
  if(!order){ app.innerHTML = '<div class="content empty">Struk tidak ditemukan.</div>'; return; }
  app.innerHTML = `
  <div class="topbar"><button class="backbtn" onclick="go('cust-table')">←</button><div><h2>Struk Pembelian</h2><div class="sub">Bukti pesanan kamu</div></div></div>
  <div class="content">
    <div class="receipt-status">
      <div class="checkcircle">✓</div>
      <h2>PESANAN BERHASIL</h2>
      <div class="ordno">Pesanan #${order.id.toUpperCase()}<br>${new Date(order.createdAt).toLocaleString('id-ID')}</div>
    </div>
    <div class="receipt">
      <h2>🏮 Lapak Alun-Alun</h2>
      <div class="rline"><span>Lapak</span><span>${escapeHtml(order.storeName)}</span></div>
      <div class="rline"><span>Meja</span><span>No. ${order.table}</span></div>
      <div class="dashed"></div>
      ${order.items.map(it => `<div class="rline"><span>${it.qty}× ${escapeHtml(it.name)}</span><span>${rupiah(it.price*it.qty)}</span></div>`).join('')}
      <div class="dashed"></div>
      <div class="rline" style="font-weight:700;font-size:16px;"><span>Total</span><span>${rupiah(order.total)}</span></div>
      <div class="rline"><span>Pembayaran</span><span>${order.paymentMethod === 'qris' ? 'QRIS' : 'Tunai'} ${order.paymentStatus === 'lunas' ? '<span class="paid-tag">✓ Lunas</span>' : ''}</span></div>
      <div class="dashed"></div>
      <p class="center muted" style="color:#7a6a48;">Simpan struk ini sebagai bukti pembelian.</p>
    </div>
    <div style="height:14px;"></div>
    <button class="btn btn-primary" onclick="go('cust-track',{lastOrderId:order.id})">Lihat Status Pesanan</button>
    <div style="height:10px;"></div>
    <button class="btn btn-outline" onclick="go('cust-table')">Kembali ke Beranda</button>
  </div>`;
}

/* ---------- lacak status pesanan ---------- */
async function renderCustTrack(){
  const app = document.getElementById('app');
  async function draw(){
    const order = await sGet('order:' + state.lastOrderId, true);
    if(!order) return;
    const idx = STATUS_FLOW.indexOf(order.status);
    app.innerHTML = `
    <div class="topbar"><button class="backbtn" onclick="go('cust-table')">←</button><div><h2>Status Pesanan</h2><div class="sub">Meja No. ${order.table} · ${escapeHtml(order.storeName)}</div></div></div>
    <div class="content">
      <div class="card">
        <div class="track">
          ${STATUS_FLOW.map((s,i) => `<div class="tstep ${i<=idx?'done':''}"><div class="dot">${i<=idx?'✓':i+1}</div><p>${STATUS_LABEL[s]}</p></div>`).join('')}
        </div>
      </div>
      <div class="card">
        ${order.items.map(it => `<div class="rline muted" style="display:flex;justify-content:space-between;"><span>${it.qty}× ${escapeHtml(it.name)}</span><span>${rupiah(it.price*it.qty)}</span></div>`).join('')}
        <div class="row" style="margin-top:8px;"><strong>Total</strong><strong>${rupiah(order.total)}</strong></div>
      </div>
      <p class="muted" style="text-align:center;">Halaman ini otomatis diperbarui.</p>
      <button class="btn btn-outline" onclick="go('cust-receipt',{lastOrderId:order.id})">Lihat Struk Lagi</button>
    </div>`;
  }
  await draw();
  stopTracking();
  state.trackInterval = setInterval(draw, 4000);
}
