/*
  customer.js
  -----------
  Semua tampilan & aksi untuk web PEMBELI (situs berdiri sendiri):
  input/scan meja -> daftar toko -> menu -> keranjang -> bayar -> struk -> lacak status.
  Bergantung pada: state & go() dari app.js, sGet/sSet/sList/sDel dari storage.js,
  fungsi bantu dari utils.js, dan SELLER_SITE_URL dari site-config.js.
*/

let menuCache = {};

/* ---------- halaman utama: input/scan nomor meja ---------- */
function viewCustTable(){
  return `
  <div class="topbar"><div><h2>🏮 Lapak Alun-Alun</h2><div class="sub">Pesan jajanan langsung dari mejamu</div></div></div>
  <div class="content">
    <div class="card">
      <p class="muted">Biasanya nomor meja otomatis terisi begitu kamu scan QR di meja. Untuk uji coba, masukkan manual di bawah.</p>
      <div class="field"><label>Nomor meja</label><input id="tableInput" type="number" min="1" max="30" placeholder="contoh: 7"></div>
      <button class="btn btn-primary" onclick="submitTable()">Lanjut lihat lapak</button>
    </div>
    <p class="muted" style="text-align:center;margin-top:18px;">
      Punya lapak sendiri? <a href="${SELLER_SITE_URL}" target="_blank" style="color:var(--lantern);text-decoration:underline;">Daftar sebagai penjual</a>
    </p>
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
  <div class="topbar"><button class="backbtn" onclick="go('cust-table')">←</button><div><h2>Pilih Toko</h2><div class="sub">Meja No. ${state.table} · diurutkan dari yang terdekat</div></div></div>
  <div class="content" id="storeList"><div class="empty">Memuat toko…</div></div>`;
  const keys = await sList('store:', true);
  const stores = (await Promise.all(keys.map(k => sGet(k, true)))).filter(Boolean);
  const el = document.getElementById('storeList');
  if(stores.length === 0){
    el.innerHTML = `<div class="empty">Belum ada toko yang terdaftar.<br>Ajak pedagang di sekitarmu untuk daftar lewat web penjual.</div>`;
    return;
  }
  const totalTables = await getTotalTables();
  const withDist = stores.map(s => ({...s, _dist: circularDist(state.table, s.nearTable, totalTables)}));
  withDist.sort((a,b) => a._dist - b._dist);
  el.innerHTML = withDist.map((s,i) => {
    const isNearest = i === 0 && s._dist !== Infinity;
    let distLabel;
    if(s._dist === Infinity) distLabel = 'Lokasi toko belum ditandai';
    else if(s._dist === 0) distLabel = 'Tepat di sekitar mejamu';
    else distLabel = '≈ ' + s._dist + ' meja dari kamu';
    return `
    <div class="card" onclick="openStore('${s.id}','${(s.name||'').replace(/'/g,"\\'")}')" style="cursor:pointer;">
      <div class="row" style="align-items:flex-start;">
        <h3 style="margin-bottom:2px;">${escapeHtml(s.name)}</h3>
        ${isNearest ? '<span class="badge badge-diproses">Terdekat</span>' : ''}
      </div>
      <p class="muted" style="margin:0 0 6px;">${escapeHtml(s.desc || 'Belum ada deskripsi')}</p>
      <p class="muted" style="font-size:12px;">📍 ${distLabel}</p>
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
  <div class="topbar"><button class="backbtn" onclick="go('cust-stores',{table:state.table})">←</button><div><h2>${escapeHtml(state.storeName)}</h2><div class="sub">Meja No. ${state.table}</div></div></div>
  <div class="content" id="menuList"><div class="empty">Memuat menu…</div></div>`;
  const keys = await sList('menu:' + state.storeId + ':', true);
  const items = (await Promise.all(keys.map(k => sGet(k, true)))).filter(Boolean).filter(m => m.available !== false);
  items.forEach(m => { menuCache[m.id] = m; });
  const el = document.getElementById('menuList');
  if(items.length === 0){
    el.innerHTML = `<div class="empty">Toko ini belum menambahkan menu.</div>`;
  } else {
    el.innerHTML = `<div class="card">` + items.map(m => {
      const qty = (state.cart[m.id] || {}).qty || 0;
      return `<div class="menu-item">
        <div><div style="font-weight:600;">${escapeHtml(m.name)}</div><div class="muted">${rupiah(m.price)}</div></div>
        <div class="qty-stepper">
          <button onclick="changeQty('${m.id}', -1)">−</button>
          <span id="qty-${m.id}">${qty}</span>
          <button onclick="changeQty('${m.id}', 1)">+</button>
        </div>
      </div>`;
    }).join('') + `</div>`;
  }
  renderCartBar();
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
  const span = document.getElementById('qty-' + menuId);
  if(span) span.textContent = state.cart[menuId] ? state.cart[menuId].qty : 0;
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
  bar.innerHTML = `<div><div style="font-weight:700;">${totalQty} item</div><div class="muted">${rupiah(totalPrice)}</div></div>
    <button class="btn btn-primary" onclick="go('cust-cart')">Lihat Keranjang</button>`;
}

/* ---------- keranjang ---------- */
function renderCustCart(){
  const app = document.getElementById('app');
  const entries = Object.entries(state.cart);
  const total = entries.reduce((a,[,c]) => a + c.qty * (c.menu ? c.menu.price : 0), 0);
  app.innerHTML = `
  <div class="topbar"><button class="backbtn" onclick="go('cust-menu',{storeId:state.storeId,storeName:state.storeName})">←</button><div><h2>Keranjang</h2><div class="sub">${escapeHtml(state.storeName)} · Meja ${state.table}</div></div></div>
  <div class="content">
    ${entries.length === 0 ? '<div class="empty">Keranjang masih kosong.</div>' : `
    <div class="card">${entries.map(([id,c]) => `
      <div class="menu-item">
        <div><div style="font-weight:600;">${escapeHtml(c.menu.name)}</div><div class="muted">${rupiah(c.menu.price)} × ${c.qty}</div></div>
        <div class="qty-stepper">
          <button onclick="changeQty('${id}', -1)">−</button>
          <span id="qty-${id}">${c.qty}</span>
          <button onclick="changeQty('${id}', 1)">+</button>
        </div>
      </div>`).join('')}</div>
    <div class="card row"><strong>Total</strong><strong>${rupiah(total)}</strong></div>
    <button class="btn btn-primary" onclick="go('cust-checkout')">Lanjut Bayar</button>
    `}
  </div>`;
}

/* ---------- checkout / bayar ---------- */
function renderCustCheckout(){
  const app = document.getElementById('app');
  const entries = Object.entries(state.cart);
  const total = entries.reduce((a,[,c]) => a + c.qty * (c.menu ? c.menu.price : 0), 0);
  app.innerHTML = `
  <div class="topbar"><button class="backbtn" onclick="go('cust-cart')">←</button><div><h2>Pembayaran</h2><div class="sub">Total ${rupiah(total)}</div></div></div>
  <div class="content">
    <div class="card">
      <h3>Metode Pembayaran</h3>
      <div class="field"><label><input type="radio" name="pm" value="tunai" checked> Tunai (bayar saat diantar)</label></div>
      <div class="field"><label><input type="radio" name="pm" value="qris"> QRIS (simulasi)</label></div>
    </div>
    <div class="card">
      <div class="row"><span>Meja</span><strong>No. ${state.table}</strong></div>
      <div class="row"><span>Toko</span><strong>${escapeHtml(state.storeName)}</strong></div>
      <div class="row"><span>Total bayar</span><strong>${rupiah(total)}</strong></div>
    </div>
    <button class="btn btn-primary" onclick="confirmPay()">Bayar Sekarang</button>
  </div>`;
}

async function confirmPay(){
  const pm = document.querySelector('input[name="pm"]:checked').value;
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
    <div class="receipt">
      <h2>🏮 Lapak Alun-Alun</h2>
      <p class="center" style="font-size:12px;color:#5b4a2f;margin:2px 0 12px;">No. Pesanan: ${order.id}</p>
      <div class="rline"><span>Toko</span><span>${escapeHtml(order.storeName)}</span></div>
      <div class="rline"><span>Meja</span><span>No. ${order.table}</span></div>
      <div class="rline"><span>Waktu</span><span>${new Date(order.createdAt).toLocaleString('id-ID')}</span></div>
      <div class="dashed"></div>
      ${order.items.map(it => `<div class="rline"><span>${it.qty}× ${escapeHtml(it.name)}</span><span>${rupiah(it.price*it.qty)}</span></div>`).join('')}
      <div class="dashed"></div>
      <div class="rline" style="font-weight:700;font-size:16px;"><span>Total</span><span>${rupiah(order.total)}</span></div>
      <div class="rline"><span>Pembayaran</span><span>${order.paymentMethod === 'qris' ? 'QRIS' : 'Tunai'}</span></div>
      <div class="dashed"></div>
      <p class="center muted" style="color:#7a6a48;">Simpan struk ini sebagai bukti pembelian.</p>
    </div>
    <div style="height:14px;"></div>
    <button class="btn btn-primary" onclick="go('cust-track',{lastOrderId:order.id})">Lihat Status Pesanan</button>
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
