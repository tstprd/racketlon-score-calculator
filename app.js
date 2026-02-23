/**
 * Racketlon Calc - Main Application
 */

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initScoreInputs();
  initPhotoCapture();
  updateAnalysis();
});

/**
 * Tab navigation
 */
function initTabs() {
  const tabs = document.querySelectorAll('.tab');
  const contents = document.querySelectorAll('.tab-content');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetId = tab.dataset.tab + '-tab';
      
      tabs.forEach(t => t.classList.remove('active'));
      contents.forEach(c => c.classList.remove('active'));
      
      tab.classList.add('active');
      document.getElementById(targetId).classList.add('active');
    });
  });
}

/**
 * Score input handling
 */
function initScoreInputs() {
  const playerAInput = document.getElementById('playerA');
  const playerBInput = document.getElementById('playerB');
  const headerA = document.getElementById('headerA');
  const headerB = document.getElementById('headerB');
  
  // Update headers when names change
  playerAInput.addEventListener('input', () => {
    headerA.textContent = playerAInput.value || 'A';
    updateAnalysis();
  });
  
  playerBInput.addEventListener('input', () => {
    headerB.textContent = playerBInput.value || 'B';
    updateAnalysis();
  });
  
  // Score inputs
  const scoreInputs = document.querySelectorAll('.score-input');
  scoreInputs.forEach(input => {
    input.addEventListener('input', () => {
      // Cap at 21
      if (input.value !== '' && parseInt(input.value) > 21) {
        input.value = 21;
      }
      updateTotals();
      updateAnalysis();
    });
    
    // Also validate on blur
    input.addEventListener('blur', () => {
      if (input.value !== '' && parseInt(input.value) > 21) {
        input.value = 21;
      }
    });
    
    // Select all on focus for easy editing
    input.addEventListener('focus', () => {
      input.select();
    });
  });
  
  // Quick 21 buttons
  const btn21s = document.querySelectorAll('.btn-21');
  btn21s.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.target;
      const cell = btn.closest('.score-cell');
      const input = cell.querySelector(`.${target}`);
      if (input) {
        input.value = 21;
        updateTotals();
        updateAnalysis();
      }
    });
  });
  
  // Clear all button
  document.getElementById('clearAll').addEventListener('click', () => {
    // Clear player names
    document.getElementById('playerA').value = '';
    document.getElementById('playerB').value = '';
    document.getElementById('headerA').textContent = 'A';
    document.getElementById('headerB').textContent = 'B';
    
    // Clear all scores
    document.querySelectorAll('.score-input').forEach(input => {
      input.value = '';
    });
    
    updateTotals();
    updateAnalysis();
  });
}

/**
 * Get current scores from inputs
 */
function getScores() {
  const scores = {};
  const rows = document.querySelectorAll('.score-row[data-sport]');
  
  rows.forEach(row => {
    const sport = row.dataset.sport;
    const scoreA = row.querySelector('.scoreA').value;
    const scoreB = row.querySelector('.scoreB').value;
    
    if (scoreA !== '' && scoreB !== '') {
      scores[sport] = `${scoreA}-${scoreB}`;
    }
  });
  
  return scores;
}

/**
 * Set scores to inputs
 */
function setScores(scores) {
  for (const [sport, score] of Object.entries(scores)) {
    if (!score) continue;
    
    const match = score.match(/(\d+)-(\d+)/);
    if (!match) continue;
    
    const row = document.querySelector(`.score-row[data-sport="${sport}"]`);
    if (row) {
      row.querySelector('.scoreA').value = match[1];
      row.querySelector('.scoreB').value = match[2];
    }
  }
  
  updateTotals();
  updateAnalysis();
}

/**
 * Update total displays
 */
function updateTotals() {
  let totalA = 0;
  let totalB = 0;
  
  const rows = document.querySelectorAll('.score-row[data-sport]');
  rows.forEach(row => {
    const scoreA = parseInt(row.querySelector('.scoreA').value) || 0;
    const scoreB = parseInt(row.querySelector('.scoreB').value) || 0;
    
    // Only count if both scores are entered
    if (row.querySelector('.scoreA').value !== '' && row.querySelector('.scoreB').value !== '') {
      totalA += scoreA;
      totalB += scoreB;
    }
  });
  
  document.getElementById('totalA').textContent = totalA;
  document.getElementById('totalB').textContent = totalB;
  
  // Update delta display
  const delta = totalA - totalB;
  const deltaText = document.getElementById('deltaText');
  const playerA = document.getElementById('playerA').value || 'Joueur A';
  const playerB = document.getElementById('playerB').value || 'Joueur B';
  
  if (delta > 0) {
    deltaText.textContent = `${playerA} mène de ${delta} pts`;
    deltaText.className = 'delta-positive';
  } else if (delta < 0) {
    deltaText.textContent = `${playerB} mène de ${Math.abs(delta)} pts`;
    deltaText.className = 'delta-negative';
  } else {
    deltaText.textContent = 'Égalité';
    deltaText.className = 'delta-zero';
  }
}

