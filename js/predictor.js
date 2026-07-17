/* =========================================================
   Pulse-AI — ONNX-based prediction (full file)
   ========================================================= */

// ── ONNX environment (single‑threaded, local WASM) ──
ort.env.wasm.numThreads = 1;
ort.env.wasm.proxy = false;
ort.env.wasm.cacheWasm = false;
// No wasmPaths – use the default CDN URL (already loaded by the <script> tag)

let onnxModels = null;
let modelsLoading = false;

// ── Feature engineering (mirrors the Python code exactly) ──
function calculateBMI(weightKg, heightCm) {
    const heightM = heightCm / 100;
    return parseFloat((weightKg / (heightM * heightM)).toFixed(2));
}

function calculatePulsePressure(apHi, apLo) {
    return apHi - apLo;
}

function calculateBPCategory(apHi, apLo) {
    if (apHi < 120 && apLo < 80) return 0;          // Normal
    if (apHi >= 120 && apHi <= 129 && apLo < 80) return 1; // Elevated
    return 2;                                        // High
}

function buildInputArray(patient) {
    const bmi = calculateBMI(patient.weight, patient.height);
    const pulsePressure = calculatePulsePressure(patient.ap_hi, patient.ap_lo);
    const bpCategory = calculateBPCategory(patient.ap_hi, patient.ap_lo);
    return [
        patient.age,
        patient.gender,          // 2 for male, 1 for female
        patient.height,
        patient.weight,
        patient.ap_hi,
        patient.ap_lo,
        patient.cholesterol,     // 1,2,3
        patient.gluc,            // 1,2,3
        patient.smoke,           // 0/1
        patient.alco,            // 0/1
        patient.active,          // 0/1
        bmi,
        pulsePressure,
        bpCategory,
    ];
}

// ── Model loading ──
async function loadONNXModel(modelPath) {
    try {
        const response = await fetch(modelPath);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const arrayBuffer = await response.arrayBuffer();
        const session = await ort.InferenceSession.create(arrayBuffer, {
            executionProviders: ['cpu'],
        });
        console.log(`✅ Loaded: ${modelPath} | Outputs: ${session.outputNames.join(', ')}`);
        return session;
    } catch (err) {
        console.error(`❌ Failed to load ${modelPath}:`, err);
        return null;
    }
}

async function preloadAllModels() {
    if (modelsLoading) return;
    modelsLoading = true;
    showToast('Loading AI models...', 'success');

    const [dt, rf, svm] = await Promise.all([
        loadONNXModel('models/decision_tree.onnx'),
        loadONNXModel('models/random_forest.onnx'),
        loadONNXModel('models/svm.onnx'),
    ]);

    onnxModels = { decisionTree: dt, randomForest: rf, svm: svm };
    modelsLoading = false;

    const loaded = [dt, rf, svm].filter(Boolean).length;
    if (loaded === 3) showToast('All AI models loaded.', 'success');
    else showToast(`Only ${loaded}/3 models loaded – some predictions will use demo mode.`, 'warning');
}

// ── Inference ──
async function runSingleModel(session, inputArray) {
    const tensor = new ort.Tensor('float32', new Float32Array(inputArray), [1, inputArray.length]);
    const feeds = { float_input: tensor };
    const results = await session.run(feeds);

    // Robust output name detection
    const outKey = session.outputNames.find(name =>
        name.includes('probability') || name.includes('probabilities')
    ) || session.outputNames[0];
    const proba = results[outKey].data;
    if (!proba || proba.length < 2) throw new Error('Unexpected output length');
    const probHigh = proba[1] || proba[proba.length - 1];
    const confidence = Math.round(probHigh * 1000) / 10;
    const prediction = probHigh >= 0.5 ? 1 : 0;
    return { prediction, confidence };
}

async function runAllModels(patient) {
    const inputArray = buildInputArray(patient);
    const results = {};
    const modelMap = {
        'Decision Tree': onnxModels.decisionTree,
        'Random Forest': onnxModels.randomForest,
        'SVM': onnxModels.svm,
    };

    for (const [name, session] of Object.entries(modelMap)) {
        if (!session) {
            const sim = simulatePrediction(name, patient);
            results[name] = { ...sim, demo: true };
            continue;
        }
        try {
            const { prediction, confidence } = await runSingleModel(session, inputArray);
            results[name] = { prediction, confidence, demo: false };
        } catch (e) {
            console.warn(`Inference failed for ${name}:`, e);
            const sim = simulatePrediction(name, patient);
            results[name] = { ...sim, demo: true };
        }
    }
    return results;
}

