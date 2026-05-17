/* public/admin.js */

// ── Elements ──────────────────────────────────────────────────────────────────
const loginWrap    = document.getElementById('login-wrap');
const loginForm    = document.getElementById('login-form');
const loginMsg     = document.getElementById('login-msg');
const dashboard    = document.getElementById('dashboard');

const sumSuccess   = document.getElementById('sum-success');
const sumFailed    = document.getElementById('sum-failed');
const sumPending   = document.getElementById('sum-pending');

const stkForm      = document.getElementById('stk-form');
const stkPhone     = document.getElementById('stk-phone');
const stkAmount    = document.getElementById('stk-amount');
const stkRef       = document.getElementById('stk-ref');
const stkDesc      = document.getElementById('stk-desc');
const stkMsg       = document.getElementById('stk-msg');

const searchInput  = document.getElementById('search');
const filterStatus = document.getElementById('filter-status');
const txTable      = document.getElementById('tx-table');
const txMsg        = document.getElementById('tx-msg');

const btnLoad      = document.getElementById('btn-load');
const btnExport    = document.getElementById('btn-export');
const btnLogout    = document.getElementById('btn-logout');

// ── Token helpers ─────────────────────────────────────────────────────────────
const getToken   = ()      => localStorage.getItem('adminToken');
const setToken   = (tok)   => localStorage.setItem('adminToken', tok);
const clearToken = ()      => localStorage.removeItem('adminToken');
const authHdr    = ()      => ({ Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' });

// ── UI helpers ────────────────────────────────────────────────────────────────
function showDashboard() {
  loginWrap.classList.add('hidden');
  dashboard.classList.remove('hidden');
}

function showLogin(msg) {
  dashboard.classList.add('hidden');
  loginWrap.classList.remove('hidden');
  if (msg) { loginMsg.style.display = 'block'; loginMsg.textContent = msg; }
}

function flashMsg(el, text, isErr = false) {
  el.style.display = 'block';
  el.textContent   = text;
  el.className     = 'msg' + (isErr ? ' err' : '');
}

function handleUnauth() {
  clearToken();
  showLogin('Session expired. Please sign in again.');
}

// ── Fetch wrappers ────────────────────────────────────────────────────────────
async function apiFetch(url, opts = {}) {
  const res = await fetch(url, { headers: authHdr(), ...opts });
  if (res.status === 401) { handleUnauth(); return null; }
  return res;
}

// ── Summary ───────────────────────────────────────────────────────────────────
async function loadSummary() {
  const res = await apiFetch('/api/admin/summary');
  if (!res) return;
  const d = await res.json();
  sumSuccess.textContent = d.totalSuccess ?? 0;
  sumFailed.textContent  = d.totalFailed  ?? 0;
  sumPending.textContent = d.totalPending ?? 0;
}

// ── Transactions ──────────────────────────────────────────────────────────────
async function loadTransactions() {
  const params = new URLSearchParams();
  if (filterStatus.value)      params.set('status', filterStatus.value);
  if (searchInput.value.trim()) params.set('search', searchInput.value.trim());
  params.set('limit', '100');

  flashMsg(txMsg, 'Loading…');
  const res = await apiFetch(`/api/admin/transactions?${params}`);
  if (!res) return;

  if (!res.ok) { flashMsg(txMsg, 'Failed to load records.', true); return; }

  const { transactions } = await res.json();
  txTable.innerHTML = transactions.map((tx) => {
    const date = new Date(tx.callbackReceivedAt || tx.createdAt).toLocaleString();
    return `<tr>
      <td>${esc(tx.fullName)}<br><small style="color:#64748b;">${esc(tx.email)}</small></td>
      <td>${esc(tx.phone)}</td>
      <td>KES ${tx.amount}</td>
      <td>${esc(tx.receiptNumber || 'N/A')}</td>
      <td><span class="badge badge-${tx.status}">${tx.status}</span></td>
      <td style="white-space:nowrap;">${date}</td>
    </tr>`;
  }).join('');

  flashMsg(txMsg, `${transactions.length} record(s) loaded.`);
}

function esc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── CSV Export ────────────────────────────────────────────────────────────────
async function exportCsv() {
  const params = new URLSearchParams({ format: 'csv' });
  if (filterStatus.value)       params.set('status', filterStatus.value);
  if (searchInput.value.trim()) params.set('search', searchInput.value.trim());

  const res = await apiFetch(`/api/admin/export?${params}`);
  if (!res || !res.ok) { flashMsg(txMsg, 'Export failed.', true); return; }

  const blob = await res.blob();
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = 'geopram_transactions.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

// ── Admin STK Push ────────────────────────────────────────────────────────────
stkForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  stkMsg.style.display = 'none';

  const body = {
    phoneNumber:      stkPhone.value.trim(),
    amount:           stkAmount.value.trim(),
    accountReference: stkRef.value.trim()  || 'GEOPRAM',
    transactionDesc:  stkDesc.value.trim() || 'Payment for services',
  };

  if (!body.phoneNumber || !body.amount) {
    return flashMsg(stkMsg, 'Phone and amount are required.', true);
  }

  flashMsg(stkMsg, 'Sending STK Push…');
  const res = await apiFetch('/api/admin/stk-push', {
    method: 'POST',
    body:   JSON.stringify(body),
  });
  if (!res) return;

  const data = await res.json();
  if (!res.ok) {
    flashMsg(stkMsg, `Error: ${data.message || data.error || 'Unknown error'}`, true);
  } else {
    flashMsg(stkMsg, `✅ STK Push sent! CheckoutRequestID: ${data.checkoutRequestID}`);
    loadSummary();
    loadTransactions();
  }
});

// ── Login ─────────────────────────────────────────────────────────────────────
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginMsg.style.display = 'none';

  const res = await fetch('/api/admin/login', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      username: loginForm.username.value.trim(),
      password: loginForm.password.value,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    loginMsg.style.display = 'block';
    loginMsg.textContent   = data.message || 'Login failed.';
    return;
  }

  setToken(data.token);
  showDashboard();
  loadSummary();
  loadTransactions();
});

// ── Controls ──────────────────────────────────────────────────────────────────
btnLogout.addEventListener('click', () => { clearToken(); showLogin(); });
btnLoad.addEventListener('click',   loadTransactions);
btnExport.addEventListener('click', exportCsv);

// ── Auto-restore session ──────────────────────────────────────────────────────
if (getToken()) {
  showDashboard();
  loadSummary();
  loadTransactions();
}
