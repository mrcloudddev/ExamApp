const API_URL = "https://script.google.com/macros/s/AKfycbzdaZ7lavtFtKIgV-lBkanwc-_WiSY3LjUg2zxjETy9gMta6izbzSt2BR4_nqmCbLyFrg/exec";

let sessionToken = "";
let examQuestions = [];

// FIX #1: studentAnswers menyimpan { id_soal: { displayKey, originalKey } }
// agar mapping display key dan kunci asli TIDAK pernah kacau walau opsi diacak ulang
let studentAnswers = {};

let doubtfulQuestions = {};
let activeIndex = 0;
let violationCount = 0;
const MAX_VIOLATIONS = 3;
let timerInterval;
let isFinishingExam = false;

// FIX #2: Debounce grid render agar tidak lag saat grid besar
let gridRenderTimeout = null;

let initialWidth = window.innerWidth;
let initialHeight = window.innerHeight;

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
    if (isFinishingExam) return;
    if (sessionToken && !pages.finish.classList.contains('hidden') && !pages.instruction.classList.contains('hidden')) {
        triggerViolation("Pindah Tab Browser / Keluar Aplikasi");
    }
});

document.addEventListener('visibilitychange', () => {
    if (isFinishingExam) return;
    if (document.visibilityState === 'hidden' && sessionToken && !pages.finish.classList.contains('hidden') && !pages.instruction.classList.contains('hidden')) {
        triggerViolation("Membuka Aplikasi Lain (Halaman Tersembunyi)");
    }
});

window.addEventListener('resize', () => {
    if (isFinishingExam) return;
    if (sessionToken && pages.login.classList.contains('hidden') && pages.finish.classList.contains('hidden') && pages.instruction.classList.contains('hidden')) {
        let widthThreshold = initialWidth * 0.15;
        let heightThreshold = initialHeight * 0.15;
        if (Math.abs(window.innerWidth - initialWidth) > widthThreshold || Math.abs(window.innerHeight - initialHeight) > heightThreshold) {
            triggerViolation("Terdeteksi Split Screen (Layar Belah) / Pop-up Melayang");
            initialWidth = window.innerWidth;
            initialHeight = window.innerHeight;
        }
    }
});

document.addEventListener('fullscreenchange', () => {
    if (isFinishingExam) return;
    if (!document.fullscreenElement && sessionToken && pages.login.classList.contains('hidden') && pages.finish.classList.contains('hidden') && pages.instruction.classList.contains('hidden')) {
        triggerViolation("Keluar dari Mode Fullscreen");
    }
});

function triggerViolation(type) {
    if (isFinishingExam) return;
    if (type === "Keluar dari Mode Fullscreen" && !document.documentElement.requestFullscreen) return;

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
    if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().then(() => {
            document.getElementById('blocker-overlay').classList.add('hidden');
            initialWidth = window.innerWidth;
            initialHeight = window.innerHeight;
        }).catch(() => alert("Wajib masuk mode fullscreen untuk melanjutkan!"));
    } else {
        document.getElementById('blocker-overlay').classList.add('hidden');
    }
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
            if (data.aksesUjian === 'TUTUP') {
                alert('Akses ujian Anda saat ini ditutup oleh admin. Silakan hubungi pengawas untuk membuka akses.');
                btn.disabled = false; btn.innerHTML = 'Masuk Sistem <i class="fa-solid fa-arrow-right ml-2"></i>';
                return;
            }
            sessionToken = data.token_sesi;
            localStorage.setItem('nisn', nisn);
            localStorage.setItem('namaSiswa', data.nama || nisn);
            // Bersihkan sesi lama
            localStorage.removeItem('studentAnswers');
            localStorage.removeItem('activeIndex');
            studentAnswers = {};
            activeIndex = 0;
            switchPage('instruction');
        } else {
            alert(data.message || "Kredensial Anda salah!");
        }
    } catch (err) { alert("Masalah koneksi ke server."); }
    finally { btn.disabled = false; btn.innerHTML = 'Masuk Sistem <i class="fa-solid fa-arrow-right ml-2"></i>'; }
});

document.getElementById('btn-start-exam').addEventListener('click', () => {
    const startExamWorkflow = () => {
        switchPage('exam');
        document.getElementById('exam-timer').classList.replace('hidden', 'flex');
        initialWidth = window.innerWidth;
        initialHeight = window.innerHeight;
        fetchExamPackage();
    };

    if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen()
            .then(startExamWorkflow)
            .catch(() => startExamWorkflow());
    } else {
        alert("Sistem mendeteksi perangkat iOS. Mode Fullscreen otomatis dilewati. Mohon jangan keluar dari aplikasi selama ujian berlangsung!");
        startExamWorkflow();
    }
});

