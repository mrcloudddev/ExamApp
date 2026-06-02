const API_URL = "https://script.google.com/macros/s/AKfycbxbplQ7qpH65vQVUE2HQeednqMwrzCBjRe7fCQaq8gL2k42dCUwrVvkDde-dTD68TQJ/exec";

// --- CLIENT ROUTER ENGINE ---
document.querySelectorAll('#sidebar-nav button').forEach(button => {
    button.addEventListener('click', () => {
        document.querySelectorAll('#sidebar-nav button').forEach(b => { b.classList.remove('active', 'text-white'); b.classList.add('text-slate-400'); });
        button.classList.add('active', 'text-white'); button.classList.remove('text-slate-400');
        const targetPage = button.getAttribute('data-target');
        document.querySelectorAll('.admin-page').forEach(page => page.classList.add('hidden'));
        if (document.getElementById(targetPage)) document.getElementById(targetPage).classList.remove('hidden');
    });
});

function windowLoadHandler() { refreshData(); setInterval(refreshData, 12000); }

async function refreshData() {
    try {
        const response = await fetch(`${API_URL}?action=getAdminData`);
        const data = await response.json();
        if (data) {
            if(document.getElementById('stat-total-siswa')) document.getElementById('stat-total-siswa').innerText = data.stats.totalSiswa || 0;
            if(document.getElementById('stat-aktif')) document.getElementById('stat-aktif').innerText = data.stats.aktif || 0;
            if(document.getElementById('stat-selesai')) document.getElementById('stat-selesai').innerText = data.stats.selesai || 0;
            if(document.getElementById('stat-pelanggaran')) document.getElementById('stat-pelanggaran').innerText = data.stats.totalPelanggaran || 0;
            renderLiveTable(data.siswaList);
            renderSiswaTable(data.siswaList);
            renderSoalTable(data.soalList);
            renderJadwalTable(data.jadwalList);
        }
    } catch (err) { console.error("Sinkronisasi gagal", err); }
}

function renderLiveTable(list) {
    const tbody = document.getElementById('live-table-body'); if (!tbody) return; tbody.innerHTML = '';
    list.forEach(item => {
        let stateBadge = item.status === 'Belum' ? `<span class="bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-bold text-[10px]">BELUM MULAI</span>` :
                         item.status === 'Aktif' ? `<span class="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded font-bold text-[10px] animate-pulse">UJIAN</span>` :
                                                   `<span class="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-bold text-[10px]">SELESAI</span>`;
        let tr = document.createElement('tr'); tr.className = "hover:bg-slate-900/40 border-b border-slate-800/40 text-slate-300";
        tr.innerHTML = `<td class="p-4 font-mono">${item.nisn}</td><td class="p-4 font-bold text-white">${item.nama}</td><td class="p-4">${item.kelas}</td><td class="p-4">${stateBadge}</td><td class="p-4 text-center font-bold ${item.pelanggaran > 0 ? 'text-rose-400 bg-rose-500/10':''}">${item.pelanggaran}x</td><td class="p-4 text-right font-mono text-indigo-400 font-bold">${item.nilai !== null ? item.nilai : '-'}</td>`;
        tbody.appendChild(tr);
    });
}

function renderSiswaTable(list) {
    const tbody = document.getElementById('siswa-table-body'); if (!tbody) return; tbody.innerHTML = '';
    list.forEach(item => {
        let tr = document.createElement('tr'); tr.className = "hover:bg-slate-900/40 border-b border-slate-800/40 text-slate-300";
        tr.innerHTML = `<td class="p-4 font-mono text-indigo-400 font-bold">${item.nisn}</td><td class="p-4 font-bold text-white">${item.nama}</td><td class="p-4">${item.kelas}</td><td class="p-4 font-mono">${item.pin}</td><td class="p-4 font-mono text-[10px] text-slate-500 truncate max-w-[120px]">${item.token || '-'}</td>`;
        tbody.appendChild(tr);
    });
}

