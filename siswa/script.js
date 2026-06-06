const API_URL = "https://script.google.com/macros/s/AKfycbygQP0lHSZLPn9bbQyQsukP_pl7AaaNyZSNqAhtSeaKQzMPmbUtsxCq_2H-zvwC5SbNPA/exec";

let sessionToken = "";
let examQuestions = [];
let studentAnswers = {};
let doubtfulQuestions = {};
let activeIndex = 0;
let violationCount = 0;
const MAX_VIOLATIONS = 3;
let timerInterval;
let isFinishingExam = false;
let examReady = false;


// ---------------------------------------------------------------
// DETEKSI PLATFORM
// ---------------------------------------------------------------
const isIOS     = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
const isAndroid = /Android/i.test(navigator.userAgent);
const isMobile  = isIOS || isAndroid || /Mobi/i.test(navigator.userAgent);
const isSafari  = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

let initialWidth  = window.innerWidth;
let initialHeight = window.innerHeight;

// Deteksi keyboard virtual terbuka via visualViewport
let keyboardOpen = false;
if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => {
        keyboardOpen = window.visualViewport.height < window.innerHeight * 0.80;
    });
}

// Jeda singkat setelah mulai ujian agar resize/blur dari
// proses fullscreen request tidak terhitung violation
let examJustStarted = false;

const pages = {
    login:       document.getElementById('login-page'),
    instruction: document.getElementById('instruction-page'),
    exam:        document.getElementById('exam-page'),
    finish:      document.getElementById('finish-page')
};

// ---------------------------------------------------------------
// PRE-BUILD opsi A–E sekali saat load
// ---------------------------------------------------------------
const OPT_KEYS     = ['a','b','c','d','e'];
const optContainer = document.getElementById('options-container');

const optBtns = OPT_KEYS.map(key => {
    const btn = document.createElement('button');
    btn.className = "option-card w-full text-left bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-3 transition-all outline-none text-sm font-medium group";
    btn.dataset.key = key;
    btn.innerHTML = `<span class="w-8 h-8 bg-slate-100 group-hover:bg-indigo-50 border border-slate-200 text-slate-600 font-bold text-xs rounded-xl flex items-center justify-center uppercase">${key}</span><span class="opt-text text-slate-700"></span>`;
    btn.addEventListener('click', () => onOptionClick(key));
    optContainer.appendChild(btn);
    return btn;
});

function onOptionClick(key) {
    if (!examReady) return;
    const q = examQuestions[activeIndex];
    if (!q[`opsi_${key}`]) return;

    optBtns.forEach(b => b.classList.remove('selected'));
    optBtns[OPT_KEYS.indexOf(key)].classList.add('selected');

    const originalKey = q[`map${key.toUpperCase()}`] || key;
    studentAnswers[q.id_soal] = { displayKey: key, originalKey };
    saveAnswerToCloud(q.id_soal, originalKey, key);
    updateGridItem(activeIndex);
}

// ---------------------------------------------------------------
// SECURITY GUARD
// Strategi per platform:
//   Desktop  : fullscreen paksa + semua violation aktif
//   Android  : fullscreen request (imersif) + deteksi pindah app
//              via visibilitychange, TANPA fullscreenchange
//   iPhone   : tidak bisa fullscreen, deteksi pindah app
//              via visibilitychange saja
// ---------------------------------------------------------------
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

// blur — hanya desktop (di mobile keyboard virtual memicu blur)
window.addEventListener('blur', () => {
    if (isFinishingExam || isMobile || keyboardOpen || examJustStarted) return;
    if (sessionToken &&
        !pages.finish.classList.contains('hidden') &&
        !pages.instruction.classList.contains('hidden')) {
        triggerViolation("Pindah Tab Browser / Keluar Aplikasi");
    }
});

// visibilitychange — aktif di SEMUA platform termasuk iOS & Android
// Di mobile ini adalah satu-satunya cara andal deteksi pindah app
document.addEventListener('visibilitychange', () => {
    if (isFinishingExam || keyboardOpen || examJustStarted) return;
    if (document.visibilityState === 'hidden' && sessionToken &&
        pages.login.classList.contains('hidden') &&
        pages.finish.classList.contains('hidden') &&
        pages.instruction.classList.contains('hidden')) {
        triggerViolation("Membuka Aplikasi Lain / Keluar Browser");
    }
});

