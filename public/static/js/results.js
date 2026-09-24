/* ================= SAFETY INSTRUCTIONS ================= */
const SAFETY_INSTRUCTIONS = {
  'Seatbelt': {
    message: 'Thank you for wearing your seatbelt. Stay safe!',
    type: 'safe',
    keyword: 'Seatbelt Detected'
  },
  'Drinking': {
    message: 'Avoid drinking while driving - it impairs your judgment and reaction time.',
    type: 'danger',
    keyword: 'Drinking Detected'
  },
  'Smoking': {
    message: 'Smoking while driving is distracting and unsafe.',
    type: 'danger',
    keyword: 'Smoking Detected'
  },
  'Phone Usage': {
    message: 'Do not use your phone while driving. Pull over if you need to make a call.',
    type: 'danger',
    keyword: 'Phone Usage Detected'
  },
  'Drowsy': {
    message: 'You appear drowsy. Please take a break and rest immediately.',
    type: 'danger',
    keyword: 'Drowsiness Detected'
  },
  'Eating': {
    message: 'Eating while driving can be distracting. Please focus on the road.',
    type: 'danger',
    keyword: 'Eating Detected'
  },
  'Distracted': {
    message: 'Please focus on the road and eliminate distractions.',
    type: 'danger',
    keyword: 'Distraction Detected'
  }
};

/* ================= LOAD AND DISPLAY RESULTS ================= */
window.onload = () => {
  const resultsData = sessionStorage.getItem('dmsResults');
  const runtimeData = sessionStorage.getItem('dmsRuntimeConfig');
  const runtimeConfig = runtimeData ? JSON.parse(runtimeData) : { cnn_enabled: false };
  updateResultModelStatus(runtimeConfig);
  
  if (!resultsData) {
    console.log('No results found in session storage');
    document.getElementById('noResults').style.display = 'block';
    return;
  }
  
  const results = JSON.parse(resultsData);
  console.log(`Loaded ${results.length} results`);
  
  const resultsGrid = document.getElementById('resultsGrid');
  
  results.forEach((result, index) => {
    const card = renderResultCard(result, index);
    resultsGrid.appendChild(card);
  });
};

function updateResultModelStatus(runtimeConfig) {
  const status = document.getElementById('resultModelStatus');
  if (!status) return;

  if (runtimeConfig.cnn_enabled) {
    status.className = 'result-model-status local';
    status.textContent = 'Models used: Chaitanya YOLO + Soham YOLO + Mishra CNN';
  } else {
    status.className = 'result-model-status vercel';
    status.textContent = runtimeConfig.cnn_reason
      ? `Models used: Chaitanya YOLO + Soham YOLO. CNN skipped: ${runtimeConfig.cnn_reason}`
      : 'Models used: Chaitanya YOLO + Soham YOLO';
  }
}

