(function () {
  const layer = document.getElementById('layer');
  const stage = document.getElementById('stage');
  const zoomLabel = document.getElementById('zoomLabel');
  const infoBtn = document.getElementById('infoBtn');
  const infoPanel = document.getElementById('info');

  const infoPath = document.getElementById('infoPath');
  const infoFormat = document.getElementById('infoFormat');
  const infoChannels = document.getElementById('infoChannels');
  const infoCompression = document.getElementById('infoCompression');
  const infoChecksum = document.getElementById('infoChecksum');
  const infoVendorSign = document.getElementById('infoVendorSign');
  const infoVendorVer = document.getElementById('infoVendorVersion');
  const infoTypeSign = document.getElementById('infoTypeSign');
  const infoSpecVersion = document.getElementById('infoSpecVersion');
  const infoWidth = document.getElementById('infoWidth');
  const infoHeight = document.getElementById('infoHeight');
  const closeBtn = document.getElementById('closeBtn');

  const cvs = document.createElement('canvas');
  cvs.id = 'imgCanvas';
  cvs.style.display = 'block';
  cvs.style.pointerEvents = 'none';
  layer.appendChild(cvs);
  const ctx = cvs.getContext('2d', { willReadFrequently: false });

  let scale = 1;
  let tx = 0, ty = 0;
  let imageWidth = 1, imageHeight = 1;
  let viewMode = 'fit';

  const MIN_SCALE = 0.05;
  const MAX_SCALE = 32;
  const ZOOM_STEP = 1.1;
  const WHEEL_STEP = 1.1;

  function updateLabels() {
    const pct = Math.round(scale * 100);
    zoomLabel.textContent = pct + '%';
  }

  function applyTransform() {
    layer.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
    updateLabels();
  }

  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

  function centerForScale(s) {
    const sw = stage.clientWidth, sh = stage.clientHeight;
    const iw = imageWidth, ih = imageHeight;
    tx = (sw - iw * s) / 2;
    ty = (sh - ih * s) / 2;
  }

  function fitToWindow() {
    const sw = stage.clientWidth, sh = stage.clientHeight;
    const iw = imageWidth, ih = imageHeight;
    const fit = clamp(Math.min(sw / iw, sh / ih), MIN_SCALE, MAX_SCALE);
    scale = fit;
    centerForScale(scale);
    viewMode = 'fit';
    applyTransform();
  }

  function resetView() {
    fitToWindow();
  }

  function zoomAt(factor, cx, cy) {
    const newScale = clamp(scale * factor, MIN_SCALE, MAX_SCALE);
    factor = newScale / scale;

    tx = tx - (factor - 1) * scale * cx;
    ty = ty - (factor - 1) * scale * cy;

    scale = newScale;
    viewMode = 'free';
    applyTransform();
  }

  function zoomAtCenter(factor) {
    const cx = (stage.clientWidth / 2 - tx) / scale;
    const cy = (stage.clientHeight / 2 - ty) / scale;
    zoomAt(factor, cx, cy);
  }

  stage.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = stage.getBoundingClientRect();
    const cx = (e.clientX - r.left - tx) / scale;
    const cy = (e.clientY - r.top - ty) / scale;
    zoomAt(e.deltaY > 0 ? 1 / WHEEL_STEP : WHEEL_STEP, cx, cy);
  }, { passive: false });

  let dragging = false, sx = 0, sy = 0, stx = 0, sty = 0;
  stage.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    dragging = true;
    sx = e.clientX; sy = e.clientY;
    stx = tx; sty = ty;
    viewMode = 'free';
    stage.setPointerCapture(e.pointerId);
  });

  stage.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    tx = stx + (e.clientX - sx);
    ty = sty + (e.clientY - sy);
    applyTransform();
  });
  stage.addEventListener('pointerup', () => { dragging = false; });
  stage.addEventListener('pointercancel', () => { dragging = false; });

  document.getElementById('zoomInBtn').addEventListener('click', () => zoomAtCenter(ZOOM_STEP));
  document.getElementById('zoomOutBtn').addEventListener('click', () => zoomAtCenter(1 / ZOOM_STEP));
  document.getElementById('resetBtn').addEventListener('click', resetView);

  async function fetchInfo() {
    try {
      const r = await fetch('/api/image', { cache: 'no-store' });
      const meta = await r.json();
      if (!meta || meta.success === false) {
        showError(meta?.error ?? 'Failed to load metadata');
        return null;
      }

      const name = meta.name ?? '—';

      const toHex = (v) =>
        (typeof v === 'number' && Number.isInteger(v))
          ? '0x' + v.toString(16).toUpperCase()
          : '—';

      const vendorSign = toHex(meta.vendor_sign);
      const vendorVersion = toHex(meta.vendor_version);
      const typeSign = toHex(meta.type_sign);
      const specVersion = toHex(meta.spec_version);

      const compressed = (typeof meta.compressed === 'boolean')
        ? (meta.compressed ? 'Yes' : 'No')
        : '—';

      const checksum = meta.checksum ?? '—';

      const width = Number.isInteger(meta.width) ? meta.width | 0 : 0;
      const height = Number.isInteger(meta.height) ? meta.height | 0 : 0;

      const channelsArr = Array.isArray(meta.channels) ? meta.channels : [];
      const channels = channelsArr.length ? channelsArr.join(', ') : '—';

      const format = meta.format ?? '—';

      infoPath.textContent = name;
      infoVendorSign.textContent = vendorSign;
      infoVendorVer.textContent = vendorVersion;
      infoTypeSign.textContent = typeSign;
      infoSpecVersion.textContent = specVersion;
      infoWidth.textContent = width ? String(width) : '—';
      infoHeight.textContent = height ? String(height) : '—';
      infoFormat.textContent = format;
      infoChannels.textContent = channels;
      infoCompression.textContent = compressed;
      infoChecksum.textContent = checksum;

      if (!(width > 0 && height > 0)) {
        showError('Invalid image dimensions in metadata');
        return null;
      }
      return { width, height };
    } catch {
      showError('Network error while loading metadata');
      return null;
    }
  }

  async function fetchBuffer(width, height) {
    let res;
    try {
      res = await fetch('/view/image', { cache: 'no-store' });
    } catch {
      showError('Network error while loading image');
      return false;
    }

    const buf = await res.arrayBuffer();
    const expected = width * height * 4;
    if (buf.byteLength !== expected) {
      showError(`Unexpected image data size: got ${buf.byteLength}, expected ${expected}`);
      return false;
    }

    const pixels = new Uint8ClampedArray(buf);
    const imgData = new ImageData(pixels, width, height);
    cvs.width = width; cvs.height = height;
    ctx.putImageData(imgData, 0, 0);

    imageWidth = width; imageHeight = height;
    return true;
  }

  let infoLoadedOnce = false;

  async function toggleInfo() {
    const showing = infoPanel.classList.toggle('show');
    if (showing && !infoLoadedOnce) {
      const meta = await fetchInfo();
      if (meta) infoLoadedOnce = true;
    }
  }
  infoBtn.addEventListener('click', toggleInfo);
  window.addEventListener('keydown', (e) => {
    if (e.key === '0') resetView();
    else if (e.key === '+' || e.key === '=') zoomAtCenter(ZOOM_STEP);
    else if (e.key === '-' || e.key === '_') zoomAtCenter(1 / ZOOM_STEP);
    else if (e.key.toLowerCase() === 'i') toggleInfo();
  });

  layer.style.visibility = 'hidden';

  (async () => {
    const meta = await fetchInfo();
    if (!meta) {
      document.getElementById('badge').textContent = 'Failed to load image';
      return;
    }
    infoLoadedOnce = true;

    const ok = await fetchBuffer(meta.width, meta.height);
    if (!ok) {
      document.getElementById('badge').textContent = 'Failed to load image';
      return;
    }

    fitToWindow();
    layer.style.visibility = 'visible';
  })();

  window.addEventListener('resize', () => {
    if (viewMode === 'fit') fitToWindow();
  });

  let closing = false;

  async function closeImage() {
    if (closing) return;
    closing = true;
    try {
      const r = await fetch('/api/image', { method: 'DELETE', cache: 'no-store' });
      const json = await r.json();
      if (!json || json.success !== true) {
        showError(json?.error || 'Failed to close');
        closing = false;
        return;
      }
      location.href = '/';
    } catch {
      showError('Network error while closing');
      closing = false;
    }
  }

  if (closeBtn) closeBtn.addEventListener('click', closeImage);

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeImage();
    }
  });
})();
