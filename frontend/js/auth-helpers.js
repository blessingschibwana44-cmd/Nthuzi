function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.style.display = 'block';
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.style.display = 'none', 2400);
}

function setLoading(button, loading, label) {
  const status = document.getElementById('statusMessage');
  button.disabled = loading;
  if (loading) {
    button.innerHTML = '<span class="spinner"></span> ' + label;
    status.className = 'status-msg';
    status.textContent = label.toLowerCase().startsWith('creating')
      ? 'Creating your account...'
      : 'Please wait...';
  } else {
    button.innerHTML = label;
  }
}

function setStatus(message, type) {
  const status = document.getElementById('statusMessage');
  status.className = `status-msg ${type || ''}`.trim();
  status.textContent = message;
}

async function authRequest(url, payload) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const body = await response.json().catch(() => ({}));
  return { response, body };
}
