const API_URL = "https://script.google.com/macros/s/AKfycbwY4HQ0nx1aJpcLE6NMNTk3eyY8RW-l8E2cdP_4P-n31AJVNTN55NITZGcmKD3TOc2Rpg/exec";

let sessionToken = "";
let examQuestions = [];
let studentAnswers = {};
let doubtfulQuestions = {};
let activeIndex = 0;
let violationCount = 0;
const MAX_VIOLATIONS = 3;
let timerInterval;

const pages = {
    login: document.getElementById('login-page'),
    instruction: document.getElementById('instruction-page'),
    exam: document.getElementById('exam-page'),
    finish: document.getElementById('finish-page')
};

// --- SECURITIES GUARD ENGINE ---
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('keydown', e => {
    if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'I') || (e.ctrlKey && e.key === 'c') || (e.ctrlKey && e.key === 'v')) {
        e.preventDefault();
        alert('Fitur proteksi aktif: Dilarang menyalin teks/membuka developer tools!');
    }
});

window.addEventListener('blur', () => {
    if (sessionToken && !pages.finish.classList.contains('hidden') && !pages.instruction.classList.contains('hidden')) {
        triggerViolation("Pindah Tab / Aplikasi (Window Blur)");
    }
});

document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && sessionToken && pages.login.classList.contains('hidden') && pages.finish.classList.contains('hidden') && pages.instruction.classList.contains('hidden')) {
        triggerViolation("Keluar dari Mode Fullscreen");
    }
});

function triggerViolation(type) {
    violationCount++;
    logViolationToAPI(type);
    if (violationCount >= MAX_VIOLATIONS) {
        autoSubmitExam("Melebihi Batas Toleransi Kecurangan");
    } else {
        document.getElementById('blocker-title').innerHTML = `Peringatan Pelanggaran (${violationCount}/${MAX_VIOLATIONS})`;
        document.getElementById('blocker-msg').innerHTML = `Anda terdeteksi melakukan tindakan terlarang: <strong>${type}</strong>. Silakan masuk kembali ke mode fullscreen.`;
        document.getElementById('blocker-overlay').classList.remove('hidden');
    }
}

document.getElementById('btn-resume').addEventListener('click', () => {
    document.documentElement.requestFullscreen().then(() => {
        document.getElementById('blocker-overlay').classList.add('hidden');
    }).catch(() => alert("Wajib masuk mode fullscreen untuk melanjutkan!"));
});

// --- AUTH ENGINE ---
document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nisn = document.getElementById('input-nisn').value;
    const pin = document.getElementById('input-pin').value;
    const btn = document.getElementById('btn-login');
    btn.disabled = true; btn.innerHTML = 'Memverifikasi...';

    try {
        const response = await fetch(`${API_URL}?action=login&nisn=${nisn}&pin=${pin}`);
        const data = await response.json();
        if (data.status === "success") {
            sessionToken = data.token_sesi;
            localStorage.setItem('nisn', nisn);
            switchPage('instruction');
        } else {
            alert(data.message || "Kredensial Anda salah!");
        }
    } catch (err) { alert("Masalah koneksi ke server."); }
    finally { btn.disabled = false; btn.innerHTML = 'Masuk Sistem <i class="fa-solid fa-arrow-right ml-2"></i>'; }
});

document.getElementById('btn-start-exam').addEventListener('click', () => {
    document.documentElement.requestFullscreen().then(() => {
        switchPage('exam');
        document.getElementById('exam-timer').classList.replace('hidden', 'flex');
        startTimer(60 * 90);
        fetchExamPackage();
    }).catch(() => alert("Gagal mengaktifkan modul fullscreen."));
});

// --- CBT CORE SYSTEM ---
async function fetchExamPackage() {
    const nisn = localStorage.getItem('nisn');
    try {
        const res = await fetch(`${API_URL}?action=getQuestion&nisn=${nisn}&token=${sessionToken}`);
        const data = await res.json();
        if (data.status === "success") {
            examQuestions = data.questions;
            activeIndex = 0;
            renderCbtDashboard();
        } else {
            alert(data.message || "Tidak ada paket ujian aktif.");
            autoSubmitExam("Paket Tidak Tersedia");
        }
    } catch (err) { alert("Gagal mengambil paket soal."); }
}

