// ==========================================
// CONFIG: PASTE URL WEB APP APPS SCRIPT ANDA
// ==========================================
const API_URL = "https://script.google.com/macros/s/AKfybyxX_PASTE_URL_WEB_APP_ANDA/exec";

// --- 1. CLIENT ROUTER ENGINE ---
document.querySelectorAll('#sidebar-nav button').forEach(button => {
    button.addEventListener('click', () => {
        document.querySelectorAll('#sidebar-nav button').forEach(b => {
            b.classList.remove('active', 'text-white');
            b.classList.add('text-slate-400');
        });
        // Perbaikan typo (.classList.add)
        button.classList.add('active', 'text-white');
        button.classList.remove('text-slate-400');

        const targetPage = button.getAttribute('data-target');
        document.querySelectorAll('.admin-page').forEach(page => page.classList.add('hidden'));
        
        const targetEl = document.getElementById(targetPage);
        if (targetEl) targetEl.classList.remove('hidden');

        const titleMap = {
            'page-monitor': { t: 'Monitoring Real-Time', d: 'Pantau pergerakan integritas siswa saat pengerjaan assessment' },
            'page-siswa': { t: 'Database Siswa', d: 'Manajemen data nomor peserta, PIN login, dan status kehadiran kelas' },
            'page-soal': { t: 'Bank Soal Pusat', d: 'Kelola butir pertanyaan, pilihan opsi ganda, bobot skoring, dan kunci jawaban' },
            'page-setting': { t: 'Pengaturan Parameter', d: 'Atur token global, durasi hitung mundur, dan regulasi sistem anti-curang' }
        };
        
        if (titleMap[targetPage]) {
            document.getElementById('header-title').innerText = titleMap[targetPage].t;
            document.getElementById('header-desc').innerText = titleMap[targetPage].d;
        }
    });
});

// --- 2. LIVE DATA ENGINE ---
function windowLoadHandler() {
    refreshData();
    setInterval(refreshData, 10000); // Sinkronisasi otomatis tiap 10 detik
}

async function refreshData() {
    if (API_URL.includes("PASTIKAN_URL_DEPLOY")) return;
    
    try {
        const response = await fetch(`${API_URL}?action=getAdminData`);
        const data = await response.json();
        
        if (data) {
            updateStats(data.stats);
            renderLiveTable(data.siswaList);
            renderSiswaTable(data.siswaList);
            renderSoalTable(data.soalList);
        }
    } catch (err) {
        console.error("Gagal melakukan sinkronisasi data stream: ", err);
        const failHTML = `<tr><td colspan="6" class="p-8 text-center text-rose-400 font-bold"><i class="fa-solid fa-circle-exclamation mr-1"></i> Gagal Sinkronisasi Basis Data.</td></tr>`;
        if(document.getElementById('live-table-body')) document.getElementById('live-table-body').innerHTML = failHTML;
    }
}

function updateStats(stats) {
    if (!stats) return;
    if(document.getElementById('stat-total-siswa')) document.getElementById('stat-total-siswa').innerText = stats.totalSiswa || 0;
    if(document.getElementById('stat-aktif')) document.getElementById('stat-aktif').innerText = stats.aktif || 0;
    if(document.getElementById('stat-selesai')) document.getElementById('stat-selesai').innerText = stats.selesai || 0;
    if(document.getElementById('stat-pelanggaran')) document.getElementById('stat-pelanggaran').innerText = stats.totalPelanggaran || 0;
}

function renderLiveTable(list) {
    const tbody = document.getElementById('live-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    if (!list || list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-slate-500">Tabel monitoring kosong.</td></tr>`;
        return;
    }
    list.forEach(item => {
        let stateBadge = item.status === 'Belum' ? `<span class="bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-bold text-[10px]">BELUM MULAI</span>` :
                         item.status === 'Aktif' ? `<span class="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded font-bold text-[10px] animate-pulse">UJIAN</span>` :
                                                   `<span class="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-bold text-[10px]">SELESAI</span>`;
        let tr = document.createElement('tr');
        tr.className = "hover:bg-slate-900/40 border-b border-slate-800/40 transition-all";
        tr.innerHTML = `
            <td class="p-4 font-mono text-slate-400 font-medium">${item.nisn}</td>
            <td class="p-4 font-bold text-white">${item.nama}</td>
            <td class="p-4 text-slate-300">${item.kelas}</td>
            <td class="p-4">${stateBadge}</td>
            <td class="p-4 text-center font-bold ${item.pelanggaran > 0 ? 'text-rose-400 bg-rose-500/10' : 'text-slate-500'}">${item.pelanggaran}x Melanggar</td>
            <td class="p-4 text-right font-mono font-black text-indigo-400 text-sm">${item.nilai !== null ? item.nilai : '-'}</td>
        `;
        tbody.appendChild(tr);
    });
}

function renderSiswaTable(list) {
    const tbody = document.getElementById('siswa-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    if (!list || list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-slate-500">Tidak ada data siswa terdaftar.</td></tr>`;
        return;
    }
    list.forEach(item => {
        let tr = document.createElement('tr');
        tr.className = "hover:bg-slate-900/40 border-b border-slate-800/40 transition-all";
        tr.innerHTML = `
            <td class="p-4 font-mono text-indigo-400 font-bold">${item.nisn}</td>
            <td class="p-4 font-bold text-white">${item.nama}</td>
            <td class="p-4 text-slate-300">${item.kelas}</td>
            <td class="p-4 font-mono text-slate-400">${item.pin}</td>
            <td class="p-4 font-mono text-[10px] text-slate-500 truncate max-w-[140px]">${item.token || 'Tidak ada sesi aktif'}</td>
        `;
        tbody.appendChild(tr);
    });
}

function renderSoalTable(list) {
    const tbody = document.getElementById('soal-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    if (!list || list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-slate-500">Tidak ada butir soal ditemukan di tb_soal Google Sheets Anda.</td></tr>`;
        return;
    }
    list.forEach(item => {
        let tr = document.createElement('tr');
        tr.className = "hover:bg-slate-900/40 border-b border-slate-800/40 transition-all";
        tr.innerHTML = `
            <td class="p-4 font-mono font-bold text-emerald-400">${item.id_soal}</td>
            <td class="p-4 text-slate-400 font-semibold">${item.mapel}</td>
            <td class="p-4 text-white font-medium truncate max-w-xs">${item.pertanyaan}</td>
            <td class="p-4 text-center"><span class="bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 font-bold px-2 py-0.5 rounded uppercase">${item.kunci}</span></td>
            <td class="p-4 text-right font-mono text-slate-300 font-bold">${item.bobot}</td>
        `;
        tbody.appendChild(tr);
    });
}

function exportNilai() {
    alert("Mengalihkan ke Compiler Unduhan Sheets Master...");
    window.open(`${API_URL}?action=exportExcel`, '_blank');
}

window.onload = windowLoadHandler;