// resize — deteksi split screen
// Keyboard virtual Android/iOS hanya mengubah tinggi, bukan lebar
// Split screen mengubah lebar secara signifikan → deteksi dari lebar saja di mobile
window.addEventListener('resize', () => {
    if (isFinishingExam || keyboardOpen || examJustStarted) return;
    if (sessionToken &&
        pages.login.classList.contains('hidden') &&
        pages.finish.classList.contains('hidden') &&
        pages.instruction.classList.contains('hidden')) {
        const lebarBerubah   = Math.abs(window.innerWidth  - initialWidth)  > initialWidth  * 0.15;
        const tinggiBerubah  = Math.abs(window.innerHeight - initialHeight) > initialHeight * 0.15;
        // Mobile: hanya deteksi dari lebar (keyboard virtual tidak ubah lebar)
        // Desktop: deteksi dari lebar atau tinggi
        const isSplitScreen  = isMobile ? lebarBerubah : (lebarBerubah || tinggiBerubah);
        if (isSplitScreen) {
            triggerViolation("Terdeteksi Split Screen / Layar Belah");
            initialWidth  = window.innerWidth;
            initialHeight = window.innerHeight;
        }
    }
});

// fullscreenchange — hanya desktop
// Android: notifikasi & status bar drop fullscreen sesaat → false-positive
// iOS: tidak support fullscreen sama sekali
document.addEventListener('fullscreenchange', () => {
    if (isFinishingExam || isMobile || examJustStarted) return;
    if (!document.fullscreenElement && sessionToken &&
        pages.login.classList.contains('hidden') &&
        pages.finish.classList.contains('hidden') &&
        pages.instruction.classList.contains('hidden')) {
        triggerViolation("Keluar dari Mode Fullscreen");
    }
});

function triggerViolation(type) {
    if (isFinishingExam) return;
    violationCount++;
    logViolationToAPI(type);
    if (violationCount >= MAX_VIOLATIONS) {
        autoSubmitExam("Melebihi Batas Toleransi Kecurangan");
    } else {
        document.getElementById('blocker-title').innerHTML = `Peringatan Pelanggaran (${violationCount}/${MAX_VIOLATIONS})`;
        document.getElementById('blocker-msg').innerHTML   = `Anda terdeteksi melakukan tindakan terlarang: <strong>${type}</strong>. Silakan masuk kembali ke mode fullscreen.`;
        document.getElementById('blocker-overlay').classList.remove('hidden');
    }
}

document.getElementById('btn-resume').addEventListener('click', () => {
    if (document.documentElement.requestFullscreen && !isIOS) {
        document.documentElement.requestFullscreen().then(() => {
            document.getElementById('blocker-overlay').classList.add('hidden');
            initialWidth  = window.innerWidth;
            initialHeight = window.innerHeight;
        }).catch(() => {
            // Kalau gagal (user tolak), tetap tutup blocker
            document.getElementById('blocker-overlay').classList.add('hidden');
        });
    } else {
        document.getElementById('blocker-overlay').classList.add('hidden');
    }
});

// ---------------------------------------------------------------
// AUTH ENGINE
// ---------------------------------------------------------------
document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nisn = document.getElementById('input-nisn').value;
    const pin  = document.getElementById('input-pin').value;
    const btn  = document.getElementById('btn-login');
    btn.disabled = true;
    btn.innerHTML = 'Memverifikasi...';
    try {
        const response = await fetch(`${API_URL}?action=login&nisn=${nisn}&pin=${pin}`);
        const data = await response.json();
        if (data.status === "success") {
            if (data.aksesUjian === 'TUTUP') {
                alert('Akses ujian Anda saat ini ditutup oleh admin. Silakan hubungi pengawas untuk membuka akses.');
                btn.disabled = false;
                btn.innerHTML = 'Masuk Sistem <i class="fa-solid fa-arrow-right ml-2"></i>';
                return;
            }
            sessionToken = data.token_sesi;
            localStorage.setItem('nisn', nisn);
            localStorage.setItem('namaSiswa', data.nama || nisn);
            localStorage.removeItem('studentAnswers');
            localStorage.removeItem('activeIndex');
            studentAnswers = {};
            activeIndex    = 0;
            switchPage('instruction');
        } else {
            alert(data.message || "Kredensial Anda salah!");
        }
    } catch (err) { alert("Masalah koneksi ke server."); }
    finally {
        btn.disabled = false;
        btn.innerHTML = 'Masuk Sistem <i class="fa-solid fa-arrow-right ml-2"></i>';
    }
});

