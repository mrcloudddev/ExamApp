const API_URL = "https://script.google.com/macros/s/AKfycby2Rr-UHzJ6MrC1heufYtMOTOOblOgILVzIS7tY0tYQRGwG6qWLFuAi0oIifmoKiumXCw/exec";

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
            renderAksesTable(data.siswaList);
            renderSoalTable(data.soalList);
            renderJadwalTable(data.jadwalList);
        }
    } catch (err) { console.error("Sinkronisasi gagal", err); }
}

// Cache for live monitor data
let liveDataCache = [];

function renderLiveTable(list) {
    liveDataCache = list;

    // Populate kelas dropdown
    const kelasSet = [...new Set(list.map(s => s.kelas).filter(Boolean))].sort();
    const kelasSelect = document.getElementById('monitor-filter-kelas');
    if (kelasSelect) {
        const prev = kelasSelect.value;
        kelasSelect.innerHTML = '<option value="">Semua Kelas</option>';
        kelasSet.forEach(k => { const o = document.createElement('option'); o.value = k; o.textContent = k; if (k === prev) o.selected = true; kelasSelect.appendChild(o); });
    }

    applyFilterMonitor();
}

function applyFilterMonitor() {
    const q      = (document.getElementById('monitor-filter-nama')?.value || '').toLowerCase().trim();
    const kelas  = document.getElementById('monitor-filter-kelas')?.value  || '';
    const status = document.getElementById('monitor-filter-status')?.value || '';
    const viol   = document.getElementById('monitor-filter-violation')?.value || '';

    const filtered = liveDataCache.filter(item => {
        const matchQ      = !q      || String(item.nisn).toLowerCase().includes(q) || String(item.nama).toLowerCase().includes(q);
        const matchKelas  = !kelas  || item.kelas === kelas;
        const matchStatus = !status || (status === 'Selesai' ? String(item.status).startsWith('Selesai') : item.status === status);
        const matchViol   = !viol   || (viol === 'ada' ? item.pelanggaran > 0 : item.pelanggaran === 0);
        return matchQ && matchKelas && matchStatus && matchViol;
    });

    const badge = document.getElementById('monitor-count-badge');
    if (badge) badge.textContent = filtered.length < liveDataCache.length ? `${filtered.length} / ${liveDataCache.length} siswa` : `${liveDataCache.length} siswa`;

    const tbody = document.getElementById('live-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-slate-500">Tidak ada siswa yang cocok dengan filter.</td></tr>`;
        return;
    }

    filtered.forEach(item => {
        let stateBadge = item.status === 'Belum' ? `<span class="bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-bold text-[10px]">BELUM MULAI</span>` :
                         item.status === 'Aktif' ? `<span class="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded font-bold text-[10px] animate-pulse">UJIAN</span>` :
                                                   `<span class="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-bold text-[10px]">SELESAI</span>`;
        let tr = document.createElement('tr'); tr.className = "hover:bg-slate-900/40 border-b border-slate-800/40 text-slate-300";
        tr.innerHTML = `<td class="p-4 font-mono">${item.nisn}</td><td class="p-4 font-bold text-white">${item.nama}</td><td class="p-4">${item.kelas}</td><td class="p-4">${stateBadge}</td><td class="p-4 text-center font-bold ${item.pelanggaran > 0 ? 'text-rose-400 bg-rose-500/10':''}">${item.pelanggaran}x</td><td class="p-4 text-right font-mono text-indigo-400 font-bold">${item.nilai !== null ? item.nilai : '-'}</td>`;
        tbody.appendChild(tr);
    });
}

function resetFilterMonitor() {
    const el = id => document.getElementById(id);
    if (el('monitor-filter-nama'))      el('monitor-filter-nama').value = '';
    if (el('monitor-filter-kelas'))     el('monitor-filter-kelas').value = '';
    if (el('monitor-filter-status'))    el('monitor-filter-status').value = '';
    if (el('monitor-filter-violation')) el('monitor-filter-violation').value = '';
    applyFilterMonitor();
}

// Cache siswa untuk filter
let siswaCache = [];

function renderSiswaTable(list) {
    siswaCache = list;

    // Isi dropdown kelas
    const kelasSet = [...new Set(list.map(s => s.kelas).filter(Boolean))].sort();
    const kelasSelect = document.getElementById('siswa-filter-kelas');
    if (kelasSelect) {
        const prev = kelasSelect.value;
        kelasSelect.innerHTML = '<option value="">Semua Kelas</option>';
        kelasSet.forEach(k => { const o = document.createElement('option'); o.value = k; o.textContent = k; kelasSelect.appendChild(o); });
        kelasSelect.value = prev;
    }

    applyFilterSiswa();
}

