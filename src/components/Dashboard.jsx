import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Tesseract from 'tesseract.js'; 
import { auth, db } from '../services/firebase';
import { parseSuperiorTranscript, calculateGrade } from '../services/pdfParser';

// --- Theme Config ---
const themes = {
    indigo: {
        id: 'indigo',
        name: 'Ocean Indigo',
        primary: 'bg-indigo-600',
        text: 'text-indigo-600',
        border: 'border-indigo-100',
        header: 'from-[#0F172A] via-[#1E1B4B] to-[#312E81]',
        accent: 'bg-indigo-50',
        bg: 'bg-[#F1F5F9]'
    },
    dark: { // Midnight Emerald (Image 2 Style)
        id: 'dark',
        name: 'Midnight Emerald',
        primary: 'bg-emerald-500',
        text: 'text-emerald-400',
        border: 'border-slate-800',
        header: 'from-[#020617] via-[#020617] to-[#0F172A]',
        accent: 'bg-slate-900',
        bg: 'bg-[#020617]'
    },
    sunset: {
        id: 'sunset',
        name: 'Rose Sunset',
        primary: 'bg-rose-500',
        text: 'text-rose-500',
        border: 'border-rose-100',
        header: 'from-[#4c0519] via-[#881337] to-[#fb7185]',
        accent: 'bg-rose-50',
        bg: 'bg-[#fff1f2]'
    }
};

