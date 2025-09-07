(function () {
  const input = document.getElementById('fileInput');
  const btn = document.getElementById('openBtn');
  const drop = document.getElementById('dropZone');

  const ACCEPT_EXT = new Set(['umbf', 'umia']);

  function getExt(name = '') {
    const m = /\.\s*([A-Za-z0-9]+)$/.exec(name);
    return m ? m[1].toLowerCase() : '';
  }
  function isAllowedFile(file) {
    const ext = getExt(file?.name || '');
    return ACCEPT_EXT.has(ext);
  }
  async function openOnServer(file) {
    if (!file || file.size === 0) {
      showError('Empty file');
      return;
    }

    let res;
    try {
      res = await fetch('/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-File-Name': encodeURIComponent(file.name || 'upload')
        },
        body: file
      });
    } catch {
      showError('Network error while uploading file');
      return;
    }

    const json = await res.json();

    if (!json || json.success !== true) {
      showError(json?.error || 'Failed to open file');
      return;
    }

    location.href = '/view';
  }


  function handleFile(file) {
    if (!file) return;
    if (!isAllowedFile(file)) {
      showError('Unsupported file type. Please select .umbf or .umia');
      return;
    }
    openOnServer(file);
  }

  btn.addEventListener('pointerdown', e => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--rx', (e.clientX - r.left) + 'px');
    e.currentTarget.style.setProperty('--ry', (e.clientY - r.top) + 'px');
  });

  btn.addEventListener('click', () => input.click());

  window.addEventListener('keydown', e => {
    if (e.key === 'F8') { e.preventDefault(); input.click(); }
  });

  input.addEventListener('change', () => {
    const file = input.files && input.files[0];
    handleFile(file);
    input.value = "";
  });

  ['dragenter', 'dragover'].forEach(ev => {
    drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('drag'); });
  });
  ['dragleave', 'drop'].forEach(ev => {
    drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('drag'); });
  });
  drop.addEventListener('drop', e => {
    const file = e.dataTransfer?.files?.[0];
    handleFile(file);
  });

  window.addEventListener('paste', e => {
    const items = e.clipboardData?.items || [];
    for (const it of items) {
      const f = it.getAsFile?.();
      if (f) { handleFile(f); break; }
    }
  });
})();