function applyFilterSiswa() {
    const text = (document.getElementById('siswa-filter-text')?.value || '').toLowerCase().trim();
    const kelas = document.getElementById('siswa-filter-kelas')?.value || '';

    const filtered = siswaCache.filter(item => {
        const matchText = !text ||
            String(item.nisn).toLowerCase().includes(text) ||
            String(item.nama).toLowerCase().includes(text);
        const matchKelas = !kelas || item.kelas === kelas;
        return matchText && matchKelas;
    });

    const badge = document.getElementById('siswa-count-badge');
    if (badge) badge.textContent = `${filtered.length} / ${siswaCache.length} siswa`;

    const tbody = document.getElementById('siswa-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-slate-500">Tidak ada siswa yang cocok dengan filter.</td></tr>`;
        return;
    }

    filtered.forEach(item => {
        let tr = document.createElement('tr'); tr.className = "hover:bg-slate-900/40 border-b border-slate-800/40 text-slate-300";
        tr.innerHTML = `<td class="p-4 font-mono text-indigo-400 font-bold">${item.nisn}</td><td class="p-4 font-bold text-white">${item.nama}</td><td class="p-4">${item.kelas}</td><td class="p-4 font-mono">${item.pin}</td><td class="p-4 font-mono text-[10px] text-slate-500 truncate max-w-[120px]">${item.token || '-'}</td>`;
        tbody.appendChild(tr);
    });
}

function resetFilterSiswa() {
    const txt = document.getElementById('siswa-filter-text'); if (txt) txt.value = '';
    const kl = document.getElementById('siswa-filter-kelas'); if (kl) kl.value = '';
    applyFilterSiswa();
}

function toggleFormSiswa() {
    const wrapper = document.getElementById('form-siswa-wrapper');
    const icon = document.getElementById('icon-toggle-form');
    const btn = document.getElementById('btn-toggle-form-siswa');
    const isHidden = wrapper.classList.contains('hidden');
    wrapper.classList.toggle('hidden');
    icon.className = isHidden ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down';
    btn.querySelector('span') && (btn.lastChild.textContent = isHidden ? ' Sembunyikan Form' : ' Tampilkan Form');
    // Update button text
    const texts = btn.childNodes;
    texts.forEach(n => { if (n.nodeType === 3) n.textContent = isHidden ? ' Sembunyikan Form' : ' Tampilkan Form'; });
}

function generatePin() {
    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    const el = document.getElementById('add-pin');
    if (el) { el.value = pin; el.classList.add('text-indigo-400'); setTimeout(() => el.classList.remove('text-indigo-400'), 1000); }
}

function resetFormSiswa() {
    document.getElementById('form-input-siswa').reset();
}

document.getElementById('form-input-siswa').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-submit-siswa');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Menyimpan...';

    const paramData = {
        action: 'addNewSiswa',
        nisn: document.getElementById('add-nisn').value.trim(),
        nama: document.getElementById('add-nama').value.trim(),
        kelas: document.getElementById('add-kelas-siswa').value.trim(),
        pin: document.getElementById('add-pin').value.trim(),
    };

    try {
        await fetch(API_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(paramData) });
        btn.innerHTML = '<i class="fa-solid fa-check mr-1"></i> Tersimpan!';
        btn.className = 'bg-emerald-600 text-white font-bold px-6 py-2 rounded-xl text-xs shadow-lg';
        resetFormSiswa();
        await refreshData();
        setTimeout(() => {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up mr-1"></i> Simpan ke Server';
            btn.className = 'bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-2 rounded-xl text-xs transition-all shadow-lg';
        }, 2000);
    } catch (err) {
        alert('Gagal menyimpan data siswa. Periksa koneksi.');
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up mr-1"></i> Simpan ke Server';
    }
});

// Cache soal untuk modal edit
let soalCache = [];

function renderSoalTable(list) {
    soalCache = list;

    // Populate dropdown mapel dari data unik
    const mapelSet = [...new Set(list.map(s => s.mapel).filter(Boolean))].sort();
    const mapelSelect = document.getElementById('soal-filter-mapel');
    if (mapelSelect) {
        const prev = mapelSelect.value;
        mapelSelect.innerHTML = '<option value="">Semua Mapel</option>';
        mapelSet.forEach(m => { const o = document.createElement('option'); o.value = m; o.textContent = m; mapelSelect.appendChild(o); });
        mapelSelect.value = prev; // pertahankan pilihan sebelumnya
    }

    applyFilterSoal();
}

function applyFilterSoal() {
    const text = (document.getElementById('soal-filter-text')?.value || '').toLowerCase().trim();
    const mapel = (document.getElementById('soal-filter-mapel')?.value || '').toLowerCase();
    const kunci = (document.getElementById('soal-filter-kunci')?.value || '').toLowerCase();

    const filtered = soalCache.filter(item => {
        const matchText = !text ||
            String(item.id_soal).toLowerCase().includes(text) ||
            String(item.mapel).toLowerCase().includes(text) ||
            String(item.pertanyaan).toLowerCase().includes(text);
        const matchMapel = !mapel || String(item.mapel).toLowerCase() === mapel;
        const matchKunci = !kunci || String(item.kunci).toLowerCase() === kunci;
        return matchText && matchMapel && matchKunci;
    });

    const badge = document.getElementById('soal-count-badge');
    if (badge) badge.textContent = `${filtered.length} / ${soalCache.length} soal`;

    const tbody = document.getElementById('soal-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-slate-500">Tidak ada soal yang cocok dengan filter.</td></tr>`;
        return;
    }

    filtered.forEach(item => {
        let tr = document.createElement('tr'); tr.className = "hover:bg-slate-900/40 border-b border-slate-800/40 text-slate-300";
        tr.innerHTML = `<td class="p-4 font-mono text-emerald-400 font-bold">${item.id_soal}</td><td class="p-4 font-semibold text-slate-400">${item.mapel}</td><td class="p-4 text-white truncate max-w-xs">${item.pertanyaan}</td><td class="p-4 text-center"><span class="bg-indigo-500/20 text-indigo-400 font-bold px-2 py-0.5 rounded uppercase">${item.kunci}</span></td><td class="p-4 text-right font-mono">${item.bobot}</td><td class="p-4 text-center"><button onclick="openEditModal('${item.id_soal}')" class="bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 font-bold px-3 py-1 rounded-lg text-[10px] transition-all"><i class="fa-solid fa-pen-to-square mr-1"></i>Edit</button></td>`;
        tbody.appendChild(tr);
    });
}