const Dashboard = ({ user, semesters, onUpdate }) => {
    const [collapsed, setCollapsed] = useState({ sems: [], subs: [] });
    const [showSettings, setShowSettings] = useState(false);
    const [showInstructions, setShowInstructions] = useState(false);
    const [showGradeTable, setShowGradeTable] = useState(false);
    const [showAnalytics, setShowAnalytics] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isParsing, setIsParsing] = useState(false);
    
    const [activeTheme, setActiveTheme] = useState(localStorage.getItem('userTheme') || 'indigo');
    const theme = themes[activeTheme];

    // --- Firebase Sync ---
    useEffect(() => {
        const fetchUserData = async () => {
            if (user?.uid) {
                try {
                    const doc = await db.collection('users').doc(user.uid).get();
                    if (doc.exists) {
                        const data = doc.data();
                        if (data.semesters) onUpdate(data.semesters);
                        if (data.activeTheme) setActiveTheme(data.activeTheme);
                    }
                } catch (err) { console.error("Cloud Load Error:", err); }
            }
        };
        if (!localStorage.getItem('hasSeenGuideV6')) setTimeout(() => setShowInstructions(true), 500);
        fetchUserData();
    }, [user?.uid]);

    useEffect(() => {
        const saveToCloud = async () => {
            if (user?.uid && semesters.length > 0) {
                setIsSyncing(true);
                try {
                    await db.collection('users').doc(user.uid).set({ 
                        semesters, activeTheme, lastUpdated: new Date().toISOString() 
                    }, { merge: true });
                    setTimeout(() => setIsSyncing(false), 1500);
                } catch (err) { setIsSyncing(false); }
            }
        };
        const timer = setTimeout(() => saveToCloud(), 3000);
        return () => clearTimeout(timer);
    }, [semesters, activeTheme, user?.uid]);

    const [assessmentTypes, setAssessmentTypes] = useState(['Quiz', 'Assignment', 'Mid Exam', 'Final Exam', 'Project', 'Viva', 'Others']);
    const [newType, setNewType] = useState("");

    // --- OCR Logic (Specifically for table image) ---
    const handleImageScan = async (e, sIdx, subIdx) => {
        const file = e.target.files[0];
        if (!file) return;
        setIsParsing(true);
        try {
            const { data: { text } } = await Tesseract.recognize(file, 'eng');
            const lines = text.split('\n');
            const newAssessments = [];
            // Regex to find: Assessment Name | Weight | Max | Obtained
            const rowRegex = /(.+?)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)$/;

            lines.forEach(line => {
                const cleanLine = line.replace(/[|_]/g, ' ').replace(/\s+/g, ' ').trim();
                const match = cleanLine.match(rowRegex);
                if (match) {
                    const name = match[1].trim();
                    const weight = parseFloat(match[2].replace(',', '.'));
                    const max = parseFloat(match[3].replace(',', '.'));
                    const obt = parseFloat(match[4].replace(',', '.'));
                    if (!/Assessment|Weightage|Max|Obt/i.test(name) && !isNaN(weight)) {
                        newAssessments.push({ id: Date.now() + Math.random(), type: name, weight, total: max, obt });
                    }
                }
            });
            if (newAssessments.length > 0) {
                const n = [...semesters];
                n[sIdx].subjects[subIdx].mode = 'assessment';
                n[sIdx].subjects[subIdx].assessments = [...(n[sIdx].subjects[subIdx].assessments || []), ...newAssessments];
                onUpdate(n);
            } else { alert("Could not detect table rows. Ensure image is clear."); }
        } finally { setIsParsing(false); e.target.value = null; }
    };

    const handlePdfImport = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setIsParsing(true);
        try {
            const data = await parseSuperiorTranscript(file);
            onUpdate([...semesters, ...data]);
        } catch (err) { alert("PDF Error."); }
        finally { setIsParsing(false); e.target.value = null; }
    };

    const getSubjectStats = (sub) => {
        let score = 0, weight = 0;
        if (sub?.mode === 'assessment' && sub?.assessments?.length > 0) {
            sub.assessments.forEach(a => {
                const w = parseFloat(a.weight) || 0;
                weight += w;
                score += ((parseFloat(a.obt) || 0) / (parseFloat(a.total) || 1)) * w;
            });
        } else { score = parseFloat(sub?.simpleObt) || 0; weight = 100; }
        const gInfo = calculateGrade(score) || { g: 'F', p: 0.0 };
        // Strictly following 85% = 4.00 rule
        let neededForA = (weight < 100 && score < 85) ? ((85 - score) / (100 - weight)) * 100 : null;
        return { score, weight, gInfo, neededForA };
    };

    const calculateSGPA = (subjects) => {
        let qp = 0, ch = 0;
        (subjects || []).forEach(sub => {
            const stats = getSubjectStats(sub);
            qp += (stats.gInfo.p * (parseFloat(sub.ch) || 0));
            ch += (parseFloat(sub.ch) || 0);
        });
        return (ch > 0 ? (qp / ch) : 0).toFixed(2);
    };

    const totalCH = semesters.reduce((acc, s) => acc + s.subjects.reduce((a, b) => a + (parseFloat(b.ch) || 0), 0), 0);
    const cgpa = (semesters.reduce((acc, s) => acc + s.subjects.reduce((a, sub) => a + (getSubjectStats(sub).gInfo.p * (parseFloat(sub.ch) || 0)), 0), 0) / (totalCH || 1)).toFixed(2);

    return (
        <div className={`min-h-screen ${theme.bg} pb-10 transition-all duration-700 overflow-x-hidden relative ${activeTheme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            <AnimatePresence>
                {isParsing && <LoadingOverlay message="AI Processing Data..." theme={theme} />}
                {showInstructions && <OnboardingModal theme={theme} onClose={() => { localStorage.setItem('hasSeenGuideV6', 'true'); setShowInstructions(false); }} />}
                {showGradeTable && <GradeScaleModal theme={theme} onClose={() => setShowGradeTable(false)} />}
            </AnimatePresence>

            {/* --- PREMIUM HEADER --- */}
            <header className={`bg-linear-to-br ${theme.header} pt-12 pb-28 md:pb-36 px-4 md:px-12 rounded-b-[4rem] shadow-2xl relative border-b border-white/5`}>
                {isSyncing && <SyncIndicator theme={theme} />}
                <div className="absolute top-8 right-6 md:right-12 flex gap-4 z-50">
                    <HeaderBtn icon="📊" onClick={() => setShowGradeTable(true)} />
                    <HeaderBtn icon="⚙️" onClick={() => setShowSettings(!showSettings)} />
                </div>
                
                <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-12">
                    <div className="flex flex-col md:flex-row items-center gap-6 text-center md:text-left group">
                        <motion.img whileHover={{ scale: 1.05 }} src={user?.photoURL || `https://ui-avatars.com/api/?name=${user?.displayName}`} className="w-24 h-24 md:w-36 md:h-36 rounded-[2.5rem] border-4 border-white/10 shadow-2xl" alt="P" />
                        <div>
                            <h2 className="text-3xl md:text-7xl font-black uppercase italic tracking-tighter text-white drop-shadow-lg">{user?.displayName || 'Abdullah Islam'}</h2>
                            {/* Gmail lowercase fix applied below */}
                            <p className="text-white/40 text-[10px] md:text-sm font-bold tracking-[0.4em] uppercase mt-2 italic">{user?.email?.toLowerCase()}</p>
                        </div>
                    </div>
                    
                    <motion.div initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="bg-white/5 backdrop-blur-3xl border border-white/10 p-8 rounded-[3.5rem] text-center w-full md:w-105 shadow-inner border-b-12 relative overflow-hidden group">
                        <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500/30"></div>
                        <span className="text-[11px] font-black uppercase opacity-40 tracking-[0.5em] block mb-2">Academic Performance</span>
                        <h1 className={`text-8xl md:text-[10rem] font-black leading-none tracking-tighter ${activeTheme === 'dark' ? 'text-emerald-500' : 'text-white'}`}>{cgpa}</h1>
                        <p className="text-[10px] font-bold opacity-30 uppercase tracking-[0.2em] mt-4 italic">Total Course Credits: {totalCH}</p>
                    </motion.div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto -mt-16 px-4 relative z-10">
                {/* --- SMART SETTINGS PANEL --- */}
                <AnimatePresence>
                    {showSettings && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0 }} className={`${activeTheme === 'dark' ? 'bg-slate-900' : 'bg-white shadow-2xl'} p-8 rounded-[3rem] mb-12 border ${theme.border} overflow-hidden`}>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                                <div>
                                    <h3 className={`font-black uppercase text-xs mb-8 tracking-widest ${theme.text}`}>System Aesthetics</h3>
                                    <div className="grid grid-cols-3 gap-4">
                                        {Object.values(themes).map(t => (
                                            <button key={t.id} onClick={() => { setActiveTheme(t.id); localStorage.setItem('userTheme', t.id); }} className={`p-5 rounded-4xl border-4 transition-all ${activeTheme === t.id ? 'border-emerald-500 bg-emerald-500/5 scale-105 shadow-xl' : 'border-transparent opacity-40 hover:opacity-100'}`}>
                                                <div className={`h-14 w-full rounded-2xl bg-linear-to-br ${t.header}`}></div>
                                                <p className="mt-4 text-[9px] font-black uppercase tracking-widest">{t.name}</p>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <h3 className={`font-black uppercase text-xs mb-8 tracking-widest ${theme.text}`}>Global Assessment Keys</h3>
                                    <div className="flex flex-wrap gap-2 mb-8">
                                        {assessmentTypes.map((type, tIdx) => (
                                            <div key={tIdx} className={`${activeTheme === 'dark' ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'} px-4 py-2 rounded-xl flex items-center gap-3 border shadow-sm`}>
                                                <input className="bg-transparent border-none text-[11px] font-black uppercase w-20 outline-none" value={type} onChange={(e) => { const n = [...assessmentTypes]; n[tIdx] = e.target.value; setAssessmentTypes(n); }} />
                                                <button onClick={() => setAssessmentTypes(assessmentTypes.filter(t => t !== type))} className="text-red-400 hover:text-red-600 transition-all">✕</button>
                                            </div>
                                        ))}
                                    </div>
                                    <div className={`flex gap-3 p-2 rounded-2xl border ${theme.border} ${activeTheme === 'dark' ? 'bg-black' : 'bg-slate-50 shadow-inner'}`}>
                                        <input className="bg-transparent px-5 py-3 text-xs w-full font-bold outline-none" placeholder="Add custom type..." value={newType} onChange={(e) => setNewType(e.target.value)} />
                                        <button onClick={() => { if(newType) { setAssessmentTypes([...assessmentTypes, newType]); setNewType(""); } }} className={`px-10 py-3 rounded-xl text-white text-[11px] font-black uppercase shadow-lg ${theme.primary} hover:scale-105 transition-all`}>Register</button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* --- ANALYTICS HUD --- */}
                <div className="flex justify-center mb-12">
                    <button onClick={() => setShowAnalytics(!showAnalytics)} className={`${activeTheme === 'dark' ? 'bg-white/10' : 'bg-white shadow-xl'} backdrop-blur-3xl px-12 py-4 rounded-full text-[11px] font-black uppercase tracking-[0.3em] border border-white/10 hover:scale-110 transition-all active:scale-95`}>
                        {showAnalytics ? 'Hide HUD' : 'Visual Analytics HUD 📈'}
                    </button>
                </div>
                <AnimatePresence>{showAnalytics && <AnalyticsChart trend={semesters.map(s => parseFloat(calculateSGPA(s.subjects)))} theme={theme} activeTheme={activeTheme} />}</AnimatePresence>

                {/* --- GLOBAL ACTION BAR --- */}
                <div className="flex flex-col sm:flex-row justify-center gap-5 mb-24 px-4">
                    <motion.button whileHover={{ scale: 1.05 }} onClick={() => document.getElementById('mainPdfIn').click()} className="bg-white text-slate-900 px-14 py-6 rounded-4xl font-black shadow-2xl border border-slate-100 uppercase text-xs tracking-widest flex items-center gap-3">📂 <span className="pt-1">Import Official PDF</span></motion.button>
                    <motion.button whileHover={{ scale: 1.05 }} onClick={() => onUpdate([...semesters, { id: Date.now(), name: `Semester ${semesters.length + 1}`, subjects: [] }])} className={`${theme.primary} text-white px-14 py-6 rounded-4xl font-black shadow-2xl uppercase text-xs tracking-widest flex items-center gap-3`}><span className="text-xl">+</span> <span className="pt-1">Establish Semester</span></motion.button>
                    <input type="file" id="mainPdfIn" hidden onChange={handlePdfImport} accept=".pdf" />
                </div>

                {/* --- SEMESTER WORKSPACE --- */}
                <AnimatePresence mode="popLayout">
                    {semesters.map((sem, sIdx) => (
                        <div key={sem.id} className="mb-16">
                            <div className={`flex items-center justify-between p-6 md:p-8 rounded-[2.5rem] md:rounded-[3.5rem] shadow-2xl border sticky top-6 z-20 transition-all duration-500 ${activeTheme === 'dark' ? 'bg-slate-900/90 border-slate-700 backdrop-blur-xl' : 'bg-white/95 border-indigo-50 backdrop-blur-xl'}`}>
                                <div className="flex items-center gap-6 cursor-pointer grow overflow-hidden" onClick={() => setCollapsed(p => ({...p, sems: p.sems.includes(sem.id) ? p.sems.filter(x => x !== sem.id) : [...p.sems, sem.id]}))}>
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black text-white shadow-2xl ${theme.primary} shrink-0`}>{collapsed.sems.includes(sem.id) ? '▶' : '▼'}</div>
                                    <div className="overflow-hidden">
                                        <h3 className="font-black uppercase tracking-[0.2em] text-lg md:text-2xl truncate italic">{sem.name}</h3>
                                        <p className={`${theme.text} text-[10px] font-black uppercase opacity-60 tracking-widest mt-1`}>Calculated SGPA: {calculateSGPA(sem.subjects)}</p>
                                    </div>
                                </div>
                                <button onClick={() => onUpdate(semesters.filter(s => s.id !== sem.id))} className="bg-red-500/10 text-red-500 w-12 h-12 rounded-2xl font-bold hover:bg-red-500 hover:text-white transition-all">✕</button>
                            </div>

                            {!collapsed.sems.includes(sem.id) && (
                                <div className="mt-10 space-y-10 px-2 md:px-10">
                                    {sem.subjects.map((sub, subIdx) => {
                                        const stats = getSubjectStats(sub);
                                        const isSubCollapsed = collapsed.subs.includes(sub.id);
                                        return (
                                            <div key={sub.id} className={`${activeTheme === 'dark' ? 'bg-slate-900/30' : 'bg-white'} border-2 rounded-[3.5rem] md:rounded-[4.5rem] p-8 md:p-12 shadow-sm transition-all duration-500 relative overflow-hidden ${theme.border} hover:border-emerald-400 group`}>
                                                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 mb-10">
                                                    <div className="flex items-center gap-6 cursor-pointer grow" onClick={() => setCollapsed(p => ({...p, subs: p.subs.includes(sub.id) ? p.subs.filter(x => x !== sub.id) : [...p.subs, sub.id]}))}>
                                                        <span className={`${theme.text} font-black text-4xl transition-transform ${isSubCollapsed ? '' : 'rotate-45'}`}>⊕</span>
                                                        <div className="overflow-hidden">
                                                            <h4 className={`font-black uppercase text-xl md:text-3xl tracking-tight italic truncate ${activeTheme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{sub.title || 'Course Designation...'}</h4>
                                                            {isSubCollapsed && <SummaryBadge stats={stats} theme={theme} />}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-4 w-full lg:w-auto">
                                                        <label className={`cursor-pointer ${theme.accent} ${theme.text} px-8 py-4 rounded-3xl text-[10px] font-black uppercase tracking-[0.2em] border ${theme.border} flex items-center gap-3 grow lg:grow-0 justify-center hover:scale-105 transition-all shadow-sm`}>
                                                            📷 Smart OCR Scan
                                                            <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageScan(e, sIdx, subIdx)} />
                                                        </label>
                                                        <button onClick={() => { const n = [...semesters]; n[sIdx].subjects.splice(subIdx, 1); onUpdate(n); }} className="bg-red-500/10 text-red-400 w-12 h-12 rounded-2xl hover:bg-red-500 hover:text-white transition-all">✕</button>
                                                    </div>
                                                </div>

                                                {!isSubCollapsed && (
                                                    <div className="grid grid-cols-1 xl:grid-cols-4 gap-12 animate-in fade-in zoom-in duration-500">
                                                        <div className="xl:col-span-3 space-y-12">
                                                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                                                <div className="md:col-span-3"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block italic">Subject Title</label><input className={`w-full ${activeTheme === 'dark' ? 'bg-slate-950' : 'bg-slate-50'} border-2 ${theme.border} rounded-3xl px-8 py-5 font-bold text-xl outline-none focus:border-emerald-500 transition-all shadow-inner`} value={sub.title} onChange={(e) => { const n = [...semesters]; n[sIdx].subjects[subIdx].title = e.target.value; onUpdate(n); }} /></div>
                                                                <div className="md:col-span-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block md:text-center italic">Units (CH)</label><input type="number" className={`w-full ${activeTheme === 'dark' ? 'bg-slate-950' : 'bg-slate-50'} border-2 ${theme.border} rounded-3xl px-8 py-5 text-center font-black text-3xl outline-none focus:border-emerald-500 shadow-inner`} value={sub.ch} onChange={(e) => { const n = [...semesters]; n[sIdx].subjects[subIdx].ch = e.target.value; onUpdate(n); }} /></div>
                                                            </div>
                                                            <div className={`flex flex-wrap ${activeTheme === 'dark' ? 'bg-slate-950' : 'bg-slate-100'} p-2 rounded-4xl`}>
                                                                <button className={`flex-1 px-8 py-4 rounded-3xl text-[10px] font-black tracking-widest transition-all ${sub.mode !== 'assessment' ? `${theme.primary} text-white shadow-2xl` : 'text-slate-400 hover:text-slate-100'}`} onClick={() => { const n = [...semesters]; n[sIdx].subjects[subIdx].mode = 'simple'; onUpdate(n); }}>Absolute Mode</button>
                                                                <button className={`flex-1 px-8 py-4 rounded-3xl text-[10px] font-black tracking-widest transition-all ${sub.mode === 'assessment' ? `${theme.primary} text-white shadow-2xl` : 'text-slate-400 hover:text-slate-100'}`} onClick={() => { const n = [...semesters]; n[sIdx].subjects[subIdx].mode = 'assessment'; onUpdate(n); }}>Assessment Components</button>
                                                            </div>
                                                            <div className="mt-8 space-y-4">
                                                                {sub.mode === 'assessment' ? (
                                                                    <>
                                                                        {sub.assessments?.map((asm, aIdx) => (
                                                                            <div key={asm.id} className={`grid grid-cols-2 md:grid-cols-12 gap-3 p-5 ${activeTheme === 'dark' ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50'} rounded-3xl items-center border shadow-sm group/row hover:border-emerald-400 transition-all`}>
                                                                                <div className="col-span-2 md:col-span-4"><select className={`w-full ${activeTheme === 'dark' ? 'bg-slate-900' : 'bg-white'} border border-slate-200 rounded-2xl p-4 font-bold text-xs outline-none focus:border-emerald-500`} value={asm.type} onChange={(e) => { const n = [...semesters]; n[sIdx].subjects[subIdx].assessments[aIdx].type = e.target.value; onUpdate(n); }}>{assessmentTypes.map((t, i) => <option key={i} value={t}>{t}</option>)}</select></div>
                                                                                <div className="col-span-1 md:col-span-2"><input type="number" className={`w-full ${activeTheme === 'dark' ? 'bg-slate-900' : 'bg-white'} p-4 text-[11px] text-center font-black rounded-2xl border outline-none`} value={asm.weight} placeholder="Weight" onChange={(e) => { const n = [...semesters]; n[sIdx].subjects[subIdx].assessments[aIdx].weight = e.target.value; onUpdate(n); }} /></div>
                                                                                <div className="col-span-1 md:col-span-2"><input type="number" className={`w-full ${activeTheme === 'dark' ? 'bg-slate-900' : 'bg-white'} p-4 text-[11px] text-center font-black rounded-2xl border outline-none`} value={asm.total} placeholder="Max" onChange={(e) => { const n = [...semesters]; n[sIdx].subjects[subIdx].assessments[aIdx].total = e.target.value; onUpdate(n); }} /></div>
                                                                                <div className="col-span-1 md:col-span-2"><input type="number" className={`w-full ${theme.accent} ${theme.text} p-4 text-xs text-center font-black rounded-2xl border border-emerald-500/20 outline-none`} value={asm.obt} placeholder="Score" onChange={(e) => { const n = [...semesters]; n[sIdx].subjects[subIdx].assessments[aIdx].obt = e.target.value; onUpdate(n); }} /></div>
                                                                                <button className="col-span-1 md:col-span-2 text-red-500 font-bold text-xs flex justify-center opacity-40 group-hover/row:opacity-100 transition-all" onClick={() => { const n = [...semesters]; n[sIdx].subjects[subIdx].assessments.splice(aIdx, 1); onUpdate(n); }}>Remove</button>
                                                                            </div>
                                                                        ))}
                                                                        <button className={`w-full py-6 border-2 border-dashed ${theme.border} rounded-4xl text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] hover:text-emerald-500 transition-all`} onClick={() => { const n = [...semesters]; if(!n[sIdx].subjects[subIdx].assessments) n[sIdx].subjects[subIdx].assessments = []; n[sIdx].subjects[subIdx].assessments.push({id: Date.now(), type: assessmentTypes[0], weight:10, total:100, obt:0}); onUpdate(n); }}>+ Initialize Component Row</button>
                                                                    </>
                                                                ) : (
                                                                    <div className={`p-10 md:p-20 ${theme.accent} rounded-[4rem] border-2 border-dashed ${theme.border} text-center shadow-inner relative overflow-hidden`}>
                                                                        <label className="text-[11px] font-black opacity-60 uppercase tracking-[0.5em] mb-6 block italic">Input Absolute Percentage (0-100)</label>
                                                                        <input type="number" className={`w-full max-w-62.5 md:max-w-sm ${activeTheme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} border-2 rounded-[2.5rem] px-8 py-10 font-black text-6xl md:text-9xl text-center ${theme.text} outline-none shadow-2xl focus:scale-105 transition-all`} value={sub.simpleObt} onChange={(e) => { const n = [...semesters]; n[sIdx].subjects[subIdx].simpleObt = e.target.value; onUpdate(n); }} />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <ResultBox stats={stats} theme={theme} activeTheme={activeTheme} />
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                    <button onClick={() => { const n = [...semesters]; n[sIdx].subjects.push({id: Date.now(), title: '', ch: 3, simpleObt: 0, mode: 'simple', assessments: []}); onUpdate(n); }} className={`w-full py-12 border-2 border-dashed ${activeTheme === 'dark' ? 'border-slate-800' : 'border-slate-200'} rounded-[4rem] text-slate-400 font-black hover:${theme.text} uppercase text-[11px] tracking-[0.6em] transition-all`}>+ Register New Subject</button>
                                </div>
                            )}
                        </div>
                    ))}
                </AnimatePresence>

                <div className="flex flex-col items-center mt-32 space-y-12 pb-24">
                    <button onClick={() => window.print()} className={`${activeTheme === 'dark' ? 'bg-emerald-600 shadow-emerald-950/50' : 'bg-slate-900 shadow-slate-950/50'} text-white w-full max-w-4xl px-12 py-10 rounded-[4rem] font-black shadow-[0_35px_60px_-15px_rgba(0,0,0,0.5)] text-xl md:text-3xl uppercase hover:scale-105 transition-all tracking-[0.3em] italic`}>🖨️ Finalize & Export Transcript</button>
                    <button onClick={() => auth.signOut()} className="text-slate-400 font-bold hover:text-red-500 uppercase text-[10px] tracking-[0.5em] transition-all flex items-center gap-3">Terminate Session <span className="text-xl">➔</span></button>
                </div>
            </main>
        </div>
    );
};

// --- HIGH-END UI COMPONENTS ---

const HeaderBtn = ({ icon, onClick }) => (
    <motion.button whileHover={{ scale: 1.1, rotate: 5 }} whileTap={{ scale: 0.9 }} onClick={onClick} className="bg-white/10 hover:bg-white/25 p-3 md:p-5 rounded-3xl backdrop-blur-3xl border border-white/20 shadow-2xl transition-all text-2xl">{icon}</motion.button>
);

const SyncIndicator = () => (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-emerald-500/30 px-6 py-2 rounded-full text-[10px] font-black uppercase text-emerald-300 border border-emerald-500/40 animate-pulse z-50 whitespace-nowrap shadow-2xl backdrop-blur-md italic tracking-[0.3em]">Establishing Cloud Link...</div>
);

const LoadingOverlay = ({ message, theme }) => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-500 bg-slate-950/90 backdrop-blur-2xl flex flex-col items-center justify-center text-white px-10 text-center">
        <div className="w-24 h-24 border-[6px] border-white/10 border-t-emerald-500 rounded-full animate-spin mb-10 shadow-[0_0_100px_rgba(16,185,129,0.2)]"></div>
        <h3 className="font-black uppercase tracking-[0.5em] text-sm md:text-xl italic animate-pulse">{message}</h3>
    </motion.div>
);

const SummaryBadge = ({ stats, theme }) => (
    <div className="flex flex-wrap gap-3 mt-4">
        <span className={`text-[9px] font-black ${theme.text} ${theme.accent} px-4 py-1.5 rounded-full border ${theme.border} uppercase shadow-sm tracking-widest`}>Score: {stats.score.toFixed(0)}%</span>
        <span className={`text-[9px] font-black text-white ${theme.primary} px-4 py-1.5 rounded-full shadow-lg uppercase tracking-widest`}>{stats.gInfo?.g} ({stats.gInfo?.p.toFixed(2)})</span>
    </div>
);

const ResultBox = ({ stats, theme, activeTheme }) => (
    <div className={`lg:col-span-1 ${activeTheme === 'dark' ? 'bg-black border-slate-800' : 'bg-slate-950 border-indigo-900'} text-white rounded-[4rem] p-10 md:p-14 flex flex-col items-center justify-center text-center shadow-2xl h-full border-t-15 relative overflow-hidden group transition-all duration-500 hover:border-emerald-500`}>
        <div className={`absolute top-0 right-0 w-48 h-48 ${theme.primary} opacity-5 rounded-full -mr-24 -mt-24 group-hover:scale-150 transition-transform duration-1000`}></div>
        <span className="text-[11px] font-black opacity-30 uppercase mb-6 block italic tracking-[0.3em]">Academic Yield</span>
        <div className="text-7xl md:text-[6rem] font-black mb-6 md:mb-10 tracking-tighter text-white drop-shadow-2xl">{(stats.score || 0).toFixed(0)}<span className="text-3xl opacity-30 font-light">%</span></div>
        <div className={`${theme.primary} w-full py-6 md:py-8 rounded-4xl md:rounded-[2.5rem] font-black text-5xl md:text-7xl shadow-2xl border border-white/10 group-hover:rotate-1 transition-transform`} >{stats.gInfo?.g}</div>
        <p className="mt-8 md:mt-12 text-[11px] font-bold text-emerald-400 uppercase tracking-[0.4em] opacity-80">Grade Points: {(stats.gInfo?.p || 0.0).toFixed(2)}</p>
    </div>
);

const AnalyticsChart = ({ trend, theme, activeTheme }) => (
    <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }} className={`${activeTheme === 'dark' ? 'bg-slate-900/50' : 'bg-white shadow-2xl'} p-8 md:p-14 rounded-[4rem] mb-16 border ${theme.border} text-center overflow-x-auto custom-scrollbar relative overflow-hidden`}>
        <div className="absolute inset-0 bg-linear-to-b from-emerald-500/5 to-transparent opacity-20"></div>
        <h3 className={`font-black uppercase text-[11px] md:text-sm ${theme.text} mb-12 md:mb-16 italic tracking-[0.5em] relative z-10`}>Performance Trajectory Matrix</h3>
        <div className="h-64 md:h-80 w-full min-w-125 md:min-w-200 relative flex items-end justify-between px-16 md:px-24 border-b-2 border-slate-100/10 pb-4 z-10">
            <svg className="absolute inset-0 w-full h-full px-16 md:px-24 pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                <defs>
                    <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#10b981"/><stop offset="100%" stopColor="#4f46e5"/></linearGradient>
                </defs>
                <polyline fill="none" stroke="url(#lineGrad)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" points={trend.length > 1 ? trend.map((val, i) => `${(i / (trend.length - 1)) * 100},${100 - (val / 4) * 100}`).join(' ') : "0,50 100,50"} className="drop-shadow-[0_10px_10px_rgba(16,185,129,0.4)]" />
            </svg>
            {trend.map((val, i) => (
                <div key={i} className="flex flex-col items-center z-10 relative group">
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: i * 0.1 }} className={`${theme.primary} w-4 h-4 md:w-6 md:h-6 rounded-full mb-4 shadow-[0_0_25px_rgba(16,185,129,0.5)] ring-4 md:ring-8 ring-white group-hover:scale-125 transition-transform cursor-pointer`}></motion.div>
                    <span className="text-base md:text-xl font-black text-slate-900 dark:text-white">{val}</span>
                    <span className="text-[10px] font-black text-slate-500 uppercase mt-2 tracking-widest italic">Phase {i+1}</span>
                </div>
            ))}
        </div>
    </motion.div>
);

