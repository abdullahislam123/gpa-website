import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Tesseract from 'tesseract.js'; // Added for OCR
import { auth, db } from '../services/firebase';
import { parseSuperiorTranscript, calculateGrade } from '../services/pdfParser';

// Animation Variants
const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.08 } } };
const itemVariants = { hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 260, damping: 20 } } };
const modalVariants = { hidden: { opacity: 0, scale: 0.9, y: 40 }, visible: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 25 } }, exit: { opacity: 0, scale: 0.9, y: 20 } };

const Dashboard = ({ user, semesters, onUpdate }) => {
    const [collapsed, setCollapsed] = useState({ sems: [], subs: [] });
    const [showSettings, setShowSettings] = useState(false);
    const [showInstructions, setShowInstructions] = useState(false);
    const [showGradeTable, setShowGradeTable] = useState(false);
    const [showAnalytics, setShowAnalytics] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isParsing, setIsParsing] = useState(false); // Used for both PDF and Image

    // --- 1. FIREBASE LOAD/SAVE LOGIC ---
    useEffect(() => {
        const fetchUserData = async () => {
            if (user?.uid) {
                try {
                    const doc = await db.collection('users').doc(user.uid).get();
                    if (doc.exists && doc.data().semesters) onUpdate(doc.data().semesters);
                } catch (err) { console.error("Firebase Load Error:", err); }
            }
        };
        const hasSeenGuide = localStorage.getItem('hasSeenAcademicGuideV5');
        if (!hasSeenGuide) setTimeout(() => setShowInstructions(true), 500);
        fetchUserData();
    }, [user?.uid]);

    useEffect(() => {
        const saveToCloud = async () => {
            if (user?.uid && semesters.length > 0) {
                setIsSyncing(true);
                try {
                    await db.collection('users').doc(user.uid).set({ semesters, lastUpdated: new Date().toISOString() }, { merge: true });
                    setTimeout(() => setIsSyncing(false), 1500);
                } catch (err) { setIsSyncing(false); }
            }
        };
        const timer = setTimeout(() => saveToCloud(), 3000);
        return () => clearTimeout(timer);
    }, [semesters, user?.uid]);

    // Assessment Logic
    const [assessmentTypes, setAssessmentTypes] = useState(['Quiz', 'Assignment', 'Mid Exam', 'Final Exam', 'Project', 'Viva', 'Class participation', 'Others']);
    const [newType, setNewType] = useState("");

    const addType = () => {
        if (newType.trim() && !assessmentTypes.includes(newType.trim())) {
            setAssessmentTypes([...assessmentTypes, newType.trim()]);
            setNewType("");
        }
    };

    const updateType = (index, newValue) => {
        const updated = [...assessmentTypes];
        updated[index] = newValue;
        setAssessmentTypes(updated);
    };

    const toggleCollapse = (type, id) => {
        setCollapsed(prev => ({
            ...prev,
            [type]: prev[type].includes(id) ? prev[type].filter(item => item !== id) : [...prev[type], id]
        }));
    };

    // --- 2. SMART OCR SCANNER (For Assessment Images) ---
    const handleImageScan = async (e, sIdx, subIdx) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsParsing(true);
        try {
            const { data: { text } } = await Tesseract.recognize(file, 'eng');
            console.log("OCR Extracted Text:", text); // Debugging ke liye

            const lines = text.split('\n');
            const newAssessments = [];

            // Pattern: [Any Text] [Numbers for Weight] [Numbers for Max] [Numbers for Obt]
            // Yeh Regex Quiz 1, Quiz 2 wagera ko bhi support karega
            const rowRegex = /(.+?)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)$/;

            lines.forEach(line => {
                // Garbage characters aur lines ko saaf karna
                const cleanLine = line.replace(/[|_]/g, ' ').replace(/\s+/g, ' ').trim();
                const match = cleanLine.match(rowRegex);
                
                if (match) {
                    const name = match[1].trim();
                    const weight = parseFloat(match[2].replace(',', '.'));
                    const max = parseFloat(match[3].replace(',', '.'));
                    const obt = parseFloat(match[4].replace(',', '.'));

                    // Header labels ko filter karna taake ghalti se data mein na aayein
                    const isHeader = /Assessment|Weightage|Max|Obtained|Total|Mark/i.test(name);
                    
                    if (!isHeader && !isNaN(weight) && !isNaN(max) && !isNaN(obt)) {
                        newAssessments.push({
                            id: Date.now() + Math.random(),
                            type: name,
                            weight: weight,
                            total: max,
                            obt: obt
                        });
                    }
                }
            });

            if (newAssessments.length > 0) {
                const n = [...semesters];
                n[sIdx].subjects[subIdx].mode = 'assessment';
                n[sIdx].subjects[subIdx].assessments = [...(n[sIdx].subjects[subIdx].assessments || []), ...newAssessments];
                onUpdate(n);
            } else {
                alert("Could not detect marks table. Please use a clear crop of the table area.");
            }
        } catch (err) {
            alert("Scanner error. Please try again.");
        } finally {
            setIsParsing(false);
            e.target.value = null; 
        }
    };

    // --- 3. PDF IMPORT HANDLER ---
    const handlePdfImport = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setIsParsing(true);
        try {
            const data = await parseSuperiorTranscript(file);
            onUpdate([...semesters, ...data]);
        } catch (err) { alert("PDF format incorrect."); }
        finally { setIsParsing(false); e.target.value = null; }
    };

    // --- Math Engine & Predictor ---
    const getSubjectStats = (sub) => {
        let score = 0, weight = 0;
        if (sub?.mode === 'assessment' && sub?.assessments?.length > 0) {
            sub.assessments.forEach(a => {
                const w = parseFloat(a.weight) || 0;
                const tot = parseFloat(a.total) || 1;
                weight += w;
                score += ((parseFloat(a.obt) || 0) / tot) * w;
            });
        } else { score = parseFloat(sub?.simpleObt) || 0; weight = 100; }
        
        const gInfo = calculateGrade(score) || { g: 'F', p: 0.0 };
        // 85%+ = 4.00 Grade A
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
    const gpaTrend = semesters.map(s => parseFloat(calculateSGPA(s.subjects)));
    const cgpa = (semesters.reduce((acc, s) => acc + s.subjects.reduce((a, sub) => a + (getSubjectStats(sub).gInfo.p * (parseFloat(sub.ch) || 0)), 0), 0) / (totalCH || 1)).toFixed(2);

    return (
        <div className="min-h-screen bg-[#F1F5F9] pb-10 font-sans text-slate-900 overflow-x-hidden relative">
            <AnimatePresence>
                {isParsing && <LoadingOverlay message="Parsing Document..." />}
                {showInstructions && <OnboardingModal onClose={() => { localStorage.setItem('hasSeenAcademicGuideV5', 'true'); setShowInstructions(false); }} />}
                {showGradeTable && <GradeScaleModal onClose={() => setShowGradeTable(false)} />}
            </AnimatePresence>

            <header className="bg-linear-to-br from-[#0F172A] via-[#312E81] to-[#4338CA] pt-10 pb-32 px-4 md:px-6 rounded-b-[4rem] shadow-2xl text-white relative overflow-hidden">
                {isSyncing && <SyncIndicator />}
                <div className="absolute top-6 right-6 md:top-10 md:right-10 flex gap-3 z-50">
                    <HeaderBtn icon="📊" onClick={() => setShowGradeTable(true)} />
                    <HeaderBtn icon="⚙️" onClick={() => setShowSettings(!showSettings)} />
                </div>
                <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-10 relative z-10">
                    <div className="flex flex-col md:flex-row items-center gap-6">
                        <motion.img whileHover={{ scale: 1.05 }} src={user?.photoURL || `https://ui-avatars.com/api/?name=${user?.displayName}`} className="w-20 h-20 md:w-28 md:h-28 rounded-4xl border-4 border-white/10 shadow-2xl" alt="Profile" />
                        <div><h2 className="text-3xl md:text-5xl font-black tracking-tight uppercase italic">{user?.displayName || 'Student'}</h2><p className="text-indigo-200/60 text-xs md:text-sm font-bold tracking-[0.2em] mt-2 uppercase">{user?.email}</p></div>
                    </div>
                    <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white/5 backdrop-blur-3xl border p-8 rounded-[3rem] text-center min-w-60 md:min-w-[320px] shadow-inner border-b-4 border-indigo-500/30">
                        <span className="text-[10px] md:text-[12px] font-black tracking-[0.4em] uppercase opacity-40">Cumulative GPA</span>
                        <h1 className="text-7xl md:text-9xl font-black text-indigo-100 tracking-tighter">{cgpa}</h1>
                        <p className="text-[11px] font-bold opacity-50 uppercase tracking-widest">Total Credits: {totalCH}</p>
                    </motion.div>
                </div>
                <div className="absolute top-0 left-0 w-64 h-64 bg-white/5 rounded-full -ml-32 -mt-32 blur-3xl"></div>
            </header>

            <main className="max-w-6xl mx-auto -mt-16 md:-mt-20 px-4 md:px-6 relative z-10">
                <AnimatePresence>
                    {showSettings && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="bg-indigo-950 text-white p-6 md:p-10 rounded-[3rem] mb-12 shadow-2xl border border-indigo-800 overflow-hidden">
                            <h3 className="font-black uppercase tracking-[0.3em] text-xs text-indigo-400 mb-8">Component Editor</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
                                {assessmentTypes.map((type, tIdx) => (
                                    <div key={tIdx} className="bg-indigo-900/50 p-2 pl-4 rounded-2xl flex items-center gap-2 border border-indigo-800">
                                        <input className="bg-transparent border-none text-xs font-bold w-full text-white outline-none" value={type} onChange={(e) => updateType(tIdx, e.target.value)} />
                                        <button onClick={() => setAssessmentTypes(assessmentTypes.filter(t => t !== type))} className="bg-indigo-800 text-red-400 p-2 rounded-xl">✕</button>
                                    </div>
                                ))}
                            </div>
                            <div className="flex gap-4 max-w-md bg-[#020617] p-2 rounded-3xl border border-indigo-800"><input className="bg-transparent px-6 py-2 text-sm w-full outline-none text-white" placeholder="Add custom type..." value={newType} onChange={(e) => setNewType(e.target.value)} /><button onClick={addType} className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black text-xs uppercase">Add</button></div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="flex justify-center mb-10"><button onClick={() => setShowAnalytics(!showAnalytics)} className="bg-white/80 px-8 py-3 rounded-full text-[11px] font-black uppercase tracking-widest shadow-lg border border-slate-200 hover:bg-white transition-all">{showAnalytics ? 'Hide Analytics' : 'Performance Analytics 📈'}</button></div>
                <AnimatePresence>{showAnalytics && <AnalyticsChart trend={gpaTrend} />}</AnimatePresence>

                <div className="flex flex-col sm:flex-row justify-center gap-5 mb-20 px-4">
                    <motion.button whileHover={{ scale: 1.05 }} onClick={() => document.getElementById('mainPdfIn').click()} className="bg-white text-indigo-900 px-12 py-5 rounded-2xl font-black shadow-xl border border-slate-200 uppercase text-xs tracking-widest">📂 Import PDF</motion.button>
                    <motion.button whileHover={{ scale: 1.05 }} onClick={() => onUpdate([...semesters, { id: Date.now(), name: `Semester ${semesters.length + 1}`, subjects: [] }])} className="bg-indigo-600 text-white px-12 py-5 rounded-2xl font-black shadow-xl uppercase text-xs tracking-widest">+ Add Manual Semester</motion.button>
                    <input type="file" id="mainPdfIn" hidden onChange={handlePdfImport} accept=".pdf" />
                </div>

                <AnimatePresence mode="popLayout">
                    {semesters.map((sem, sIdx) => {
                        const semSGPA = calculateSGPA(sem.subjects);
                        return (
                            <motion.div layout key={sem.id} className="mb-12">
                                <div className={`flex items-center gap-4 p-5 md:p-7 rounded-[2.5rem] shadow-xl border sticky top-4 z-20 transition-all ${collapsed.sems.includes(sem.id) ? 'bg-[#0F172A] text-white' : 'bg-white'}`}>
                                    <div className="flex items-center grow cursor-pointer" onClick={() => toggleCollapse('sems', sem.id)}>
                                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-black bg-indigo-600 text-white shadow-lg mr-4">{collapsed.sems.includes(sem.id) ? '▶' : '▼'}</div>
                                        <span className="font-black uppercase tracking-widest text-lg">{sem.name}</span>
                                        <span className="ml-6 bg-indigo-50 text-indigo-700 px-5 py-2 rounded-full text-xs font-black">SGPA: {semSGPA}</span>
                                    </div>
                                    <button onClick={() => onUpdate(semesters.filter(s => s.id !== sem.id))} className="text-red-400 p-2 mr-2 transition-all">✕</button>
                                </div>

                                {!collapsed.sems.includes(sem.id) && (
                                    <div className="mt-8 space-y-8 px-2 md:px-8">
                                        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
                                            {sem.subjects.map((sub, subIdx) => {
                                                const stats = getSubjectStats(sub);
                                                const isSubCollapsed = collapsed.subs.includes(sub.id);
                                                return (
                                                    <motion.div layout variants={itemVariants} key={sub.id} className={`bg-white border-2 rounded-[3rem] p-6 md:p-10 shadow-sm transition-all relative ${isSubCollapsed ? 'border-slate-100 opacity-90 scale-[0.99]' : 'border-white hover:border-indigo-400'}`}>
                                                        <div className="flex justify-between items-center">
                                                            <div className="flex items-center gap-6 cursor-pointer grow" onClick={() => toggleCollapse('subs', sub.id)}>
                                                                 <motion.span animate={{ rotate: isSubCollapsed ? 0 : 45 }} className="text-indigo-600 font-black text-4xl">⊕</motion.span>
                                                                 <div><h3 className={`font-black uppercase text-sm md:text-xl tracking-tight transition-colors italic ${isSubCollapsed ? 'text-slate-400' : 'text-slate-900'}`}>{sub.title || 'Course Title...'}</h3>{isSubCollapsed && <SummaryBadge stats={stats} />}</div>
                                                            </div>
                                                            {!isSubCollapsed && stats.neededForA !== null && stats.neededForA <= 100 && (
                                                                <div className="hidden lg:flex flex-col items-end mr-6 bg-amber-50 px-4 py-2 rounded-2xl border border-amber-100 animate-pulse"><span className="text-[9px] font-black text-amber-500 uppercase tracking-widest">Target A</span><span className="text-sm font-black text-amber-700">Need {stats.neededForA.toFixed(0)}% more</span></div>
                                                            )}
                                                            <div className="flex gap-3">
                                                                <label className="cursor-pointer bg-indigo-50 hover:bg-indigo-100 text-indigo-600 px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-indigo-100 flex items-center gap-2 shadow-sm">
                                                                    📷 Scan Image
                                                                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageScan(e, sIdx, subIdx)} />
                                                                </label>
                                                                <button onClick={() => { const n = [...semesters]; n[sIdx].subjects.splice(subIdx, 1); onUpdate(n); }} className="bg-slate-50 text-slate-300 w-12 h-12 rounded-2xl hover:bg-red-500 hover:text-white transition-all shadow-inner">✕</button>
                                                            </div>
                                                        </div>

                                                        {!isSubCollapsed && (
                                                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-10 pt-10 border-t border-slate-100 grid grid-cols-1 lg:grid-cols-4 gap-12 animate-in fade-in slide-in-from-top-4 duration-500">
                                                                <div className="lg:col-span-3 space-y-10">
                                                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                                                        <div className="md:col-span-3"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Name</label><input className="w-full bg-slate-50 border-2 border-slate-100 rounded-3xl px-8 py-5 outline-none font-bold text-lg focus:border-indigo-600 transition-all" value={sub.title} onChange={(e) => { const n = [...semesters]; n[sIdx].subjects[subIdx].title = e.target.value; onUpdate(n); }} /></div>
                                                                        <div className="md:col-span-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block text-center">CH</label><input type="number" className="w-full bg-slate-50 border-2 border-slate-100 rounded-3xl px-8 py-5 text-center font-black text-2xl outline-none focus:border-indigo-600 transition-all" value={sub.ch} onChange={(e) => { const n = [...semesters]; n[sIdx].subjects[subIdx].ch = e.target.value; onUpdate(n); }} /></div>
                                                                    </div>
                                                                    <div className="inline-flex bg-slate-100 p-2 rounded-full border border-slate-200 shadow-inner">
                                                                        <button className={`px-12 py-3 rounded-full text-[10px] font-black ${sub.mode !== 'assessment' ? 'bg-white shadow-xl text-indigo-600' : 'text-slate-400'}`} onClick={() => { const n = [...semesters]; n[sIdx].subjects[subIdx].mode = 'simple'; onUpdate(n); }}>SIMPLE MODE</button>
                                                                        <button className={`px-12 py-3 rounded-full text-[10px] font-black ${sub.mode === 'assessment' ? 'bg-white shadow-xl text-indigo-600' : 'text-slate-400'}`} onClick={() => { const n = [...semesters]; n[sIdx].subjects[subIdx].mode = 'assessment'; onUpdate(n); }}>ADVANCED MODE</button>
                                                                    </div>
                                                                    <div className="mt-8">
                                                                        {sub.mode === 'assessment' ? (
                                                                            <div className="space-y-4">
                                                                                {sub.assessments?.map((asm, aIdx) => (
                                                                                    <div key={asm.id} className="grid grid-cols-2 md:grid-cols-12 gap-4 p-5 bg-slate-50 rounded-3xl items-center border border-slate-100 hover:bg-white transition-all shadow-sm">
                                                                                        <div className="col-span-2 md:col-span-4"><select className="w-full bg-white border border-slate-200 rounded-2xl p-4 font-bold text-xs focus:border-indigo-600 shadow-inner outline-none appearance-none" value={asm.type} onChange={(e) => { const n = [...semesters]; n[sIdx].subjects[subIdx].assessments[aIdx].type = e.target.value; onUpdate(n); }}>{assessmentTypes.map((t, i) => <option key={i} value={t}>{t}</option>)}</select></div>
                                                                                        <div className="md:col-span-2"><input type="number" className="w-full p-4 text-xs text-center font-black rounded-2xl border border-slate-200 shadow-inner outline-none focus:border-indigo-500" value={asm.weight} placeholder="W%" onChange={(e) => { const n = [...semesters]; n[sIdx].subjects[subIdx].assessments[aIdx].weight = e.target.value; onUpdate(n); }} /></div>
                                                                                        <div className="md:col-span-2"><input type="number" className="w-full p-4 text-xs text-center font-black rounded-2xl border border-slate-200 shadow-inner outline-none focus:border-indigo-500" value={asm.total} placeholder="Max" onChange={(e) => { const n = [...semesters]; n[sIdx].subjects[subIdx].assessments[aIdx].total = e.target.value; onUpdate(n); }} /></div>
                                                                                        <div className="md:col-span-2"><input type="number" className="w-full p-4 text-xs text-center font-black rounded-2xl bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-inner outline-none focus:ring-4 focus:ring-indigo-100" value={asm.obt} placeholder="Score" onChange={(e) => { const n = [...semesters]; n[sIdx].subjects[subIdx].assessments[aIdx].obt = e.target.value; onUpdate(n); }} /></div>
                                                                                        <button className="text-red-400 font-bold hover:text-red-600 text-[10px] uppercase flex justify-end" onClick={() => { const n = [...semesters]; n[sIdx].subjects[subIdx].assessments.splice(aIdx, 1); onUpdate(n); }}>✕</button>
                                                                                    </div>
                                                                                ))}
                                                                                <button className="w-full py-6 border-2 border-dashed border-slate-200 rounded-[2.5rem] text-slate-400 text-[10px] font-black hover:border-indigo-500 hover:text-indigo-600 transition-all uppercase tracking-widest" onClick={() => { const n = [...semesters]; if(!n[sIdx].subjects[subIdx].assessments) n[sIdx].subjects[subIdx].assessments = []; n[sIdx].subjects[subIdx].assessments.push({id: Date.now(), type: assessmentTypes[0], weight:10, total:100, obt:0}); onUpdate(n); }}>+ Link Performance Component</button>
                                                                            </div>
                                                                        ) : (
                                                                            <div className="p-16 bg-indigo-50/40 rounded-[4rem] border-2 border-dashed border-indigo-200 text-center shadow-inner"><label className="text-[11px] font-black text-indigo-400 uppercase tracking-[0.5em] mb-8 block italic">Input Total Percentage (0-100)</label><input type="number" className="w-full max-w-xs bg-white border-2 border-indigo-200 rounded-[2.5rem] px-8 py-10 font-black text-7xl text-center text-indigo-700 focus:ring-8 focus:ring-indigo-100 transition-all shadow-2xl" value={sub.simpleObt} onChange={(e) => { const n = [...semesters]; n[sIdx].subjects[subIdx].simpleObt = e.target.value; onUpdate(n); }} /></div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <ResultBox stats={stats} />
                                                            </motion.div>
                                                        )}
                                                    </motion.div>
                                                );
                                            })}
                                        </motion.div>
                                        <button onClick={() => { const n = [...semesters]; n[sIdx].subjects.push({id: Date.now(), title: '', ch: 3, simpleObt: 0, mode: 'simple', assessments: []}); onUpdate(n); }} className="w-full py-10 border-2 border-dashed border-slate-200 rounded-[4rem] text-slate-300 font-black hover:text-indigo-600 uppercase text-xs tracking-widest transition-all shadow-md">+ Add Subject to {sem.name}</button>
                                    </div>
                                )}
                            </motion.div>
                        );
                    })}
                </AnimatePresence>

                <div className="flex flex-col items-center mt-32 space-y-12 pb-20">
                    <button onClick={() => window.print()} className="bg-[#0F172A] text-white px-20 py-8 rounded-[4rem] font-black shadow-2xl w-full max-w-3xl text-xl uppercase hover:scale-105 active:scale-95 shadow-indigo-900/40 tracking-widest italic">🖨️ Export PDF Transcript</button>
                    <button onClick={() => auth.signOut()} className="text-slate-400 font-bold hover:text-red-500 uppercase text-[10px] tracking-widest transition-colors">Terminate session</button>
                </div>
            </main>
        </div>
    );
};

// --- HELPER SUB-COMPONENTS ---
const HeaderBtn = ({ icon, onClick }) => (
    <motion.button whileHover={{ scale: 1.1 }} onClick={onClick} className="bg-white/10 hover:bg-white/20 p-3 rounded-2xl backdrop-blur-md border border-white/10 shadow-xl">{icon}</motion.button>
);

const SyncIndicator = () => (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-indigo-500/20 px-4 py-1.5 rounded-full text-[10px] font-black uppercase border border-white/10 animate-pulse z-50">Syncing to cloud...</div>
);

const LoadingOverlay = ({ message }) => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-400 bg-indigo-950/70 backdrop-blur-md flex flex-col items-center justify-center text-white">
        <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin mb-4"></div>
        <h3 className="font-black uppercase tracking-widest text-sm italic">{message}</h3>
    </motion.div>
);

const SummaryBadge = ({ stats }) => (
    <div className="flex gap-2 mt-2">
        <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg">Score: {stats.score.toFixed(0)}%</span>
        <span className="text-[10px] font-black text-white bg-indigo-600 px-3 py-1 rounded-lg uppercase">{stats.gInfo?.g} ({stats.gInfo?.p.toFixed(2)})</span>
    </div>
);

const ResultBox = ({ stats }) => (
    <div className="lg:col-span-1 bg-[#0F172A] text-white rounded-[4rem] p-12 flex flex-col items-center justify-center text-center shadow-2xl h-full border-t-12 border-indigo-600 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/10 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700"></div>
        <span className="text-[11px] font-black opacity-30 uppercase tracking-[0.5em] mb-4 block italic">Yield</span>
        <div className="text-8xl font-black mb-8 tracking-tighter text-indigo-100">{(stats.score || 0).toFixed(0)}<span className="text-3xl opacity-40">%</span></div>
        <div className="bg-indigo-600 w-full py-6 rounded-4xl font-black text-5xl shadow-xl shadow-indigo-900/50">{stats.gInfo?.g}</div>
        <p className="mt-8 text-xs font-bold text-indigo-300 uppercase tracking-widest opacity-60">Grade Points: {(stats.gInfo?.p || 0.0).toFixed(2)}</p>
    </div>
);

const AnalyticsChart = ({ trend }) => (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="bg-white p-10 rounded-[4rem] mb-12 shadow-2xl border border-slate-100 text-center overflow-x-auto custom-scrollbar">
        <h3 className="font-black uppercase text-xs text-slate-400 mb-12 italic tracking-[0.4em]">Performance Analytics (SGPA Trend)</h3>
        <div className="h-64 w-full min-w-125 relative flex items-end justify-between px-16 border-b-2 border-slate-100 pb-2">
            <svg className="absolute inset-0 w-full h-full px-16 pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                <polyline fill="none" stroke="#4F46E5" strokeWidth="3" points={trend.length > 1 ? trend.map((val, i) => `${(i / (trend.length - 1)) * 100},${100 - (val / 4) * 100}`).join(' ') : "0,50 100,50"} />
            </svg>
            {trend.map((val, i) => (
                <div key={i} className="flex flex-col items-center z-10 relative group">
                    <div className="bg-indigo-600 w-5 h-5 rounded-full mb-3 shadow-xl ring-4 ring-indigo-50"></div>
                    <span className="text-base font-black text-slate-900">{val}</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase mt-2">Sem {i+1}</span>
                </div>
            ))}
        </div>
    </motion.div>
);

const GradeScaleModal = ({ onClose }) => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-300 flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-sm">
        <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden border border-slate-700">
            <div className="bg-slate-900 p-6 text-white flex justify-between items-center"><h3 className="font-black uppercase tracking-widest text-xs italic">Superior Standard</h3><button onClick={onClose} className="text-slate-400 hover:text-white transition-all">✕</button></div>
            <div className="p-8 space-y-2">{[ ["85-100", "A", "4.00"], ["80-84", "A-", "3.66"], ["75-79", "B+", "3.33"], ["71-74", "B", "3.00"], ["68-70", "B-", "2.66"], ["64-67", "C+", "2.33"], ["61-63", "C", "2.00"], ["58-60", "C-", "1.66"], ["Below 50", "F", "0.00"] ].map(([r, g, p], i) => (<div key={i} className="flex justify-between py-2 border-b border-slate-50 last:border-0 items-center"><span className="text-[10px] font-black text-slate-400 uppercase">{r}</span><span className={`text-sm font-black ${g === 'A' ? 'text-indigo-600' : 'text-slate-900'}`}>{g}</span><span className="font-mono font-bold text-slate-400">{p}</span></div>))}</div>
        </motion.div>
    </motion.div>
);