document.getElementById('btn-start-exam').addEventListener('click', () => {
    const startExamWorkflow = () => {
        switchPage('exam');
        document.getElementById('exam-timer').classList.replace('hidden', 'flex');
        initialWidth  = window.innerWidth;
        initialHeight = window.innerHeight;
        // Beri jeda 2 detik agar event resize/blur dari proses
        // fullscreen tidak terhitung violation
        examJustStarted = true;
        setTimeout(() => { examJustStarted = false; }, 2000);
        fetchExamPackage();
    };

    if (isIOS || !document.documentElement.requestFullscreen) {
        // iOS: tidak support fullscreen, langsung mulai
        startExamWorkflow();
    } else {
        // Desktop & Android: request fullscreen dulu
        document.documentElement.requestFullscreen()
            .then(startExamWorkflow)
            .catch(() => startExamWorkflow());
    }
});

// ---------------------------------------------------------------
// NAVIGASI — hanya click, tidak ada touchend
// touchend + e.preventDefault() + passive:false = scroll macet
// ---------------------------------------------------------------
function goToIndex(idx) {
    if (!examReady) return;
    if (idx < 0 || idx >= examQuestions.length) return;
    activeIndex = idx;
    localStorage.setItem('activeIndex', activeIndex);
    // requestAnimationFrame: beri browser 1 frame napas sebelum render
    // mencegah UI thread blocking di Android saat navigasi cepat
    requestAnimationFrame(() => renderQuestion());
}

document.getElementById('btn-next').addEventListener('click', () => goToIndex(activeIndex + 1));
document.getElementById('btn-prev').addEventListener('click', () => goToIndex(activeIndex - 1));

document.getElementById('btn-doubt').addEventListener('click', () => {
    if (!examReady) return;
    const id = examQuestions[activeIndex].id_soal;
    doubtfulQuestions[id] = !doubtfulQuestions[id];
    updateGridItem(activeIndex);
});

// ---------------------------------------------------------------
// CBT CORE SYSTEM
// ---------------------------------------------------------------
async function fetchExamPackage() {
    const nisn = localStorage.getItem('nisn');
    examReady  = false;
    examQuestions     = [];
    studentAnswers    = {};
    doubtfulQuestions = {};
    activeIndex = 0;
    document.getElementById('question-grid').innerHTML = '';
    document.getElementById('question-text').textContent = 'Memuat soal...';
    optBtns.forEach(b => { b.classList.add('hidden'); b.classList.remove('selected'); });

    try {
        const res  = await fetch(`${API_URL}?action=getQuestion&nisn=${nisn}&token=${sessionToken}`);
        const data = await res.json();

        if (data.status !== "success") {
            alert(data.message || "Tidak ada paket ujian aktif.");
            autoSubmitExam("Paket Tidak Tersedia");
            return;
        }

        examQuestions = data.questions;

        try {
            const resAns  = await fetch(`${API_URL}?action=getMyAnswers&nisn=${nisn}&token=${sessionToken}`);
            const dataAns = await resAns.json();
            if (dataAns.status === "success" && dataAns.answers) {
                examQuestions.forEach(q => {
                    const serverAns = dataAns.answers[q.id_soal];
                    if (serverAns) {
                        const displayKey = OPT_KEYS.find(k => q[`map${k.toUpperCase()}`] === serverAns);
                        if (displayKey) studentAnswers[q.id_soal] = { displayKey, originalKey: serverAns };
                    }
                });
            }
        } catch(e) { /* silent */ }

        const savedIndex = parseInt(localStorage.getItem('activeIndex') || '0');
        activeIndex = (savedIndex < examQuestions.length) ? savedIndex : 0;

        buildGrid();
        examReady = true;
        renderQuestion();

        if (data.sisa_waktu && data.sisa_waktu <= 0) {
            alert("Waktu ujian untuk kelas Anda telah habis. Silakan hubungi pengawas.");
            autoSubmitExam("Waktu Ujian Telah Habis Saat Login");
            return;
        }
        startTimer((data.sisa_waktu && data.sisa_waktu > 0) ? data.sisa_waktu : 3600);

    } catch (err) {
        alert("Gagal mengambil paket soal. Periksa koneksi internet Anda.");
    }
}

