/* ================= CONFIGURATION ================= */
ort.env.wasm.numThreads = navigator.hardwareConcurrency || 4;
ort.env.wasm.simd = true;

const MODEL_PATHS = {
  chaitanya: "/static/models/chaitanya_best.onnx",
  soham: "/static/models/soham_best.onnx"
};

const INPUT_SIZE = 640;
const CONF_THRES = 0.25;
const IOU_THRES = 0.45;

/* ================= GLOBAL MODEL CACHE ================= */
let modelCache = {
  chaitanya: null,
  soham: null
};

/* ================= STATE ================= */
let uploadedImages = [];
let processedResults = [];
let demoImages = [];
let selectedDemoImages = new Set();
let runtimeConfigPromise = null;

/* ================= DEMO MODAL FUNCTIONALITY ================= */
document.getElementById('demoBtn').onclick = async () => {
  const modal = document.getElementById('demoModal');
  const modalBody = document.getElementById('modalBody');
  
  // Show modal with animation
  modal.style.display = 'flex';
  setTimeout(() => modal.classList.add('active'), 10);
  
  // Load demo images
  try {
    modalBody.innerHTML = '<div class="loading-state"><div class="loading-spinner"></div><p>Loading demo images...</p></div>';
    
    // Fetch list of demo images from JSON file
    const response = await fetch('/demo-images/images.json');
    if (!response.ok) {
      throw new Error('Failed to load demo images list');
    }
    
    const imageList = await response.json();
    
    if (!Array.isArray(imageList) || imageList.length === 0) {
      modalBody.innerHTML = '<div class="error-state"><p>No demo images found</p></div>';
      return;
    }
    
    // Map to image objects
    demoImages = imageList.map(filename => ({
      name: filename,
      url: `/demo-images/${filename}`
    }));
    
    console.log(`Loaded ${demoImages.length} demo images`);
    
    // Render demo images grid
    renderDemoGrid();
    
  } catch (error) {
    console.error('Error loading demo images:', error);
    modalBody.innerHTML = `<div class="error-state"><p>Error loading demo images: ${error.message}</p></div>`;
  }
};

function renderDemoGrid() {
  const modalBody = document.getElementById('modalBody');
  const grid = document.createElement('div');
  grid.className = 'demo-grid';
  
  demoImages.forEach((image, index) => {
    const item = document.createElement('div');
    item.className = 'demo-image-item';
    if (selectedDemoImages.has(index)) {
      item.classList.add('selected');
    }
    
    item.innerHTML = `
      <img src="${image.url}" alt="${image.name}" loading="lazy">
      <div class="demo-checkbox"></div>
      <div class="demo-image-name">${image.name}</div>
    `;
    
    item.onclick = () => toggleDemoImage(index);
    grid.appendChild(item);
  });
  
  modalBody.innerHTML = '';
  modalBody.appendChild(grid);
  updateSelectionCount();
}

function toggleDemoImage(index) {
  if (selectedDemoImages.has(index)) {
    selectedDemoImages.delete(index);
  } else {
    selectedDemoImages.add(index);
  }
  
  const items = document.querySelectorAll('.demo-image-item');
  if (items[index]) {
    items[index].classList.toggle('selected');
  }
  
  updateSelectionCount();
}

function updateSelectionCount() {
  const count = selectedDemoImages.size;
  document.getElementById('selectionCount').textContent = `${count} image${count !== 1 ? 's' : ''} selected`;
  document.getElementById('modalProcessBtn').disabled = count === 0;
}

document.getElementById('selectAllBtn').onclick = () => {
  selectedDemoImages.clear();
  demoImages.forEach((_, index) => selectedDemoImages.add(index));
  document.querySelectorAll('.demo-image-item').forEach(item => item.classList.add('selected'));
  updateSelectionCount();
};

document.getElementById('unselectAllBtn').onclick = () => {
  selectedDemoImages.clear();
  document.querySelectorAll('.demo-image-item').forEach(item => item.classList.remove('selected'));
  updateSelectionCount();
};

