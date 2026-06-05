const API_URL = "https://script.google.com/macros/s/AKfycbw-ZVWvp-6g7B5KBKTh5DT9zpzXfweTkIZxj8wbakFg1bAUcxdqWF9zbCRRJYETMyhHpg/exec";

let sessionToken = "";
let examQuestions = [];
let studentAnswers = {};
let doubtfulQuestions = {};
let activeIndex = 0;
let violationCount = 0;
const MAX_VIOLATIONS = 3;
let timerInterval;
let questionPollInterval;  // Polling refresh soal saat ujian berlangsung
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
        // Timer tidak dijalankan di sini — akan dijalankan setelah fetchExamPackage
        // mendapatkan sisa_waktu dari server agar siswa telat mendapat waktu yang dipotong
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

            // Restore jawaban & posisi soal dari localStorage (backup setelah reload)
            const savedAnswers = JSON.parse(localStorage.getItem('studentAnswers') || '{}');
            studentAnswers = savedAnswers;
            const savedIndex = parseInt(localStorage.getItem('activeIndex') || '0');
            activeIndex = (savedIndex < examQuestions.length) ? savedIndex : 0;

            renderCbtDashboard();

            // Gunakan sisa_waktu dari server jika tersedia (dalam detik)
            // Ini memastikan siswa telat mendapat waktu yang sudah dipotong
            const sisaWaktu = (data.sisa_waktu && data.sisa_waktu > 0)
                ? data.sisa_waktu
                : 60 * 60; // fallback 60 menit jika server belum support field ini

            if (data.sisa_waktu && data.sisa_waktu <= 0) {
                // Waktu ujian sudah habis sebelum siswa sempat mulai
                alert("Waktu ujian untuk kelas Anda telah habis. Silakan hubungi pengawas.");
                autoSubmitExam("Waktu Ujian Telah Habis Saat Login");
                return;
            }

            startTimer(sisaWaktu);
            startQuestionPolling();
        } else {
            alert(data.message || "Tidak ada paket ujian aktif.");
            autoSubmitExam("Paket Tidak Tersedia");
        }
    } catch (err) { alert("Gagal mengambil paket soal."); }
}

// Polling soal secara berkala — update pertanyaan & opsi tanpa hapus jawaban siswa
function startQuestionPolling() {
    clearInterval(questionPollInterval);
    questionPollInterval = setInterval(async () => {
        if (isFinishingExam) { clearInterval(questionPollInterval); return; }
        const nisn = localStorage.getItem('nisn');
        try {
            const res = await fetch(`${API_URL}?action=getQuestion&nisn=${nisn}&token=${sessionToken}`);
            const data = await res.json();
            if (data.status === "success" && data.questions && data.questions.length > 0) {
                // Buat peta soal lama berdasarkan id_soal agar merge akurat (bukan berdasarkan index)
                const oldQMap = {};
                examQuestions.forEach(q => { oldQMap[q.id_soal] = q; });

                // Untuk setiap soal baru dari server:
                // - Jika id_soal sudah ada di soal lama → pertahankan SEMUA data lama
                //   (termasuk opsi & mapping acak yang sudah dilihat siswa)
                //   tapi update hanya teks pertanyaan & gambar (konten substantif)
                // - Jika id_soal benar-benar baru → gunakan data baru sepenuhnya
                const updatedQuestions = data.questions.map(newQ => {
                    const oldQ = oldQMap[newQ.id_soal];
                    if (oldQ) {
                        // Pertahankan urutan opsi & mapping yang sudah tampil ke siswa
                        return {
                            ...oldQ,
                            pertanyaan: newQ.pertanyaan,  // update teks soal jika diubah admin
                            gambar_url: newQ.gambar_url   // update gambar jika diubah admin
                        };
                    }
                    return newQ; // soal baru, pakai data fresh
                });

                // Pertahankan urutan soal yang sudah diacak sebelumnya (jangan acak ulang)
                // Soal lama tetap di posisinya; soal baru (jika ada) ditambahkan di akhir
                const existingIds = examQuestions.map(q => q.id_soal);
                const newIds = updatedQuestions.map(q => q.id_soal);
                const updatedMap = {};
                updatedQuestions.forEach(q => { updatedMap[q.id_soal] = q; });

                // Rebuild: soal lama dengan data terupdate, lalu soal baru yang belum ada
                const merged = examQuestions
                    .filter(q => newIds.includes(q.id_soal))  // buang soal yang dihapus admin
                    .map(q => updatedMap[q.id_soal]);          // update data soal yang ada
                updatedQuestions.forEach(q => {
                    if (!existingIds.includes(q.id_soal)) merged.push(q); // tambah soal baru
                });

                examQuestions = merged;
                renderCbtDashboard();
                showSoalUpdateBanner();
            }
        } catch (err) { /* Silent — jangan ganggu ujian jika polling gagal */ }
    }, 30000); // Setiap 30 detik
}