const GradeScaleModal = ({ onClose, theme }) => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-600 flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-2xl">
        <motion.div initial={{ scale: 0.9, y: 50 }} animate={{ scale: 1, y: 0 }} className="bg-[#0F172A] w-full max-w-lg rounded-[3.5rem] shadow-[0_0_100px_rgba(16,185,129,0.15)] overflow-hidden border border-white/10 mx-2">
            <div className="bg-linear-to-r from-slate-900 to-indigo-900 p-8 text-white flex justify-between items-center border-b border-white/5"><h3 className="font-black uppercase tracking-[0.4em] text-sm md:text-base italic">Superior Metric Standard</h3><button onClick={onClose} className="text-white/50 hover:text-white hover:rotate-90 transition-all text-3xl">✕</button></div>
            <div className="p-10 space-y-3">
                {[ ["85-100", "A", "4.00"], ["80-84", "A-", "3.66"], ["75-79", "B+", "3.33"], ["71-74", "B", "3.00"], ["68-70", "B-", "2.66"], ["64-67", "C+", "2.33"], ["61-63", "C", "2.00"], ["58-60", "C-", "1.66"],["54-57", "D+", "1.30"],["50-53", "D", "1.00"], ["Below 50", "F", "0.00"] ].map(([r, g, p], i) => (<div key={i} className="flex justify-between py-4 border-b border-white/5 last:border-0 items-center group/metric"><span className="text-[11px] font-black text-slate-500 group-hover/metric:text-white transition-colors uppercase tracking-widest">{r} Scale</span><span className={`text-xl font-black ${g === 'A' ? 'text-emerald-500' : 'text-white'}`}>{g}</span><span className="font-mono font-black text-emerald-500/50 text-xl">{p}</span></div>))}
            </div>
        </motion.div>
    </motion.div>
);

