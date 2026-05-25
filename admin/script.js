// ISI DENGAN URL WEB APP GOOGLE APPS SCRIPT ASLI ANDA
const API_URL = "https://script.google.com/macros/s/AKfycbyCBRnEcD-5EQDrhQWgHiQDNJPIJt4IJomMjrJewGNO4IaY_CxGCJW5lI6cLrPfCxUe0g/exec"; 

// --- ENGINE TAB NAVIGASI ---
document.querySelectorAll('#sidebar-nav button').forEach(button => {
    button.addEventListener('click', () => {
        // Ganti class active pada tombol menu samping
        document.querySelectorAll('#sidebar-nav button').forEach(b => {
            b.classList.remove('active', 'text-white');
            b.classList.add('text-slate-400');
        });
        button.add('active', 'text-white');
        button.classList.remove('text-slate-400');

        // Sembunyikan semua halaman admin, tampilkan yang dipilih
        const targetPage = button.getAttribute('data-target');
        document.querySelectorAll('.admin-page').forEach(page => page.classList.add('hidden'));
        document.getElementById(targetPage).classList.remove('hidden');

        // Dinamis Ubah Teks Header Judul atas sesuai menu
        const titleMap = {
            'page-monitor': { t: 'Monitoring Real-Time', d: 'Pantau pergerakan integritas siswa saat pengerjaan assessment' },
            'page-siswa': { t: 'Database Siswa', d: 'Manajemen data nomor peserta, PIN login, dan status kehadiran kelas' },
            'page-soal': { t: 'Bank Soal Pusat', d: 'Kelola butir pertanyaan, pilihan opsi ganda, bobot skoring, dan kunci jawaban' },
            'page-setting': { t: 'Pengaturan Parameter', d: 'Atur token global, durasi hitung mundur, dan regulasi sistem anti-curang' }
        };
        document.getElementById('header-title').innerText = titleMap[targetPage].t;
        document.getElementById('header-desc').innerText = titleMap[targetPage].d;
    });
});

// --- CLIENT-SIDE REAL-TIME DATA FETCH POLLING ---
function windowLoadHandler() {
    refreshData();
    setInterval(refreshData, 8000); // Sinkronisasi otomatis data tiap 8 detik
}

async function refreshData() {
    if (API_URL.includes("PASTIKAN_URL_DEPLOY")) {
        console.warn("API_URL belum dikonfigurasi dengan URL Apps Script Anda!");
        return;
    }

    try {
        const response = await fetch(`${API_URL}?action=getAdminData`);
        const data = await response.json();
        
        if(data) {
            updateStats(data.stats);
            renderLiveTable(data.siswaList);
        }
    } catch (err) {
        console.error("Gagal melakukan penarikan data dashboard master: ", err);
        document.getElementById('live-table-body').innerHTML = `
            <tr>
                <td colspan="6" class="p-8 text-center text-rose-400 font-medium">
                    <i class="fa-solid fa-triangle-exclamation mr-1"></i> Gagal terhubung ke Apps Script. Periksa URL API atau Hak Akses Deployment!
                </td>
            </tr>`;
    }
}

function updateStats(stats) {
    document.getElementById('stat-total-siswa').innerText = stats.totalSiswa || 0;
    document.getElementById('stat-aktif').innerText = stats.aktif || 0;
    document.getElementById('stat-selesai').innerText = stats.selesai || 0;
    document.getElementById('stat-pelanggaran').innerText = stats.totalPelanggaran || 0;
}

function renderLiveTable(list) {
    const tbody = document.getElementById('live-table-body');
    tbody.innerHTML = '';

    if(!list || list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-slate-500">Tidak ada data siswa ditemukan di tb_siswa.</td></tr>`;
        return;
    }

    list.forEach(item => {
        let statusBadge = '';
        if(item.status === "Belum") {
            statusBadge = `<span class="bg-slate-800 text-slate-400 px-2 py-1 rounded-md font-bold text-[10px]">BELUM MULAI</span>`;
        } else if(item.status === "Aktif") {
            statusBadge = `<span class="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-1 rounded-md font-bold text-[10px] animate-pulse">SEDANG UJIAN</span>`;
        } else if(item.status === "Selesai") {
            statusBadge = `<span class="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-1 rounded-md font-bold text-[10px]">SELESAI</span>`;
        }

        let tr = document.createElement('tr');
        tr.className = "hover:bg-slate-900/30 transition-all border-b border-slate-800/30";
        tr.innerHTML = `
            <td class="p-4 font-mono font-semibold text-slate-400">${item.nisn}</td>
            <td class="p-4 font-bold text-white">${item.nama}</td>
            <td class="p-4 text-slate-300">${item.kelas}</td>
            <td class="p-4">${statusBadge}</td>
            <td class="p-4 text-center font-bold ${item.pelanggaran > 0 ? 'text-rose-400 bg-rose-500/5' : 'text-slate-500'}">${item.pelanggaran}x Melanggar</td>
            <td class="p-4 text-right font-mono font-black text-sm ${item.status === 'Selesai' ? 'text-indigo-400' : 'text-slate-600'}">${item.nilai !== null ? item.nilai : '-'}</td>
        `;
        tbody.appendChild(tr);
    });
}

function exportNilai() {
    if (API_URL.includes("PASTIKAN_URL_DEPLOY")) return;
    alert("Proses otomatisasi ekspor sedang mengeksekusi Google Apps Script Spreadsheet Compiler.");
    window.open(`${API_URL}?action=exportExcel`, '_blank');
}

window.onload = windowLoadHandler;