const OnboardingModal = ({ onClose }) => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-300 flex items-center justify-center p-4 bg-indigo-950/80 backdrop-blur-md">
        <motion.div initial={{ y: 50 }} animate={{ y: 0 }} className="bg-white w-full max-w-2xl rounded-[4rem] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col border border-white/10">
            <div className="bg-indigo-600 p-10 text-white"><h2 className="text-4xl font-black uppercase italic tracking-tighter">A to Z Guide</h2><p className="text-indigo-100 text-sm opacity-80 uppercase tracking-[0.2em] mt-2">Professional Academic Ecosystem</p></div>
            <div className="p-10 md:p-14 space-y-12 overflow-y-auto grow custom-scrollbar">
                <GuideStep icon="☁️" title="Cloud Persistence" desc="Data is auto-synced to Firestore. Refresh or switch devices without losing a single mark." />
                <GuideStep icon="📉" title="Grade Predictor" desc="Amber alerts show exactly what score you need in finals to secure a 4.00 Grade A result." />
                <GuideStep icon="📷" title="OCR Smart Scan" desc="Snap your marks table and upload to auto-fill assessments. Zero manual typing required." />
                <GuideStep icon="📊" title="GPA Trendline" desc="Interactive visual analytics track your performance across all semesters dynamically." />
            </div>
            <div className="p-10 border-t border-slate-100 flex justify-center bg-slate-50"><button onClick={onClose} className="bg-indigo-600 text-white px-16 py-5 rounded-3xl font-black uppercase tracking-[0.2em] text-xs shadow-2xl hover:bg-indigo-700 transition-all active:scale-95">Enter Dashboard</button></div>
        </motion.div>
    </motion.div>
);

const GuideStep = ({ icon, title, desc }) => (
    <div className="flex gap-8 items-start group">
        <div className="bg-indigo-50 text-indigo-600 w-20 h-20 rounded-4xl flex items-center justify-center text-4xl shrink-0 border border-indigo-100 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-xl">{icon}</div>
        <div className="pt-2"><h4 className="font-black text-slate-800 uppercase text-lg tracking-widest mb-1 italic">{title}</h4><p className="text-slate-500 text-sm leading-relaxed font-medium">{desc}</p></div>
    </div>
);

// Helper function for Scan integration inside Dashboard
const scanImageForMarks = async (file) => {
    const { data: { text } } = await Tesseract.recognize(file, 'eng');
    const lines = text.split('\n');
    const results = [];
    lines.forEach(line => {
        const match = line.match(/([A-Za-z\s-]+)\s+(\d+\.?\d*)\s+(\d+\.?\d*)\s+(\d+\.?\d*)/);
        if (match && !line.toLowerCase().includes('weightage')) {
            results.push({ total: match[3], obtained: match[4], type: match[1].trim(), weight: match[2] });
        }
    });
    return results;
};

export default Dashboard;