function buildGrid() {
    const grid = document.getElementById('question-grid');
    grid.innerHTML = '';
    examQuestions.forEach((q, idx) => {
        const box = document.createElement('button');
        box.innerText = idx + 1;
        box.className = "aspect-square w-full min-w-[36px] max-w-[46px] rounded-xl font-mono text-xs font-bold flex items-center justify-center transition-all border outline-none select-none bg-slate-50 text-slate-600 border-slate-200";
        box.addEventListener('click', () => goToIndex(idx));
        grid.appendChild(box);
    });
}

function updateGridItem(idx) {
    const grid = document.getElementById('question-grid');
    const box  = grid.querySelectorAll('button')[idx];
    if (!box) return;
    const q = examQuestions[idx];
    let cls = "aspect-square w-full min-w-[36px] max-w-[46px] rounded-xl font-mono text-xs font-bold flex items-center justify-center transition-all border outline-none select-none ";
    if (idx === activeIndex)               cls += "bg-indigo-600 text-white shadow-md ring-4 ring-indigo-100 border-indigo-600";
    else if (doubtfulQuestions[q.id_soal]) cls += "bg-amber-500 text-white border-amber-500";
    else if (studentAnswers[q.id_soal])    cls += "bg-emerald-600 text-white border-emerald-600";
    else                                   cls += "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-200";
    box.className = cls;
}

function updateAllGrid(prevIndex) {
    if (prevIndex >= 0) updateGridItem(prevIndex); // skip jika belum pernah render
    updateGridItem(activeIndex);
}

// prevIndex disimpan di luar renderQuestion agar updateAllGrid bisa
// membedakan kotak lama vs kotak baru dengan benar
let prevRenderIndex = -1; // -1 = belum pernah render, hindari false-update kotak pertama
function renderQuestion() {
    if (!examReady || examQuestions.length === 0) return;
    const prevIndex = prevRenderIndex;
    prevRenderIndex = activeIndex;
    const q = examQuestions[activeIndex];

    document.getElementById('current-question-num').innerText = activeIndex + 1;
    document.getElementById('question-text').textContent = q.pertanyaan;

    const imgWrap = document.getElementById('question-image-wrap');
    const imgEl   = document.getElementById('question-image');
    if (q.gambar_url && q.gambar_url.trim()) {
        let imgUrl = q.gambar_url.trim();
        // Google Drive
        const driveMatch = imgUrl.match(/(?:\/d\/|id=)([a-zA-Z0-9_-]{25,})/);
        if (driveMatch) imgUrl = `https://drive.google.com/thumbnail?id=${driveMatch[1]}&sz=w800`;
        // Blogger/Blogspot — ganti ukuran apapun (/s335/, /w640-h480/, dll) ke /s800/
        // agar tidak kena redirect chain yang sering block di Android/iOS WebView
        else if (/blogger\.googleusercontent\.com|bp\.blogspot\.com/.test(imgUrl)) {
            imgUrl = imgUrl.replace(/\/s\d+(-[^/]+)?\//, '/s800/');
        }

        // Reset src dulu agar loading gambar lama dibatalkan (cegah UI hang)
        imgEl.src = '';
        imgEl.style.opacity = '0';
        imgEl.onload  = null;
        imgEl.onerror = null;

        imgWrap.classList.remove('hidden');

        // Lazy-load gambar secara async — UI tidak blocking
        const newImg = new Image();
        newImg.onload = () => {
            imgEl.src = imgUrl;
            imgEl.style.opacity = '1';
        };
        newImg.onerror = () => {
            imgWrap.innerHTML = '<p class="text-xs text-rose-400 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2"><i class="fa-solid fa-triangle-exclamation mr-1"></i>Gambar tidak dapat dimuat.</p>';
        };
        newImg.src = imgUrl;
    } else {
        imgWrap.classList.add('hidden');
        imgEl.src = '';
        imgEl.style.opacity = '1';
    }

    if (window.MathJax && window.MathJax.typesetPromise) {
        setTimeout(() => {
            window.MathJax.typesetPromise([document.getElementById('question-container')]).catch(()=>{});
        }, 0);
    }

    const saved = studentAnswers[q.id_soal];
    const currentDisplayKey = saved ? saved.displayKey : null;

    OPT_KEYS.forEach((key, i) => {
        const btn  = optBtns[i];
        const text = q[`opsi_${key}`];
        if (text) {
            btn.querySelector('.opt-text').textContent = text;
            btn.classList.remove('hidden', 'selected');
            if (currentDisplayKey === key) btn.classList.add('selected');
        } else {
            btn.classList.add('hidden');
            btn.classList.remove('selected');
        }
    });

    updateAllGrid(prevIndex);
}

function saveAnswerToCloud(idSoal, jawaban, displayKey) {
    const nisn = localStorage.getItem('nisn');
    const savedAnswers = JSON.parse(localStorage.getItem('studentAnswers') || '{}');
    savedAnswers[idSoal] = { displayKey: displayKey || jawaban, originalKey: jawaban };
    localStorage.setItem('studentAnswers', JSON.stringify(savedAnswers));
    localStorage.setItem('activeIndex', activeIndex);
    fetch(API_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ action: 'submitAnswer', nisn, token: sessionToken, id_soal: idSoal, jawaban })
    });
}