function renderCbtDashboard() {
    if (examQuestions.length === 0) return;
    const currentQuestion = examQuestions[activeIndex];
    
    document.getElementById('current-question-num').innerText = activeIndex + 1;
    document.getElementById('question-weight').innerText = currentQuestion.bobot;
    document.getElementById('question-text').innerText = currentQuestion.pertanyaan;

    const optContainer = document.getElementById('options-container');
    optContainer.innerHTML = '';

    ['a', 'b', 'c', 'd', 'e'].forEach(key => {
        if (currentQuestion[`opsi_${key}`]) {
            const btn = document.createElement('button');
            btn.className = "option-card w-full text-left bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-3 transition-all outline-none text-sm font-medium group";
            if (studentAnswers[currentQuestion.id_soal] === key) btn.classList.add('selected');

            btn.onclick = () => {
                document.querySelectorAll('.option-card').forEach(el => el.classList.remove('selected'));
                btn.classList.add('selected');
                studentAnswers[currentQuestion.id_soal] = key;
                saveAnswerToCloud(currentQuestion.id_soal, key);
                renderGridIndicators();
            };
            btn.innerHTML = `<span class="w-8 h-8 bg-slate-100 group-hover:bg-indigo-50 border border-slate-200 text-slate-600 font-bold text-xs rounded-xl flex items-center justify-center uppercase">${key}</span><span class="text-slate-700">${currentQuestion[`opsi_${key}`]}</span>`;
            optContainer.appendChild(btn);
        }
    });

    document.getElementById('btn-finish-trigger').classList.toggle('hidden', activeIndex !== examQuestions.length - 1);
    renderGridIndicators();
}

// --- CBT NAVIGATORS ---
document.getElementById('btn-next').addEventListener('click', () => { if (activeIndex < examQuestions.length - 1) { activeIndex++; renderCbtDashboard(); } });
document.getElementById('btn-prev').addEventListener('click', () => { if (activeIndex > 0) { activeIndex--; renderCbtDashboard(); } });
document.getElementById('btn-doubt').addEventListener('click', () => { doubtfulQuestions[examQuestions[activeIndex].id_soal] = !doubtfulQuestions[examQuestions[activeIndex].id_soal]; renderGridIndicators(); });

function renderGridIndicators() {
    const grid = document.getElementById('question-grid'); grid.innerHTML = '';
    examQuestions.forEach((q, idx) => {
        const box = document.createElement('button');
        box.className = "w-10 h-10 rounded-xl font-bold text-xs flex items-center justify-center transition-all ";
        box.innerText = idx + 1;

        if (idx === activeIndex) box.className += "bg-indigo-600 text-white shadow-md ring-4 ring-indigo-100";
        else if (doubtfulQuestions[q.id_soal]) box.className += "bg-amber-500 text-white";
        else if (studentAnswers[q.id_soal]) box.className += "bg-emerald-600 text-white";
        else box.className += "bg-slate-100 text-slate-600 hover:bg-slate-200";

        box.onclick = () => { activeIndex = idx; renderCbtDashboard(); };
        grid.appendChild(box);
    });
}

function saveAnswerToCloud(idSoal, jawaban) {
    const nisn = localStorage.getItem('nisn');
    fetch(API_URL, {
        method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ action: 'submitAnswer', nisn: nisn, token: sessionToken, id_soal: idSoal, jawaban: jawaban })
    });
}

document.getElementById('btn-finish-trigger').addEventListener('click', async () => {
    if(confirm("Apakah Anda yakin ingin mengakhiri sesi ujian dan mengirim berkas?")) {
        const nisn = localStorage.getItem('nisn');
        try {
            await fetch(`${API_URL}?action=forceEndExam&nisn=${nisn}&token=${sessionToken}`);
            finishExam(localStorage.getItem('nisn'));
        } catch(e) { finishExam("-"); }
    }
});

// --- CORE UTILS ---
function switchPage(pageName) { Object.values(pages).forEach(p => p.classList.add('hidden')); pages[pageName].classList.remove('hidden'); }
function startTimer(durationSeconds) {
    let timeLeft = durationSeconds;
    timerInterval = setInterval(() => {
        let hrs = Math.floor(timeLeft / 3600); let mins = Math.floor((timeLeft % 3600) / 60); let secs = timeLeft % 60;
        document.getElementById('timer-countdown').innerText = `${String(hrs).padStart(2,'0')}:${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
        if (--timeLeft < 0) { clearInterval(timerInterval); autoSubmitExam("Waktu Sesi Habis"); }
    }, 1000);
}
async function logViolationToAPI(type) { const nisn = localStorage.getItem('nisn'); navigator.sendBeacon(API_URL, new URLSearchParams({ action: 'logViolation', nisn: nisn, jenis: type })); }
function autoSubmitExam(reason) { clearInterval(timerInterval); if (document.fullscreenElement) document.exitFullscreen(); alert(`Ujian selesai: ${reason}`); finishExam("-"); }
function finishExam(nama) { clearInterval(timerInterval); if (document.fullscreenElement) document.exitFullscreen(); document.getElementById('exam-timer').classList.add('hidden'); document.getElementById('res-nama').innerText = nama; switchPage('finish'); }
