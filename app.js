/*
  app.js (web pembeli)
  --------------------
  Karena web ini sekarang berdiri sendiri, halamannya cuma seputar alur beli.
  Harus dimuat PALING TERAKHIR di index.html.
*/

let state = {
  view: 'cust-table',
  table: null,
  storeId: null,
  storeName: null,
  cart: {},
  lastOrderId: null,
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
  else app.innerHTML = '<div class="content">Memuat…</div>';

  if(state.view === 'cust-stores') renderCustStores();
  else if(state.view === 'cust-menu') renderCustMenu();
  else if(state.view === 'cust-cart') renderCustCart();
  else if(state.view === 'cust-checkout') renderCustCheckout();
  else if(state.view === 'cust-receipt') renderCustReceipt();
  else if(state.view === 'cust-track') renderCustTrack();
}

/* ---------- nyalakan aplikasi ---------- */
(async function init(){
  const params = new URLSearchParams(location.search);
  const t = params.get('table');
  // QR di meja membawa parameter ?table=N -> langsung loncat ke daftar toko.
  if(t){ go('cust-stores', {table:t}); return; }
  render(); // tidak ada param -> tampilkan input nomor meja manual
})();