function closeModal() {
  const modal = document.getElementById('demoModal');
  modal.classList.remove('active');
  setTimeout(() => {
    modal.style.display = 'none';
  }, 300);
}

document.getElementById('closeModal').onclick = closeModal;
document.getElementById('modalCloseBtn').onclick = closeModal;

document.getElementById('demoModal').onclick = (e) => {
  if (e.target.id === 'demoModal') {
    closeModal();
  }
};

document.getElementById('modalProcessBtn').onclick = async () => {
  if (selectedDemoImages.size === 0) return;
  
  closeModal();
  
  const selectedIndices = Array.from(selectedDemoImages);

  uploadedImages = [];
  setUploadStatus(
    `${selectedIndices.length} demo image${selectedIndices.length > 1 ? 's' : ''} selected - preparing...`,
    true
  );
  document.getElementById('processBtn').disabled = true;
  document.getElementById('clearBtn').style.display = 'flex';

  const loadedImages = await Promise.all(
    selectedIndices.map(async (index) => {
      const image = demoImages[index];

      try {
        const response = await fetch(image.url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const blob = await response.blob();
        const dataUrl = await blobToDataUrl(blob);

        return {
          name: image.name,
          dataUrl: dataUrl
        };
      } catch (error) {
        console.error(`Error loading ${image.name}:`, error);
        return null;
      }
    })
  );

  uploadedImages = loadedImages.filter(Boolean);

  if (uploadedImages.length > 0) {
    setUploadStatus(
      `${uploadedImages.length} demo image${uploadedImages.length > 1 ? 's' : ''} ready`,
      false
    );
    document.getElementById('processBtn').disabled = false;
  } else {
    setUploadStatus('Demo images could not be loaded. Try again.', false);
    document.getElementById('processBtn').disabled = true;
  }
  
  // Clear selection
  selectedDemoImages.clear();
};

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve({
      name: file.name,
      dataUrl: event.target.result
    });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function setUploadStatus(message, isLoading = false) {
  const uploadArea = document.getElementById('uploadArea');
  const fileCount = document.getElementById('fileCount');

  uploadArea.classList.add('has-files');
  fileCount.style.display = 'inline-flex';
  fileCount.classList.toggle('loading', isLoading);
  fileCount.textContent = message;
}

async function getRuntimeConfig() {
  if (!runtimeConfigPromise) {
    runtimeConfigPromise = fetch('/api/runtime-config', { cache: 'no-store' })
      .then(response => {
        if (response.ok) {
          return response.json();
        }

        return {
          cnn_enabled: false,
          cnn_reason: 'Local CNN API not found. Restart python app.py from the repo root.'
        };
      })
      .catch(() => ({
        cnn_enabled: false,
        cnn_reason: 'Local CNN API unreachable. Open the site from http://127.0.0.1:5000 after starting python app.py.'
      }));
  }

  return runtimeConfigPromise;
}

function updateModelStatus(runtimeConfig) {
  const cnnModelChip = document.getElementById('cnnModelChip');
  if (!cnnModelChip) return;

  if (runtimeConfig.cnn_enabled) {
    cnnModelChip.className = 'model-chip enabled';
    cnnModelChip.textContent = 'Mishra CNN';
  } else {
    cnnModelChip.className = 'model-chip disabled';
    cnnModelChip.textContent = runtimeConfig.cnn_reason
      ? `Mishra CNN - ${runtimeConfig.cnn_reason}`
      : 'Mishra CNN';
  }
}

async function runLocalCnn(imageData) {
  const response = await fetch('/api/cnn', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: imageData.name,
      image: imageData.dataUrl
    })
  });

  if (!response.ok) {
    throw new Error('Local CNN prediction failed');
  }

  return response.json();
}

