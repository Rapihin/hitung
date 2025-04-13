// script.js - Solusi Terbaik (Eksternal + alpine:init)

// ===========================================
// 1. DEFINISI FUNGSI HELPER & LOGIKA GLOBAL
// ===========================================

function gradeToValue(grade) {
    const gradeMap = { 'A': 4.0, 'A-': 3.7, 'B+': 3.3, 'B': 3.0, 'B-': 2.7, 'C+': 2.3, 'C': 2.0, 'D': 1.0, 'E': 0.0 };
    return gradeMap[grade?.toUpperCase()] ?? 0.0;
}

function valueToGrade(value, scale = null) {
    let gradingScale = [ { grade: 'A', min: 85 }, { grade: 'A-', min: 80 }, { grade: 'B+', min: 75 }, { grade: 'B', min: 70 }, { grade: 'B-', min: 65 }, { grade: 'C+', min: 60 }, { grade: 'C', min: 55 }, { grade: 'D', min: 40 }, { grade: 'E', min: 0 } ];
    if (scale && Array.isArray(scale) && scale.length > 0) { gradingScale = scale.sort((a, b) => b.min - a.min); }
    if (isNaN(value) || value === null) return '-';
    const score = Math.round(value);
    for (const level of gradingScale) { if (score >= level.min) { return level.grade; } }
    return 'E';
}

function formatNumber(num, decimals = 2) {
     if (isNaN(num) || num === null || num === undefined) return '--';
     return parseFloat(num).toFixed(decimals);
}

function manageDarkMode() {
    const MQL = window.matchMedia('(prefers-color-scheme: dark)');
    const storedPreference = localStorage.getItem('darkMode');
    function applyDarkMode(isDark) {
        const htmlEl = document.documentElement;
        if (isDark) { htmlEl.classList.add('dark'); localStorage.setItem('darkMode', 'true'); }
        else { htmlEl.classList.remove('dark'); localStorage.setItem('darkMode', 'false'); }
        window.dispatchEvent(new CustomEvent('darkModeChanged', { detail: { isDark } }));
    }
    if (storedPreference !== null) { applyDarkMode(storedPreference === 'true'); } else { applyDarkMode(MQL.matches); }
    MQL.addEventListener('change', (e) => { if (localStorage.getItem('darkMode') === null) { applyDarkMode(e.matches); } });
     window.toggleDarkMode = () => { const isCurrentlyDark = document.documentElement.classList.contains('dark'); applyDarkMode(!isCurrentlyDark); }
}

// ===========================================
// 2. DEFINISI LOGIKA KOMPONEN ALPINE
// ===========================================

function appSetupLogic() {
    return {
        isDark: false, isMobileMenuOpen: false, showBackToTop: false,
        init() {
            manageDarkMode(); this.isDark = document.documentElement.classList.contains('dark');
            window.addEventListener('darkModeChanged', (event) => { this.isDark = event.detail.isDark; });
            window.addEventListener('scroll', () => { this.showBackToTop = window.scrollY > 200; });
            this.$nextTick(() => { if (typeof AOS !== 'undefined') { AOS.init({ duration: 800, once: true, offset: 50 }); } else { console.warn("AOS not loaded yet"); } });
        },
        toggleDarkMode() { window.toggleDarkMode(); }
    };
}