/* ================= RENDER RESULT CARD ================= */
function renderResultCard(result, index) {
  const card = document.createElement('div');
  card.className = 'result-card';
  
  const detectedClasses = Object.keys(result.detections);
  const detectionCounts = {};
  Object.entries(result.detections).forEach(([cls, boxes]) => {
    detectionCounts[cls] = boxes.length;
  });
  
  const instructions = generateSafetyInstructions(detectedClasses, detectionCounts);
  
  const resultTable = document.createElement('div');
  resultTable.className = 'result-table';
  
  // Left: Image
  const imageCell = document.createElement('div');
  imageCell.className = 'image-cell';
  
  const imageWrapper = document.createElement('div');
  imageWrapper.className = 'image-wrapper';
  
  const img = document.createElement('img');
  img.className = 'result-image';
  img.src = result.imageData.dataUrl;
  img.alt = result.imageData.name;
  
  const canvas = document.createElement('canvas');
  canvas.className = 'detection-canvas';
  
  img.onload = () => {
    drawDetections(canvas, img, result.detections);
    syncCanvasWithImage(canvas, img);
  };
  
  window.addEventListener('resize', () => syncCanvasWithImage(canvas, img));
  
  imageWrapper.appendChild(img);
  imageWrapper.appendChild(canvas);
  imageCell.appendChild(imageWrapper);
  
  // Right: Info
  const infoCell = document.createElement('div');
  infoCell.className = 'info-cell';
  
  const infoHeader = document.createElement('div');
  infoHeader.className = 'info-header';
  
  const headerTitle = document.createElement('h3');
  headerTitle.textContent = 'Safety Analysis';
  
  const viewDetailsBtn = document.createElement('button');
  viewDetailsBtn.className = 'view-details-btn';
  viewDetailsBtn.textContent = 'View Detailed Report';
  viewDetailsBtn.onclick = () => showDetailedReport(result);
  
  infoHeader.appendChild(headerTitle);
  infoHeader.appendChild(viewDetailsBtn);
  
  const warningsTable = document.createElement('div');
  warningsTable.className = 'warnings-table';
  
  if (instructions.length === 0) {
    warningsTable.innerHTML = '<div class="no-detections">No behaviors detected</div>';
  } else {
    instructions.forEach(instruction => {
      const row = document.createElement('div');
      row.className = 'warning-row';
      
      const icon = document.createElement('div');
      icon.className = `warning-icon ${instruction.type}`;
      icon.textContent = instruction.type === 'safe' ? '✓' : '!';
      
      const content = document.createElement('div');
      content.className = 'warning-content';
      
      const label = document.createElement('div');
      label.className = instruction.type === 'safe' ? 'warning-label safe-label' : 'warning-label';
      
      const highlight = document.createElement('span');
      highlight.className = 'highlight';
      highlight.textContent = instruction.keyword;
      label.appendChild(highlight);
      
      if (instruction.count > 1) {
        const countBadge = document.createElement('span');
        countBadge.className = 'warning-count';
        countBadge.textContent = `${instruction.count}×`;
        label.appendChild(countBadge);
      }
      
      const text = document.createElement('div');
      text.className = 'warning-text';
      text.textContent = instruction.message;
      
      content.appendChild(label);
      content.appendChild(text);
      
      row.appendChild(icon);
      row.appendChild(content);
      warningsTable.appendChild(row);
    });
  }
  
  infoCell.appendChild(infoHeader);
  infoCell.appendChild(warningsTable);

  const cnnPanel = renderCnnPanel(result);
  if (cnnPanel) {
    infoCell.appendChild(cnnPanel);
  }
  
  resultTable.appendChild(imageCell);
  resultTable.appendChild(infoCell);
  card.appendChild(resultTable);
  
  return card;
}

function renderCnnPanel(result) {
  if (!result.cnnResult && !result.cnnError) {
    return null;
  }

  const panel = document.createElement('div');
  panel.className = result.cnnResult ? 'cnn-panel' : 'cnn-panel cnn-panel-error';

  const title = document.createElement('div');
  title.className = 'cnn-title';
  title.textContent = 'Mishra CNN Prediction';
  panel.appendChild(title);

  if (result.cnnResult) {
    const classRow = document.createElement('div');
    classRow.className = 'cnn-row';
    classRow.innerHTML = `<span>Class</span><strong>${result.cnnResult.class}</strong>`;

    const confidenceRow = document.createElement('div');
    confidenceRow.className = 'cnn-row';
    confidenceRow.innerHTML = `<span>Confidence</span><strong>${(result.cnnResult.confidence * 100).toFixed(2)}%</strong>`;

    panel.appendChild(classRow);
    panel.appendChild(confidenceRow);
  } else {
    const error = document.createElement('div');
    error.className = 'cnn-error';
    error.textContent = result.cnnError;
    panel.appendChild(error);
  }

  return panel;
}

/* ================= GENERATE SAFETY INSTRUCTIONS ================= */
function generateSafetyInstructions(detectedClasses, detectionCounts) {
  const instructions = [];
  
  const hasSeatbelt = detectedClasses.includes('Seatbelt');
  
  if (!hasSeatbelt) {
    instructions.push({
      keyword: 'No Seatbelt',
      message: 'Please fasten your seatbelt for your safety.',
      type: 'danger',
      count: 0,
      source: ''
    });
  }
  
  // Sort by priority (dangers first, then safe)
  const sortedClasses = detectedClasses.sort((a, b) => {
    const aType = SAFETY_INSTRUCTIONS[a]?.type || 'danger';
    const bType = SAFETY_INSTRUCTIONS[b]?.type || 'danger';
    if (aType === 'danger' && bType === 'safe') return -1;
    if (aType === 'safe' && bType === 'danger') return 1;
    return 0;
  });
  
  sortedClasses.forEach(unifiedClass => {
    if (SAFETY_INSTRUCTIONS[unifiedClass]) {
      instructions.push({
        keyword: SAFETY_INSTRUCTIONS[unifiedClass].keyword,
        message: SAFETY_INSTRUCTIONS[unifiedClass].message,
        type: SAFETY_INSTRUCTIONS[unifiedClass].type,
        count: detectionCounts[unifiedClass] || 1,
        source: ''
      });
    }
  });
  
  return instructions;
}