/* ================= PRELOAD MODELS (LAZY) ================= */
async function preloadModels(progressCallback) {
  if (modelCache.chaitanya && modelCache.soham) {
    return; // Already loaded
  }
  
  try {
    if (!modelCache.chaitanya) {
      progressCallback('Loading Chaitanya model...', 10);
      modelCache.chaitanya = await ort.InferenceSession.create(MODEL_PATHS.chaitanya, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all'
      });
      console.log('✓ Chaitanya model loaded');
    }
    
    progressCallback('Loading Chaitanya model...', 30);
    
    if (!modelCache.soham) {
      progressCallback('Loading Soham model...', 40);
      modelCache.soham = await ort.InferenceSession.create(MODEL_PATHS.soham, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all'
      });
      console.log('✓ Soham model loaded');
    }
    
    progressCallback('Models ready', 60);
  } catch (error) {
    console.error('Model loading error:', error);
    throw new Error('Failed to load AI models: ' + error.message);
  }
}

/* ================= FILE HANDLING ================= */
document.getElementById('uploadArea').onclick = () => {
  document.getElementById('fileInput').click();
};

document.getElementById('fileInput').onchange = (e) => {
  const files = Array.from(e.target.files);
  if (files.length === 0) return;
  
  uploadedImages = [];
  setUploadStatus(`${files.length} file${files.length > 1 ? 's' : ''} selected - preparing...`, true);
  document.getElementById('processBtn').disabled = true;
  document.getElementById('clearBtn').style.display = 'flex';

  Promise.all(files.map(readFileAsDataUrl))
    .then((images) => {
      uploadedImages = images;
      setUploadStatus(`${files.length} file${files.length > 1 ? 's' : ''} ready`, false);
      document.getElementById('processBtn').disabled = false;
    })
    .catch((error) => {
      console.error('Error loading uploaded files:', error);
      setUploadStatus('Some files could not be loaded. Try again.', false);
      document.getElementById('processBtn').disabled = true;
    });
};

document.getElementById('clearBtn').onclick = () => {
  uploadedImages = [];
  document.getElementById('fileInput').value = '';
  document.getElementById('processBtn').disabled = true;
  document.getElementById('clearBtn').style.display = 'none';
  
  const uploadArea = document.getElementById('uploadArea');
  uploadArea.classList.remove('has-files');
  
  const fileCount = document.getElementById('fileCount');
  fileCount.style.display = 'none';
  fileCount.classList.remove('loading');
  fileCount.textContent = '';
};

document.getElementById('processBtn').onclick = async () => {
  if (uploadedImages.length === 0) return;
  
  const overlay = document.getElementById('processingOverlay');
  const progressFill = document.getElementById('progressFill');
  const processingText = document.getElementById('processingText');
  
  overlay.style.display = 'flex';
  
  const updateProgress = (text, percent) => {
    processingText.textContent = text;
    progressFill.style.width = percent + '%';
  };
  
  try {
    // Load models first
    await preloadModels(updateProgress);
    
    updateProgress('Processing images...', 65);
    
    processedResults = [];
    const runtimeConfig = await getRuntimeConfig();
    updateModelStatus(runtimeConfig);
    
    for (let i = 0; i < uploadedImages.length; i++) {
      const imageData = uploadedImages[i];
      updateProgress(`Processing image ${i + 1} of ${uploadedImages.length}...`, 65 + (i / uploadedImages.length) * 30);
      
      const img = await loadImage(imageData.dataUrl);
      const prep = preprocess(img);
      
      // Run inference
      const chaitanyaResult = await modelCache.chaitanya.run({ images: prep.tensor });
      const sohamResult = await modelCache.soham.run({ images: prep.tensor });
      
      const chaitanyaDetections = parseDetections(chaitanyaResult, prep, img.width, img.height, 'chaitanya');
      const sohamDetections = parseDetections(sohamResult, prep, img.width, img.height, 'soham');
      
      const finalDetections = confidenceBasedMerge(chaitanyaDetections, sohamDetections);
      let cnnResult = null;
      let cnnError = null;

      if (runtimeConfig.cnn_enabled) {
        updateProgress(`Running CNN model for image ${i + 1} of ${uploadedImages.length}...`, 65 + (i / uploadedImages.length) * 30);

        try {
          cnnResult = await runLocalCnn(imageData);
        } catch (error) {
          console.error('CNN prediction error:', error);
          cnnError = error.message;
        }
      }
      
      processedResults.push({
        imageData: imageData,
        detections: finalDetections,
        rawChaitanya: chaitanyaDetections,
        rawSoham: sohamDetections,
        cnnResult: cnnResult,
        cnnError: cnnError
      });
    }
    
    updateProgress('Complete! Redirecting...', 100);
    
    sessionStorage.setItem('dmsResults', JSON.stringify(processedResults));
    sessionStorage.setItem('dmsRuntimeConfig', JSON.stringify(runtimeConfig));
    
    setTimeout(() => {
      window.location.href = 'results.html';
    }, 400);
    
  } catch (error) {
    console.error('Processing error:', error);
    alert('Error processing images: ' + error.message);
    overlay.style.display = 'none';
  }
};