function finalGradeCalculatorLogic() {
    return {
        nilaiTugas: null, bobotTugas: 20, nilaiUTS: null, bobotUTS: 30, nilaiUAS: null, bobotUAS: 50,
        finalGrade: null, letterGrade: '-', neededUAS: null, loading: false,
        formatNumber: formatNumber, // Referensi helper

        isValidWeights() { const totalBobot = (Number(this.bobotTugas) || 0) + (Number(this.bobotUTS) || 0) + (Number(this.bobotUAS) || 0); return Math.abs(totalBobot - 100) < 0.01; },
        calculateFinalGrade() {
            if (!this.isValidWeights()) { alert('Total bobot harus 100%.'); return; }
            this.loading = true; this.finalGrade = null; this.letterGrade = '-'; this.neededUAS = null;
            setTimeout(() => {
                const tgs = parseFloat(this.nilaiTugas) || 0; const uts = parseFloat(this.nilaiUTS) || 0; const uas = parseFloat(this.nilaiUAS) || 0;
                const bt = parseFloat(this.bobotTugas) / 100 || 0; const bu = parseFloat(this.bobotUTS) / 100 || 0; const ba = parseFloat(this.bobotUAS) / 100 || 0;
                if (isNaN(tgs) || isNaN(uts) || isNaN(uas) || isNaN(bt) || isNaN(bu) || isNaN(ba)) { this.loading = false; return; }
                this.finalGrade = (tgs * bt) + (uts * bu) + (uas * ba); this.letterGrade = valueToGrade(this.finalGrade); this.loading = false;
            }, 500);
        },
         '@calculate-needed-uas.document'({ detail }) { this.calculateNeededUAS(detail.target); },
         calculateNeededUAS(target) {
             const targetGrade = parseFloat(target); if (isNaN(targetGrade) || targetGrade < 0 || targetGrade > 100) { alert('Target nilai akhir tidak valid (0-100).'); return; }
             const tgs = parseFloat(this.nilaiTugas) || 0; const uts = parseFloat(this.nilaiUTS) || 0; const bt = parseFloat(this.bobotTugas) / 100 || 0;
             const bu = parseFloat(this.bobotUTS) / 100 || 0; const ba = parseFloat(this.bobotUAS) / 100 || 0;
             if (ba <= 0) { alert('Bobot UAS harus > 0.'); this.neededUAS = null; return; }
             if (isNaN(tgs) || isNaN(uts) || isNaN(bt) || isNaN(bu)) { alert('Nilai/Bobot Tugas & UTS valid?'); this.neededUAS = null; return; }
             const currentScoreContribution = (tgs * bt) + (uts * bu); const neededContributionFromUAS = targetGrade - currentScoreContribution; this.neededUAS = neededContributionFromUAS / ba;
         }
    };
}