/**
 * Update analysis section
 */
function updateAnalysis() {
  const scores = getScores();
  const playerA = document.getElementById('playerA').value || 'Joueur A';
  const playerB = document.getElementById('playerB').value || 'Joueur B';
  
  const container = document.getElementById('analysisContent');
  
  // Check if any scores are entered
  if (Object.keys(scores).length === 0) {
    container.innerHTML = '<p class="placeholder">Entrez les scores pour voir l\'analyse</p>';
    return;
  }
  
  // Run analysis
  const result = analyzeMatch(scores, playerA, playerB);
  
  // Build HTML
  let html = '';
  
  // Status summary
  if (result.status === 'finished' && result.winner) {
    html += `<div class="analysis-item winner">🏆 ${result.winner} remporte le match !</div>`;
  } else if (result.status === 'gummiarm') {
    html += `<div class="analysis-item gummiarm">⚡ GUMMIARM ! Un point décisif au tennis</div>`;
  }
  
  // Score summary
  html += `<div class="analysis-item">
    📊 Score total : <strong>${result.totalA}</strong> - <strong>${result.totalB}</strong>
    (${result.sportsPlayed}/4 sports joués)
  </div>`;
  
  // Detailed analysis
  for (const item of result.analysis) {
    const cssClass = item.type || 'scenario';
    html += `<div class="analysis-item ${cssClass}">${item.message}</div>`;
  }
  
  container.innerHTML = html;
}

/**
 * Photo capture and OCR
 */
function initPhotoCapture() {
  const photoInput = document.getElementById('photoInput');
  const photoPreview = document.getElementById('photoPreview');
  const previewImage = document.getElementById('previewImage');
  const processBtn = document.getElementById('processPhoto');
  const ocrStatus = document.getElementById('ocrStatus');
  const ocrResult = document.getElementById('ocrResult');
  const ocrText = document.getElementById('ocrText');
  const applyBtn = document.getElementById('applyOcr');
  
  let lastOcrResult = null;
  
  photoInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      previewImage.src = e.target.result;
      photoPreview.classList.remove('hidden');
      ocrResult.classList.add('hidden');
    };
    reader.readAsDataURL(file);
  });
  
  processBtn.addEventListener('click', async () => {
    const file = photoInput.files[0];
    if (!file) return;
    
    ocrStatus.classList.remove('hidden');
    ocrResult.classList.add('hidden');
    processBtn.disabled = true;
    
    const statusText = ocrStatus.querySelector('span');
    
    try {
      lastOcrResult = await ocrRacketlonSheet(file, (status, progress) => {
        if (status === 'recognizing text') {
          statusText.textContent = `Reconnaissance... ${Math.round(progress * 100)}%`;
        } else {
          statusText.textContent = status;
        }
      });
      
      ocrText.textContent = lastOcrResult.raw || '(Aucun texte détecté)';
      ocrStatus.classList.add('hidden');
      ocrResult.classList.remove('hidden');
      
      // Show what was found
      if (Object.values(lastOcrResult.scores).some(s => s !== null)) {
        const found = Object.entries(lastOcrResult.scores)
          .filter(([k, v]) => v !== null)
          .map(([k, v]) => `${k}: ${v}`)
          .join(', ');
        ocrText.textContent += `\n\n📋 Scores détectés:\n${found}`;
        
        if (lastOcrResult.playerA) {
          ocrText.textContent += `\n\n👤 Joueurs: ${lastOcrResult.playerA} vs ${lastOcrResult.playerB}`;
        }
      }
    } catch (err) {
      statusText.textContent = `Erreur: ${err.message}`;
      console.error('OCR error:', err);
    } finally {
      processBtn.disabled = false;
    }
  });
  
  applyBtn.addEventListener('click', () => {
    if (!lastOcrResult) return;
    
    // Apply player names if found
    if (lastOcrResult.playerA) {
      document.getElementById('playerA').value = lastOcrResult.playerA;
      document.getElementById('headerA').textContent = lastOcrResult.playerA;
    }
    if (lastOcrResult.playerB) {
      document.getElementById('playerB').value = lastOcrResult.playerB;
      document.getElementById('headerB').textContent = lastOcrResult.playerB;
    }
    
    // Apply scores
    setScores(lastOcrResult.scores);
    
    // Switch to manual tab
    document.querySelector('.tab[data-tab="manual"]').click();
  });
}

// Service worker registration for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {
      // SW registration failed, app still works
    });
  });
}