/* ================= HELPER FUNCTIONS ================= */
function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

function preprocess(img) {
  const canvas = document.createElement('canvas');
  canvas.width = INPUT_SIZE;
  canvas.height = INPUT_SIZE;
  const ctx = canvas.getContext('2d');
  
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, INPUT_SIZE, INPUT_SIZE);
  
  const scale = Math.min(INPUT_SIZE / img.width, INPUT_SIZE / img.height);
  const newWidth = img.width * scale;
  const newHeight = img.height * scale;
  const offsetX = (INPUT_SIZE - newWidth) / 2;
  const offsetY = (INPUT_SIZE - newHeight) / 2;
  
  ctx.drawImage(img, offsetX, offsetY, newWidth, newHeight);
  
  const imageData = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE);
  const pixels = imageData.data;
  const float32Data = new Float32Array(3 * INPUT_SIZE * INPUT_SIZE);
  
  for (let i = 0; i < INPUT_SIZE * INPUT_SIZE; i++) {
    float32Data[i] = pixels[i * 4] / 255.0;
    float32Data[INPUT_SIZE * INPUT_SIZE + i] = pixels[i * 4 + 1] / 255.0;
    float32Data[2 * INPUT_SIZE * INPUT_SIZE + i] = pixels[i * 4 + 2] / 255.0;
  }
  
  return {
    tensor: new ort.Tensor('float32', float32Data, [1, 3, INPUT_SIZE, INPUT_SIZE]),
    scale: scale,
    offsetX: offsetX,
    offsetY: offsetY
  };
}

const CHAITANYA_CLASSES = ['Cigarette', 'Drinking', 'Eating', 'Phone', 'Seatbelt'];
const SOHAM_CLASSES = ['Distracted', 'Drinking', 'Drowsy', 'Eating', 'PhoneUse', 'SafeDriving', 'Seatbelt', 'Smoking'];

const UNIFIED_MAPPING = {
  'Cigarette': 'Smoking',
  'Smoking': 'Smoking',
  'Drinking': 'Drinking',
  'Eating': 'Eating',
  'Phone': 'Phone Usage',
  'PhoneUse': 'Phone Usage',
  'Seatbelt': 'Seatbelt',
  'Distracted': 'Distracted',
  'Drowsy': 'Drowsy',
  'SafeDriving': 'Safe Driving'
};