const OnboardingModal = ({ onClose, theme }) => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-600 flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-3xl">
        <motion.div initial={{ y: 100, rotate: -2 }} animate={{ y: 0, rotate: 0 }} className="bg-white w-full max-w-2xl rounded-[4rem] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col border border-white/10 mx-2">
            <div className={`p-10 md:p-14 text-white ${theme.primary} relative overflow-hidden`}>
                <div className="absolute top-0 right-0 w-64 h-64 bg-black/10 rounded-full -mr-32 -mt-32"></div>
                <h2 className="text-3xl md:text-5xl font-black uppercase italic tracking-tighter relative z-10 leading-tight">System Initialization</h2>
                <p className="text-[10px] md:text-sm opacity-80 uppercase tracking-[0.4em] mt-4 font-black relative z-10">Advanced Academic Ecosystem v6.0</p>
            </div>
            <div className="p-10 md:p-16 space-y-12 overflow-y-auto grow custom-scrollbar">
                <GuideStep theme={theme} icon="⚡" title="Neural Cloud Link" desc="Your academic dataset is synchronized in real-time with Firestore clusters. Access your profile globally." />
                <GuideStep theme={theme} icon="🧠" title="Grade Intelligence" desc="Amber-alert predictors use predictive algorithms to calculate the exact finals threshold for Grade A." />
                <GuideStep theme={theme} icon="📸" title="Hyper-OCR Engine" desc="Scan your results using high-precision character recognition. Zero manual input architecture." />
            </div>
            <div className="p-10 border-t border-slate-100 flex justify-center bg-slate-50"><button onClick={onClose} className={`${theme.primary} text-white px-14 py-6 rounded-3xl font-black uppercase tracking-[0.5em] text-[11px] shadow-[0_20px_40px_-10px_rgba(0,0,0,0.3)] hover:scale-105 active:scale-95 transition-all`}>Authorize Dashboard</button></div>
        </motion.div>
    </motion.div>
);

const GuideStep = ({ icon, title, desc, theme }) => (
    <div className="flex gap-6 md:gap-10 items-start group">
        <div className={`${theme.accent} ${theme.text} w-16 h-16 md:w-24 md:h-24 rounded-4xl flex items-center justify-center text-3xl md:text-5xl shrink-0 border-2 ${theme.border} group-hover:${theme.primary} group-hover:text-white transition-all shadow-2xl`}>{icon}</div>
        <div className="pt-2"><h4 className="font-black text-slate-900 uppercase text-lg md:text-2xl tracking-tight italic mb-2">{title}</h4><p className="text-slate-500 text-[12px] md:text-base leading-relaxed font-bold opacity-80">{desc}</p></div>
    </div>
);

export default Dashboard;