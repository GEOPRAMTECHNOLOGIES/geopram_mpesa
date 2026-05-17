const loginScreen = document.getElementById('login-screen');
const dashboard = document.getElementById('dashboard');
const loginForm = document.getElementById('login-form');
const loginMessage = document.getElementById('login-message');
const logoutButton = document.getElementById('logout');
const loadButton = document.getElementById('load-transactions');
const exportButton = document.getElementById('export-csv');
const transactionTable = document.getElementById('transaction-table');
const summaryEl = document.getElementById('summary');
const dashboardMessage = document.getElementById('dashboard-message');
const searchInput = document.getElementById('search');
const filterStatus = document.getElementById('filter-status');

const getToken = () => window.localStorage.getItem('adminToken');
const setToken = (token) => window.localStorage.setItem('adminToken', token);
const clearToken = () => window.localStorage.removeItem('adminToken');

const authHeaders = () => ({
  Authorization: `Bearer ${getToken()}`,
  'Content-Type': 'application/json',
});

const showDashboard = () => {
  loginScreen.classList.add('hidden');
  dashboard.classList.remove('hidden');
};

const showLogin = () => {
  loginScreen.classList.remove('hidden');
  dashboard.classList.add('hidden');
};

const handleAuthError = () => {
  clearToken();
  showLogin();
  loginMessage.textContent = 'Session expired. Please log in again.';
};

const fetchSummary = async () => {
  const response = await fetch('/api/admin/summary', { headers: authHeaders() });
  if (response.status === 401) return handleAuthError();
  const data = await response.json();
  summaryEl.textContent = `Success: ${data.totalSuccess || 0} | Failed: ${data.totalFailed || 0} | Pending: ${data.totalPending || 0}`;
};

const fetchTransactions = async () => {
  const params = new URLSearchParams();
  if (filterStatus.value) params.append('status', filterStatus.value);
  if (searchInput.value.trim()) params.append('search', searchInput.value.trim());
  params.append('limit', '100');

  const response = await fetch(`/api/admin/transactions?${params.toString()}`, { headers: authHeaders() });
  if (response.status === 401) return handleAuthError();
  const data = await response.json();
  transactionTable.innerHTML = data.transactions.map((tx) => `
    <tr>
      <td>${tx.fullName} / ${tx.email}</td>
      <td>${tx.phone}</td>
      <td>KES ${tx.amount}</td>
      <td>${tx.receiptNumber || 'N/A'}</td>
      <td class="status-${tx.status.toLowerCase()}">${tx.status}</td>
      <td>${new Date(tx.callbackReceivedAt || tx.createdAt).toLocaleString()}</td>
    </tr>
  `).join('');
  dashboardMessage.textContent = `Loaded ${data.transactions.length} record(s).`;
};

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  loginMessage.textContent = '';

  const username = loginForm.username.value.trim();
  const password = loginForm.password.value;

  const response = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  const result = await response.json();
  if (!response.ok) {
    loginMessage.textContent = result.message || 'Login failed';
    return;
  }

  setToken(result.token);
  showDashboard();
  fetchSummary();
  fetchTransactions();
});

logoutButton.addEventListener('click', () => {
  clearToken();
  showLogin();
});

loadButton.addEventListener('click', () => fetchTransactions());
exportButton.addEventListener('click', () => {
  const params = new URLSearchParams();
  if (filterStatus.value) params.append('status', filterStatus.value);
  if (searchInput.value.trim()) params.append('search', searchInput.value.trim());
  window.location.href = `/api/admin/export?format=csv&${params.toString()}`;
});

if (getToken()) {
  showDashboard();
  fetchSummary();
  fetchTransactions();
}
