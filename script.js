const defaultSettings = {
  text: '僅供證明使用',
  fontSize: 32,
  gapX: 120,
  gapY: 100,
  opacity: 20,
  rotation: -30,
  color: '#999999',
  jpgQuality: 0.92
};

const settings = { ...defaultSettings };

const fileInput = document.querySelector('#fileInput');
const uploadArea = document.querySelector('#uploadArea');
const uploadSection = document.querySelector('#uploadSection');
const workspace = document.querySelector('.workspace');
const controlsPanel = document.querySelector('.controls-panel');
const previewPanel = document.querySelector('.preview-panel');
const settingsSection = document.querySelector('.settings-section');
const previewCanvas = document.querySelector('#previewCanvas');
const watermarkTextInput = document.querySelector('#watermarkText');
const fontSizeInput = document.querySelector('#fontSize');
const gapXInput = document.querySelector('#gapX');
const gapYInput = document.querySelector('#gapY');
const opacityInput = document.querySelector('#opacity');
const rotationInput = document.querySelector('#rotation');
const colorInput = document.querySelector('#color');
const downloadPngButton = document.querySelector('#downloadPng');
const downloadJpgButton = document.querySelector('#downloadJpg');
const resetButton = document.querySelector('#resetSettings');

const jpgQualityInput = document.querySelector('#jpgQuality');
const resetPreviewButton = document.querySelector('#resetSettingsPreview');
const fontSizeValue = document.querySelector('#fontSizeValue');
const gapXValue = document.querySelector('#gapXValue');
const gapYValue = document.querySelector('#gapYValue');
const opacityValue = document.querySelector('#opacityValue');
const rotationValue = document.querySelector('#rotationValue');
const colorValue = document.querySelector('#colorValue');
const jpgQualityValue = document.querySelector('#jpgQualityValue');
const errorMessage = document.querySelector('#errorMessage');
const emptyPreview = document.querySelector('#emptyPreview');
const imageMeta = document.querySelector('#imageMeta');

const canvasContext = previewCanvas.getContext('2d');
const controls = [
  watermarkTextInput,
  fontSizeInput,
  gapXInput,
  gapYInput,
  opacityInput,
  rotationInput,
  colorInput,
  jpgQualityInput,
  resetButton,
  resetPreviewButton
];

let loadedImage = null;
let loadedFileName = '';
let renderFrame = null;
let shouldHideUploadOnPhone = false;

const phoneLayoutQuery = window.matchMedia('(max-width: 640px)');

function init() {
  if (!window.FileReader || !window.Blob || !previewCanvas.getContext) {
    showError('你的瀏覽器不支援必要圖片處理 API，請改用較新版本瀏覽器。');
    return;
  }

  syncControlsFromSettings();
  updateControlsState();
  updateValueLabels();
  updateResponsiveUploadLayout();
  bindMediaQueryChange(phoneLayoutQuery, updateResponsiveUploadLayout);

  fileInput.addEventListener('change', () => {
    const [file] = fileInput.files;

    if (!file) {
      showError('沒有選擇檔案。');
      return;
    }

    handleFile(file);
  });

  uploadArea.addEventListener('dragenter', handleDragEnter);
  uploadArea.addEventListener('dragover', handleDragEnter);
  uploadArea.addEventListener('dragleave', handleDragLeave);
  uploadArea.addEventListener('drop', handleDrop);

  watermarkTextInput.addEventListener('input', () => {
    settings.text = watermarkTextInput.value;
    scheduleRender();
  });

  fontSizeInput.addEventListener('input', () => updateNumberSetting('fontSize', fontSizeInput));
  gapXInput.addEventListener('input', () => updateNumberSetting('gapX', gapXInput));
  gapYInput.addEventListener('input', () => updateNumberSetting('gapY', gapYInput));
  opacityInput.addEventListener('input', () => updateNumberSetting('opacity', opacityInput));
  rotationInput.addEventListener('input', () => updateNumberSetting('rotation', rotationInput));

  colorInput.addEventListener('input', () => {
    settings.color = colorInput.value;
    updateValueLabels();
    scheduleRender();
  });

  jpgQualityInput.addEventListener('input', () => {
    settings.jpgQuality = Number(jpgQualityInput.value);
    updateValueLabels();
  });

  resetButton.addEventListener('click', resetSettings);
  resetPreviewButton.addEventListener('click', resetSettings);
  downloadPngButton.addEventListener('click', () => downloadImage('png'));
  downloadJpgButton.addEventListener('click', () => downloadImage('jpg'));
}