function showSoalUpdateBanner() {
    const existing = document.getElementById('soal-update-banner');
    if (existing) { existing.remove(); }
    const banner = document.createElement('div');
    banner.id = 'soal-update-banner';
    banner.className = 'fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-amber-500 text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg flex items-center gap-2 animate-bounce';
    banner.innerHTML = '<i class="fa-solid fa-rotate mr-1"></i> Soal diperbarui oleh admin';
    document.body.appendChild(banner);
    setTimeout(() => { if (banner.parentNode) banner.remove(); }, 3500);
}

function renderCbtDashboard() {
    if (examQuestions.length === 0) return;
    const currentQuestion = examQuestions[activeIndex];
    
    document.getElementById('current-question-num').innerText = activeIndex + 1;

    // Render teks soal (support teks biasa)
    const qTextEl = document.getElementById('question-text');
    qTextEl.textContent = currentQuestion.pertanyaan;

    // Render gambar soal jika ada (field gambar_url dari server)
    const imgWrap = document.getElementById('question-image-wrap');
    const imgEl = document.getElementById('question-image');
    if (currentQuestion.gambar_url && currentQuestion.gambar_url.trim() !== '') {
        let imgUrl = currentQuestion.gambar_url.trim();

        // Konversi berbagai format Google Drive ke format thumbnail yang bisa di-embed
        // Format 1: https://drive.google.com/file/d/FILE_ID/view
        // Format 2: https://drive.google.com/open?id=FILE_ID
        // Format 3: https://drive.google.com/uc?id=FILE_ID  (sudah benar, tapi sering diblokir)
        const driveMatch = imgUrl.match(/(?:\/d\/|id=)([a-zA-Z0-9_-]{25,})/);
        if (driveMatch) {
            // Gunakan thumbnail API Drive yang tidak butuh auth
            imgUrl = `https://drive.google.com/thumbnail?id=${driveMatch[1]}&sz=w800`;
        }

        imgEl.src = imgUrl;
        imgEl.onerror = function() {
            // Jika gambar gagal load, sembunyikan dan tampilkan pesan
            imgWrap.innerHTML = '<p class="text-xs text-rose-400 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2"><i class="fa-solid fa-triangle-exclamation mr-1"></i>Gambar tidak dapat dimuat. Pastikan link gambar dapat diakses publik.</p>';
        };
        imgWrap.classList.remove('hidden');
    } else {
        imgWrap.classList.add('hidden');
        imgEl.src = '';
    }

    // Trigger MathJax render ulang untuk soal matematika
    if (window.MathJax && window.MathJax.typesetPromise) {
        window.MathJax.typesetPromise([document.getElementById('question-container')]).catch(()=>{});
    }

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

    // Simpan ke localStorage sebagai backup tampilan setelah reload
    const savedAnswers = JSON.parse(localStorage.getItem('studentAnswers') || '{}');
    savedAnswers[idSoal] = jawaban;
    localStorage.setItem('studentAnswers', JSON.stringify(savedAnswers));
    localStorage.setItem('activeIndex', activeIndex);

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
      } catch(e) { /* tetap lanjut ke halaman selesai */ }
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
    clearInterval(questionPollInterval);
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
    clearInterval(questionPollInterval);
    isFinishingExam = true;

    // Bersihkan backup — nilai sudah aman di spreadsheet
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
