/* =========================================================
   Pulse-AI — Scroll-driven frame sequence animation (hero intro)
   ========================================================= */

(function () {
    const TOTAL_FRAMES = 300;
    const FRAME_PATH = 'images/ezgif-frame-';
    const FRAME_EXT = '.jpg';
    const PAD_LENGTH = 3;

    const wrapper = document.getElementById('scroll-anim-wrapper');
    const canvas = document.getElementById('frame-canvas');
    const frameCtx = canvas ? canvas.getContext('2d') : null;
    const loadingEl = document.getElementById('scroll-anim-loading');
    const loadingPctEl = document.getElementById('loading-pct');
    const cueEl = document.getElementById('scroll-anim-cue');
    const scrimEl = document.getElementById('scrim-intro');

    const overlays = {
        intro: document.getElementById('overlay-intro'),
        outro: document.getElementById('overlay-outro'),
        dt: document.getElementById('label-dt'),
        svm: document.getElementById('label-svm'),
        rf: document.getElementById('label-rf'),
    };

    if (!wrapper || !canvas || !frameCtx) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const frames = new Array(TOTAL_FRAMES);
    let loadedCount = 0;
    let framesReady = false;
    let currentFrameIndex = -1;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    function frameUrl(i) {
        const num = String(i + 1).padStart(PAD_LENGTH, '0');
        return FRAME_PATH + num + FRAME_EXT;
    }

    function preloadFrames() {
        for (let i = 0; i < TOTAL_FRAMES; i++) {
            const img = new Image();
            img.onload = img.onerror = onFrameSettled;
            img.src = frameUrl(i);
            frames[i] = img;
        }
    }

    function onFrameSettled() {
        loadedCount++;
        const pct = Math.round((loadedCount / TOTAL_FRAMES) * 100);
        if (loadingPctEl) loadingPctEl.textContent = 'Loading ' + pct + '%';
        if (loadedCount === 1) drawFrame(0, true);
        if (loadedCount >= TOTAL_FRAMES) {
            framesReady = true;
            if (loadingEl) loadingEl.classList.add('hidden');
            updateScrollAnim();
        }
    }

    function resizeCanvas() {
        const stickyHeight = window.innerHeight;
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = window.innerWidth * dpr;
        canvas.height = stickyHeight * dpr;
        canvas.style.width = window.innerWidth + 'px';
        canvas.style.height = stickyHeight + 'px';
        frameCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        if (currentFrameIndex >= 0 && frames[currentFrameIndex] && frames[currentFrameIndex].complete) {
            drawFrame(currentFrameIndex, true);
        }
    }

    function drawFrame(index, force) {
        const img = frames[index];
        if (!img || !img.complete || img.naturalWidth === 0) return;
        if (index === currentFrameIndex && !force) return;
        currentFrameIndex = index;
        const cw = window.innerWidth;
        const ch = window.innerHeight;
        const iw = img.naturalWidth;
        const ih = img.naturalHeight;
        const scale = Math.max(cw / iw, ch / ih);
        const dw = iw * scale;
        const dh = ih * scale;
        const dx = (cw - dw) / 2;
        const dy = (ch - dh) / 2;
        frameCtx.clearRect(0, 0, cw, ch);
        frameCtx.drawImage(img, dx, dy, dw, dh);
    }

    function setOverlayOpacity(el, value) {
        if (el) el.style.opacity = value;
    }

    function fadeWindow(p, a1, a2, b1, b2) {
        if (p < a1 || p > b2) return 0;
        if (p < a2) return (p - a1) / (a2 - a1);
        if (p > b1) return 1 - (p - b1) / (b2 - b1);
        return 1;
    }

    function smoothstep(t) {
        t = Math.max(0, Math.min(1, t));
        return t * t * (3 - 2 * t);
    }

    function fadeIn(p, start, end) {
        return smoothstep((p - start) / (end - start));
    }

    function updateScrollAnim() {
        const rect = wrapper.getBoundingClientRect();
        const scrollDistance = wrapper.offsetHeight - window.innerHeight;
        const scrolled = -rect.top;
        let progress = scrollDistance > 0 ? scrolled / scrollDistance : 0;
        progress = Math.max(0, Math.min(1, progress));

        if (framesReady) {
            const frameIndex = Math.min(TOTAL_FRAMES - 1, Math.floor(progress * TOTAL_FRAMES));
            drawFrame(frameIndex);
        }

        // Overlay timings
        setOverlayOpacity(overlays.intro, fadeWindow(progress, 0, 0, 0.03, 0.08));
        setOverlayOpacity(overlays.dt,   fadeWindow(progress, 0.28, 0.34, 0.48, 0.55));
        setOverlayOpacity(overlays.svm,  fadeWindow(progress, 0.32, 0.38, 0.51, 0.58));
        setOverlayOpacity(overlays.rf,   fadeWindow(progress, 0.36, 0.42, 0.55, 0.62));
        setOverlayOpacity(overlays.outro, fadeWindow(progress, 0.74, 0.82, 0.90, 0.98));

        if (cueEl) cueEl.style.opacity = progress < 0.05 ? 1 : 0;

        // Iris‑out scrim
        const exitAmount = fadeIn(progress, 0.90, 1.0);
        if (scrimEl) scrimEl.style.opacity = exitAmount;
        canvas.style.transform = `scale(${1 + exitAmount * 0.05})`;
        canvas.style.filter = exitAmount > 0
            ? `blur(${(exitAmount * 6).toFixed(1)}px) brightness(${(1 - exitAmount * 0.35).toFixed(2)})`
            : 'none';
    }

    if (reduceMotion) {
        if (loadingEl) loadingEl.style.display = 'none';
        if (cueEl) cueEl.style.display = 'none';
        resizeCanvas();
        const img = new Image();
        img.onload = function () {
            frames[TOTAL_FRAMES - 1] = img;
            drawFrame(TOTAL_FRAMES - 1, true);
        };
        img.src = frameUrl(TOTAL_FRAMES - 1);
    } else {
        resizeCanvas();
        preloadFrames();
        lenis.on('scroll', updateScrollAnim);
        window.addEventListener('resize', () => {
            resizeCanvas();
            updateScrollAnim();
        });
    }
})();