function resetFilterSoal() {
    const txt = document.getElementById('soal-filter-text'); if (txt) txt.value = '';
    const mp = document.getElementById('soal-filter-mapel'); if (mp) mp.value = '';
    const kn = document.getElementById('soal-filter-kunci'); if (kn) kn.value = '';
    applyFilterSoal();
}

function openEditModal(idSoal) {
    const soal = soalCache.find(s => String(s.id_soal) === String(idSoal));
    if (!soal) return;
    document.getElementById('edit-soal-id-label').innerText = `— ${idSoal}`;
    document.getElementById('edit-id-soal-original').value = soal.id_soal;
    document.getElementById('edit-id-soal').value = soal.id_soal;
    document.getElementById('edit-mapel').value = soal.mapel || '';
    document.getElementById('edit-pertanyaan').value = soal.pertanyaan || '';
    document.getElementById('edit-gambar-url').value = soal.gambar_url || '';
    document.getElementById('edit-opsi-a').value = soal.opsi_a || '';
    document.getElementById('edit-opsi-b').value = soal.opsi_b || '';
    document.getElementById('edit-opsi-c').value = soal.opsi_c || '';
    document.getElementById('edit-opsi-d').value = soal.opsi_d || '';
    document.getElementById('edit-opsi-e').value = soal.opsi_e || '';
    document.getElementById('edit-kunci').value = soal.kunci || 'a';
    document.getElementById('edit-bobot').value = soal.bobot || '';
    document.getElementById('edit-soal-notice').classList.add('hidden');
    document.getElementById('modal-edit-soal').classList.remove('hidden');
}

function closeEditModal() {
    document.getElementById('modal-edit-soal').classList.add('hidden');
}

async function submitEditSoal() {
    const btn = document.getElementById('btn-submit-edit-soal');
    btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Menyimpan...';
    const paramData = {
        action: 'editQuestion',
        id_soal_original: document.getElementById('edit-id-soal-original').value,
        id_soal: document.getElementById('edit-id-soal').value,
        mapel: document.getElementById('edit-mapel').value,
        pertanyaan: document.getElementById('edit-pertanyaan').value,
        opsi_a: document.getElementById('edit-opsi-a').value,
        opsi_b: document.getElementById('edit-opsi-b').value,
        opsi_c: document.getElementById('edit-opsi-c').value,
        opsi_d: document.getElementById('edit-opsi-d').value,
        opsi_e: document.getElementById('edit-opsi-e').value,
        kunci: document.getElementById('edit-kunci').value,
        bobot: document.getElementById('edit-bobot').value,
        gambar_url: document.getElementById('edit-gambar-url').value || ''
    };
    try {
        await fetch(API_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(paramData) });
        document.getElementById('edit-soal-notice').classList.remove('hidden');
        btn.innerHTML = '<i class="fa-solid fa-check mr-1"></i> Tersimpan!';
        btn.className = 'bg-emerald-600 text-white font-bold px-6 py-2.5 rounded-xl text-xs';
        refreshData();
        setTimeout(() => {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-floppy-disk mr-1"></i> Simpan Perubahan';
            btn.className = 'bg-amber-500 hover:bg-amber-600 text-white font-bold px-6 py-2.5 rounded-xl text-xs transition-all';
        }, 2000);
    } catch(err) {
        alert('Gagal menyimpan perubahan. Periksa koneksi.');
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-floppy-disk mr-1"></i> Simpan Perubahan';
    }
}