function handleFile(file) {
  clearError();

  if (!file) {
    showError('沒有選擇檔案。');
    return;
  }

  if (!isImageFile(file)) {
    showError('請選擇圖片檔案。');
    return;
  }

  loadImageFromFile(file)
    .then((image) => {
      loadedImage = image;
      loadedFileName = file.name;
      shouldHideUploadOnPhone = true;
      updatePreviewAspectClass(image);
      renderCanvas();
      updateControlsState();
      updateResponsiveUploadLayout();
      imageMeta.textContent = `${loadedFileName} · ${image.naturalWidth} × ${image.naturalHeight}px`;
    })
    .catch(() => {
      showError('圖片讀取失敗，請確認檔案格式是否受瀏覽器支援。');
    })
    .finally(() => {
      fileInput.value = '';
    });
}

function isImageFile(file) {
  const imageExtensionPattern = /\.(jpe?g|png|webp|gif|bmp|svg)$/i;

  if (file.type) {
    return file.type.startsWith('image/') || imageExtensionPattern.test(file.name);
  }

  return imageExtensionPattern.test(file.name);
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.addEventListener('error', reject);
    reader.addEventListener('load', () => {
      const image = new Image();

      image.addEventListener('load', () => resolve(image), { once: true });
      image.addEventListener('error', reject, { once: true });
      image.src = reader.result;
    });

    reader.readAsDataURL(file);
  });
}

function renderCanvas() {
  if (!loadedImage) {
    return;
  }

  const width = loadedImage.naturalWidth;
  const height = loadedImage.naturalHeight;

  previewCanvas.width = width;
  previewCanvas.height = height;
  canvasContext.clearRect(0, 0, width, height);
  canvasContext.drawImage(loadedImage, 0, 0, width, height);

  if (!settings.text.trim()) {
    updatePreviewVisibility();
    return;
  }

  canvasContext.save();
  canvasContext.globalAlpha = settings.opacity / 100;
  canvasContext.fillStyle = settings.color;
  canvasContext.font = `${settings.fontSize}px ${getCanvasFontFamily()}`;
  canvasContext.textAlign = 'center';
  canvasContext.textBaseline = 'middle';

  const angle = (settings.rotation * Math.PI) / 180;
  canvasContext.translate(width / 2, height / 2);
  canvasContext.rotate(angle);

  const diagonal = Math.sqrt(width * width + height * height);
  const drawWidth = diagonal * 2;
  const drawHeight = diagonal * 2;
  const textMetrics = canvasContext.measureText(settings.text);
  const textWidth = Math.max(textMetrics.width, settings.fontSize);
  const stepX = Math.max(textWidth + settings.gapX, 12);
  const stepY = Math.max(settings.fontSize + settings.gapY, 12);

  let rowIndex = 0;
  for (let y = -drawHeight / 2; y <= drawHeight / 2; y += stepY) {
    const rowOffset = rowIndex % 2 === 0 ? 0 : stepX / 2;

    for (let x = -drawWidth / 2 - stepX; x <= drawWidth / 2 + stepX; x += stepX) {
      canvasContext.fillText(settings.text, x + rowOffset, y);
    }

    rowIndex += 1;
  }

  canvasContext.restore();
  updatePreviewVisibility();
}

function updateControlsState() {
  const hasImage = Boolean(loadedImage);

  controls.forEach((control) => {
    control.disabled = !hasImage;
  });

  downloadPngButton.disabled = !hasImage;
  downloadJpgButton.disabled = !hasImage;
  updatePreviewVisibility();
}