function gpaCalculatorLogic() {
    return {
        courses: [], semesterIP: null, previousIPK: null, previousSKS: null, cumulativeIPK: null, totalSKS: null,
        ipError: '', loading: false, ipkChartInstance: null, ipkHistory: [],
        formatNumber: formatNumber, gradeToValue: gradeToValue,

        init() {
             this.loadFromLocalStorage();
             if (typeof Chart !== 'undefined') { this.createChart(); this.updateChartData(); /* Update chart with loaded data */ }
             else { console.warn("Chart.js not loaded yet."); setTimeout(() => { if (typeof Chart !== 'undefined') { this.createChart(); this.updateChartData(); } }, 500); }
             this.recalculateOnLoad();
             this.$watch('courses', () => this.saveToLocalStorage(), { deep: true });
             this.$watch('previousIPK', () => { this.calculateIPK(); this.saveToLocalStorage(); });
             this.$watch('previousSKS', () => { this.calculateIPK(); this.saveToLocalStorage(); });
             this.$watch('ipkHistory', () => { this.updateChartData(); this.saveToLocalStorage(); }, { deep: true });
        },
        recalculateOnLoad() { if (this.courses.length > 0 && this.allCoursesValid()) { this.calculateIP(false); } if (this.semesterIP !== null && this.previousIPK !== null && this.previousSKS !== null) { this.calculateIPK(); } },
        addCourse() { this.courses.push({ name: '', sks: null, grade: '' }); },
        removeCourse(index) { this.courses.splice(index, 1); this.calculateIP(false); },
        allCoursesValid() { return this.courses.every(c => !isNaN(parseInt(c.sks)) && parseInt(c.sks) > 0 && c.grade !== ''); },
        calculateIP(addToHistory = true) {
            if (!this.allCoursesValid()) { this.ipError = 'Cek SKS (>0) & Nilai Huruf.'; this.semesterIP = null; return; }
            this.loading = true; this.ipError = ''; this.semesterIP = null;
            setTimeout(() => {
                let totalScore = 0; let totalSKS = 0; if (this.courses.length === 0) { this.loading = false; this.ipError = 'Tambah matkul.'; return; }
                for (const course of this.courses) { const sks = parseInt(course.sks, 10); const gradeValue = this.gradeToValue(course.grade); totalScore += gradeValue * sks; totalSKS += sks; }
                if (totalSKS > 0) {
                    this.semesterIP = totalScore / totalSKS; this.calculateIPK();
                    if (addToHistory && this.semesterIP !== null) { const newEntry = { semester: this.ipkHistory.length + 1, ip: this.semesterIP, ipk: this.cumulativeIPK }; this.ipkHistory.push(newEntry); /* Watcher will save and update chart */ }
                    else if (!addToHistory) { this.updateChartData(); /* Just update chart visually */ }
                } else { this.semesterIP = null; this.ipError = 'Total SKS 0.'; }
                this.loading = false;
            }, 500);
        },
        calculateIPK() {
            const prevIPK = parseFloat(this.previousIPK); const prevSKS = parseInt(this.previousSKS, 10); const currentIP = parseFloat(this.semesterIP); let currentSKS = 0;
            if (isNaN(prevIPK) || isNaN(prevSKS) || prevSKS < 0 || this.semesterIP === null || isNaN(currentIP)) { this.cumulativeIPK = null; this.totalSKS = isNaN(prevSKS) || prevSKS < 0 ? null : prevSKS; return; }
            for (const course of this.courses) { const sks = parseInt(course.sks, 10); if (!isNaN(sks) && sks > 0) { currentSKS += sks; } }
            if (currentSKS <= 0) { this.cumulativeIPK = prevIPK; this.totalSKS = prevSKS; return; }
            const totalScore = (prevIPK * prevSKS) + (currentIP * currentSKS); this.totalSKS = prevSKS + currentSKS; this.cumulativeIPK = this.totalSKS > 0 ? totalScore / this.totalSKS : null;
            // IPK Calculation doesn't directly add to history, calculateIP does.
            // But if IPK/SKS lama diubah, watcher akan save, dan kita perlu update chart jika ada history.
            this.updateChartData();
        },
        createChart() {
            const ctx = document.getElementById('ipkChart'); if (!ctx || !Chart) return;
             const isDark = document.documentElement.classList.contains('dark'); const textColor = isDark ? '#cbd5e1' : '#4b5563'; const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
             this.ipkChartInstance = new Chart(ctx, {
                 type: 'line', data: { labels: [], datasets: [ { label: 'IP Semester (IPS)', data: [], borderColor: 'rgb(20, 184, 166)', backgroundColor: 'rgba(20, 184, 166, 0.1)', tension: 0.1, fill: false, pointRadius: 4, pointHoverRadius: 6, }, { label: 'IP Kumulatif (IPK)', data: [], borderColor: 'rgb(139, 92, 246)', backgroundColor: 'rgba(139, 92, 246, 0.1)', tension: 0.1, fill: false, pointRadius: 4, pointHoverRadius: 6, }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: false, suggestedMin: 2.0, suggestedMax: 4.0, ticks: { color: textColor }, grid: { color: gridColor } }, x: { ticks: { color: textColor }, grid: { display: false } } }, plugins: { legend: { labels: { color: textColor } }, tooltip: { mode: 'index', intersect: false, callbacks: { label: (context) => { let label = context.dataset.label || ''; if (label) { label += ': '; } if (context.parsed.y !== null) { label += this.formatNumber(context.parsed.y, 2); } return label; } } } } }
             });
             window.addEventListener('darkModeChanged', (event) => { if (this.ipkChartInstance) { const isDark = event.detail.isDark; const textColor = isDark ? '#cbd5e1' : '#4b5563'; const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'; this.ipkChartInstance.options.scales.y.ticks.color = textColor; this.ipkChartInstance.options.scales.x.ticks.color = textColor; this.ipkChartInstance.options.scales.y.grid.color = gridColor; this.ipkChartInstance.options.plugins.legend.labels.color = textColor; this.ipkChartInstance.update(); } });
         },
        updateChartData() {
             if (!this.ipkChartInstance) { console.warn("Chart instance not ready for update"); return; }
             const history = this.ipkHistory || [];
             this.ipkChartInstance.data.labels = history.map(entry => `Sem ${entry.semester}`);
             this.ipkChartInstance.data.datasets[0].data = history.map(entry => entry.ip);
             this.ipkChartInstance.data.datasets[1].data = history.map(entry => entry.ipk);
             this.ipkChartInstance.update();
        },
        clearHistory() { if (confirm('Hapus riwayat grafik IP/IPK?')) { this.ipkHistory = []; /* Watcher akan save & update */ } },
        saveToLocalStorage() { const dataToSave = { courses: this.courses, previousIPK: this.previousIPK, previousSKS: this.previousSKS, ipkHistory: this.ipkHistory }; localStorage.setItem('gpaCalculatorData', JSON.stringify(dataToSave)); },
        loadFromLocalStorage() {
            const savedData = localStorage.getItem('gpaCalculatorData'); let parsedData = null;
            if (savedData) { try { parsedData = JSON.parse(savedData); } catch (e) { console.error("Gagal parse data GPA:", e); localStorage.removeItem('gpaCalculatorData');} }
            this.courses = Array.isArray(parsedData?.courses) ? parsedData.courses : [{ name: '', sks: null, grade: '' }]; // Default jika gagal parse atau tidak ada
            this.previousIPK = parsedData?.previousIPK ?? null;
            this.previousSKS = parsedData?.previousSKS ?? null;
            this.ipkHistory = Array.isArray(parsedData?.ipkHistory) ? parsedData.ipkHistory : [];
            if (this.courses.length === 0) { // Pastikan minimal ada 1 baris input course
                 this.courses = [{ name: '', sks: null, grade: '' }];
            }
         }
    };
}

function ppdbCalculatorLogic() {
    return {
        nilaiRapor: null, nilaiASPD: null, akreditasiSekolah: 95, nilaiGabungan: null,
        kontribusiRapor: null, kontribusiASPD: null, kontribusiAkreditasi: null, loading: false,
        formatNumber: formatNumber,

        calculateNilaiGabungan() {
            if (this.nilaiRapor === null || this.nilaiASPD === null || this.akreditasiSekolah === null) { return; }
            this.loading = true; this.nilaiGabungan = null; this.kontribusiRapor = null; this.kontribusiASPD = null; this.kontribusiAkreditasi = null;
            setTimeout(() => {
                const rapor = parseFloat(this.nilaiRapor); const aspd = parseFloat(this.nilaiASPD); const akreditasi = parseInt(this.akreditasiSekolah, 10);
                if (isNaN(rapor) || isNaN(aspd) || isNaN(akreditasi) || rapor < 0 || aspd < 0) { this.loading = false; alert('Nilai Rapor/ASPD/Akreditasi valid?'); return; }
                this.kontribusiRapor = rapor * 0.40; this.kontribusiASPD = aspd * 0.55; this.kontribusiAkreditasi = (akreditasi * 4) * 0.05;
                this.nilaiGabungan = this.kontribusiRapor + this.kontribusiASPD + this.kontribusiAkreditasi; this.loading = false;
            }, 500);
        }
    };
}

// ===========================================
// 3. DAFTARKAN KOMPONEN ALPINE SETELAH ALPINE SIAP
// ===========================================
document.addEventListener('alpine:init', () => {
    console.log("Alpine.js Initialized - Registering components..."); // Pesan debug
    Alpine.data('appSetup', appSetupLogic);
    Alpine.data('finalGradeCalculator', finalGradeCalculatorLogic);
    Alpine.data('gpaCalculator', gpaCalculatorLogic);
    Alpine.data('ppdbCalculator', ppdbCalculatorLogic);
    console.log("Components registered."); // Pesan debug
});

console.log("script.js loaded"); // Pesan debug untuk memastikan file JS dimuat