function renderJadwalTable(list) {
    const tbody = document.getElementById('jadwal-table-body'); if (!tbody) return; tbody.innerHTML = '';
    if(!list || list.length === 0) { tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-slate-600">Belum ada pengaturan gerbang.</td></tr>`; return; }
    list.forEach(item => {
        let isOff = item.sesi === "OFF";
        let isTutup = item.gerbang === "TUTUP";

        // Format waktu mulai
        let waktuMulaiStr = '-';
        if (item.waktu_mulai && item.waktu_mulai > 0) {
            const d = new Date(item.waktu_mulai * 1000);
            waktuMulaiStr = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        }

        // Hitung sisa waktu berjalan
        let sisaStr = '-';
        if (!isOff && item.waktu_mulai > 0 && item.durasi_menit > 0) {
            const durDetik = item.durasi_menit * 60;
            const elapsed = Math.floor(Date.now() / 1000) - item.waktu_mulai;
            const sisa = durDetik - elapsed;
            if (sisa > 0) {
                const m = Math.floor(sisa / 60), s = sisa % 60;
                sisaStr = `<span class="text-amber-400 font-mono font-bold">${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}</span> <span class="text-slate-500">sisa</span>`;
            } else {
                sisaStr = `<span class="text-rose-400 font-bold text-[10px]">HABIS</span>`;
            }
        }

        let tr = document.createElement('tr'); tr.className = isOff ? "opacity-40 bg-slate-900/10 text-slate-500" : "bg-slate-900/40 text-slate-300 font-medium";
        let statusBtn = isOff ? `<span class="text-slate-600 text-[11px] font-bold">—</span>` :
            isTutup
            ? `<button onclick="toggleGerbang('${item.kelas}','BUKA')" class="bg-red-500/15 hover:bg-red-500/30 border border-red-500/40 text-red-400 font-bold px-3 py-1 rounded-lg text-[10px] transition-all"><i class="fa-solid fa-lock mr-1"></i>TUTUP</button>`
            : `<button onclick="toggleGerbang('${item.kelas}','TUTUP')" class="bg-emerald-500/15 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-400 font-bold px-3 py-1 rounded-lg text-[10px] transition-all"><i class="fa-solid fa-lock-open mr-1"></i>BUKA</button>`;
        const durasiStr  = (item.durasi_menit && item.durasi_menit > 0) ? (item.durasi_menit + ' mnt') : '— belum diset';
        const waktuKolom = (item.waktu_mulai && item.waktu_mulai > 0) ? (waktuMulaiStr + (!isOff ? '<br>' + sisaStr : '')) : '—';
        tr.innerHTML = `<td class="p-3 font-bold text-white">${item.kelas}</td><td class="p-3 font-mono text-amber-400">${item.sesi}</td><td class="p-3 font-mono text-indigo-400">${item.paket}</td><td class="p-3 text-center text-slate-300">${durasiStr}</td><td class="p-3 text-center text-slate-400 font-mono text-[11px]">${waktuKolom}</td><td class="p-3 text-right">${statusBtn}</td>`;
        tbody.appendChild(tr);
    });
}

async function toggleGerbang(kelas, statusBaru) {
    try {
        const body = new URLSearchParams({ action: 'toggleGerbang', kelas: kelas, status: statusBaru });
        await fetch(API_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
        await refreshData();
    } catch(err) { alert('Gagal mengubah status gerbang.'); }
}

// --- FORM HANDLERS (POST METHOD) ---
document.getElementById('form-input-soal').addEventListener('submit', async (e) => {
    e.preventDefault(); const btn = document.getElementById('btn-submit-soal'); btn.disabled = true;
    const paramData = {
        action: 'addNewQuestion', id_soal: document.getElementById('add-id-soal').value, mapel: document.getElementById('add-mapel').value,
        pertanyaan: document.getElementById('add-pertanyaan').value, opsi_a: document.getElementById('add-opsi-a').value, opsi_b: document.getElementById('add-opsi-b').value,
        opsi_c: document.getElementById('add-opsi-c').value, opsi_d: document.getElementById('add-opsi-d').value, opsi_e: document.getElementById('add-opsi-e').value,
        kunci: document.getElementById('add-kunci').value, bobot: document.getElementById('add-bobot').value,
        target_kelas: document.getElementById('add-target-kelas').value, sesi_soal: document.getElementById('add-sesi-soal').value, paket_soal: document.getElementById('add-paket-soal').value,
        gambar_url: document.getElementById('add-gambar-url').value || ""
    };
    try {
        await fetch(API_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(paramData) });
        alert("Sukses menyuntikkan soal!"); document.getElementById('form-input-soal').reset(); refreshData();
    } catch(err) { alert("Gagal mengirim."); } finally { btn.disabled = false; btn.innerHTML = 'Simpan ke Server'; }
});

document.getElementById('form-kontrol-jadwal').addEventListener('submit', async (e) => {
    e.preventDefault(); const btn = document.getElementById('btn-submit-jadwal'); btn.disabled = true;
    const sesi = document.getElementById('set-sesi').value;
    const durasi = parseInt(document.getElementById('set-durasi').value) || 60;
    // Catat waktu mulai ujian dalam Unix timestamp (detik) saat admin tekan Terapkan
    // Hanya dicatat jika sesi BUKAN OFF
    const waktuMulai = sesi !== 'OFF' ? Math.floor(Date.now() / 1000) : 0;
    const paramData = {
        action: 'updateJadwalKontrol',
        kelas: document.getElementById('set-kelas').value,
        sesi: sesi,
        paket: document.getElementById('set-paket').value,
        durasi_menit: durasi,
        waktu_mulai: waktuMulai
    };
    try {
        await fetch(API_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(paramData) });
        alert("Jadwal kelas berhasil diubah!"); refreshData();
    } catch(err) { alert("Gagal ubah jadwal."); } finally { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-toggle-on"></i> Terapkan Perubahan'; }
});

// ============================================================
// AKSES UJIAN PER SISWA
// ============================================================

// Cache data siswa untuk fitur akses (diisi ulang setiap refreshData)
let allSiswaForAkses = [];

function renderAksesTable(list) {
    // Preserve which NISNs were checked before re-render
    const prevChecked = new Set(
        [...document.querySelectorAll('.akses-row-check:checked')].map(cb => cb.getAttribute('data-nisn'))
    );
    allSiswaForAkses = list.map(s => ({
        nisn: s.nisn,
        nama: s.nama,
        kelas: s.kelas,
        // Default: akses BUKA kecuali field aksesUjian di data = "TUTUP"
        akses: (s.aksesUjian === 'TUTUP') ? 'tutup' : 'buka'
    }));

    // Isi dropdown filter kelas
    const kelasSet = [...new Set(allSiswaForAkses.map(s => s.kelas).filter(Boolean))].sort();
    const filterKelas = document.getElementById('filter-akses-kelas');
    if (filterKelas) {
        const currentVal = filterKelas.value;
        filterKelas.innerHTML = '<option value="">Semua Kelas</option>';
        kelasSet.forEach(k => {
            const opt = document.createElement('option');
            opt.value = k; opt.textContent = k;
            if (k === currentVal) opt.selected = true;
            filterKelas.appendChild(opt);
        });
    }

    filterAksesTable(prevChecked);
}

function filterAksesTable(restoreChecked) {
    const q = (document.getElementById('filter-akses-nama')?.value || '').toLowerCase();
    const kelasFilter = document.getElementById('filter-akses-kelas')?.value || '';
    const statusFilter = document.getElementById('filter-akses-status')?.value || '';

    const filtered = allSiswaForAkses.filter(s => {
        const matchQ = !q || s.nama.toLowerCase().includes(q) || s.nisn.toLowerCase().includes(q);
        const matchKelas = !kelasFilter || s.kelas === kelasFilter;
        const matchStatus = !statusFilter || s.akses === statusFilter;
        return matchQ && matchKelas && matchStatus;
    });

    const tbody = document.getElementById('akses-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-slate-500">Tidak ada siswa yang cocok.</td></tr>`;
    } else {
        filtered.forEach(s => {
            const isBuka = s.akses === 'buka';
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-slate-900/40 border-b border-slate-800/40 transition-colors ' + (isBuka ? '' : 'opacity-60');
            tr.id = `akses-row-${s.nisn}`;
            tr.innerHTML = `
                <td class="p-4 w-10">
                    <input type="checkbox" class="akses-row-check w-3.5 h-3.5 rounded accent-indigo-500 cursor-pointer" data-nisn="${s.nisn}" onchange="onRowCheckChange()">
                </td>
                <td class="p-4 font-mono text-indigo-400 font-bold">${s.nisn}</td>
                <td class="p-4 font-bold text-white">${s.nama}</td>
                <td class="p-4 text-slate-400">${s.kelas}</td>
                <td class="p-4 text-center">
                    ${isBuka
                        ? `<span class="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full font-bold text-[10px] uppercase tracking-wider"><i class="fa-solid fa-lock-open mr-1 text-[9px]"></i>Terbuka</span>`
                        : `<span class="bg-rose-500/10 text-rose-400 border border-rose-500/30 px-3 py-1 rounded-full font-bold text-[10px] uppercase tracking-wider"><i class="fa-solid fa-lock mr-1 text-[9px]"></i>Ditutup</span>`
                    }
                </td>
                <td class="p-4 text-center">
                    <button 
                        data-nisn="${s.nisn}"
                        data-target="${isBuka ? 'tutup' : 'buka'}"
                        class="btn-toggle-akses font-bold px-4 py-1.5 rounded-xl text-[10px] transition-all ${isBuka
                            ? 'bg-rose-600 hover:bg-rose-700 text-white'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white'}">
                        ${isBuka ? '<i class="fa-solid fa-lock mr-1"></i>Tutup Akses' : '<i class="fa-solid fa-lock-open mr-1"></i>Buka Akses'}
                    </button>
                </td>
            `;
            // Restore checked state if NISN was checked before re-render
            if (restoreChecked && restoreChecked.has(String(s.nisn))) {
                const cb = tr.querySelector('.akses-row-check');
                if (cb) cb.checked = true;
            }
            tbody.appendChild(tr);
        });
    }

    // Sync checkAll state after re-render (may have restored checks)
    const allCbs = document.querySelectorAll('.akses-row-check');
    const checkedCbs = document.querySelectorAll('.akses-row-check:checked');
    const checkAll = document.getElementById('akses-check-all');
    if (checkAll) {
        checkAll.checked = allCbs.length > 0 && checkedCbs.length === allCbs.length;
        checkAll.indeterminate = checkedCbs.length > 0 && checkedCbs.length < allCbs.length;
    }
    updateBulkToolbar();

    // Update stats
    const total = allSiswaForAkses.length;
    const buka = allSiswaForAkses.filter(s => s.akses === 'buka').length;
    const tutup = total - buka;
    if (document.getElementById('akses-stat-total')) document.getElementById('akses-stat-total').innerText = total;
    if (document.getElementById('akses-stat-buka')) document.getElementById('akses-stat-buka').innerText = buka;
    if (document.getElementById('akses-stat-tutup')) document.getElementById('akses-stat-tutup').innerText = tutup;
}

async function toggleAksesSiswa(nisn, newAkses) {
    const siswa = allSiswaForAkses.find(s => String(s.nisn) === String(nisn));
    if (!siswa) { console.error('NISN tidak ditemukan di cache:', nisn); return; }

    const oldAkses = siswa.akses;
    siswa.akses = newAkses;
    filterAksesTable();

    try {
        const body = new URLSearchParams();
        body.append('action', 'setAksesUjian');
        body.append('nisn', String(nisn));
        body.append('akses', newAkses.toUpperCase());

        await fetch(API_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString()
        });
        // no-cors tidak bisa baca response — anggap sukses jika tidak throw
    } catch (err) {
        console.error('Gagal mengubah akses:', err);
        siswa.akses = oldAkses;
        filterAksesTable();
        alert('Gagal mengubah akses. Periksa koneksi.');
    }
}