/* ================= DRAW DETECTIONS ================= */
function drawDetections(canvas, img, detections) {
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Enhanced drawing settings
  ctx.lineWidth = 4;
  ctx.font = 'bold 18px Inter, sans-serif';
  
  Object.entries(detections).forEach(([cls, boxes]) => {
    const isSafe = SAFETY_INSTRUCTIONS[cls]?.type === 'safe';
    const color = isSafe ? '#10b981' : '#dc2626';
    
    boxes.forEach((det) => {
      const [x1, y1, x2, y2] = det.bbox;
      const width = x2 - x1;
      const height = y2 - y1;
      
      // Draw bounding box with rounded corners
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      
      const radius = 8;
      ctx.beginPath();
      ctx.moveTo(x1 + radius, y1);
      ctx.lineTo(x2 - radius, y1);
      ctx.quadraticCurveTo(x2, y1, x2, y1 + radius);
      ctx.lineTo(x2, y2 - radius);
      ctx.quadraticCurveTo(x2, y2, x2 - radius, y2);
      ctx.lineTo(x1 + radius, y2);
      ctx.quadraticCurveTo(x1, y2, x1, y2 - radius);
      ctx.lineTo(x1, y1 + radius);
      ctx.quadraticCurveTo(x1, y1, x1 + radius, y1);
      ctx.closePath();
      ctx.stroke();
      
      // Draw label background
      const conf = `${(det.conf * 100).toFixed(0)}%`;
      const labelText = `${cls} ${conf}`;
      
      ctx.font = 'bold 16px Inter, sans-serif';
      const textMetrics = ctx.measureText(labelText);
      const textWidth = textMetrics.width;
      const textHeight = 20;
      
      const labelY = y1 > 35 ? y1 - 8 : y1 + height + 8;
      
      // Label background with shadow
      ctx.shadowColor = 'rgba(0,0,0,0.3)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 2;
      
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(x1 - 2, labelY - textHeight - 6, textWidth + 20, textHeight + 12, 6);
      ctx.fill();
      
      // Reset shadow
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      
      // Label text
      ctx.fillStyle = '#ffffff';
      ctx.fillText(labelText, x1 + 8, labelY - 6);
    });
  });
}

/* ================= SYNC CANVAS WITH IMAGE ================= */
function syncCanvasWithImage(canvas, img) {
  const imgRect = img.getBoundingClientRect();
  const imgNaturalWidth = img.naturalWidth;
  const imgNaturalHeight = img.naturalHeight;
  
  const displayAspect = imgRect.width / imgRect.height;
  const naturalAspect = imgNaturalWidth / imgNaturalHeight;
  
  let displayWidth, displayHeight, offsetX = 0, offsetY = 0;
  
  if (displayAspect > naturalAspect) {
    displayHeight = imgRect.height;
    displayWidth = displayHeight * naturalAspect;
    offsetX = (imgRect.width - displayWidth) / 2;
  } else {
    displayWidth = imgRect.width;
    displayHeight = displayWidth / naturalAspect;
    offsetY = (imgRect.height - displayHeight) / 2;
  }
  
  canvas.style.width = displayWidth + 'px';
  canvas.style.height = displayHeight + 'px';
  canvas.style.left = offsetX + 'px';
  canvas.style.top = offsetY + 'px';
}

