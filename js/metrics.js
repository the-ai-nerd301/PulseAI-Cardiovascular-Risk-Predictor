/* =========================================================
   Pulse-AI — Model performance dashboard (mini cards + bar/ROC/radar charts)
   ========================================================= */

// Perf mini cards
function renderPerfMiniCards() {
    const container = document.getElementById('perf-mini-cards');
    const metrics = {
        '🌳 Decision Tree': { Accuracy: 0.86, Precision: 0.84, Recall: 0.83, 'F1': 0.835 },
        '🔲 SVM': { Accuracy: 0.88, Precision: 0.87, Recall: 0.85, 'F1': 0.860 },
        '🌲 Random Forest': { Accuracy: 0.91, Precision: 0.90, Recall: 0.89, 'F1': 0.895 },
    };
    let html = '';
    for (const [model, m] of Object.entries(metrics)) {
        html +=
            `<div class="card" style="margin-bottom:16px;padding:18px 20px;"><strong style="font-family:var(--font-display);font-size:0.9rem;">${model}</strong><div class="perf-mini-row" style="margin-top:10px;">`;
        for (const [k, v] of Object.entries(m)) {
            html +=
                `<div class="perf-mini"><div class="perf-label">${k}</div><div class="perf-value">${(v*100).toFixed(1)}%</div></div>`;
        }
        html += `</div></div>`;
    }
    container.innerHTML = html;
}
renderPerfMiniCards();
// Charts init
let chartsInit = false;
const metricsSec = document.getElementById('metrics-section');
const metricsObs = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && !chartsInit) {
        chartsInit = true;
        setTimeout(initAllCharts, 300);
        metricsObs.unobserve(metricsSec);
    }
}, { threshold: 0.08 });
if (metricsSec) metricsObs.observe(metricsSec);
function initAllCharts() {
    const barCtx = document.getElementById('chart-bar')?.getContext('2d');
    if (barCtx) new Chart(barCtx, {
        type: 'bar',
        data: {
            labels: ['Accuracy', 'Precision', 'Recall', 'F1', 'AUC-ROC'],
            datasets: [
                { label: 'Decision Tree', data: [0.86, 0.84, 0.83, 0.835, 0.84],
                    backgroundColor: 'rgba(74,144,217,0.55)', borderColor: 'rgba(74,144,217,0.9)',
                    borderWidth: 1.5, borderRadius: 6 },
                { label: 'SVM', data: [0.88, 0.87, 0.85, 0.86, 0.90], backgroundColor: 'rgba(124,92,231,0.55)',
                    borderColor: 'rgba(124,92,231,0.9)', borderWidth: 1.5, borderRadius: 6 },
                { label: 'Random Forest', data: [0.91, 0.90, 0.89, 0.895, 0.94],
                    backgroundColor: 'rgba(240,160,64,0.55)', borderColor: 'rgba(240,160,64,0.9)',
                    borderWidth: 1.5, borderRadius: 6 },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: { legend: { labels: { color: '#8898b0', font: { family: 'Inter', size: 11 },
                        usePointStyle: true, pointStyleWidth: 10 } } },
            scales: {
                x: { ticks: { color: '#8898b0', font: { family: 'Inter', size: 10 } },
                    grid: { color: 'rgba(255,255,255,0.04)' } },
                y: { min: 0.6, max: 1.0, ticks: { color: '#8898b0', font: { family: 'Inter', size: 10 },
                        callback: v => (v * 100).toFixed(0) + '%' }, grid: { color: 'rgba(255,255,255,0.05)' } },
            },
        },
    });
    const rocCtx = document.getElementById('chart-roc')?.getContext('2d');
    if (rocCtx) new Chart(rocCtx, {
        type: 'line',
        data: {
            labels: [0, 0.05, 0.1, 0.15, 0.22, 0.3, 0.4, 0.55, 0.7, 1],
            datasets: [
                { label: 'Decision Tree (AUC=0.84)', data: [0, 0.35, 0.52, 0.62, 0.71, 0.78, 0.83, 0.87, 0.90,
                        1
                    ], borderColor: '#4a90d9', borderWidth: 2.5, tension: 0.4, pointRadius: 0,
                    backgroundColor: 'transparent' },
                { label: 'SVM (AUC=0.90)', data: [0, 0.42, 0.58, 0.70, 0.78, 0.85, 0.89, 0.92, 0.94, 1],
                    borderColor: '#7c5ce7', borderWidth: 2.5, tension: 0.4, pointRadius: 0,
                    backgroundColor: 'transparent' },
                { label: 'Random Forest (AUC=0.94)', data: [0, 0.48, 0.65, 0.76, 0.84, 0.90, 0.93, 0.95, 0.97,
                        1
                    ], borderColor: '#f0a040', borderWidth: 2.5, tension: 0.4, pointRadius: 0,
                    backgroundColor: 'transparent' },
                { label: 'Random (AUC=0.50)', data: [0, 0.05, 0.1, 0.15, 0.22, 0.3, 0.4, 0.55, 0.7, 1],
                    borderColor: 'rgba(255,255,255,0.3)', borderWidth: 1.5, borderDash: [6, 6], tension: 0,
                    pointRadius: 0, backgroundColor: 'transparent' },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: { legend: { labels: { color: '#8898b0', font: { family: 'Inter', size: 10 },
                        usePointStyle: true, pointStyleWidth: 8 } } },
            scales: {
                x: { title: { text: 'False Positive Rate', color: '#8898b0', font: { family: 'Inter',
                            size: 10 } }, ticks: { color: '#8898b0', font: { family: 'Inter', size: 9 } },
                    grid: { color: 'rgba(255,255,255,0.04)' } },
                y: { title: { text: 'True Positive Rate', color: '#8898b0', font: { family: 'Inter',
                            size: 10 } }, ticks: { color: '#8898b0', font: { family: 'Inter', size: 9 } },
                    grid: { color: 'rgba(255,255,255,0.05)' } },
            },
        },
    });
    const radarCtx = document.getElementById('chart-radar')?.getContext('2d');
    if (radarCtx) new Chart(radarCtx, {
        type: 'radar',
        data: {
            labels: ['Accuracy', 'Precision', 'Recall', 'F1 Score', 'AUC-ROC', 'Robustness'],
            datasets: [
                { label: 'Decision Tree', data: [0.86, 0.84, 0.83, 0.835, 0.84, 0.72],
                    borderColor: '#4a90d9', backgroundColor: 'rgba(74,144,217,0.12)', borderWidth: 2,
                    pointRadius: 3, pointBackgroundColor: '#4a90d9' },
                { label: 'SVM', data: [0.88, 0.87, 0.85, 0.86, 0.90, 0.80], borderColor: '#7c5ce7',
                    backgroundColor: 'rgba(124,92,231,0.12)', borderWidth: 2, pointRadius: 3,
                    pointBackgroundColor: '#7c5ce7' },
                { label: 'Random Forest', data: [0.91, 0.90, 0.89, 0.895, 0.94, 0.88],
                    borderColor: '#f0a040', backgroundColor: 'rgba(240,160,64,0.12)', borderWidth: 2,
                    pointRadius: 3, pointBackgroundColor: '#f0a040' },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: { legend: { labels: { color: '#8898b0', font: { family: 'Inter', size: 11 },
                        usePointStyle: true, pointStyleWidth: 10 } } },
            scales: {
                r: { min: 0.5, max: 1.0, ticks: { color: '#8898b0', backdropColor: 'transparent',
                        font: { family: 'Inter', size: 9 }, callback: v => (v * 100).toFixed(0) + '%',
                        stepSize: 0.1 }, grid: { color: 'rgba(255,255,255,0.1)' },
                    angleLines: { color: 'rgba(255,255,255,0.07)' }, pointLabels: { color: '#b8c0d0',
                        font: { family: 'Inter', size: 10, weight: '600' } } },
            },
        },
    });
}
console.log('%c🫀 Pulse-AI %cEnhanced Dashboard Ready',
    'font-size:1.3em;font-weight:900;color:#00d4aa;', 'font-size:1em;color:#8898b0;');
console.log('%cFeatures: 3-model prediction | AI consensus voting | Health gauges | Explanations | Performance dashboard',
    'color:#f0a040;');
    