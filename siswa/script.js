// Ganti dengan URL Web App Google Apps Script Anda yang sudah di-deploy
const API_URL = "https://script.google.com/macros/s/AKfycbxhvwnuRlhfg3cCL-KD_8UCFxiWpjbAUdOi8Nj5HnOXnOtR1Mf2FcYepBQHp_kLj8lVHg/exec";

let sessionToken = "";
let currentQuestion = null;
let currentNumber = 1;
let totalQuestions = 0;
let violationCount = 0;
const MAX_VIOLATIONS = 3;
let timerInterval;

// DOM Selectors
const pages = {
    login: document.getElementById('login-page'),
    instruction: document.getElementById('instruction-page'),
    exam: document.getElementById('exam-page'),
    finish: document.getElementById('finish-page')
};

// --- SECURITY: PREVENT INTERFERENCE ---
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('keydown', e => {
    // Blokir F12, Ctrl+Shift+I, Ctrl+C, Ctrl+V, Alt+Tab (maksimal semampunya di browser)
    if (e.key === 'F12' || 
        (e.ctrlKey && e.shiftKey && e.key === 'I') || 
        (e.ctrlKey && e.key === 'c') || 
        (e.ctrlKey && e.key === 'v')) {
        e.preventDefault();
        alert('Tindakan ini dilarang selama ujian berlangsung!');
    }
});

// Deteksi Blur / Pindah Tab & Aplikasi
window.addEventListener('blur', () => {
    if (sessionToken && !pages.finish.classList.contains('hidden')) {
        triggerViolation("Pindah Tab / Aplikasi (Window Blur)");
    }
});

// Deteksi Keluar Fullscreen
document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && sessionToken && !pages.finish.classList.contains('hidden') && !pages.instruction.classList.contains('hidden')) {
        triggerViolation("Keluar dari Mode Fullscreen");
    }
});

function triggerViolation(type) {
    violationCount++;
    logViolationToAPI(type);

    if (violationCount >= MAX_VIOLATIONS) {
        autoSubmitExam("Melebihi Batas Toleransi Kecurangan");
    } else {
        showBlocker(`Peringatan Pelanggaran (${violationCount}/${MAX_VIOLATIONS})`, `Anda terdeteksi melakukan tindakan terlarang: <strong>${type}</strong>. Silakan kembali masuk mode fullscreen.`);
    }
}

function showBlocker(title, msg) {
    document.getElementById('blocker-title').innerHTML = title;
    document.getElementById('blocker-msg').innerHTML = msg;
    document.getElementById('blocker-overlay').classList.remove('hidden');
}

document.getElementById('btn-resume').addEventListener('click', () => {
    document.documentElement.requestFullscreen().then(() => {
        document.getElementById('blocker-overlay').classList.add('hidden');
    }).catch(err => {
        alert("Harap izinkan mode fullscreen untuk melanjutkan ujian!");
    });
});

// --- AUTHENTICATION ---
document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nisn = document.getElementById('input-nisn').value;
    const pin = document.getElementById('input-pin').value;
    
    // Loading State
    const btnLogin = document.getElementById('btn-login');
    btnLogin.disabled = true;
    btnLogin.innerHTML = '<i class="fa-solid fa-spinner animate-spin"></i> Memverifikasi data...';

    try {
        const response = await fetch(`${API_URL}?action=login&nisn=${nisn}&pin=${pin}`);
        const data = await response.json();

        if (data.status === "success") {
            sessionToken = data.token_sesi;
            localStorage.setItem('nisn', nisn);
            switchPage('instruction');
        } else {
            alert(data.message || "Gagal masuk. Periksa kembali NISN & PIN!");
        }
    } catch (err) {
        alert("Terjadi kesalahan koneksi ke server.");
    } finally {
        btnLogin.disabled = false;
        btnLogin.innerHTML = 'Masuk Sistem <i class="fa-solid fa-arrow-right ml-2"></i>';
    }
});

document.getElementById('btn-start-exam').addEventListener('click', () => {
    document.documentElement.requestFullscreen().then(() => {
        switchPage('exam');
        document.getElementById('exam-timer').classList.remove('hidden');
        document.getElementById('exam-timer').classList.add('flex');
        startTimer(60 * 90); // Default 90 menit (idealnya waktu ditarik dari server)
        fetchNextQuestion();
    }).catch(() => {
        alert("Anda wajib masuk mode Full-Screen untuk memulai ujian.");
    });
});