/* ================= SHOW DETAILED REPORT MODAL ================= */
function showDetailedReport(result) {
  const modal = document.getElementById('detailModal');
  const modalTitle = document.getElementById('modalTitle');
  const modalBody = document.getElementById('modalBody');
  
  modalTitle.textContent = `Detailed Report - ${result.imageData.name}`;
  modalBody.innerHTML = '';
  const rawChaitanya = result.rawChaitanya;
  const rawSoham = result.rawSoham;
  const finalDetections = result.detections;
  
  // Chaitanya Model Section
  const chaitanyaSection = document.createElement('div');
  chaitanyaSection.className = 'model-section';
  chaitanyaSection.innerHTML = '<div class="model-title">Chaitanya Model Detections</div>';
  
  if (rawChaitanya.length === 0) {
    chaitanyaSection.innerHTML += '<div class="no-detections-table">No detections from this model</div>';
  } else {
    const chaitanyaTable = createDetectionTable(rawChaitanya);
    chaitanyaSection.appendChild(chaitanyaTable);
  }
  
  // Soham Model Section
  const sohamSection = document.createElement('div');
  sohamSection.className = 'model-section';
  sohamSection.innerHTML = '<div class="model-title">Soham Model Detections</div>';
  
  if (rawSoham.length === 0) {
    sohamSection.innerHTML += '<div class="no-detections-table">No detections from this model</div>';
  } else {
    const sohamTable = createDetectionTable(rawSoham);
    sohamSection.appendChild(sohamTable);
  }
  
  // Final Merged Section
  const finalSection = document.createElement('div');
  finalSection.className = 'model-section';
  finalSection.innerHTML = '<div class="model-title">Final Merged Detections (After NMS)</div>';
  
  const finalFlat = [];
  Object.entries(finalDetections).forEach(([cls, boxes]) => {
    boxes.forEach(box => {
      finalFlat.push({
        cls: cls,
        conf: box.conf,
        bbox: box.bbox,
        source: box.source
      });
    });
  });
  
  if (finalFlat.length === 0) {
    finalSection.innerHTML += '<div class="no-detections-table">No final detections</div>';
  } else {
    const finalTable = createDetectionTable(finalFlat);
    finalSection.appendChild(finalTable);
  }
  
  modalBody.appendChild(chaitanyaSection);
  modalBody.appendChild(sohamSection);
  modalBody.appendChild(finalSection);

  if (result.cnnResult || result.cnnError) {
    const cnnSection = document.createElement('div');
    cnnSection.className = 'model-section';
    cnnSection.innerHTML = '<div class="model-title">Mishra CNN Classification</div>';

    if (result.cnnResult) {
      const table = document.createElement('table');
      table.className = 'detection-table';
      table.innerHTML = `
        <thead>
          <tr>
            <th>Class</th>
            <th>Confidence</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="class-cell">${result.cnnResult.class}</td>
            <td class="conf-cell">${(result.cnnResult.confidence * 100).toFixed(1)}%</td>
            <td class="source-cell">Mishra CNN</td>
          </tr>
        </tbody>
      `;
      cnnSection.appendChild(table);
    } else {
      cnnSection.innerHTML += `<div class="no-detections-table">${result.cnnError}</div>`;
    }

    modalBody.appendChild(cnnSection);
  }
  
  // Show modal with animation
  modal.style.display = 'flex';
  setTimeout(() => modal.classList.add('active'), 10);
}

/* ================= CREATE DETECTION TABLE ================= */
function createDetectionTable(detections) {
  const table = document.createElement('table');
  table.className = 'detection-table';
  
  table.innerHTML = `
    <thead>
      <tr>
        <th>Class</th>
        <th>Confidence</th>
        <th>Bounding Box</th>
        <th>Source</th>
      </tr>
    </thead>
    <tbody>
    </tbody>
  `;
  
  const tbody = table.querySelector('tbody');
  
  // Sort by confidence descending
  const sortedDetections = [...detections].sort((a, b) => b.conf - a.conf);
  
  sortedDetections.forEach(det => {
    const row = document.createElement('tr');
    
    const clsCell = document.createElement('td');
    clsCell.className = 'class-cell';
    clsCell.textContent = det.cls;
    
    const confCell = document.createElement('td');
    confCell.className = 'conf-cell';
    confCell.textContent = (det.conf * 100).toFixed(1) + '%';
    
    const bboxCell = document.createElement('td');
    bboxCell.className = 'bbox-cell';
    const [x1, y1, x2, y2] = det.bbox.map(v => Math.round(v));
    bboxCell.textContent = `(${x1}, ${y1}) → (${x2}, ${y2})`;
    
    const sourceCell = document.createElement('td');
    sourceCell.className = 'source-cell';
    sourceCell.textContent = det.source || '-';
    
    row.appendChild(clsCell);
    row.appendChild(confCell);
    row.appendChild(bboxCell);
    row.appendChild(sourceCell);
    
    tbody.appendChild(row);
  });
  
  return table;
}

/* ================= MODAL CLOSE FUNCTIONALITY ================= */
document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('detailModal');
  const closeBtn = document.getElementById('modalCloseBtn');
  
  if (closeBtn) {
    closeBtn.onclick = () => {
      modal.classList.remove('active');
      setTimeout(() => {
        modal.style.display = 'none';
      }, 200);
    };
  }
  
  // Close on background click
  modal.onclick = (e) => {
    if (e.target === modal) {
      modal.classList.remove('active');
      setTimeout(() => {
        modal.style.display = 'none';
      }, 200);
    }
  };
  
  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.style.display === 'flex') {
      modal.classList.remove('active');
      setTimeout(() => {
        modal.style.display = 'none';
      }, 200);
    }
  });
});
