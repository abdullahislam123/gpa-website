import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { auth, db } from '../services/firebase';
import { calculateGrade, parseSuperiorTranscript } from '../services/pdfParser';
import UpdateModal from './UpdateModal';

// --- 1. ICONS & THEMES ---
const GithubIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" /><path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
);
const LinkedinIcon = (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2z"></path><circle cx="4" cy="4" r="2"></circle></svg>
);

const themes = {
    professional: { id: 'professional', name: 'Daylight Pro', primary: 'bg-indigo-600', text: 'text-indigo-600', border: 'border-slate-200', header: 'from-white via-slate-50 to-indigo-50', accent: 'bg-indigo-50', bg: 'bg-slate-50', card: 'bg-white' },
    minimal: { id: 'minimal', name: 'Minimal Soft', primary: 'bg-emerald-500', text: 'text-emerald-600', border: 'border-slate-100', header: 'from-white to-emerald-50', accent: 'bg-emerald-50', bg: 'bg-white', card: 'bg-slate-50' }
};

const gradeColors = { 'A': 'text-emerald-600 font-bold', 'A-': 'text-teal-600', 'B+': 'text-blue-600', 'F': 'text-rose-600 animate-pulse font-black', 'default': 'text-slate-500' };
const gradeToMarks = { 'A': 85, 'A-': 80, 'B+': 75, 'B': 71, 'B-': 68, 'C+': 64, 'C': 61, 'C-': 58, 'D+': 54, 'D': 50, 'F': 0 };