// Event delegation — satu listener untuk semua tombol toggle di tabel
document.addEventListener('click', function(e) {
    const btn = e.target.closest('.btn-toggle-akses');
    if (!btn) return;
    const nisn = btn.getAttribute('data-nisn');
    const target = btn.getAttribute('data-target');
    if (nisn && target) toggleAksesSiswa(nisn, target);
});

async function aksesAction(type) {
    const label = type === 'bukaAll' ? 'membuka akses semua siswa' : 'menutup akses semua siswa';
    if (!confirm(`Apakah Anda yakin ingin ${label}?`)) return;

    const newAkses = type === 'bukaAll' ? 'buka' : 'tutup';
    allSiswaForAkses.forEach(s => s.akses = newAkses);
    filterAksesTable();

    try {
        await fetch(API_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ action: 'setAksesUjianAll', akses: newAkses.toUpperCase() })
        });
    } catch (err) {
        console.error('Gagal:', err);
        alert('Gagal mengubah akses semua siswa. Periksa koneksi.');
        refreshData();
    }
}


// ============================================================
// CHECKBOX SELECTION — Akses Ujian
// ============================================================

function getCheckedNisns() {
    return [...document.querySelectorAll('.akses-row-check:checked')].map(cb => cb.getAttribute('data-nisn'));
}