// ── Simulation fallback (unchanged) ──
function simulatePrediction(modelName, patient) {
    let risk = 0;
    risk += getBPCat() * 22;
    risk += (getBMI() > 30) ? 20 : ((getBMI() > 25) ? 8 : 0);
    risk += (patient.cholesterol - 1) * 12;
    risk += (patient.gluc - 1) * 8;
    risk += patient.smoke * 10;
    risk += patient.alco * 8;
    risk -= patient.active * 8;
    risk += Math.max(0, (patient.age - 40)) * 0.5;
    const offset = { 'Decision Tree': -4, 'Random Forest': 0, 'SVM': 4 }[modelName] || 0;
    risk += offset;
    const pred = risk >= 45 ? 1 : 0;
    const conf = Math.min(96, Math.max(52, 50 + Math.abs(risk - 45) * 0.9));
    return { prediction: pred, confidence: Math.round(conf * 10) / 10, demo: true };
}

function majorityVote(results) {
    const votes = Object.values(results).map(r => r.prediction);
    const high = votes.filter(v => v === 1).length;
    const low = votes.length - high;
    const final = high > low ? 1 : 0;
    const agreement = (Math.max(high, low) / votes.length) * 100;
    return { final, high, low, total: votes.length, agreement };
}

function generateExplanations(patient) {
    const expl = [];
    const bpCat = getBPCat();
    if (bpCat === 2) expl.push({ icon: '⚠️', text: 'Elevated blood pressure (High BP category) significantly increased risk.' });
    else if (bpCat === 1) expl.push({ icon: '⚠️', text: 'Blood pressure is elevated — worth monitoring closely.' });
    const bmi = getBMI();
    if (bmi > 30) expl.push({ icon: '⚠️', text: `High BMI (${bmi.toFixed(1)}) detected — contributes to cardiovascular risk.` });
    if (patient.cholesterol === 3) expl.push({ icon: '⚠️', text: 'High cholesterol level is a contributing risk factor.' });
    if (patient.smoke === 1) expl.push({ icon: '⚠️', text: 'Smoking is a significant contributing risk factor.' });
    if (patient.active === 1) expl.push({ icon: '✅', text: 'Physical activity is a positive health factor reducing risk.' });
    if (expl.length === 0) expl.push({ icon: 'ℹ️', text: 'No significant risk factors detected among monitored indicators.' });
    return expl;
}

// ── UI animation helpers (unchanged) ──
function animateRing(ringId, targetPercent, confId, duration = 1600) {
    const ring = document.getElementById(ringId);
    const confEl = document.getElementById(confId);
    const circumference = 326.73;
    const targetOffset = circumference - (targetPercent / 100) * circumference;
    ring.style.transition = 'none';
    ring.style.strokeDashoffset = circumference;
    confEl.textContent = '0';
    ring.getBoundingClientRect();
    ring.style.transition = `stroke-dashoffset ${duration}ms cubic-bezier(0.22, 0.61, 0.36, 1)`;
    ring.style.strokeDashoffset = targetOffset;
    const startTime = performance.now();
    function updateNumber(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        confEl.textContent = Math.round(eased * targetPercent);
        if (progress < 1) requestAnimationFrame(updateNumber);
        else confEl.textContent = targetPercent;
    }
    requestAnimationFrame(updateNumber);
}

let confChartInstance = null;
function renderConfidenceChart(results) {
    const ctx = document.getElementById('chart-conf-bar')?.getContext('2d');
    if (!ctx) return;
    if (confChartInstance) confChartInstance.destroy();
    const names = Object.keys(results);
    const confs = names.map(n => results[n].confidence);
    const colors = names.map(n => results[n].prediction === 1 ? '#ff5c72' : '#2ed573');
    confChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: names,
            datasets: [{ data: confs, backgroundColor: colors, borderRadius: 8, borderWidth: 0, barThickness: 48 }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { color: '#8898b0', font: { family: 'Inter', size: 11 } }, grid: { color: 'rgba(255,255,255,0.03)' } },
                y: { min: 0, max: 100, ticks: { color: '#8898b0', font: { family: 'Inter', size: 10 }, callback: v => v + '%' }, grid: { color: 'rgba(255,255,255,0.05)' } },
            },
        },
    });
}