function renderSoalTable(list) {
    const tbody = document.getElementById('soal-table-body'); if (!tbody) return; tbody.innerHTML = '';
    list.forEach(item => {
        let tr = document.createElement('tr'); tr.className = "hover:bg-slate-900/40 border-b border-slate-800/40 text-slate-300";
        tr.innerHTML = `<td class="p-4 font-mono text-emerald-400 font-bold">${item.id_soal}</td><td class="p-4 font-semibold text-slate-400">${item.mapel}</td><td class="p-4 text-white truncate max-w-xs">${item.pertanyaan}</td><td class="p-4 text-center"><span class="bg-indigo-500/20 text-indigo-400 font-bold px-2 py-0.5 rounded uppercase">${item.kunci}</span></td><td class="p-4 text-right font-mono">${item.bobot}</td>`;
        tbody.appendChild(tr);
    });
}

function renderJadwalTable(list) {
    const tbody = document.getElementById('jadwal-table-body'); if (!tbody) return; tbody.innerHTML = '';
    if(!list || list.length === 0) { tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-slate-600">Belum ada pengaturan gerbang.</td></tr>`; return; }
    list.forEach(item => {
        let isOff = item.sesi === "OFF";
        let tr = document.createElement('tr'); tr.className = isOff ? "opacity-40 bg-slate-900/10 text-slate-500" : "bg-slate-900/40 text-slate-300 font-medium";
        tr.innerHTML = `<td class="p-3 font-bold text-white">${item.kelas}</td><td class="p-3 font-mono text-amber-400">${item.sesi}</td><td class="p-3 font-mono text-indigo-400">${item.paket}</td><td class="p-3 text-right text-[11px]">${isOff ? 'KUNCI':'BUKA'}</td>`;
        tbody.appendChild(tr);
    });
}

// --- FORM HANDLERS (POST METHOD) ---
document.getElementById('form-input-soal').addEventListener('submit', async (e) => {
    e.preventDefault(); const btn = document.getElementById('btn-submit-soal'); btn.disabled = true;
    const paramData = {
        action: 'addNewQuestion', id_soal: document.getElementById('add-id-soal').value, mapel: document.getElementById('add-mapel').value,
        pertanyaan: document.getElementById('add-pertanyaan').value, opsi_a: document.getElementById('add-opsi-a').value, opsi_b: document.getElementById('add-opsi-b').value,
        opsi_c: document.getElementById('add-opsi-c').value, opsi_d: document.getElementById('add-opsi-d').value, opsi_e: document.getElementById('add-opsi-e').value,
        kunci: document.getElementById('add-kunci').value, bobot: document.getElementById('add-bobot').value,
        target_kelas: document.getElementById('add-target-kelas').value, sesi_soal: document.getElementById('add-sesi-soal').value, paket_soal: document.getElementById('add-paket-soal').value
    };
    try {
        await fetch(API_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(paramData) });
        alert("Sukses menyuntikkan soal!"); document.getElementById('form-input-soal').reset(); refreshData();
    } catch(err) { alert("Gagal mengirim."); } finally { btn.disabled = false; btn.innerHTML = 'Simpan ke Server'; }
});

document.getElementById('form-kontrol-jadwal').addEventListener('submit', async (e) => {
    e.preventDefault(); const btn = document.getElementById('btn-submit-jadwal'); btn.disabled = true;
    const paramData = { action: 'updateJadwalKontrol', kelas: document.getElementById('set-kelas').value, sesi: document.getElementById('set-sesi').value, paket: document.getElementById('set-paket').value };
    try {
        await fetch(API_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(paramData) });
        alert("Jadwal kelas berhasil diubah!"); refreshData();
    } catch(err) { alert("Gagal ubah jadwal."); } finally { btn.disabled = false; btn.innerHTML = 'Terapkan Perubahan'; }
});

function exportNilai() { window.open(`${API_URL}?action=exportExcel`, '_blank'); }
window.onload = windowLoadHandler;