const Dashboard = ({ user, semesters, onUpdate }) => {

    // --- 2. STATES & REFS ---
    const CURRENT_VERSION = "2.0";
    const [showUpdateModal, setShowUpdateModal] = useState(false);
    const fileInputRef = useRef(null);
    const [isParsing, setIsParsing] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showGradeTable, setShowGradeTable] = useState(false);
    const [collapsedSems, setCollapsedSems] = useState([]);
    const [customAssessments, setCustomAssessments] = useState(() => {
        const saved = localStorage.getItem(`custom_asm_${user?.uid}`);
        return saved ? JSON.parse(saved) : [];
    });

    const assessmentTypes = ['Quiz', 'Assignment', 'Mid Exam', 'Final Exam', 'Project', 'Viva', 'Others', ...customAssessments];
    const activeTheme = localStorage.getItem('userTheme') || 'professional';
    const theme = themes[activeTheme] || themes.professional;

    // --- 3. MASTER SYNC FUNCTION (NO RECURSION) ---
    const handleSyncUpdate = async (newSemesters) => {
        // Step 1: Update UI local state for speed
        onUpdate(newSemesters);

        // Step 2: Push to Cloud
        if (user?.uid) {
            try {
                await db.collection('users').doc(user.uid).set({
                    semesters: newSemesters,
                    lastUpdated: new Date().toISOString()
                }, { merge: true });
                console.log("Cloud Saved!");
            } catch (error) { console.error("Firebase Sync Error:", error); }
        }
    };

    // --- 4. AUTO LOAD FROM CLOUD ---
    useEffect(() => {
        const init = async () => {
            if (user?.uid && semesters.length === 0) {
                const doc = await db.collection('users').doc(user.uid).get();
                if (doc.exists && doc.data().semesters) {
                    onUpdate(doc.data().semesters);
                }
            }
            if (localStorage.getItem('app_version') !== CURRENT_VERSION) setShowUpdateModal(true);
        };
        init();
    }, [user?.uid]);

    // --- 5. CALCULATION HELPERS ---
    const getSubjectStats = (sub) => {
        let score = 0;
        if (sub?.mode === 'assessment' && sub?.assessments?.length > 0) {
            sub.assessments.forEach(a => {
                const w = parseFloat(a.weight) || 0;
                const total = parseFloat(a.total) || 1;
                const obt = parseFloat(a.obt) || 0;
                score += (obt / total) * w;
            });
        } else { score = parseFloat(sub?.simpleObt) || 0; }
        const gInfo = calculateGrade(score) || { g: 'F', p: 0.0 };
        return { score, gInfo };
    };

    const calculateSGPAData = (subjects) => {
        let qp = 0, ch = 0;
        (subjects || []).forEach(sub => {
            const stats = getSubjectStats(sub);
            qp += (stats.gInfo.p * (parseFloat(sub.ch) || 0));
            ch += (parseFloat(sub.ch) || 0);
        });
        const sgpa = ch > 0 ? (qp / ch) : 0;
        return { sgpa: sgpa.toFixed(2), ch: ch, grade: calculateGrade((sgpa / 4) * 100).g };
    };

    const totalCH = semesters.reduce((acc, s) => acc + s.subjects.reduce((a, b) => a + (parseFloat(b.ch) || 0), 0), 0);
    const cgpa = (semesters.reduce((acc, s) => acc + s.subjects.reduce((a, sub) => a + (getSubjectStats(sub).gInfo.p * (parseFloat(sub.ch) || 0)), 0), 0) / (totalCH || 1)).toFixed(2);

    return (
        <div className={`min-h-screen ${theme.bg} transition-colors duration-500 pb-32 font-sans`}>
            <UpdateModal isOpen={showUpdateModal} onClose={() => { localStorage.setItem('app_version', CURRENT_VERSION); setShowUpdateModal(false); }} />

            {/* TOP NAVIGATION */}
            <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b px-4 py-3 flex justify-between items-center shadow-sm">
                <div className="flex items-center gap-3">
                    <img src={user?.photoURL || `https://ui-avatars.com/api/?name=${user?.displayName || 'Student'}&background=6366f1&color=fff`} className="w-9 h-9 rounded-full border" alt="profile" />
                    <span className="font-bold text-slate-800 text-sm">{showSettings ? "User Settings" : (user?.displayName || 'Abdullah')}</span>
                </div>
                {!showSettings && semesters.length > 0 && (
                    <div className="flex flex-col items-center">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Total CGPA</span>
                        <span className="text-2xl font-black text-indigo-600 leading-none">{cgpa}</span>
                    </div>
                )}
                <div className="w-9 h-9" />
            </nav>

            <AnimatePresence>{showGradeTable && <GradeScaleModal onClose={() => setShowGradeTable(false)} />}</AnimatePresence>

            <main className="max-w-6xl mx-auto px-4 relative z-10">
                {showSettings ? (
                    <div className="mt-8">
                        <SettingsPanel user={user} themes={themes} activeTheme={activeTheme} setActiveTheme={setActiveTheme} customAssessments={customAssessments} setCustomAssessments={setCustomAssessments} />
                    </div>
                ) : (
                    <>
                        <header className={`bg-linear-to-br ${theme.header} -mx-4 pt-12 pb-24 px-6 rounded-b-[3.5rem] text-center border-b border-slate-200/50 mb-12`}>
                            <h1 className="text-4xl font-black text-slate-900 tracking-tight">Academic Portal</h1>
                            <p className="text-slate-600 mt-2 font-medium">Hello <span className="text-indigo-600 font-black">{user?.displayName?.split(' ')[0]}</span>, track your progress!</p>
                        </header>

                        {/* MASTER BUTTONS (FIXED CLEAR ALL) */}
                        <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mb-12 -mt-20">
                            <button onClick={() => handleSyncUpdate([...semesters, { id: Date.now(), name: `Semester ${semesters.length + 1}`, subjects: [] }])} className={`${theme.primary} text-white px-10 py-4 rounded-2xl font-bold shadow-xl`}>+ Add Semester</button>

                            <input type="file" ref={fileInputRef} onChange={async (e) => {
                                const file = e.target.files[0]; if (!file) return;
                                setIsParsing(true);
                                try { const data = await parseSuperiorTranscript(file); if (data) handleSyncUpdate([...semesters, ...data]); }
                                finally { setIsParsing(false); e.target.value = null; }
                            }} accept="application/pdf" className="hidden" />
                            <button onClick={() => fileInputRef.current.click()} disabled={isParsing} className="bg-white border text-slate-700 px-10 py-4 rounded-2xl font-bold shadow-sm">{isParsing ? '...' : '📄 Import PDF'}</button>

                            <button onClick={() => { if (window.confirm("ARE YOU SURE? This clears all data everywhere.")) handleSyncUpdate([]); }} className="bg-rose-50 text-rose-600 px-10 py-4 rounded-2xl font-bold border border-rose-100 shadow-sm">Clear All</button>
                        </div>

                        <LayoutGroup>
                            <div className="space-y-6">
                                {semesters.map((sem, sIdx) => {
                                    const isCollapsed = collapsedSems.includes(sem.id);
                                    const semSummary = calculateSGPAData(sem.subjects);
                                    return (
                                        <motion.div layout key={sem.id} className={`${theme.card} rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden`}>
                                            <div className="p-5 flex justify-between items-center cursor-pointer" onClick={() => setCollapsedSems(prev => prev.includes(sem.id) ? prev.filter(i => i !== sem.id) : [...prev, sem.id])}>
                                                <div className="flex items-center gap-4">
                                                    <motion.div animate={{ rotate: isCollapsed ? 0 : 90 }} className="p-1.5 rounded-xl bg-indigo-600 text-white shadow-md">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
                                                    </motion.div>
                                                    <h3 className="font-black text-slate-800 uppercase text-[11px] tracking-widest">{sem.name}</h3>
                                                    {isCollapsed && <span className="text-[10px] font-black text-indigo-600">⭐ {semSummary.sgpa} SGPA</span>}
                                                </div>
                                                <button onClick={(e) => { e.stopPropagation(); if (window.confirm("Delete semester?")) handleSyncUpdate(semesters.filter(s => s.id !== sem.id)); }} className="text-slate-300 hover:text-rose-500 transition-colors p-2">🗑️</button>
                                            </div>

                                            <AnimatePresence>
                                                {!isCollapsed && (
                                                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 pt-6 border-t">
                                                        {sem.subjects.map((sub, subIdx) => {
                                                            const stats = getSubjectStats(sub);
                                                            return (
                                                                <div key={sub.id} className="bg-slate-50/50 rounded-3xl p-5 border border-slate-100 relative group">
                                                                    <button onClick={() => { const n = [...semesters]; n[sIdx].subjects.splice(subIdx, 1); handleSyncUpdate(n); }} className="absolute top-4 right-4 text-slate-300 hover:text-rose-500">✕</button>
                                                                    <input className="bg-transparent font-bold text-sm w-full outline-none mb-4 focus:text-indigo-600 transition-all" value={sub.title} onChange={(e) => { const n = [...semesters]; n[sIdx].subjects[subIdx].title = e.target.value; handleSyncUpdate(n); }} placeholder="Subject Name" />

                                                                    {/* MODE TOGGLE */}
                                                                    <div className="flex gap-1 p-1 bg-slate-200/50 rounded-lg mb-4">
                                                                        <button className={`flex-1 py-1 text-[8px] font-black uppercase rounded-md transition-all ${sub.mode !== 'assessment' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`} onClick={() => { const n = [...semesters]; n[sIdx].subjects[subIdx].mode = 'simple'; handleSyncUpdate(n); }}>Simple</button>
                                                                        <button className={`flex-1 py-1 text-[8px] font-black uppercase rounded-md transition-all ${sub.mode === 'assessment' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`} onClick={() => { const n = [...semesters]; n[sIdx].subjects[subIdx].mode = 'assessment'; handleSyncUpdate(n); }}>Assessment</button>
                                                                    </div>

                                                                    {sub.mode === 'assessment' ? (
                                                                        <div className="space-y-2">
                                                                            {sub.assessments?.map((asm, aIdx) => (
                                                                                <div key={asm.id} className="grid grid-cols-12 gap-1 items-center">
                                                                                    <select className="col-span-4 bg-white border border-slate-100 rounded-lg p-1 text-[9px] font-bold" value={asm.type} onChange={(e) => { const n = [...semesters]; n[sIdx].subjects[subIdx].assessments[aIdx].type = e.target.value; handleSyncUpdate(n); }}>
                                                                                        {assessmentTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                                                                    </select>
                                                                                    <input type="number" className="col-span-2 bg-indigo-50 rounded-lg p-1 text-center text-[9px] font-bold" value={asm.obt} onChange={(e) => { const n = [...semesters]; n[sIdx].subjects[subIdx].assessments[aIdx].obt = e.target.value; handleSyncUpdate(n); }} />
                                                                                    <input type="number" className="col-span-2 bg-white border border-slate-100 rounded-lg p-1 text-center text-[9px]" value={asm.total} onChange={(e) => { const n = [...semesters]; n[sIdx].subjects[subIdx].assessments[aIdx].total = e.target.value; handleSyncUpdate(n); }} />
                                                                                    <input type="number" className="col-span-3 bg-white border border-slate-100 rounded-lg p-1 text-center text-[9px]" value={asm.weight} onChange={(e) => { const n = [...semesters]; n[sIdx].subjects[subIdx].assessments[aIdx].weight = e.target.value; handleSyncUpdate(n); }} />
                                                                                    <button onClick={() => { const n = [...semesters]; n[sIdx].subjects[subIdx].assessments.splice(aIdx, 1); handleSyncUpdate(n); }} className="col-span-1 text-rose-300">✕</button>
                                                                                </div>
                                                                            ))}
                                                                            <button onClick={() => { const n = [...semesters]; if (!n[sIdx].subjects[subIdx].assessments) n[sIdx].subjects[subIdx].assessments = []; n[sIdx].subjects[subIdx].assessments.push({ id: Date.now(), type: 'Quiz', weight: 10, total: 100, obt: 0 }); handleSyncUpdate(n); }} className="w-full py-2 border border-dashed border-indigo-200 rounded-xl text-[9px] font-black text-indigo-500">+ Row</button>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="space-y-4">
                                                                            <div className="flex justify-between items-center bg-white p-2 rounded-xl border border-slate-100 shadow-sm">
                                                                                <span className="text-[8px] font-black text-slate-400">CREDIT HOURS</span>
                                                                                <input type="number" className="w-12 bg-slate-50 rounded-lg font-bold text-center text-indigo-600 text-sm" value={sub.ch} onChange={(e) => { const n = [...semesters]; n[sIdx].subjects[subIdx].ch = e.target.value; handleSyncUpdate(n); }} />
                                                                            </div>
                                                                            <div className="bg-indigo-50/50 rounded-2xl p-4 text-center">
                                                                                <div className="flex gap-1 p-1 bg-slate-100 rounded-lg mb-3 max-w-[120px] mx-auto">
                                                                                    <button className={`flex-1 text-[7px] font-bold ${!sub.isManual ? 'bg-white' : ''}`} onClick={() => { const n = [...semesters]; n[sIdx].subjects[subIdx].isManual = false; handleSyncUpdate(n); }}>Grade</button>
                                                                                    <button className={`flex-1 text-[7px] font-bold ${sub.isManual ? 'bg-white' : ''}`} onClick={() => { const n = [...semesters]; n[sIdx].subjects[subIdx].isManual = true; handleSyncUpdate(n); }}>Marks</button>
                                                                                </div>
                                                                                {!sub.isManual ? (
                                                                                    <select className="bg-white border-2 border-indigo-100 rounded-xl px-4 py-2 font-black text-indigo-600 text-sm appearance-none shadow-md" value={Object.keys(gradeToMarks).find(key => gradeToMarks[key] === parseFloat(sub.simpleObt)) || "F"} onChange={(e) => { const n = [...semesters]; n[sIdx].subjects[subIdx].simpleObt = gradeToMarks[e.target.value]; handleSyncUpdate(n); }}>
                                                                                        {Object.keys(gradeToMarks).map(g => <option key={g} value={g}>{g}</option>)}
                                                                                    </select>
                                                                                ) : (
                                                                                    <input type="number" className="bg-white border-2 border-indigo-100 rounded-xl px-4 py-2 w-24 text-center font-black text-2xl text-indigo-600 shadow-md" value={sub.simpleObt} onChange={(e) => { const n = [...semesters]; n[sIdx].subjects[subIdx].simpleObt = e.target.value; handleSyncUpdate(n); }} />
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                    <div className="flex justify-between pt-3 border-t border-slate-100 text-[10px] font-bold mt-4">
                                                                        <span>Grade: <span className={gradeColors[stats.gInfo.g]}>{stats.gInfo.g} ({stats.gInfo.p})</span></span>
                                                                        <span className="text-indigo-600">{stats.score.toFixed(0)}%</span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                        <button onClick={() => { const n = [...semesters]; n[sIdx].subjects.push({ id: Date.now(), title: '', ch: 3, simpleObt: 0, mode: 'simple', assessments: [] }); handleSyncUpdate(n); }} className="py-12 border-2 border-dashed border-slate-200 rounded-4xl text-slate-300 font-bold hover:bg-indigo-50 hover:text-indigo-600 transition-all">+ Add Course</button>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        </LayoutGroup>
                    </>
                )}
            </main>

            <footer className="py-12 text-center text-gray-400">
                <div className="flex justify-center gap-8 mb-6">
                    <a href="#" target="_blank" className="hover:text-black transition-colors"><GithubIcon className="w-6 h-6" /></a>
                    <a href="#" target="_blank" className="hover:text-blue-600 transition-colors"><LinkedinIcon className="w-6 h-6" /></a>
                </div>
                <p className="text-[10px] uppercase tracking-[0.4em] font-black mb-2">Superior Academic Portal — 2026</p>
                <p className="text-sm">Crafted with ❤️ by <b>Abdullah</b></p>
            </footer>

            {/* FLOATING NAV */}
            <div className="fixed bottom-6 left-0 right-0 z-50 flex justify-center px-6">
                <nav className="bg-slate-900/90 backdrop-blur-xl border border-white/10 p-2 rounded-3xl shadow-2xl flex items-center gap-2">
                    <button onClick={() => setShowSettings(false)} className={`p-4 rounded-2xl flex flex-col items-center ${!showSettings ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400'}`}><span className="text-xl">🏠</span><span className="text-[7px] font-black mt-1">HOME</span></button>
                    <button onClick={() => setShowGradeTable(true)} className="p-4 rounded-2xl text-slate-400 flex flex-col items-center"><span className="text-xl">📊</span><span className="text-[7px] font-black mt-1">SCALE</span></button>
                    <button onClick={() => setShowSettings(true)} className={`p-4 rounded-2xl flex flex-col items-center ${showSettings ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400'}`}><span className="text-xl">⚙️</span><span className="text-[7px] font-black mt-1">PROFILE</span></button>
                    <div className="w-[1px] h-8 bg-white/10 mx-1" />
                    <button onClick={() => auth.signOut()} className="p-4 rounded-2xl text-rose-400 flex flex-col items-center"><span className="text-xl">🚪</span><span className="text-[7px] font-black mt-1">EXIT</span></button>
                </nav>
            </div>
        </div>
    );
};

// --- 6. SETTINGS PANEL ---
const SettingsPanel = ({ user, themes, activeTheme, setActiveTheme, customAssessments, setCustomAssessments }) => {
    const [name, setName] = useState(user?.displayName || "");
    const [loading, setLoading] = useState(false);
    const [newAsm, setNewAsm] = useState("");
    const [editIndex, setEditIndex] = useState(null);
    const [editText, setEditText] = useState("");

    const saveToLocal = (arr) => {
        setCustomAssessments(arr);
        localStorage.setItem(`custom_asm_${user?.uid}`, JSON.stringify(arr));
    };

    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 pb-20">
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden flex flex-col sm:flex-row items-center gap-6">
                <img src={user?.photoURL || `https://ui-avatars.com/api/?name=${name || 'S'}&background=6366f1&color=fff`} className="w-24 h-24 rounded-3xl border-4 border-indigo-50 shadow-md object-cover" />
                <div className="flex-1 w-full space-y-4">
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                        <div className="flex gap-2 mt-1">
                            <input className="flex-1 bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:border-indigo-400 focus:bg-white transition-all shadow-inner" value={name} onChange={e => setName(e.target.value)} />
                            <button onClick={async () => { setLoading(true); try { await user.updateProfile({ displayName: name.trim() }); alert("Name Updated!"); } finally { setLoading(false); } }} className="bg-slate-900 text-white px-6 rounded-2xl text-[10px] font-black uppercase hover:bg-black transition-all shadow-lg active:scale-95">{loading ? '...' : 'Save'}</button>
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email</label>
                        <p className="text-sm font-bold text-slate-500 bg-slate-50/80 p-3 px-4 rounded-2xl border border-slate-100 shadow-sm italic">{user?.email}</p>
                    </div>
                </div>
            </div>

            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl">
                <h3 className="text-[10px] font-black uppercase text-indigo-600 mb-6 tracking-[0.2em]">Interface Theme</h3>
                <div className="grid grid-cols-2 gap-3">
                    {Object.values(themes).map(t => (
                        <button key={t.id} onClick={() => { setActiveTheme(t.id); localStorage.setItem('userTheme', t.id); }} className={`p-4 rounded-2xl border-2 text-[10px] font-black transition-all ${activeTheme === t.id ? 'border-indigo-600 bg-indigo-50 text-indigo-600 shadow-sm' : 'border-slate-50 text-slate-400'}`}>{t.name}</button>
                    ))}
                </div>
            </div>

            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl">
                <h3 className="text-[10px] font-black uppercase text-indigo-600 mb-6 tracking-[0.2em]">Custom Assessment Labels</h3>
                <div className="flex gap-2 mb-8">
                    <input className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-xs font-bold outline-none focus:border-indigo-400 shadow-inner" placeholder="Add new (e.g. Lab Task)" value={newAsm} onChange={e => setNewAsm(e.target.value)} />
                    <button onClick={() => { if (!newAsm.trim()) return; const updated = [...customAssessments, newAsm.trim()]; saveToLocal(updated); setNewAsm(""); }} className="bg-indigo-600 text-white px-8 rounded-2xl text-[10px] font-black uppercase shadow-lg transition-all">Add</button>
                </div>
                <div className="flex flex-wrap gap-3">
                    {customAssessments.map((item, idx) => (
                        <div key={idx} className="bg-white px-4 py-3 rounded-2xl flex items-center gap-3 border border-slate-200 shadow-sm hover:border-indigo-200 transition-all">
                            {editIndex === idx ? (
                                <input className="w-24 bg-indigo-50 px-2 py-0.5 rounded-lg text-[10px] font-black outline-none border border-indigo-200" value={editText} onChange={e => setEditText(e.target.value)} autoFocus onBlur={() => { if (!editText.trim()) { setEditIndex(null); return; } const updated = [...customAssessments]; updated[idx] = editText; saveToLocal(updated); setEditIndex(null); }} />
                            ) : (
                                <><span className="text-[10px] font-black text-indigo-600 uppercase tracking-tighter">{item}</span>
                                    <div className="flex items-center gap-1 border-l pl-2 border-slate-100">
                                        <button onClick={() => { setEditIndex(idx); setEditText(item); }} className="text-slate-300 hover:text-indigo-500 p-1"><svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg></button>
                                        <button onClick={() => saveToLocal(customAssessments.filter((_, i) => i !== idx))} className="text-slate-300 hover:text-rose-500 p-1">✕</button>
                                    </div></>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </motion.div>
    );
};

// --- 7. GRADE SCALE MODAL ---
const GradeScaleModal = ({ onClose }) => {
    const grades = [["85+", "A", "4.0"], ["80-84", "A-", "3.6"], ["75-79", "B+", "3.3"], ["71-74", "B", "3.0"], ["68-70", "B-", "2.6"], ["64-67", "C+", "2.3"], ["61-63", "C", "2.0"], ["58-60", "C-", "1.6"], ["54-57", "D+", "1.3"], ["50-53", "D", "1.0"], ["<50", "F", "0.0"]];
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 bg-slate-900/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white w-full max-w-[280px] rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
                <div className="bg-indigo-600 px-4 py-3 flex justify-between items-center text-white"><span className="font-black text-[9px] tracking-widest uppercase">Grading Scale</span><button onClick={onClose} className="p-1 font-bold">✕</button></div>
                <div className="p-2 space-y-0.5">
                    {grades.map(([r, g, p], i) => (
                        <div key={i} className="flex justify-between items-center px-3 py-1 text-[10px] font-bold border-b border-slate-50 last:border-0"><span className="text-slate-500 w-16">{r}%</span><span className="text-indigo-600 w-6 text-center">{g}</span><span className="text-slate-800 w-8 text-right">{p}</span></div>
                    ))}
                </div>
            </motion.div>
        </div>
    );
};

export default Dashboard;