document.getElementById('btn-finish-trigger').addEventListener('click', async () => {
    if (confirm("Apakah Anda yakin ingin mengakhiri sesi ujian dan mengirim berkas jawaban?")) {
        isFinishingExam = true;
        const btn = document.getElementById('btn-finish-trigger');
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Mengirim jawaban...';
        const nisn = localStorage.getItem('nisn');
        try { await fetch(`${API_URL}?action=forceEndExam&nisn=${nisn}&token=${sessionToken}`); } catch(e) {}
        finishExam();
    }
});

// ---------------------------------------------------------------
// CORE UTILS
// ---------------------------------------------------------------
function switchPage(pageName) {
    Object.values(pages).forEach(p => p.classList.add('hidden'));
    pages[pageName].classList.remove('hidden');
}

function startTimer(durationSeconds) {
    let timeLeft = durationSeconds;
    const btnFinish    = document.getElementById('btn-finish-trigger');
    const noticeFinish = document.getElementById('finish-notice');
    timerInterval = setInterval(() => {
        const hrs  = Math.floor(timeLeft / 3600);
        const mins = Math.floor((timeLeft % 3600) / 60);
        const secs = timeLeft % 60;
        document.getElementById('timer-countdown').innerText =
            `${String(hrs).padStart(2,'0')}:${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
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
    navigator.sendBeacon(API_URL, new URLSearchParams({ action: 'logViolation', nisn, jenis: type }));
}

function autoSubmitExam(reason) {
    clearInterval(timerInterval);
    isFinishingExam = true;
    examReady = false;
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(()=>{});
    if (reason === "Melebihi Batas Toleransi Kecurangan") {
        const nisn = localStorage.getItem('nisn');
        navigator.sendBeacon(API_URL, new URLSearchParams({ action: 'resetStatusSiswa', nisn }));
        localStorage.removeItem('studentAnswers');
        localStorage.removeItem('activeIndex');
        alert("\u26a0\ufe0f Anda telah melakukan 3 pelanggaran!\nSesi dihentikan. Lapor ke pengawas, lalu login ulang untuk mengerjakan kembali.");
        sessionToken = ""; examQuestions = []; studentAnswers = {}; doubtfulQuestions = {};
        activeIndex = 0; violationCount = 0; isFinishingExam = false;
        switchPage('login');
        document.getElementById('exam-timer').classList.add('hidden');
        document.getElementById('input-nisn').value = '';
        document.getElementById('input-pin').value  = '';
        return;
    }
    alert(`Ujian selesai: ${reason}`);
    finishExam();
}

function finishExam() {
    clearInterval(timerInterval);
    isFinishingExam = true;
    examReady = false;
    localStorage.removeItem('studentAnswers');
    localStorage.removeItem('activeIndex');
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
    document.getElementById('exam-timer').classList.add('hidden');
    document.getElementById('res-nama').innerText = localStorage.getItem('namaSiswa');
    switchPage('finish');
}
