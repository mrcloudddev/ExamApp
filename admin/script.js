// Memanggil Apps Script Server API Functions
const API_URL = "https://script.google.com/macros/s/AKfycbxhvwnuRlhfg3cCL-KD_8UCFxiWpjbAUdOi8Nj5HnOXnOtR1Mf2FcYepBQHp_kLj8lVHg/exec"; // Sesuaikan URL API

function windowLoadHandler() {
    refreshData();
    setInterval(refreshData, 10000); // Polling otomatis setiap 10 detik
}

async function refreshData() {
    try {
        const response = await fetch(`${API_URL}?action=getAdminData`);
        const data = await response.json();
        
        if(data) {
            updateStats(data.stats);
            renderLiveTable(data.siswaList);
        }
    } catch (err) {
        console.error("Gagal melakukan penarikan data dashboard master: ", err);
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

    if(list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-slate-500">Tidak ada data siswa ditemukan.</td></tr>`;
        return;
    }

    list.forEach(item => {
        let statusBadge = '';
        if(item.status === "Belum") statusBadge = `<span class="bg-slate-800 text-slate-400 px-2 py-1 rounded-md font-bold text-[10px]">BELUM MULAI</span>`;
        else if(item.status === "Aktif") statusBadge = `<span class="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-1 rounded-md font-bold text-[10px] animate-pulse">SEDANG UJIAN</span>`;
        else if(item.status === "Selesai") statusBadge = `<span class="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-1 rounded-md font-bold text-[10px]">SELESAI</span>`;

        let tr = document.createElement('tr');
        tr.className = "hover:bg-slate-900/30 transition-all";
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
    alert("Proses otomatisasi ekspor sedang mengeksekusi Google Apps Script Spreadsheet Compiler. File Excel/PDF siap diunduh pada Drive master Anda.");
    window.open(`${API_URL}?action=exportExcel`, '_blank');
}

window.onload = windowLoadHandler;