// --- CBT CORE SYSTEM ---
async function fetchExamPackage() {
    const nisn = localStorage.getItem('nisn');
    try {
        const res = await fetch(`${API_URL}?action=getQuestion&nisn=${nisn}&token=${sessionToken}`);
        const data = await res.json();
        if (data.status === "success") {
            examQuestions = data.questions;

            // ================================================================
            // FIX #1 — Restore jawaban dari server dengan menyimpan KEDUA kunci
            // (displayKey = huruf yang ditampilkan, originalKey = kunci asli server)
            // Ini mencegah jawaban tampak berubah walau urutan opsi diacak ulang
            // ================================================================
            try {
                const resAns = await fetch(`${API_URL}?action=getMyAnswers&nisn=${nisn}&token=${sessionToken}`);
                const dataAns = await resAns.json();
                if (dataAns.status === "success" && dataAns.answers) {
                    const restored = {};
                    examQuestions.forEach(q => {
                        const serverAns = dataAns.answers[q.id_soal]; // kunci asli (a/b/c/d/e versi server)
                        if (serverAns) {
                            // Cari displayKey yang mapping-nya cocok dengan jawaban server
                            const displayKey = ['a','b','c','d','e'].find(k => q[`map${k.toUpperCase()}`] === serverAns);
                            if (displayKey) {
                                restored[q.id_soal] = {
                                    displayKey: displayKey,   // huruf tampilan saat ini (mungkin berbeda tiap load)
                                    originalKey: serverAns    // kunci asli — STABIL tidak berubah
                                };
                            }
                        }
                    });
                    studentAnswers = restored;
                }
            } catch(e) { /* silent, lanjut tanpa restore */ }

            const savedIndex = parseInt(localStorage.getItem('activeIndex') || '0');
            activeIndex = (savedIndex < examQuestions.length) ? savedIndex : 0;

            renderCbtDashboard();

            const sisaWaktu = (data.sisa_waktu && data.sisa_waktu > 0)
                ? data.sisa_waktu
                : 60 * 60;

            if (data.sisa_waktu && data.sisa_waktu <= 0) {
                alert("Waktu ujian untuk kelas Anda telah habis. Silakan hubungi pengawas.");
                autoSubmitExam("Waktu Ujian Telah Habis Saat Login");
                return;
            }

            startTimer(sisaWaktu);
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

    const qTextEl = document.getElementById('question-text');
    qTextEl.textContent = currentQuestion.pertanyaan;

    const imgWrap = document.getElementById('question-image-wrap');
    const imgEl = document.getElementById('question-image');
    if (currentQuestion.gambar_url && currentQuestion.gambar_url.trim() !== '') {
        let imgUrl = currentQuestion.gambar_url.trim();
        const driveMatch = imgUrl.match(/(?:\/d\/|id=)([a-zA-Z0-9_-]{25,})/);
        if (driveMatch) {
            imgUrl = `https://drive.google.com/thumbnail?id=${driveMatch[1]}&sz=w800`;
        }
        imgEl.src = imgUrl;
        imgEl.onerror = function() {
            imgWrap.innerHTML = '<p class="text-xs text-rose-400 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2"><i class="fa-solid fa-triangle-exclamation mr-1"></i>Gambar tidak dapat dimuat. Pastikan link gambar dapat diakses publik.</p>';
        };
        imgWrap.classList.remove('hidden');
    } else {
        imgWrap.classList.add('hidden');
        imgEl.src = '';
    }

    if (window.MathJax && window.MathJax.typesetPromise) {
        window.MathJax.typesetPromise([document.getElementById('question-container')]).catch(()=>{});
    }

    const optContainer = document.getElementById('options-container');
    optContainer.innerHTML = '';

    // Ambil displayKey yang sudah disimpan untuk soal ini
    const savedAnswer = studentAnswers[currentQuestion.id_soal];
    const currentDisplayKey = savedAnswer ? savedAnswer.displayKey : null;

    ['a', 'b', 'c', 'd', 'e'].forEach(key => {
        if (currentQuestion[`opsi_${key}`]) {
            const btn = document.createElement('button');
            btn.className = "option-card w-full text-left bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-3 transition-all outline-none text-sm font-medium group";

            // FIX #1 — Tandai tombol yang sudah dipilih berdasarkan displayKey saat ini
            if (currentDisplayKey === key) btn.classList.add('selected');

            btn.onclick = () => {
                // FIX #2 — Matikan semua pointer event sementara (anti-double-click lag)
                optContainer.style.pointerEvents = 'none';

                document.querySelectorAll('.option-card').forEach(el => el.classList.remove('selected'));
                btn.classList.add('selected');

                const originalKey = currentQuestion[`map${key.toUpperCase()}`] || key;

                // Simpan keduanya: displayKey untuk UI, originalKey untuk server
                studentAnswers[currentQuestion.id_soal] = {
                    displayKey: key,
                    originalKey: originalKey
                };

                saveAnswerToCloud(currentQuestion.id_soal, originalKey, key);
                scheduleGridRender();

                // Re-enable pointer events setelah singkat (debounce anti-stag)
                setTimeout(() => { optContainer.style.pointerEvents = ''; }, 300);
            };

            btn.innerHTML = `<span class="w-8 h-8 bg-slate-100 group-hover:bg-indigo-50 border border-slate-200 text-slate-600 font-bold text-xs rounded-xl flex items-center justify-center uppercase">${key}</span><span class="text-slate-700">${currentQuestion[`opsi_${key}`]}</span>`;
            optContainer.appendChild(btn);
        }
    });

    scheduleGridRender();
}

// --- CBT NAVIGATORS ---
document.getElementById('btn-next').addEventListener('click', () => {
    if (activeIndex < examQuestions.length - 1) { activeIndex++; renderCbtDashboard(); }
});
document.getElementById('btn-prev').addEventListener('click', () => {
    if (activeIndex > 0) { activeIndex--; renderCbtDashboard(); }
});
document.getElementById('btn-doubt').addEventListener('click', () => {
    doubtfulQuestions[examQuestions[activeIndex].id_soal] = !doubtfulQuestions[examQuestions[activeIndex].id_soal];
    scheduleGridRender();
});

// FIX #2 — Debounce renderGridIndicators agar tidak dipanggil berkali-kali dalam satu frame
// Ini cegah stag/freeze saat soal banyak (misal 100 soal = 100 DOM node dibuat ulang)
function scheduleGridRender() {
    if (gridRenderTimeout) clearTimeout(gridRenderTimeout);
    gridRenderTimeout = setTimeout(renderGridIndicators, 50);
}

function renderGridIndicators() {
    gridRenderTimeout = null;
    const grid = document.getElementById('question-grid');

    // FIX #2 — Update class tombol yang sudah ada (JANGAN innerHTML = '' setiap kali)
    // Ini mencegah layout reflow besar yang menyebabkan stag
    const existingBoxes = grid.querySelectorAll('button');
    const needRebuild = existingBoxes.length !== examQuestions.length;

    if (needRebuild) {
        // Build grid dari awal hanya jika jumlah soal berubah (sekali saja)
        grid.innerHTML = '';
        examQuestions.forEach((q, idx) => {
            const box = document.createElement('button');
            box.dataset.idx = idx;
            box.className = "aspect-square w-full min-w-[36px] max-w-[46px] rounded-xl font-mono text-xs font-bold flex items-center justify-center transition-all border outline-none select-none ";
            box.innerText = idx + 1;
            box.onclick = () => { activeIndex = idx; renderCbtDashboard(); };
            grid.appendChild(box);
        });
    }

    // Update hanya class tiap tombol — jauh lebih ringan dari rebuild penuh
    grid.querySelectorAll('button').forEach((box, idx) => {
        const q = examQuestions[idx];
        let cls = "aspect-square w-full min-w-[36px] max-w-[46px] rounded-xl font-mono text-xs font-bold flex items-center justify-center transition-all border outline-none select-none ";
        if (idx === activeIndex)              cls += "bg-indigo-600 text-white shadow-md ring-4 ring-indigo-100 border-indigo-600";
        else if (doubtfulQuestions[q.id_soal]) cls += "bg-amber-500 text-white border-amber-500";
        else if (studentAnswers[q.id_soal])   cls += "bg-emerald-600 text-white border-emerald-600";
        else                                   cls += "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-200";
        box.className = cls;
    });
}

function saveAnswerToCloud(idSoal, jawaban, displayKey) {
    const nisn = localStorage.getItem('nisn');

    // Simpan di localStorage: format { displayKey, originalKey } agar konsisten
    const savedAnswers = JSON.parse(localStorage.getItem('studentAnswers') || '{}');
    savedAnswers[idSoal] = { displayKey: displayKey || jawaban, originalKey: jawaban };
    localStorage.setItem('studentAnswers', JSON.stringify(savedAnswers));
    localStorage.setItem('activeIndex', activeIndex);

    // Kirim ke server secara async, no-cors (fire and forget)
    fetch(API_URL, {
        method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ action: 'submitAnswer', nisn: nisn, token: sessionToken, id_soal: idSoal, jawaban: jawaban })
    });
}