function onRowCheckChange() {
    const all   = document.querySelectorAll('.akses-row-check');
    const checked = document.querySelectorAll('.akses-row-check:checked');
    const checkAll = document.getElementById('akses-check-all');
    if (checkAll) {
        checkAll.indeterminate = checked.length > 0 && checked.length < all.length;
        checkAll.checked = all.length > 0 && checked.length === all.length;
    }
    updateBulkToolbar();
}

function toggleCheckAll(masterCb) {
    document.querySelectorAll('.akses-row-check').forEach(cb => { cb.checked = masterCb.checked; });
    updateBulkToolbar();
}

function clearAllChecked() {
    document.querySelectorAll('.akses-row-check').forEach(cb => { cb.checked = false; });
    const checkAll = document.getElementById('akses-check-all');
    if (checkAll) { checkAll.checked = false; checkAll.indeterminate = false; }
    updateBulkToolbar();
}

function updateBulkToolbar() {
    const checkedNisns = getCheckedNisns();
    const toolbar = document.getElementById('akses-bulk-toolbar');
    const counter = document.getElementById('akses-selected-count');
    if (!toolbar) return;
    if (checkedNisns.length > 0) {
        toolbar.classList.remove('hidden');
        toolbar.classList.add('flex');
        if (counter) counter.innerHTML = `<i class="fa-solid fa-check-square"></i> ${checkedNisns.length} siswa dipilih`;
    } else {
        toolbar.classList.add('hidden');
        toolbar.classList.remove('flex');
    }
}

async function aksesActionSelected(newAkses) {
    const nisns = getCheckedNisns();
    if (nisns.length === 0) return;
    const label = newAkses === 'buka' ? 'membuka' : 'menutup';
    if (!confirm(`Apakah Anda yakin ingin ${label} akses untuk ${nisns.length} siswa terpilih?`)) return;

    // Optimistic UI update
    nisns.forEach(nisn => {
        const siswa = allSiswaForAkses.find(s => String(s.nisn) === String(nisn));
        if (siswa) siswa.akses = newAkses;
    });
    filterAksesTable();
    clearAllChecked();

    // Send requests sequentially (no-cors)
    for (const nisn of nisns) {
        try {
            const body = new URLSearchParams();
            body.append('action', 'setAksesUjian');
            body.append('nisn', String(nisn));
            body.append('akses', newAkses.toUpperCase());
            await fetch(API_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: body.toString()
            });
        } catch (err) {
            console.error('Gagal mengubah akses untuk NISN:', nisn, err);
        }
    }
}