// ── Health gauges (unchanged) ──
let gaugeCharts = {};
function renderHealthGauges(patient) {
    Object.values(gaugeCharts).forEach(c => c.destroy());
    gaugeCharts = {};
    const bmi = getBMI();
    const sbp = patient.ap_hi || 120;
    const chol = patient.cholesterol || 1;
    function createGauge(canvasId, value, max, title, zones) {
        const ctx = document.getElementById(canvasId)?.getContext('2d');
        if (!ctx) return;
        const needleVal = Math.min(max, Math.max(0, value));
        gaugeCharts[canvasId] = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: zones.map(z => z.label),
                datasets: [
                    { data: zones.map(z => z.range[1] - z.range[0]), backgroundColor: zones.map(z => z.color), borderWidth: 0, borderRadius: 4 },
                    { data: [needleVal, max - needleVal], backgroundColor: ['rgba(255,255,255,0.85)', 'transparent'], borderWidth: 0, weight: 0.3 },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                cutout: '75%',
                rotation: -90,
                circumference: 180,
                plugins: { legend: { display: false }, tooltip: { enabled: false } },
            },
            plugins: [{
                id: 'centerText',
                afterDraw(chart) {
                    const { ctx, chartArea: { width, height, top, left } } = chart;
                    ctx.save();
                    ctx.font = '700 28px "JetBrains Mono"';
                    ctx.fillStyle = '#e2eaf4';
                    ctx.textAlign = 'center';
                    ctx.fillText(value, left + width / 2, top + height * 0.65);
                    ctx.font = '500 12px Inter';
                    ctx.fillStyle = '#8898b0';
                    ctx.fillText(title, left + width / 2, top + height * 0.85);
                    ctx.restore();
                }
            }],
        });
    }
    createGauge('gauge-bmi', bmi, 50, 'BMI', [
        { range: [0, 18.5], label: 'Under', color: 'rgba(74,144,217,0.35)' },
        { range: [18.5, 25], label: 'Normal', color: 'rgba(46,213,115,0.4)' },
        { range: [25, 30], label: 'Over', color: 'rgba(240,160,64,0.4)' },
        { range: [30, 50], label: 'Obese', color: 'rgba(255,92,114,0.4)' },
    ]);
    createGauge('gauge-sbp', sbp, 220, 'mmHg', [
        { range: [0, 120], label: 'Normal', color: 'rgba(46,213,115,0.4)' },
        { range: [120, 140], label: 'Elevated', color: 'rgba(240,160,64,0.4)' },
        { range: [140, 220], label: 'High', color: 'rgba(255,92,114,0.4)' },
    ]);
    createGauge('gauge-chol', chol, 3, 'Level', [
        { range: [0, 1], label: 'Normal', color: 'rgba(46,213,115,0.4)' },
        { range: [1, 2], label: 'Above', color: 'rgba(240,160,64,0.4)' },
        { range: [2, 3], label: 'High', color: 'rgba(255,92,114,0.4)' },
    ]);
}

// ── Form input helpers ──
function updateAutoMetrics() {
    const h = parseFloat(document.getElementById('height')?.value);
    const w = parseFloat(document.getElementById('weight')?.value);
    const hi = parseInt(document.getElementById('ap_hi')?.value);
    const lo = parseInt(document.getElementById('ap_lo')?.value);
    const bmiEl = document.getElementById('calc-bmi');
    const ppEl = document.getElementById('calc-pp');
    const bpcatEl = document.getElementById('calc-bpcat');
    if (h && w && h > 0) { const bmi = (w / ((h / 100) ** 2)).toFixed(2); bmiEl.textContent = bmi; } else bmiEl.textContent = '--';
    if (hi && lo) { ppEl.textContent = (hi - lo).toString(); } else ppEl.textContent = '--';
    if (hi && lo) {
        let cat = 'Normal';
        if (hi >= 140 || lo >= 90) cat = 'High';
        else if (hi >= 120 || lo >= 80) cat = 'Elevated';
        bpcatEl.textContent = cat;
    } else bpcatEl.textContent = '--';
}