document.getElementById('btn-finish-trigger').addEventListener('click', async () => {
    if(confirm("Apakah Anda yakin ingin mengakhiri sesi ujian dan mengirim berkas jawaban?")) {
        isFinishingExam = true;
        const btn = document.getElementById('btn-finish-trigger');
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Mengirim jawaban...';
        const nisn = localStorage.getItem('nisn');
        try {
            await fetch(`${API_URL}?action=forceEndExam&nisn=${nisn}&token=${sessionToken}`);
        } catch(e) { /* tetap lanjut */ }
        finishExam();
    }
});

// --- CORE UTILS ---
function switchPage(pageName) { Object.values(pages).forEach(p => p.classList.add('hidden')); pages[pageName].classList.remove('hidden'); }

function startTimer(durationSeconds) {
    let timeLeft = durationSeconds;
    const btnFinish = document.getElementById('btn-finish-trigger');
    const noticeFinish = document.getElementById('finish-notice');

    timerInterval = setInterval(() => {
        let hrs = Math.floor(timeLeft / 3600);
        let mins = Math.floor((timeLeft % 3600) / 60);
        let secs = timeLeft % 60;

        document.getElementById('timer-countdown').innerText = `${String(hrs).padStart(2,'0')}:${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;

        if (timeLeft <= 1200) {
            btnFinish.removeAttribute('disabled');
            btnFinish.className = "w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-3 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-lg";
            btnFinish.innerHTML = `<i class="fa-solid fa-check-double"></i> Selesai & Kirim Ujian`;
            noticeFinish.classList.add('hidden');
        } else {
            btnFinish.setAttribute('disabled', 'true');
            btnFinish.className = "w-full bg-slate-300 text-slate-500 font-bold py-3 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-not-allowed select-none";
            btnFinish.innerHTML = `<i class="fa-solid fa-lock text-[10px]"></i> Selesai & Kirim Ujian`;
            noticeFinish.classList.remove('hidden');
        }

        if (--timeLeft < 0) {
            clearInterval(timerInterval);
            isFinishingExam = true;
            autoSubmitExam("Waktu Sesi Habis");
        }
    }, 1000);
}

async function logViolationToAPI(type) {
    if (isFinishingExam) return;
    const nisn = localStorage.getItem('nisn');
    navigator.sendBeacon(API_URL, new URLSearchParams({ action: 'logViolation', nisn: nisn, jenis: type }));
}

function autoSubmitExam(reason) {
    clearInterval(timerInterval);
    isFinishingExam = true;
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(()=>{});

    if (reason === "Melebihi Batas Toleransi Kecurangan") {
        const nisn = localStorage.getItem('nisn');
        navigator.sendBeacon(API_URL, new URLSearchParams({ action: 'resetStatusSiswa', nisn: nisn }));
        localStorage.removeItem('studentAnswers');
        localStorage.removeItem('activeIndex');
        alert("\u26a0\ufe0f Anda telah melakukan 3 pelanggaran!\nSesi dihentikan. Lapor ke pengawas, lalu login ulang untuk mengerjakan kembali.");
        sessionToken = ""; examQuestions = []; studentAnswers = {}; doubtfulQuestions = {};
        activeIndex = 0; violationCount = 0; isFinishingExam = false;
        switchPage('login');
        document.getElementById('exam-timer').classList.add('hidden');
        document.getElementById('input-nisn').value = '';
        document.getElementById('input-pin').value = '';
        return;
    }

    alert(`Ujian selesai: ${reason}`);
    finishExam();
}

function finishExam() {
    clearInterval(timerInterval);
    isFinishingExam = true;
    localStorage.removeItem('studentAnswers');
    localStorage.removeItem('activeIndex');
    if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
    }
    document.getElementById('exam-timer').classList.add('hidden');
    const namaTerdaftar = localStorage.getItem('namaSiswa');
    document.getElementById('res-nama').innerText = namaTerdaftar;
    switchPage('finish');
}
