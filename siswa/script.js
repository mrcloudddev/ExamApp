const API_URL = "https://script.google.com/macros/s/AKfycbza70DdM7lJuR4YTDimoiNmsB_rP4g1q6aSeIsJ6TbhEjOJ08jBfl1YMnQjzqsy7B7VZg/exec";

let sessionToken = "";
let examQuestions = [];
let studentAnswers = {};
let doubtfulQuestions = {};
let activeIndex = 0;
let violationCount = 0;
const MAX_VIOLATIONS = 3;
let timerInterval;
let isFinishingExam = false; 

// Menyimpan ukuran layar awal untuk deteksi manipulasi Split Screen (Layar Belah HP)
let initialWidth = window.innerWidth;
let initialHeight = window.innerHeight;

const pages = {
    login: document.getElementById('login-page'),
    instruction: document.getElementById('instruction-page'),
    exam: document.getElementById('exam-page'),
    finish: document.getElementById('finish-page')
};

// --- SECURITIES GUARD ENGINE (ANTI-NYONTEK HP & PC BERLAPIS) ---
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
    
    // FIX KHUSUS IPHONE: Jika tipe pelanggaran adalah fullscreen tetapi device tidak mendukung API Fullscreen, abaikan.
    if (type === "Keluar dari Mode Fullscreen" && !document.documentElement.requestFullscreen) {
        return; 
    }

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
    // Validasi pengecekan dukungan fullscreen saat tombol resume ditekan
    if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().then(() => {
            document.getElementById('blocker-overlay').classList.add('hidden');
            initialWidth = window.innerWidth;
            initialHeight = window.innerHeight;
        }).catch(() => alert("Wajib masuk mode fullscreen untuk melanjutkan!"));
    } else {
        // Jika di iPhone, langsung tutup blocker overlay karena tidak mendukung fullscreen
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
            // Cek apakah akses ujian siswa ini dibuka atau ditutup admin
            if (data.aksesUjian === 'TUTUP') {
                alert('Akses ujian Anda saat ini ditutup oleh admin. Silakan hubungi pengawas untuk membuka akses.');
                btn.disabled = false; btn.innerHTML = 'Masuk Sistem <i class="fa-solid fa-arrow-right ml-2"></i>';
                return;
            }
            sessionToken = data.token_sesi;
            localStorage.setItem('nisn', nisn);
            localStorage.setItem('namaSiswa', data.nama || nisn);
            switchPage('instruction');
        } else {
            alert(data.message || "Kredensial Anda salah!");
        }
    } catch (err) { alert("Masalah koneksi ke server."); }
    finally { btn.disabled = false; btn.innerHTML = 'Masuk Sistem <i class="fa-solid fa-arrow-right ml-2"></i>'; }
});

document.getElementById('btn-start-exam').addEventListener('click', () => {
    // Alur penyiapan dashboard dan fetch soal dimasukkan ke dalam fungsi terisolasi
    const startExamWorkflow = () => {
        switchPage('exam');
        document.getElementById('exam-timer').classList.replace('hidden', 'flex');
        
        // --- TEMPAT MERUBAH DURASI UJIAN (Dalam Satuan Detik) ---
        startTimer(60 * 60); // Default: 60 Menit.
        
        initialWidth = window.innerWidth;
        initialHeight = window.innerHeight;
        
        fetchExamPackage();
    };

    // FIX KHUSUS IPHONE: Cek ketersediaan API requestFullscreen sebelum dieksekusi
    if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen()
            .then(startExamWorkflow)
            .catch(() => {
                // Jika request fullscreen gagal/ditolak oleh user di Android/PC, sistem tetap mengizinkan ujian
                startExamWorkflow();
            });
    } else {
        // Eksekusi langsung jika diakses dari iOS / Safari Mobile
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
    document.getElementById('question-text').innerText = currentQuestion.pertanyaan;

    const optContainer = document.getElementById('options-container');
    optContainer.innerHTML = '';

    // Loop pembuatan opsi pilihan jawaban yang adaptif terhadap arsitektur acakan Apps Script
    ['a', 'b', 'c', 'd', 'e'].forEach(key => {
        if (currentQuestion[`opsi_${key}`]) {
            const btn = document.createElement('button');
            btn.className = "option-card w-full text-left bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-3 transition-all outline-none text-sm font-medium group";
            if (studentAnswers[currentQuestion.id_soal] === key) btn.classList.add('selected');

            btn.onclick = () => {
                document.querySelectorAll('.option-card').forEach(el => el.classList.remove('selected'));
                btn.classList.add('selected');
                studentAnswers[currentQuestion.id_soal] = key;
                
                // Konversi kunci dinamis kembali ke index aslinya agar kalkulasi nilai di spreadsheet tetap akurat
                let properKey = currentQuestion[`map${key.toUpperCase()}`] || key;
                saveAnswerToCloud(currentQuestion.id_soal, properKey);
                renderGridIndicators();
            };
            btn.innerHTML = `<span class="w-8 h-8 bg-slate-100 group-hover:bg-indigo-50 border border-slate-200 text-slate-600 font-bold text-xs rounded-xl flex items-center justify-center uppercase">${key}</span><span class="text-slate-700">${currentQuestion[`opsi_${key}`]}</span>`;
            optContainer.appendChild(btn);
        }
    });

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
        box.className = "aspect-square w-full min-w-[36px] max-w-[46px] rounded-xl font-mono text-xs font-bold flex items-center justify-center transition-all border outline-none select-none ";
        box.innerText = idx + 1;

        if (idx === activeIndex) box.className += "bg-indigo-600 text-white shadow-md ring-4 ring-indigo-100 border-indigo-600";
        else if (doubtfulQuestions[q.id_soal]) box.className += "bg-amber-500 text-white border-amber-500";
        else if (studentAnswers[q.id_soal]) box.className += "bg-emerald-600 text-white border-emerald-600";
        else box.className += "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-200";

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
  if(confirm("Apakah Anda yakin ingin mengakhiri sesi ujian dan mengirim berkas jawaban?")) {
      isFinishingExam = true; 
      const nisn = localStorage.getItem('nisn');
      try {
          await fetch(`${API_URL}?action=forceEndExam&nisn=${nisn}&token=${sessionToken}`);
          finishExam();
      } catch(e) { finishExam(); }
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
        
        // Aturan Kunci Sesi: Tombol diaktifkan penuh ketika sisa waktu <= 20 menit (1200 detik)
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
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen(); 
    alert(`Ujian selesai: ${reason}`); 
    finishExam(); 
}

function finishExam() { 
    clearInterval(timerInterval); 
    isFinishingExam = true;
    
    if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
    }
    
    document.getElementById('exam-timer').classList.add('hidden'); 
    
    const namaTerdaftar = localStorage.getItem('namaSiswa');
    document.getElementById('res-nama').innerText = namaTerdaftar; 
    
    switchPage('finish'); 
}