function getPatientData() {
    return {
        age: parseInt(document.getElementById('age').value) || 45,
        gender: document.getElementById('gender').value === 'male' ? 2 : 1,
        height: parseFloat(document.getElementById('height').value) || 170,
        weight: parseFloat(document.getElementById('weight').value) || 75,
        ap_hi: parseInt(document.getElementById('ap_hi').value) || 120,
        ap_lo: parseInt(document.getElementById('ap_lo').value) || 80,
        cholesterol: parseInt(document.getElementById('cholesterol').value) || 1,
        gluc: parseInt(document.getElementById('gluc').value) || 1,
        smoke: parseInt(document.getElementById('smoke').value) || 0,
        alco: parseInt(document.getElementById('alco').value) || 0,
        active: parseInt(document.getElementById('active').value) || 0,
        family_history: document.getElementById('family_history').value === 'yes' ? 1 : 0,
    };
}

function getBMI() {
    const h = parseFloat(document.getElementById('height')?.value);
    const w = parseFloat(document.getElementById('weight')?.value);
    return (h && w && h > 0) ? parseFloat((w / ((h / 100) ** 2)).toFixed(2)) : 25;
}

function getBPCat() {
    const hi = parseInt(document.getElementById('ap_hi')?.value) || 120;
    const lo = parseInt(document.getElementById('ap_lo')?.value) || 80;
    if (hi >= 140 || lo >= 90) return 2;
    if (hi >= 120 || lo >= 80) return 1;
    return 0;
}

// ── Auto‑calculate on input change ──
['height', 'weight', 'ap_hi', 'ap_lo'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', updateAutoMetrics);
});

// ── Form submit handler ──
async function handlePredict(e) {
    e.preventDefault();
    const patient = getPatientData();
    if (!patient.age || patient.age < 18 || patient.age > 100) {
        showToast('⚠️ Please enter a valid age (18-100).', 'warning');
        return;
    }
    if (!onnxModels) {
        showToast('Models are still loading – please wait a moment.', 'warning');
        return;
    }

    const results = await runAllModels(patient);
    const vote = majorityVote(results);
    const rs = document.getElementById('results-section');
    rs.classList.add('visible');
    rs.classList.remove('revealed');
    setTimeout(() => {
        revealObserver.observe(rs);
        rs.querySelectorAll('.reveal').forEach(el => {
            el.classList.remove('revealed');
            revealObserver.observe(el);
        });
    }, 80);

    ['Decision Tree', 'SVM', 'Random Forest'].forEach((name, i) => {
        const key = name === 'Support Vector Machine' ? 'SVM' : name;
        const r = results[key] || results[name];
        const cardKey = ['dt', 'svm', 'rf'][i];
        const isHigh = r.prediction === 1;
        document.getElementById('risk-' + cardKey).textContent = isHigh ? 'High Risk' : 'Low Risk';
        document.getElementById('risk-' + cardKey).className = 'risk-badge ' + (isHigh ? 'high' : 'low');
        document.getElementById('demo-' + cardKey).textContent = r.demo ? '⚡ DEMO' : '';
        setTimeout(() => animateRing('ring-' + cardKey, r.confidence, 'conf-' + cardKey), 150 + i * 250);
    });

    const cc = document.getElementById('consensus-container');
    cc.style.display = 'block';
    const cb = document.getElementById('consensus-box');
    cb.className = 'consensus-box ' + (vote.final === 1 ? 'consensus-high' : 'consensus-low');
    document.getElementById('consensus-votes').textContent =
        `${vote.final===1?vote.high:vote.low}/${vote.total} models predicted ${vote.final===1?'High Risk':'Low Risk'}`;
    document.getElementById('consensus-verdict').textContent =
        'FINAL AI DECISION: ' + (vote.final === 1 ? 'HIGH CARDIOVASCULAR RISK' : 'LOW CARDIOVASCULAR RISK');
    document.getElementById('consensus-agreement').textContent = 'Agreement: ' + Math.round(vote.agreement) + '%';
    renderConfidenceChart(results);

    document.getElementById('health-indicators-section').style.display = 'block';
    document.getElementById('explanation-section').style.display = 'block';
    document.getElementById('explain-list').innerHTML = generateExplanations(patient).map(e =>
        `<div class="explain-item"><span class="explain-icon">${e.icon}</span><span>${e.text}</span></div>`
    ).join('');
    setTimeout(() => renderHealthGauges(patient), 400);

    lenis.scrollTo('#results-section', { offset: -40, duration: 0.9 });
    showToast('✅ Multi-model analysis complete!', 'success');
}

// ── Start loading models when page is ready ──
window.addEventListener('DOMContentLoaded', () => {
    preloadAllModels();
});