function parseDetections(result, prep, imgWidth, imgHeight, modelName) {
  const classes = modelName === 'chaitanya' ? CHAITANYA_CLASSES : SOHAM_CLASSES;
  const outputName = Object.keys(result)[0];
  const output = result[outputName];
  const data = output.data;
  const shape = output.dims;
  
  let numClasses, numDetections;
  
  if (shape.length === 3 && shape[0] === 1) {
    numClasses = shape[1] - 4;
    numDetections = shape[2];
  } else {
    console.error('Unexpected output shape:', shape);
    return [];
  }
  
  const detections = [];
  
  for (let j = 0; j < numDetections; j++) {
    let maxScore = 0;
    let maxIndex = 0;
    
    for (let k = 0; k < numClasses; k++) {
      const score = data[(4 + k) * numDetections + j];
      if (score > maxScore) {
        maxScore = score;
        maxIndex = k;
      }
    }
    
    if (maxScore > CONF_THRES) {
      const x = data[j];
      const y = data[numDetections + j];
      const w = data[2 * numDetections + j];
      const h = data[3 * numDetections + j];
      
      const x1 = Math.max(0, (x - w / 2 - prep.offsetX) / prep.scale);
      const y1 = Math.max(0, (y - h / 2 - prep.offsetY) / prep.scale);
      const x2 = Math.min(imgWidth, (x + w / 2 - prep.offsetX) / prep.scale);
      const y2 = Math.min(imgHeight, (y + h / 2 - prep.offsetY) / prep.scale);
      
      const originalClass = classes[maxIndex];
      const unifiedClass = UNIFIED_MAPPING[originalClass] || originalClass;
      
      detections.push({
        bbox: [x1, y1, x2, y2],
        conf: maxScore,
        cls: unifiedClass,
        originalClass: originalClass,
        source: modelName === 'chaitanya' ? 'Chaitanya' : 'Soham'
      });
    }
  }
  
  return detections;
}

function iou(box1, box2) {
  const x1 = Math.max(box1[0], box2[0]);
  const y1 = Math.max(box1[1], box2[1]);
  const x2 = Math.min(box1[2], box2[2]);
  const y2 = Math.min(box1[3], box2[3]);
  
  const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const area1 = (box1[2] - box1[0]) * (box1[3] - box1[1]);
  const area2 = (box2[2] - box2[0]) * (box2[3] - box2[1]);
  const union = area1 + area2 - intersection;
  
  return union > 0 ? intersection / union : 0;
}

function getBoxCenter(box) {
  return {
    x: (box[0] + box[2]) / 2,
    y: (box[1] + box[3]) / 2
  };
}

function boxesOverlap(box1, box2, iouThreshold) {
  const iouValue = iou(box1, box2);
  if (iouValue > iouThreshold) return true;
  
  const center1 = getBoxCenter(box1);
  const center2 = getBoxCenter(box2);
  
  const center1InBox2 = center1.x >= box2[0] && center1.x <= box2[2] && 
                        center1.y >= box2[1] && center1.y <= box2[3];
  const center2InBox1 = center2.x >= box1[0] && center2.x <= box1[2] && 
                        center2.y >= box1[1] && center2.y <= box1[3];
  
  return center1InBox2 || center2InBox1;
}

function nonMaxSuppression(boxes, iouThreshold) {
  if (boxes.length === 0) return [];
  
  boxes.sort((a, b) => b.conf - a.conf);
  const keep = [];
  
  while (boxes.length > 0) {
    const best = boxes.shift();
    keep.push(best);
    boxes = boxes.filter(box => !boxesOverlap(best.bbox, box.bbox, iouThreshold));
  }
  
  return keep;
}

function confidenceBasedMerge(chaitanyaDetections, sohamDetections) {
  const allDetectionsByClass = {};
  
  chaitanyaDetections.forEach(det => {
    if (!allDetectionsByClass[det.cls]) {
      allDetectionsByClass[det.cls] = [];
    }
    allDetectionsByClass[det.cls].push(det);
  });
  
  sohamDetections.forEach(det => {
    if (det.cls === 'Safe Driving') return;
    
    if (!allDetectionsByClass[det.cls]) {
      allDetectionsByClass[det.cls] = [];
    }
    allDetectionsByClass[det.cls].push(det);
  });
  
  const finalDetections = {};
  
  for (const [cls, boxes] of Object.entries(allDetectionsByClass)) {
    const filteredBoxes = nonMaxSuppression(boxes, IOU_THRES);
    
    if (filteredBoxes.length > 0) {
      finalDetections[cls] = filteredBoxes;
    }
  }
  
  return finalDetections;
}

/* ================= INITIALIZE ================= */
// Ensure Clear button is hidden initially
document.getElementById('clearBtn').style.display = 'none';
getRuntimeConfig().then(updateModelStatus);

console.log('DMS Web Application initialized');
