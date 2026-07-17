/* =========================================================
   Pulse-AI — Core: smooth scroll, nav, reveal-on-scroll, particle background, toast helper
   ========================================================= */

const lenis = new Lenis({ duration: 1.5, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true, wheelMultiplier: 0.9, touchMultiplier: 1.5 });
function raf(time) { lenis.raf(time); requestAnimationFrame(raf); }
requestAnimationFrame(raf);
document.querySelectorAll('a[href^="#"]').forEach(a => a.addEventListener('click', function(e) { e.preventDefault(); const t =
        document.querySelector(this.getAttribute('href')); if (t) lenis.scrollTo(t, { offset: -50, duration: 1.1 }); }));

const nav = document.getElementById('nav');
lenis.on('scroll', ({ scroll }) => { nav.classList.toggle('scrolled', scroll > 70); });
const revealEls = document.querySelectorAll('.reveal');
const revealObserver = new IntersectionObserver((entries) => { entries.forEach(e => { if (e.isIntersecting) e.target
        .classList.add('revealed'); }); }, { threshold: 0.12, rootMargin: '0px 0px -25px 0px' });
revealEls.forEach(el => revealObserver.observe(el));
const canvas = document.getElementById('particle-canvas');
const ctx = canvas.getContext('2d');
let particles = [];
const pc = 55;
function resizeCanvas() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
resizeCanvas();
window.addEventListener('resize', resizeCanvas);
class Particle {
    constructor() { this.reset(); this.y = Math.random() * canvas.height; }
    reset() { this.x = Math.random() * canvas.width; this.y = -10; this.size = Math.random() * 2.4 + 0.7;
        this.speedY = Math.random() * 0.38 + 0.14; this.speedX = (Math.random() - 0.5) * 0.28;
        this.opacity = Math.random() * 0.5 + 0.18; this.hue = Math.random() < 0.5 ? 170 : 210; }
    update() { this.y += this.speedY; this.x += this.speedX; if (this.y > canvas.height + 10 || this.x < -10 || this.x > canvas.width + 10) { this
                .reset(); this.y = -10; } }
    draw(ctx) { ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${this.hue},80%,65%,${this.opacity})`; ctx.fill();
        ctx.beginPath(); ctx.arc(this.x, this.y, this.size * 2.4, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${this.hue},80%,65%,${this.opacity*0.11})`; ctx.fill(); }
}
for (let i = 0; i < pc; i++) particles.push(new Particle());
function animateParticles() { ctx.clearRect(0, 0, canvas.width, canvas.height); particles.forEach(p => { p.update(); p.draw(ctx); });
    requestAnimationFrame(animateParticles); }
animateParticles();

const toast = document.getElementById('toast');
function showToast(msg, type = 'success') { toast.textContent = msg; toast.className = 'toast ' + type + ' show';
    clearTimeout(toast._timeout); toast._timeout = setTimeout(() => toast.classList.remove('show'), 2600); }

/* ── Scroll‑spy for active nav link ── */
const navLinks = document.querySelectorAll('.nav-link');
const sections = Array.from(navLinks).map(link => {
    const id = link.getAttribute('href').substring(1);
    return document.getElementById(id);
}).filter(Boolean);

function updateActiveNav() {
    const scrollY = window.scrollY + 100;
    let current = '';
    sections.forEach(section => {
        if (section && scrollY >= section.offsetTop) {
            current = section.id;
        }
    });
    navLinks.forEach(link => {
        const href = link.getAttribute('href').substring(1);
        link.classList.toggle('active', href === current);
    });
}

lenis.on('scroll', updateActiveNav);
window.addEventListener('resize', updateActiveNav);
updateActiveNav();

/* ── Scroll progress bar ── */
const progressBar = document.getElementById('scroll-progress');
lenis.on('scroll', () => {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (progressBar) progressBar.style.width = (max > 0 ? (scrollTop / max) * 100 : 0) + '%';
});

/* ── Custom pulse cursor ── */
if (window.matchMedia('(pointer: fine)').matches) {
    const cursorEl = document.createElement('div');
    cursorEl.id = 'cursor-glow';
    document.body.appendChild(cursorEl);
    let cx = innerWidth / 2, cy = innerHeight / 2, tx = cx, ty = cy;
    addEventListener('mousemove', e => { tx = e.clientX; ty = e.clientY; });
    (function animateCursor() {
        cx += (tx - cx) * 0.18;
        cy += (ty - cy) * 0.18;
        cursorEl.style.left = cx + 'px';
        cursorEl.style.top = cy + 'px';
        requestAnimationFrame(animateCursor);
    })();
    document.querySelectorAll('a, button, .card, .result-card, .chart-card, .gauge-card, input, select')
        .forEach(el => {
            el.addEventListener('mouseenter', () => cursorEl.classList.add('cursor-hover'));
            el.addEventListener('mouseleave', () => cursorEl.classList.remove('cursor-hover'));
        });
}

console.log('%c🫀 Pulse-AI %cEnhanced Dashboard Ready',
    'font-size:1.3em;font-weight:900;color:#00d4aa;', 'font-size:1em;color:#8898b0;');
console.log('%cFeatures: 3-model prediction | AI consensus voting | Health gauges | Explanations | Performance dashboard',
    'color:#f0a040;');