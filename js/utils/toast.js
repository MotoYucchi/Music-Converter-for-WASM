const toastContainer = () => document.getElementById('toast-container');

export function showToast(message, type = 'info', durationMs = 3400) {
  const container = toastContainer();
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(6px)';
    toast.style.transition = 'opacity 160ms ease, transform 160ms ease';
    setTimeout(() => toast.remove(), 180);
  }, durationMs);
}