function updateValueLabels() {
  fontSizeValue.value = `${settings.fontSize} px`;
  gapXValue.value = `${settings.gapX} px`;
  gapYValue.value = `${settings.gapY} px`;
  opacityValue.value = `${settings.opacity}%`;
  rotationValue.value = `${settings.rotation}°`;
  colorValue.value = settings.color.toUpperCase();
  jpgQualityValue.value = settings.jpgQuality.toFixed(2);
}

function resetSettings() {
  shouldHideUploadOnPhone = false;
  updateResponsiveUploadLayout();
  Object.assign(settings, defaultSettings);
  syncControlsFromSettings();
  updateValueLabels();
  renderCanvas();
}

function downloadImage(type) {
  if (!loadedImage) {
    showError('請先匯入圖片。');
    return;
  }

  renderCanvas();

  const isJpg = type === 'jpg';
  const mimeType = isJpg ? 'image/jpeg' : 'image/png';
  const fileName = isJpg ? 'watermarked-image.jpg' : 'watermarked-image.png';
  const quality = isJpg ? settings.jpgQuality : undefined;

  try {
    previewCanvas.toBlob(
      (blob) => {
        if (!blob) {
          showError('圖片匯出失敗，請稍後再試。');
          return;
        }

        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(downloadUrl);
        clearError();
      },
      mimeType,
      quality
    );
  } catch (error) {
    showError('圖片匯出失敗，瀏覽器無法處理呢個檔案。');
  }
}

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.classList.add('is-visible');
}

function clearError() {
  errorMessage.textContent = '';
  errorMessage.classList.remove('is-visible');
}

function updateNumberSetting(key, input) {
  settings[key] = Number(input.value);
  updateValueLabels();
  scheduleRender();
}

function syncControlsFromSettings() {
  watermarkTextInput.value = settings.text;
  fontSizeInput.value = String(settings.fontSize);
  gapXInput.value = String(settings.gapX);
  gapYInput.value = String(settings.gapY);
  opacityInput.value = String(settings.opacity);
  rotationInput.value = String(settings.rotation);
  colorInput.value = settings.color;
  jpgQualityInput.value = String(settings.jpgQuality);
}

function scheduleRender() {
  if (!loadedImage) {
    return;
  }

  if (renderFrame) {
    cancelAnimationFrame(renderFrame);
  }

  renderFrame = requestAnimationFrame(() => {
    renderFrame = null;
    renderCanvas();
  });
}

function updatePreviewVisibility() {
  const hasImage = Boolean(loadedImage);
  previewCanvas.classList.toggle('is-visible', hasImage);
  emptyPreview.classList.toggle('is-hidden', hasImage);
}

function updatePreviewAspectClass(image) {
  const isPortrait = image.naturalHeight / image.naturalWidth >= 1.3;
  previewPanel.classList.toggle('is-portrait-preview', isPortrait);
}

function updateResponsiveUploadLayout() {
  const useInlinePreview = shouldHideUploadOnPhone && phoneLayoutQuery.matches;

  uploadSection.hidden = useInlinePreview;
  previewPanel.classList.toggle('is-inline-mobile-preview', useInlinePreview);

  if (useInlinePreview) {
    controlsPanel.insertBefore(previewPanel, settingsSection);
    return;
  }

  if (previewPanel.parentElement !== workspace) {
    workspace.insertBefore(previewPanel, controlsPanel.nextSibling);
  }
}

function bindMediaQueryChange(mediaQuery, handler) {
  if (typeof mediaQuery.addEventListener === 'function') {
    mediaQuery.addEventListener('change', handler);
    return;
  }

  mediaQuery.addListener(handler);
}

function getCanvasFontFamily() {
  return '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif';
}

function handleDragEnter(event) {
  event.preventDefault();
  uploadArea.classList.add('is-dragover');
}

function handleDragLeave(event) {
  event.preventDefault();

  if (!uploadArea.contains(event.relatedTarget)) {
    uploadArea.classList.remove('is-dragover');
  }
}

function handleDrop(event) {
  event.preventDefault();
  uploadArea.classList.remove('is-dragover');

  const [file] = event.dataTransfer.files;

  if (!file) {
    showError('沒有偵測到可匯入嘅檔案。');
    return;
  }

  handleFile(file);
}

document.addEventListener('DOMContentLoaded', init);