// --- CORE EXAM ENGINE (PARTIAL FETCH) ---
async function fetchNextQuestion() {
    const nisn = localStorage.getItem('nisn');
    try {
        const res = await fetch(`${API_URL}?action=getQuestion&nisn=${nisn}&token=${sessionToken}`);
        const data = await res.json();

        if (data.status === "finished") {
            finishExam(data.nama);
            return;
        }

        if (data.status === "success") {
            currentQuestion = data.question;
            currentNumber = data.current_index;
            renderQuestion();
        }
    } catch (err) {
        alert("Gagal mengambil soal. Memuat ulang otomatis...");
    }
}

function renderQuestion() {
    document.getElementById('current-question-num').innerText = currentNumber;
    document.getElementById('question-weight').innerText = currentQuestion.bobot;
    document.getElementById('question-text').innerText = currentQuestion.pertanyaan;

    const optContainer = document.getElementById('options-container');
    optContainer.innerHTML = '';

    const opsiKeys = ['a', 'b', 'c', 'd', 'e'];
    opsiKeys.forEach(key => {
        if(currentQuestion[`opsi_${key}`]) {
            const btn = document.createElement('button');
            btn.className = "option-card w-full text-left bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center gap-3 transition-all outline-none text-sm font-medium group";
            btn.onclick = () => selectOption(btn, key);
            btn.innerHTML = `
                <span class="w-8 h-8 bg-slate-100 group-hover:bg-indigo-50 border border-slate-200 group-hover:border-indigo-200 text-slate-600 group-hover:text-indigo-600 text-xs font-bold rounded-xl flex items-center justify-center uppercase transition-all">${key}</span>
                <span class="text-slate-700">${currentQuestion[`opsi_${key}`]}</span>
            `;
            optContainer.appendChild(btn);
        }
    });
}

let selectedAnswer = "";
function selectOption(element, key) {
    document.querySelectorAll('.option-card').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');
    selectedAnswer = key;
}

document.getElementById('btn-next').addEventListener('click', async () => {
    if (!selectedAnswer) {
        alert("Pilih salah satu jawaban terlebih dahulu!");
        return;
    }

    const nisn = localStorage.getItem('nisn');
    const btn = document.getElementById('btn-next');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner animate-spin"></i> Menyimpan...';

    try {
        const res = await fetch(`${API_URL}`, {
            method: 'POST',
            mode: 'no-cors', // Atasi CORS untuk web app script Google
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                action: 'submitAnswer',
                nisn: nisn,
                token: sessionToken,
                id_soal: currentQuestion.id_soal,
                jawaban: selectedAnswer
            })
        });

        // Karena no-cors, kita asumsikan sukses dan langsung tarik soal berikutnya secara parsial
        selectedAnswer = "";
        fetchNextQuestion();
    } catch (err) {
        alert("Gagal mengirim jawaban. Coba lagi.");
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Simpan & Lanjut <i class="fa-solid fa-chevron-right text-xs"></i>';
    }
});

// --- HELPER FUNCTION ---
function switchPage(pageName) {
    Object.values(pages).forEach(p => p.classList.add('hidden'));
    pages[pageName].classList.remove('hidden');
}

function startTimer(durationSeconds) {
    let timeLeft = durationSeconds;
    timerInterval = setInterval(() => {
        let hrs = Math.floor(timeLeft / 3600);
        let mins = Math.floor((timeLeft % 3600) / 60);
        let secs = timeLeft % 60;

        document.getElementById('timer-countdown').innerText = 
            `${String(hrs).padStart(2,'0')}:${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
        
        if (--timeLeft < 0) {
            clearInterval(timerInterval);
            autoSubmitExam("Waktu Ujian Habis");
        }
    }, 1000);
}

async function logViolationToAPI(type) {
    const nisn = localStorage.getItem('nisn');
    navigator.sendBeacon(`${API_URL}`, new URLSearchParams({
        action: 'logViolation', nisn: nisn, jenis: type
    }));
}

function autoSubmitExam(reason) {
    clearInterval(timerInterval);
    if(document.fullscreenElement) document.exitFullscreen();
    alert(`Ujian Anda dihentikan otomatis: ${reason}`);
    finishExam("-");
}

function finishExam(nama) {
    clearInterval(timerInterval);
    if(document.fullscreenElement) document.exitFullscreen();
    document.getElementById('exam-timer').classList.add('hidden');
    document.getElementById('res-nama').innerText = nama;
    switchPage('finish');
}