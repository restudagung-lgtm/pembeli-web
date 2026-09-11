/*
  app.js (web pembeli)
  --------------------
  Karena web ini berdiri sendiri, halamannya cuma seputar alur beli.
  Harus dimuat PALING TERAKHIR di index.html.
*/

let state = {
  view: 'cust-table',
  table: null,
  storeId: null,
  storeName: null,
  cart: {},
  orderId: null,
  location: null,
  trackInterval: null,
};

function stopTracking(){
  if(state.trackInterval){ clearInterval(state.trackInterval); state.trackInterval = null; }
}

function go(view, extra){
  stopTracking();
  state.view = view;
  Object.assign(state, extra || {});
  render();
}

function render(){
  const app = document.getElementById('app');
  if(state.view === 'cust-table') app.innerHTML = viewCustTable();
  else app.innerHTML = '<div class="content"><div class="empty">Memuat…</div></div>';
  mountIcons();

  if(state.view === 'cust-stores') renderCustStores();
  else if(state.view === 'cust-menu') renderCustMenu();
  else if(state.view === 'cust-cart') renderCustCart();
  else if(state.view === 'cust-checkout') renderCustCheckout();
  else if(state.view === 'cust-order') renderCustOrder();
  else if(state.view === 'cust-orders') renderCustOrdersList();
  else mountIcons();
}

/* ---------- nyalakan aplikasi ---------- */
(async function init(){
  const params = new URLSearchParams(location.search);
  const t = params.get('table');

  // Kalau ada pesanan yang masih berjalan di HP ini, langsung buka layar
  // status-nya -- jangan lempar balik ke halaman input nomor meja.
  const activeId = getActiveOrderId();
  if(activeId){
    const order = await sGet('order:' + activeId, true);
    if(order && order.status !== 'selesai' && order.status !== 'dibatalkan'){
      go('cust-order', {orderId: activeId, table: order.table});
      return;
    } else {
      clearActiveOrder();
    }
  }

  if(t){
    localStorage.setItem('lapak_table', t);
    go('cust-stores', {table:t});
    return;
  }
  const savedTable = localStorage.getItem('lapak_table');
  if(savedTable){
    go('cust-stores', {table:savedTable});
    return;
  }
  render();
})();
