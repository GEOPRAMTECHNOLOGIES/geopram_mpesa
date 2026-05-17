/* public/payment.js */
const form      = document.getElementById('payment-form');
const payBtn    = document.getElementById('pay-btn');
const statusBox = document.getElementById('status-box');

function showStatus(html, variant) {
  statusBox.style.display = 'block';
  statusBox.innerHTML     = html;
  statusBox.className     = `status-box status-${variant}`;
}

async function pollStatus(checkoutRequestId) {
  showStatus('<span class="spinner"></span>Waiting for M-Pesa confirmation… Please enter your PIN.', 'info');

  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 3000));

    let data;
    try {
      const res = await fetch(`/api/payments/status/${encodeURIComponent(checkoutRequestId)}`);
      data = await res.json();
    } catch {
      continue;
    }

    if (data.status === 'SUCCESS') {
      const ts = data.callbackReceivedAt || data.createdAt;
      showStatus(
        `✅ <strong>Payment successful!</strong><br>` +
        `Receipt: <strong>${data.receiptNumber || checkoutRequestId}</strong><br>` +
        `Amount: KES ${data.amount} · Phone: ${data.phone}<br>` +
        `${ts ? new Date(ts).toLocaleString() : ''}`,
        'success'
      );
      return;
    }

    if (data.status === 'FAILED') {
      const code = data.resultCode != null ? ` (code ${data.resultCode})` : '';
      showStatus(`❌ Payment failed${code}: ${data.resultDesc || 'Check your M-Pesa.'}`, 'fail');
      return;
    }
  }

  showStatus('Still waiting… Check your M-Pesa app or try again shortly.', 'info');
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const fullName = form.fullName.value.trim();
  const email    = form.email.value.trim();
  const phone    = form.phone.value.trim();
  const amount   = form.amount.value.trim();

  if (!fullName || !email || !phone || !amount) {
    return showStatus('All fields are required.', 'fail');
  }

  payBtn.disabled = true;
  showStatus('<span class="spinner"></span>Sending request to Safaricom…', 'info');

  try {
    const res  = await fetch('/api/payments/initiate', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ fullName, email, phone, amount }),
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.message || 'Could not start payment.');

    await pollStatus(data.checkoutRequestId);
  } catch (err) {
    showStatus(`❌ ${err.message}`, 'fail');
  } finally {
    payBtn.disabled = false;
  }
});
