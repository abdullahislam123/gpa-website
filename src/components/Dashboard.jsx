import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Tesseract from 'tesseract.js';
import { auth, db } from '../services/firebase';
import { parseSuperiorTranscript, calculateGrade } from '../services/pdfParser';

const themes = {
    cyber: {
        id: 'cyber', name: 'Cyber Arctic', primary: 'bg-cyan-500', text: 'text-cyan-400',
        border: 'border-cyan-500/20', header: 'from-[#020617] via-[#0B1121] to-[#1E1B4B]',
        accent: 'bg-cyan-500/10', bg: 'bg-[#020617]'
    },
    royal: {
        id: 'royal', name: 'Royal Velvet', primary: 'bg-violet-500', text: 'text-violet-400',
        border: 'border-violet-500/20', header: 'from-[#020617] via-[#1E1B4B] to-[#4C1D95]',
        accent: 'bg-violet-500/10', bg: 'bg-[#020617]'
    }
};

const gradeColors = {
    'A': 'text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.6)]',
    'A-': 'text-cyan-500/80',
    'F': 'text-rose-500 animate-pulse',
    'default': 'text-slate-300'
};

const Dashboard = ({ user, semesters, onUpdate }) => {
    const [collapsed, setCollapsed] = useState({ sems: [], subs: [] });
    const [showSettings, setShowSettings] = useState(false);
    const [showGradeTable, setShowGradeTable] = useState(false);
    const [showAnalytics, setShowAnalytics] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isParsing, setIsParsing] = useState(false);
    const [assessmentTypes, setAssessmentTypes] = useState(['Quiz', 'Assignment', 'Mid Exam', 'Final Exam', 'Project', 'Viva', 'Others']);
    const [newType, setNewType] = useState("");

    // CRASH FIX: Added fallback to 'cyber' if activeTheme is invalid
    const [activeTheme, setActiveTheme] = useState(localStorage.getItem('userTheme') || 'cyber');
    const theme = themes[activeTheme] || themes.cyber;

    useEffect(() => {
        const fetchUserData = async () => {
            if (user?.uid) {
                try {
                    const doc = await db.collection('users').doc(user.uid).get();
                    if (doc.exists) {
                        const data = doc.data();
                        if (data.semesters) onUpdate(data.semesters);
                        if (data.activeTheme && themes[data.activeTheme]) setActiveTheme(data.activeTheme);
                        if (data.assessmentTypes) setAssessmentTypes(data.assessmentTypes);
                    }
                } catch (err) { console.error("Firebase Load Error", err); }
            }
        };
        fetchUserData();
    }, [user?.uid]);

    useEffect(() => {
        const saveToCloud = async () => {
            if (user?.uid && semesters.length > 0) {
                setIsSyncing(true);
                try {
                    await db.collection('users').doc(user.uid).set({
                        semesters, activeTheme, assessmentTypes, lastUpdated: new Date().toISOString()
                    }, { merge: true });
                    setTimeout(() => setIsSyncing(false), 1500);
                } catch (err) { setIsSyncing(false); }
            }
        };
        const timer = setTimeout(() => saveToCloud(), 3000);
        return () => clearTimeout(timer);
    }, [semesters, activeTheme, assessmentTypes, user?.uid]);

    const handlePdfImport = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setIsParsing(true);
        try {
            const data = await parseSuperiorTranscript(file);
            onUpdate([...semesters, ...data]);
        } catch (err) { alert("PDF Error"); }
        finally { setIsParsing(false); e.target.value = null; }
    };

    const handleImageScan = async (e, sIdx, subIdx) => {
        const file = e.target.files[0];
        if (!file) return;
        setIsParsing(true);
        try {
            const { data: { text } } = await Tesseract.recognize(file, 'eng');
            const lines = text.split('\n');
            const newAssessments = [];
            const rowRegex = /(.+?)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)$/;
            lines.forEach(line => {
                const match = line.replace(/[|_]/g, ' ').replace(/\s+/g, ' ').trim().match(rowRegex);
                if (match) {
                    newAssessments.push({ id: Date.now() + Math.random(), type: match[1].trim(), weight: parseFloat(match[2]), total: parseFloat(match[3]), obt: parseFloat(match[4]) });
                }
            });
            if (newAssessments.length > 0) {
                const n = JSON.parse(JSON.stringify(semesters));
                n[sIdx].subjects[subIdx].mode = 'assessment';
                n[sIdx].subjects[subIdx].assessments = [...(n[sIdx].subjects[subIdx].assessments || []), ...newAssessments];
                onUpdate(n);
            }
        } finally { setIsParsing(false); e.target.value = null; }
    };

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
        <div className={`min-h-screen ${theme.bg} transition-all duration-700 pb-20`}>
            <AnimatePresence>
                {isParsing && <LoadingOverlay message="Neural Processor Active..." />}
                {showGradeTable && <GradeScaleModal onClose={() => setShowGradeTable(false)} />}
            </AnimatePresence>

            <header className={`relative bg-linear-to-br ${theme.header} pt-8 pb-16 px-4 md:px-12 rounded-b-[3rem] border-b border-white/10 z-10`}>
                {isSyncing && <SyncIndicator />}
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <img src={user?.photoURL || `https://ui-avatars.com/api/?name=${user?.displayName}`} className="w-12 h-12 rounded-xl border border-white/20 shadow-xl" alt="P" />
                        <div>
                            <h2 className="text-xl md:text-3xl font-black italic uppercase text-white">{user?.displayName?.split(' ')[0] || 'User'}</h2>
                            <p className="text-[8px] font-bold text-cyan-400 tracking-[0.4em] uppercase opacity-70">Arctic v6.0</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-right hidden sm:block">
                            <p className="text-[9px] font-black text-white/30 uppercase tracking-[0.5em]">CGPA</p>
                            <h1 className="text-4xl font-black text-white">{cgpa}</h1>
                        </div>
                        <div className="flex flex-col gap-2">
                            <button onClick={() => setShowGradeTable(true)} className="bg-white/10 p-2 rounded-lg text-white">📊</button>
                            <button onClick={() => setShowSettings(!showSettings)} className="bg-white/10 p-2 rounded-lg text-white">⚙️</button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto -mt-8 px-2 md:px-6 relative z-20">
                <AnimatePresence>{showSettings && <SettingsPanel themes={themes} activeTheme={activeTheme} setActiveTheme={setActiveTheme} assessmentTypes={assessmentTypes} setAssessmentTypes={setAssessmentTypes} newType={newType} setNewType={setNewType} />}</AnimatePresence>

                <div className="flex flex-wrap justify-center gap-3 mb-10">
                    <button onClick={() => setShowAnalytics(!showAnalytics)} className="bg-black/60 backdrop-blur-md px-6 py-2 rounded-full text-[9px] font-black uppercase tracking-widest border border-white/10 text-white">Analytics {showAnalytics ? '✕' : '📈'}</button>
                    <button onClick={() => document.getElementById('mainPdfIn').click()} className="bg-white text-black px-6 py-2 rounded-full text-[9px] font-black uppercase tracking-widest shadow-lg">Import PDF</button>
                    <button onClick={() => onUpdate([...semesters, { id: Date.now(), name: `Semester ${semesters.length + 1}`, subjects: [] }])} className={`${theme.primary} text-white px-6 py-2 rounded-full text-[9px] font-black uppercase tracking-widest shadow-lg`}>+ Semester</button>
                    <input type="file" id="mainPdfIn" hidden onChange={handlePdfImport} accept=".pdf" />
                </div>

                <AnimatePresence>{showAnalytics && <AnalyticsChart trend={semesters.map(s => parseFloat(calculateSGPA(s.subjects)))} />}</AnimatePresence>

                <div className="space-y-10">
                    {semesters.map((sem, sIdx) => (
                        <div key={sem.id}>
                            <div className="flex items-center justify-between p-3 bg-slate-900/80 backdrop-blur-2xl border border-white/10 rounded-2xl mb-6 sticky top-4 z-30 shadow-2xl">
                                <div className="flex items-center gap-4 cursor-pointer" onClick={() => setCollapsed(p => ({ ...p, sems: p.sems.includes(sem.id) ? p.sems.filter(x => x !== sem.id) : [...p.sems, sem.id] }))}>
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-white ${theme.primary}`}>{collapsed.sems.includes(sem.id) ? '▶' : '▼'}</div>
                                    <h3 className="text-sm font-black uppercase text-white tracking-widest">{sem.name} <span className="ml-4 text-cyan-400 font-mono text-xs">{calculateSGPA(sem.subjects)} SGPA</span></h3>
                                </div>
                                <button onClick={() => onUpdate(semesters.filter(s => s.id !== sem.id))} className="text-rose-500/60 font-bold px-4 text-lg">✕</button>
                            </div>

                            {!collapsed.sems.includes(sem.id) && (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 px-1 md:px-4">
                                    {sem.subjects.map((sub, subIdx) => {
                                        const stats = getSubjectStats(sub);
                                        const isSubCollapsed = collapsed.subs.includes(sub.id);
                                        return (
                                            <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} key={sub.id} className="bg-black/30 border border-white/10 rounded-[2.5rem] p-5 hover:border-cyan-500/40 transition-all group relative overflow-hidden">
                                                <div className="flex justify-between items-center mb-6">
                                                    <div className="flex items-center gap-4 cursor-pointer" onClick={() => setCollapsed(p => ({ ...p, subs: p.subs.includes(sub.id) ? p.subs.filter(x => x !== sub.id) : [...p.subs, sub.id] }))}>
                                                        <span className="text-cyan-400 font-black text-2xl">{isSubCollapsed ? '⊕' : '⊖'}</span>
                                                        <h4 className="text-sm font-black text-white/90 uppercase italic truncate max-w-37.5 md:max-w-50">{sub.title || 'Modular Unit...'}</h4>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <label className="p-2 bg-white/5 rounded-lg border border-white/10 cursor-pointer text-sm">📸<input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageScan(e, sIdx, subIdx)} /></label>
                                                        <button onClick={() => { const n = JSON.parse(JSON.stringify(semesters)); n[sIdx].subjects.splice(subIdx, 1); onUpdate(n); }} className="p-2 text-rose-500/40 hover:text-rose-500 text-lg">✕</button>
                                                    </div>
                                                </div>

                                                {!isSubCollapsed && (
                                                    <div className="space-y-6">
                                                        <div className="flex gap-2">
                                                            <input className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white outline-none" value={sub.title} onChange={(e) => { const n = JSON.parse(JSON.stringify(semesters)); n[sIdx].subjects[subIdx].title = e.target.value; onUpdate(n); }} placeholder="Subject Name" />
                                                            <input type="number" className="w-16 bg-black/40 border border-white/10 rounded-xl px-2 py-3 text-center text-xs text-cyan-400 font-black outline-none" value={sub.ch} onChange={(e) => { const n = JSON.parse(JSON.stringify(semesters)); n[sIdx].subjects[subIdx].ch = e.target.value; onUpdate(n); }} placeholder="CH" />
                                                        </div>

                                                        <div className="flex gap-2 p-1 bg-black/40 rounded-xl">
                                                            <button className={`flex-1 py-1.5 text-[9px] font-black uppercase rounded-lg ${sub.mode !== 'assessment' ? theme.primary + ' text-white' : 'opacity-40 text-white'}`} onClick={() => { const n = JSON.parse(JSON.stringify(semesters)); n[sIdx].subjects[subIdx].mode = 'simple'; onUpdate(n); }}>Absolute Mode</button>
                                                            <button className={`flex-1 py-1.5 text-[9px] font-black uppercase rounded-lg ${sub.mode === 'assessment' ? theme.primary + ' text-white' : 'opacity-40 text-white'}`} onClick={() => { const n = JSON.parse(JSON.stringify(semesters)); n[sIdx].subjects[subIdx].mode = 'assessment'; onUpdate(n); }}>Assessment Mode</button>
                                                        </div>

                                                        {sub.mode === 'assessment' ? (
                                                            <div className="bg-black/60 rounded-2xl border border-white/10 overflow-hidden shadow-inner">
                                                                <div className="grid grid-cols-12 gap-1 px-4 py-2 text-[8px] font-black uppercase text-cyan-400/50 border-b border-white/5 tracking-widest italic bg-white/5">
                                                                    <div className="col-span-5 text-left">TYPE</div>
                                                                    <div className="col-span-2 text-center">W%</div>
                                                                    <div className="col-span-2 text-center">OBT</div>
                                                                    <div className="col-span-2 text-center">MAX</div>
                                                                </div>
                                                                <div className="divide-y divide-white/5 italic">
                                                                    {sub.assessments?.map((asm, aIdx) => (
                                                                        <div key={asm.id} className="grid grid-cols-12 gap-1 px-3 py-2 items-center hover:bg-white/2 transition-all">
                                                                            <select className="col-span-5 bg-transparent font-black text-[10px] text-white outline-none cursor-pointer" value={asm.type} onChange={(e) => { const n = JSON.parse(JSON.stringify(semesters)); n[sIdx].subjects[subIdx].assessments[aIdx].type = e.target.value; onUpdate(n); }}>{assessmentTypes.map((t, i) => <option key={i} value={t} className="bg-[#020617]">{t}</option>)}</select>
                                                                            <input type="number" className="col-span-2 bg-white/5 border border-white/5 rounded text-center text-[10px] py-1 text-white outline-none" value={asm.weight} onChange={(e) => { const n = JSON.parse(JSON.stringify(semesters)); n[sIdx].subjects[subIdx].assessments[aIdx].weight = e.target.value; onUpdate(n); }} />
                                                                            <input type="number" className="col-span-2 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded text-center text-[10px] py-1 font-black outline-none" value={asm.obt} onChange={(e) => { const n = JSON.parse(JSON.stringify(semesters)); n[sIdx].subjects[subIdx].assessments[aIdx].obt = e.target.value; onUpdate(n); }} />
                                                                            <input type="number" className="col-span-2 bg-rose-500/5 text-rose-400/80 border border-rose-500/20 rounded text-center text-[10px] py-1 font-bold outline-none" value={asm.total} onChange={(e) => { const n = JSON.parse(JSON.stringify(semesters)); n[sIdx].subjects[subIdx].assessments[aIdx].total = e.target.value; onUpdate(n); }} />
                                                                            <button onClick={() => { const n = JSON.parse(JSON.stringify(semesters)); n[sIdx].subjects[subIdx].assessments.splice(aIdx, 1); onUpdate(n); }} className="col-span-1 text-rose-500/40 hover:text-rose-500 text-right">✕</button>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                                <button className="w-full py-2 bg-white/5 text-[9px] uppercase font-black text-cyan-400 transition-all border-t border-white/5" onClick={() => { const n = JSON.parse(JSON.stringify(semesters)); if (!n[sIdx].subjects[subIdx].assessments) n[sIdx].subjects[subIdx].assessments = []; n[sIdx].subjects[subIdx].assessments.push({ id: Date.now(), type: assessmentTypes[0], weight: 10, total: 100, obt: 0 }); onUpdate(n); }}>+ Add Row</button>
                                                            </div>
                                                        ) : (
                                                            <div className="bg-black/60 rounded-3xl p-8 border-2 border-dashed border-white/10 text-center relative group">
                                                                <input type="number" className="bg-transparent font-black text-6xl text-white text-center w-full outline-none drop-shadow-[0_0_15px_rgba(34,211,238,0.4)]" value={sub.simpleObt} onChange={(e) => { const n = JSON.parse(JSON.stringify(semesters)); n[sIdx].subjects[subIdx].simpleObt = e.target.value; onUpdate(n); }} />
                                                                <p className="text-[10px] font-black text-cyan-400 uppercase mt-2 tracking-widest italic opacity-50 group-hover:opacity-100 transition-opacity">Yield %</p>
                                                            </div>
                                                        )}

                                                        <div className="flex justify-between items-center p-4 bg-linear-to-r from-black/60 to-slate-900/60 rounded-2xl border border-white/10 shadow-2xl">
                                                            <div className="text-center"><p className="text-[8px] font-black text-white/30 uppercase tracking-widest mb-1 leading-none">Yield</p><h5 className="text-2xl font-black text-white italic">{stats.score.toFixed(0)}%</h5></div>
                                                            <div className="h-10 w-px bg-white/10"></div>
                                                            <div className="text-center"><p className="text-[8px] font-black text-white/30 uppercase tracking-widest mb-1 leading-none">Grade</p><h5 className={`text-3xl font-black italic leading-none ${gradeColors[stats.gInfo?.g] || 'text-white'}`}>{stats.gInfo?.g}</h5></div>
                                                            <div className="h-10 w-px bg-white/10"></div>
                                                            <div className="text-center px-2"><p className="text-[8px] font-black text-white/30 uppercase tracking-widest mb-1 leading-none">Points</p><h5 className="text-2xl font-black text-cyan-400 font-mono tracking-tighter">{stats.gInfo?.p.toFixed(2)}</h5></div>
                                                        </div>
                                                    </div>
                                                )}
                                            </motion.div>
                                        );
                                    })}
                                    <button onClick={() => { const n = JSON.parse(JSON.stringify(semesters)); n[sIdx].subjects.push({ id: Date.now(), title: '', ch: 3, simpleObt: 0, mode: 'simple', assessments: [] }); onUpdate(n); }} className="w-full py-12 border-2 border-dashed border-cyan-500/20 bg-cyan-500/5 rounded-3xl text-cyan-400/60 font-black uppercase text-[11px] tracking-[1em] hover:text-cyan-400 transition-all">+ REGISTER UNIT</button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                <div className="flex flex-col items-center mt-20 space-y-8 pb-32">
                    <motion.button whileHover={{ scale: 1.05 }} onClick={() => window.print()} className="bg-cyan-500 text-black w-full max-w-2xl py-6 rounded-[2.5rem] font-black shadow-[0_15px_40px_rgba(34,211,238,0.4)] text-2xl tracking-widest uppercase italic border-t-4 border-white/30">🖨️ Generate Report</motion.button>
                    <button onClick={() => auth.signOut()} className="text-white/20 hover:text-rose-500 transition-colors font-black text-[9px] tracking-[1em] uppercase">TERMINATE SESSION</button>
                </div>
            </main>
        </div>
    );
};

// --- SLEEK ATOMIC COMPONENTS ---

const HeaderBtn = ({ icon, onClick }) => (
    <button onClick={onClick} className="bg-white/10 p-3 rounded-2xl backdrop-blur-3xl border border-white/20 text-white text-lg hover:bg-cyan-500/20 active:scale-90 transition-all">{icon}</button>
);

const SettingsPanel = ({ themes, activeTheme, setActiveTheme, assessmentTypes, setAssessmentTypes, newType, setNewType }) => (
    <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="bg-slate-900 border-2 border-white/10 p-6 rounded-3xl mb-10 shadow-2xl z-40 relative">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div>
                <h3 className="text-[10px] font-black uppercase text-cyan-400 mb-4 tracking-widest">Aesthetics</h3>
                <div className="grid grid-cols-2 gap-3">
                    {Object.values(themes).map(t => (
                        <button key={t.id} onClick={() => { setActiveTheme(t.id); localStorage.setItem('userTheme', t.id); }} className={`h-12 rounded-xl border-2 transition-all ${activeTheme === t.id ? 'border-cyan-400 bg-cyan-400/10' : 'border-white/5 opacity-40'}`}>
                            <div className="text-[8px] font-black uppercase text-white">{t.name}</div>
                        </button>
                    ))}
                </div>
            </div>
            <div>
                <h3 className="text-[10px] font-black uppercase text-cyan-400 mb-4 tracking-widest">Assessment Schema</h3>
                <div className="space-y-2 max-h-40 overflow-y-auto mb-4 pr-2 custom-scrollbar">
                    {assessmentTypes.map((type, i) => (
                        <div key={i} className="flex gap-2 items-center bg-black/40 p-2 rounded-xl border border-white/5">
                            <input className="flex-1 bg-transparent text-[10px] font-bold text-white outline-none" value={type} onChange={(e) => { const n = [...assessmentTypes]; n[i] = e.target.value; setAssessmentTypes(n); }} />
                            <button onClick={() => setAssessmentTypes(assessmentTypes.filter((_, idx) => idx !== i))} className="text-rose-500 text-xs px-2">✕</button>
                        </div>
                    ))}
                </div>
                <div className="flex gap-2 p-1.5 bg-black/60 rounded-xl border border-cyan-500/20">
                    <input className="bg-transparent px-4 py-2 text-[10px] w-full text-white outline-none" placeholder="Register unique key..." value={newType} onChange={(e) => setNewType(e.target.value)} />
                    <button onClick={() => { if (newType) { setAssessmentTypes([...assessmentTypes, newType]); setNewType(""); } }} className="px-6 py-2 bg-cyan-500 text-black rounded-lg text-[10px] font-black uppercase">Add</button>
                </div>
            </div>
        </div>
    </motion.div>
);

const GradeScaleModal = ({ onClose }) => (
    <div className="fixed inset-0 z-2000 flex items-center justify-center p-6 bg-slate-950/95 backdrop-blur-2xl">
        <div className="bg-[#020617] w-full max-w-[320px] rounded-3xl border-2 border-white/20 overflow-hidden shadow-2xl shadow-cyan-500/20">
            <div className="bg-cyan-500 p-5 flex justify-between items-center"><span className="font-black text-xs text-black tracking-widest">METRICS</span><button onClick={onClose} className="text-black font-black text-lg">✕</button></div>
            <div className="p-4 space-y-1 italic">
                {[["85-100", "A", "4.00"], ["80-84", "A-", "3.66"], ["75-79", "B+", "3.33"], ["71-74", "B", "3.00"], ["Below 50", "F", "0.00"]].map(([r, g, p], i) => (
                    <div key={i} className="flex justify-between py-2 px-4 text-[10px] font-black text-white/60 hover:bg-white/5 rounded-xl border-b border-white/5 last:border-0 group">
                        <span className="group-hover:text-cyan-400 transition-colors">{r} Scale</span><span className="text-cyan-400 text-sm font-black italic">{g}</span><span className="font-mono text-white/40">{p}</span>
                    </div>
                ))}
            </div>
        </div>
    </div>
);

const LoadingOverlay = ({ message }) => (
    <div className="fixed inset-0 z-3000 bg-[#020617]/98 backdrop-blur-3xl flex flex-col items-center justify-center">
        <div className="w-16 h-16 border-t-4 border-cyan-500 rounded-full animate-spin mb-10 shadow-[0_0_20px_#22d3ee]"></div>
        <h3 className="font-black uppercase tracking-[0.5em] text-[11px] animate-pulse text-cyan-400 italic text-center">{message}</h3>
    </div>
);

const SyncIndicator = () => (
    <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-cyan-500 text-black px-5 py-1 rounded-full text-[9px] font-black uppercase animate-pulse shadow-[0_0_15px_#22d3ee] z-50">Link Synchronized</div>
);

const AnalyticsChart = ({ trend }) => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-black/60 p-8 rounded-[3rem] mb-12 border border-white/10 shadow-inner relative overflow-hidden">
        <h3 className="text-[10px] font-black text-cyan-400 mb-8 tracking-[1em] uppercase text-center italic opacity-60">Phase Trajectory Matrix</h3>
        <div className="h-32 w-full relative flex items-end justify-between px-6 border-b border-white/10 pb-2">
            <svg className="absolute inset-0 w-full h-full px-6 pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                <polyline fill="none" stroke="#22d3ee" strokeWidth="4" strokeLinecap="round" points={trend.length > 1 ? trend.map((val, i) => `${(i / (trend.length - 1)) * 100},${100 - (val / 4) * 100}`).join(' ') : "0,50 100,50"} className="drop-shadow-[0_0_10px_#22d3ee]" />
            </svg>
            {trend.map((val, i) => (
                <div key={i} className="flex flex-col items-center z-10 text-[10px] font-black text-cyan-400 font-mono">
                    <div className="w-2 h-2 rounded-full bg-cyan-500 mb-1 border border-black shadow-[0_0_10px_#22d3ee]"></div>
                    {val}
                </div>
            ))}
        </div>
    </motion.div>
);

export default Dashboard;