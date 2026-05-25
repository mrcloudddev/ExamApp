// ==========================================
// CONFIG: PASTE URL WEB APP APPS SCRIPT ANDA
// ==========================================
const API_URL = "https://script.google.com/macros/s/AKfycbwW73ER0bU9AIdMeyFCDmargiXZRDOq98We0JJk-F0o5xnjBFxPuUMwHvc7fTwa8GLluA/exec";

let sessionToken = "";
let currentQuestion = null;
let currentNumber = 1;
let violationCount = 0;
const MAX_VIOLATIONS = 3;
let timerInterval;
let selectedAnswer = "";

const pages = {
    login: document.getElementById('login-page'),
    instruction: document.getElementById('instruction-page'),
    exam: document.getElementById('exam-page'),
    finish: document.getElementById('finish-page')
};

// --- SECURITY ENGINE: ANTI-CHEAT LOCKS ---
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('keydown', e => {
    if (e.key === 'F12' || 
        (e.ctrlKey && e.shiftKey && e.key === 'I') || 
        (e.ctrlKey && e.key === 'c') || 
        (e.ctrlKey && e.key === 'v')) {
        e.preventDefault();
        alert('Fitur proteksi aktif: Dilarang menyalin teks/membuka developer tools!');
    }
});

// Deteksi Blur (Keluar Tab/Membuka Aplikasi Lain)
window.addEventListener('blur', () => {
    if (sessionToken && !pages.finish.classList.contains('hidden') && !pages.instruction.classList.contains('hidden')) {
        triggerViolation("Pindah Tab / Aplikasi (Window Blur)");
    }
});

// Deteksi Memaksa Keluar dari Fullscreen
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
        showBlocker(`Peringatan Pelanggaran (${violationCount}/${MAX_VIOLATIONS})`, `Anda terdeteksi melakukan tindakan terlarang: <strong>${type}</strong>. Silakan masuk kembali ke mode fullscreen.`);
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
    }).catch(() => {
        alert("Wajib mengizinkan mode fullscreen untuk melanjutkan assessment!");
    });
});

// --- AUTH ENGINE ---
document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nisn = document.getElementById('input-nisn').value;
    const pin = document.getElementById('input-pin').value;
    
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
            alert(data.message || "Kredensial salah. Periksa nomor peserta & PIN!");
        }
    } catch (err) {
        alert("Terjadi masalah koneksi. Periksa jaringan Anda.");
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
        startTimer(60 * 90); // Timer default: 90 Menit
        fetchNextQuestion();
    }).catch(() => {
        alert("Gagal mengaktifkan sistem keamanan. Harap izinkan mode Fullscreen.");
    });
});

// --- EXAM CORE (PARTIAL FETCH METHOD) ---
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
        alert("Gagal memuat soal. Mengambil ulang...");
        fetchNextQuestion();
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
        if (currentQuestion[`opsi_${key}`]) {
            const btn = document.createElement('button');
            btn.className = "option-card w-full text-left bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center gap-3 transition-all outline-none text-sm font-medium group";
            btn.onclick = () => {
                document.querySelectorAll('.option-card').forEach(el => el.classList.remove('selected'));
                btn.classList.add('selected');
                selectedAnswer = key;
            };
            btn.innerHTML = `
                <span class="w-8 h-8 bg-slate-100 group-hover:bg-indigo-50 border border-slate-200 group-hover:border-indigo-200 text-slate-600 group-hover:text-indigo-600 text-xs font-bold rounded-xl flex items-center justify-center uppercase transition-all">${key}</span>
                <span class="text-slate-700">${currentQuestion[`opsi_${key}`]}</span>
            `;
            optContainer.appendChild(btn);
        }
    });
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
        await fetch(`${API_URL}`, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                action: 'submitAnswer',
                nisn: nisn,
                token: sessionToken,
                id_soal: currentQuestion.id_soal,
                jawaban: selectedAnswer
            })
        });

        selectedAnswer = "";
        fetchNextQuestion();
    } catch (err) {
        alert("Koneksi gagal. Coba klik kembali.");
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Simpan & Lanjut <i class="fa-solid fa-chevron-right text-xs"></i>';
    }
});

// --- CORE UTILS ---
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
    if (document.fullscreenElement) document.exitFullscreen();
    alert(`Ujian dihentikan otomatis: ${reason}`);
    finishExam("-");
}

function finishExam(nama) {
    clearInterval(timerInterval);
    if (document.fullscreenElement) document.exitFullscreen();
    document.getElementById('exam-timer').classList.add('hidden');
    document.getElementById('res-nama').innerText = nama;
    switchPage('finish');
}
