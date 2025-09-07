(() => {
  const $ = s => document.querySelector(s);

  const back = $('#modalBackdrop');
  const titleEl = $('#modalTitle');
  const msgEl = $('#modalMsg');
  const closeBtn = $('#modalCloseBtn');

  let lastFocus = null;
  let keyHandler = null;

  function openModal(message, title = 'Error') {
    if (!back) return;

    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = message || 'Unexpected error';

    lastFocus = document.activeElement;

    back.classList.add('show');
    back.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    (closeBtn || back).focus();

    keyHandler = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeModal();
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        (closeBtn || back).focus();
      }
    };
    window.addEventListener('keydown', keyHandler);
  }

  function closeModal() {
    if (!back) return;

    back.classList.remove('show');
    back.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';

    if (keyHandler) {
      window.removeEventListener('keydown', keyHandler);
      keyHandler = null;
    }
    if (lastFocus && typeof lastFocus.focus === 'function') {
      lastFocus.focus();
    }
  }

  closeBtn?.addEventListener('click', () => {
    location.href = '/';
  });

  window.showError = (message, title = 'Error') => openModal(message, title);
})();
