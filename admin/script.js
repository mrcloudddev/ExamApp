const API_URL = "https://script.google.com/macros/s/AKfycbwBiHVR5WZEgcgHY-a7XqPYHMedZOhTB8ZpzTZQ_P77-8FtJbap92w4vuFrN-8wJTouvg/exec";

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
    if(!list || list.length === 0) { tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-slate-600">Belum ada pengaturan gerbang.</td></tr>`; return; }
    list.forEach(item => {
        let isOff = item.sesi === "OFF";
        let isTutup = item.gerbang === "TUTUP";
        let tr = document.createElement('tr'); tr.className = isOff ? "opacity-40 bg-slate-900/10 text-slate-500" : "bg-slate-900/40 text-slate-300 font-medium";
        let statusBtn = isOff ? `<span class="text-slate-600 text-[11px] font-bold">—</span>` :
            isTutup
            ? `<button onclick="toggleGerbang('${item.kelas}','BUKA')" class="bg-red-500/15 hover:bg-red-500/30 border border-red-500/40 text-red-400 font-bold px-3 py-1 rounded-lg text-[10px] transition-all"><i class="fa-solid fa-lock mr-1"></i>TUTUP</button>`
            : `<button onclick="toggleGerbang('${item.kelas}','TUTUP')" class="bg-emerald-500/15 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-400 font-bold px-3 py-1 rounded-lg text-[10px] transition-all"><i class="fa-solid fa-lock-open mr-1"></i>BUKA</button>`;
        tr.innerHTML = `<td class="p-3 font-bold text-white">${item.kelas}</td><td class="p-3 font-mono text-amber-400">${item.sesi}</td><td class="p-3 font-mono text-indigo-400">${item.paket}</td><td class="p-3 text-right">${statusBtn}</td>`;
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
    const paramData = { action: 'updateJadwalKontrol', kelas: document.getElementById('set-kelas').value, sesi: document.getElementById('set-sesi').value, paket: document.getElementById('set-paket').value };
    try {
        await fetch(API_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(paramData) });
        alert("Jadwal kelas berhasil diubah!"); refreshData();
    } catch(err) { alert("Gagal ubah jadwal."); } finally { btn.disabled = false; btn.innerHTML = 'Terapkan Perubahan'; }
});

// ============================================================
// AKSES UJIAN PER SISWA
// ============================================================

// Cache data siswa untuk fitur akses (diisi ulang setiap refreshData)
let allSiswaForAkses = [];

function renderAksesTable(list) {
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

    filterAksesTable();
}

function filterAksesTable() {
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
            tbody.appendChild(tr);
        });
    }

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

function exportNilai() { window.open(`${API_URL}?action=exportExcel`, '_blank'); }
window.onload = windowLoadHandler;
