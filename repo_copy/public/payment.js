const form = document.getElementById('payment-form');
const statusEl = document.getElementById('status');

const showStatus = (message, variant = 'info') => {
  statusEl.style.display = 'block';
  statusEl.textContent = message;
  statusEl.className = `status ${variant}`;
};

const checkStatus = async (checkoutRequestId) => {
  const response = await fetch(`/api/payments/status/${checkoutRequestId}`);
  if (!response.ok) {
    throw new Error('Could not load transaction status.');
  }
  return response.json();
};

const waitForResult = async (checkoutRequestId) => {
  showStatus('Waiting for M-Pesa confirmation... Please enter your PIN on your phone.', 'info');

  for (let attempt = 0; attempt < 20; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const status = await checkStatus(checkoutRequestId);

    if (status.status === 'SUCCESS') {
      showStatus(`Payment to GEOPRAM Services was successful! Thank you. Transaction ID: ${status.checkoutRequestId}. Amount: KES ${status.amount}. Phone: ${status.phone}. Timestamp: ${new Date(status.callbackReceivedAt || status.createdAt).toLocaleString()}.`, 'success');
      return;
    }

    if (status.status === 'FAILED') {
      const codeText = status.resultCode != null ? ` (ResultCode: ${status.resultCode})` : '';
      showStatus(`Payment failed${codeText}: ${status.resultDesc || 'Check your M-Pesa response.'}`, 'fail');
      return;
    }
  }

  showStatus('Still waiting for confirmation. Please check your M-Pesa app or try again in a few moments.', 'info');
};

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const fullName = form.fullName.value.trim();
  const email = form.email.value.trim();
  const phone = form.phone.value.trim();
  const amount = form.amount.value.trim();

  if (!fullName || !email || !phone || !amount) {
    return showStatus('All fields are required.', 'fail');
  }

  form.querySelector('button').disabled = true;
  showStatus('Sending payment request to Safaricom...', 'info');

  try {
    const response = await fetch('/api/payments/initiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName, email, phone, amount }),
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.message || 'Could not start payment');
    }

    await waitForResult(result.checkoutRequestId);
  } catch (err) {
    showStatus(err.message, 'fail');
  } finally {
    form.querySelector('button').disabled = false;
  }
});