function exportNilai() { window.open(`${API_URL}?action=exportExcel`, '_blank'); }

// ============================================================
// REKAP NILAI — Export Excel per Mapel & per Kelas (SheetJS)
// ============================================================
async function exportRekapNilai() {
    const btn = document.getElementById('btn-rekap-nilai');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner animate-spin mr-1"></i>Memproses...'; }

    try {
        const res  = await fetch(`${API_URL}?action=getRekapNilai`);
        const data = await res.json();
        if (data.status !== 'success') throw new Error(data.message || 'Gagal mengambil data');
        buildRekapExcel(data);
    } catch(err) {
        alert('Gagal ekspor rekap: ' + err.message);
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-table mr-1"></i>Rekap Nilai'; }
    }
}

function buildRekapExcel(data) {
    // data = { siswa: [...], soal: [...], jawaban: [...] }
    const { siswa, soal, jawaban } = data;

    // Build soal lookup: id_soal -> { mapel, kunci, bobot }
    const soalMap = {};
    soal.forEach(s => { soalMap[String(s.id_soal).trim()] = { mapel: s.mapel || '', kunci: String(s.kunci).trim().toLowerCase(), bobot: Number(s.bobot) || 1 }; });

    // Build jawaban lookup: nisn -> { id_soal -> jawaban_siswa }
    const jawMap = {};
    jawaban.forEach(j => {
        const n = String(j.nisn).trim();
        const id = String(j.id_soal).trim();
        if (!jawMap[n]) jawMap[n] = {};
        jawMap[n][id] = String(j.jawaban).trim().toLowerCase();
    });

    // Collect all unique mapel (sorted)
    const mapelList = [...new Set(soal.map(s => s.mapel || '').filter(Boolean))].sort();
    // Collect all soal per mapel
    const soalPerMapel = {};
    mapelList.forEach(m => { soalPerMapel[m] = soal.filter(s => s.mapel === m); });

    // Siswa sorted A->Z by nama
    const sortedSiswa = [...siswa].sort((a, b) => String(a.nama).localeCompare(String(b.nama), 'id'));

    // Group siswa per kelas
    const kelasList = [...new Set(sortedSiswa.map(s => s.kelas || '').filter(Boolean))].sort();

    const XLSX = window.XLSX;
    const wb = XLSX.utils.book_new();

    // Styles via write options (xlsx community doesn't support full styles without pro,
    // so we'll use the aoa approach with careful structure)

    // Helper: compute stats for one siswa one mapel
    function hitungMapel(nisnStr, mapelSoalList) {
        const jawSiswa = jawMap[nisnStr] || {};
        let totalSoal = mapelSoalList.length;
        let benar = 0, salah = 0, tidakJawab = 0, nilaiTotal = 0;
        mapelSoalList.forEach(s => {
            const id = String(s.id_soal).trim();
            const jSiswa = jawSiswa[id];
            if (!jSiswa || jSiswa === '') {
                tidakJawab++;
            } else if (jSiswa === String(s.kunci).trim().toLowerCase()) {
                benar++;
                nilaiTotal += Number(s.bobot) || 1;
            } else {
                salah++;
            }
        });
        return { totalSoal, benar, salah, tidakJawab, nilai: nilaiTotal };
    }

    // ---- Sheet 1: REKAP SEMUA (semua siswa, semua mapel) ----
    {
        const aoa = [];
        // Title
        aoa.push(['REKAP NILAI UJIAN - SEMUA KELAS']);
        aoa.push([]);

        // Header row 1
        const h1 = ['No', 'Nama', 'Kelas', 'Total', '', '', ''];
        mapelList.forEach(m => { h1.push(m, '', '', '', ''); });
        h1.push('Nilai Akhir', 'Keterangan');
        aoa.push(h1);

        // Header row 2
        const h2 = ['', '', '', 'Nilai', 'Jawab', 'Tidak Jawab', 'Total'];
        mapelList.forEach(() => { h2.push('Jawaban Benar', 'Jawaban Salah', 'Tidak Jawab', 'Nilai', 'Total Soal'); });
        h2.push('', '');
        aoa.push(h2);

        let no = 1;
        sortedSiswa.forEach(s => {
            const nisnStr = String(s.nisn).trim();
            let totalBenar = 0, totalJawab = 0, totalTidakJawab = 0, totalNilai = 0;
            const row = [no++, s.nama || '', s.kelas || ''];
            // placeholder for totals (fill later)
            const totalPlaceholders = [null, null, null, null];
            const mapelCols = [];
            mapelList.forEach(m => {
                const st = hitungMapel(nisnStr, soalPerMapel[m]);
                totalBenar      += st.benar;
                totalJawab      += (st.benar + st.salah);
                totalTidakJawab += st.tidakJawab;
                totalNilai      += st.nilai;
                mapelCols.push(st.benar, st.salah, st.tidakJawab, st.nilai, st.totalSoal);
            });
            // Fill totals
            row.push(totalNilai, totalJawab, totalTidakJawab, soal.length);
            mapelCols.forEach(v => row.push(v));
            // Nilai akhir & keterangan
            const nilaiAkhir = s.nilai !== null && s.nilai !== undefined ? s.nilai : totalNilai;
            const ket = nilaiAkhir >= 75 ? 'LULUS' : 'TIDAK LULUS';
            row.push(nilaiAkhir, ket);
            aoa.push(row);
        });

        const ws = XLSX.utils.aoa_to_sheet(aoa);
        // Merge title
        ws['!merges'] = [{ s: {r:0,c:0}, e: {r:0,c:6 + mapelList.length*5 + 1} }];
        // Column widths
        const cols = [{wch:5},{wch:28},{wch:18},{wch:10},{wch:10},{wch:14},{wch:10}];
        mapelList.forEach(() => [14,14,12,10,10].forEach(w => cols.push({wch:w})));
        cols.push({wch:12},{wch:14});
        ws['!cols'] = cols;
        XLSX.utils.book_append_sheet(wb, ws, 'Rekap Semua');
    }

    // ---- Sheet per Kelas ----
    kelasList.forEach(kelas => {
        const siswaKelas = sortedSiswa.filter(s => s.kelas === kelas);
        const aoa = [];
        aoa.push([`REKAP NILAI UJIAN - KELAS ${kelas}`]);
        aoa.push([]);
        const h1 = ['No', 'Nama', 'Total', '', '', ''];
        mapelList.forEach(m => { h1.push(m, '', '', '', ''); });
        h1.push('Nilai Akhir', 'Keterangan');
        aoa.push(h1);
        const h2 = ['', '', 'Nilai', 'Jawab', 'Tidak Jawab', 'Total'];
        mapelList.forEach(() => { h2.push('Benar', 'Salah', 'Tidak Jawab', 'Nilai', 'Total Soal'); });
        h2.push('', '');
        aoa.push(h2);

        let no = 1;
        siswaKelas.forEach(s => {
            const nisnStr = String(s.nisn).trim();
            let totalBenar=0, totalJawab=0, totalTidakJawab=0, totalNilai=0;
            const mapelCols = [];
            mapelList.forEach(m => {
                const st = hitungMapel(nisnStr, soalPerMapel[m]);
                totalBenar += st.benar; totalJawab += (st.benar+st.salah); totalTidakJawab += st.tidakJawab; totalNilai += st.nilai;
                mapelCols.push(st.benar, st.salah, st.tidakJawab, st.nilai, st.totalSoal);
            });
            const row = [no++, s.nama||'', totalNilai, totalJawab, totalTidakJawab, soal.length];
            mapelCols.forEach(v => row.push(v));
            const nilaiAkhir = s.nilai !== null && s.nilai !== undefined ? s.nilai : totalNilai;
            row.push(nilaiAkhir, nilaiAkhir >= 75 ? 'LULUS' : 'TIDAK LULUS');
            aoa.push(row);
        });

        const ws = XLSX.utils.aoa_to_sheet(aoa);
        ws['!merges'] = [{ s:{r:0,c:0}, e:{r:0,c:5+mapelList.length*5+1} }];
        const cols = [{wch:5},{wch:28},{wch:10},{wch:10},{wch:14},{wch:10}];
        mapelList.forEach(() => [12,12,12,10,10].forEach(w => cols.push({wch:w})));
        cols.push({wch:12},{wch:14});
        ws['!cols'] = cols;
        const safeName = kelas.replace(/[\/\?*[\]]/g,'_').substring(0,28);
        XLSX.utils.book_append_sheet(wb, ws, safeName);
    });

    // ---- Sheet per Mapel ----
    mapelList.forEach(m => {
        const soalMapel = soalPerMapel[m];
        const aoa = [];
        aoa.push([`REKAP NILAI - ${m}`]);
        aoa.push([]);
        aoa.push(['No','Nama','Kelas','Jawaban Benar','Jawaban Salah','Tidak Jawab','Total Soal','Nilai','Keterangan']);

        let no = 1;
        sortedSiswa.forEach(s => {
            const st = hitungMapel(String(s.nisn).trim(), soalMapel);
            const ket = st.nilai >= 75 ? 'LULUS' : 'TIDAK LULUS';
            aoa.push([no++, s.nama||'', s.kelas||'', st.benar, st.salah, st.tidakJawab, st.totalSoal, st.nilai, ket]);
        });

        const ws = XLSX.utils.aoa_to_sheet(aoa);
        ws['!merges'] = [{ s:{r:0,c:0}, e:{r:0,c:8} }];
        ws['!cols'] = [{wch:5},{wch:28},{wch:18},{wch:14},{wch:14},{wch:14},{wch:12},{wch:10},{wch:14}];
        const safeName = m.replace(/[\/\?*[\]]/g,'_').substring(0,28);
        XLSX.utils.book_append_sheet(wb, ws, safeName);
    });

    // Write and download
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob  = new Blob([wbout], { type: 'application/octet-stream' });
    const url   = URL.createObjectURL(blob);
    const a     = document.createElement('a');
    a.href = url;
    a.download = `Rekap_Nilai_${new Date().toISOString().slice(0,10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
window.onload = windowLoadHandler;
