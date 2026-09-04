/**
 * Toast Notification Component
 */
export function showToast(msg) {
  const toast = document.getElementById('toast');
  const msgElem = document.getElementById('toast-msg');
  if (msgElem) msgElem.innerText = msg;
  if (toast) {
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2000);
  }
}
