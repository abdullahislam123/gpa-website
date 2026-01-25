import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { auth, db } from '../services/firebase';
import { calculateGrade } from '../services/pdfParser';

const themes = {
    professional: {
        id: 'professional', name: 'Daylight Pro', primary: 'bg-indigo-600', text: 'text-indigo-600',
        border: 'border-slate-200', header: 'from-white via-slate-50 to-indigo-50',
        accent: 'bg-indigo-50', bg: 'bg-slate-50', card: 'bg-white'
    },
    minimal: {
        id: 'minimal', name: 'Minimal Soft', primary: 'bg-emerald-500', text: 'text-emerald-600',
        border: 'border-slate-100', header: 'from-white to-emerald-50',
        accent: 'bg-emerald-50', bg: 'bg-white', card: 'bg-slate-50'
    }
};

const gradeColors = {
    'A': 'text-emerald-600 font-bold', 'A-': 'text-teal-600', 'B+': 'text-blue-600',
    'F': 'text-rose-600 animate-pulse font-black', 'default': 'text-slate-500'
};

const Dashboard = ({ user, semesters, onUpdate }) => {
    const [showSettings, setShowSettings] = useState(false);
    const [showGradeTable, setShowGradeTable] = useState(false);
    const [showAnalytics, setShowAnalytics] = useState(false);
    const [collapsedSems, setCollapsedSems] = useState([]); // Tracking collapsed semesters
    const [assessmentTypes] = useState(['Quiz', 'Assignment', 'Mid Exam', 'Final Exam', 'Project', 'Viva', 'Others']);
    
    const [activeTheme, setActiveTheme] = useState(localStorage.getItem('userTheme') || 'professional');
    const theme = themes[activeTheme] || themes.professional;

    // --- GPA Logic ---
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
        return {
            sgpa: sgpa.toFixed(2),
            ch: ch,
            grade: calculateGrade((sgpa / 4) * 100).g
        };
    };

    const toggleSemester = (id) => {
        setCollapsedSems(prev => 
            prev.includes(id) ? prev.filter(sId => sId !== id) : [...prev, id]
        );
    };

    const totalCH = semesters.reduce((acc, s) => acc + s.subjects.reduce((a, b) => a + (parseFloat(b.ch) || 0), 0), 0);
    const cgpa = (semesters.reduce((acc, s) => acc + s.subjects.reduce((a, sub) => a + (getSubjectStats(sub).gInfo.p * (parseFloat(sub.ch) || 0)), 0), 0) / (totalCH || 1)).toFixed(2);

    return (
        <div className={`min-h-screen ${theme.bg} transition-colors duration-500 pb-20 font-sans`}>
            {/* TOP NAVIGATION */}
            <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 px-4 py-3 shadow-sm">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <img src={user?.photoURL || `https://ui-avatars.com/api/?name=${user?.displayName}`} className="w-9 h-9 rounded-full border border-slate-200" alt="p" />
                        <span className="hidden sm:block font-bold text-slate-800 text-sm truncate max-w-30">{user?.displayName || 'Student'}</span>
                    </div>
                    
                    <div className="flex flex-col items-center">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Total CGPA</span>
                        <span className="text-2xl font-black text-indigo-600 leading-none">{cgpa}</span>
                    </div>

                    <div className="flex gap-1 sm:gap-2">
                        <button onClick={() => setShowGradeTable(true)} className="p-2 hover:bg-slate-100 rounded-xl transition-all" title="Grade Chart">📊</button>
                        <button onClick={() => setShowAnalytics(!showAnalytics)} className="p-2 hover:bg-slate-100 rounded-xl transition-all">📈</button>
                        <button onClick={() => setShowSettings(!showSettings)} className="p-2 hover:bg-slate-100 rounded-xl transition-all">⚙️</button>
                    </div>
                </div>
            </nav>

            <AnimatePresence>
                {showGradeTable && <GradeScaleModal onClose={() => setShowGradeTable(false)} />}
            </AnimatePresence>

            <header className={`bg-linear-to-br ${theme.header} pt-12 pb-24 px-6 rounded-b-[3.5rem] text-center border-b border-slate-200/50`}>
                <h1 className="text-4xl font-black text-slate-900 tracking-tight">Academic Portal</h1>
                <p className="text-slate-500 mt-2 font-medium">Hello, {user?.displayName || 'User'}! Track your progress with precision.</p>
            </header>

            <main className="max-w-6xl mx-auto -mt-12 px-4 relative z-10">
                <AnimatePresence>
                    {showSettings && <SettingsPanel user={user} themes={themes} activeTheme={activeTheme} setActiveTheme={setActiveTheme} />}
                </AnimatePresence>

                <div className="flex justify-center gap-4 mb-12">
                    <button onClick={() => onUpdate([...semesters, { id: Date.now(), name: `Semester ${semesters.length + 1}`, subjects: [] }])} className={`${theme.primary} text-white px-10 py-4 rounded-2xl font-bold shadow-xl shadow-indigo-200 hover:scale-[1.02] transition-all active:scale-95 flex items-center gap-2`}>
                        <span>+ Add Semester</span>
                    </button>
                </div>

                <LayoutGroup>
                    <div className="space-y-10">
                        {semesters.map((sem, sIdx) => {
                            const isCollapsed = collapsedSems.includes(sem.id);
                            const semSummary = calculateSGPAData(sem.subjects);

                            return (
                                <motion.div layout key={sem.id} className={`${theme.card} rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden`}>
                                    {/* SEMESTER HEADER */}
                                    <div 
                                        className="p-6 bg-white/80 border-b border-slate-100 flex justify-between items-center cursor-pointer hover:bg-slate-50 transition-colors"
                                        onClick={() => toggleSemester(sem.id)}
                                    >
                                        <div className="flex items-center gap-4">
                                            <motion.div 
                                                animate={{ rotate: isCollapsed ? -90 : 0 }}
                                                className="text-slate-400"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                                </svg>
                                            </motion.div>
                                            <div>
                                                <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest mb-1">{sem.name}</h3>
                                                {/* COLLAPSED SUMMARY */}
                                                <AnimatePresence>
                                                    {isCollapsed && (
                                                        <motion.div 
                                                            initial={{ opacity: 0, x: -10 }}
                                                            animate={{ opacity: 1, x: 0 }}
                                                            className="flex items-center gap-3 text-[10px] font-bold"
                                                        >
                                                            <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md flex items-center gap-1">
                                                                ⭐ {semSummary.sgpa} SGPA
                                                            </span>
                                                            <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md flex items-center gap-1">
                                                                🎯 Grade: {semSummary.grade}
                                                            </span>
                                                            <span className="text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                                                                📚 {semSummary.ch} CH
                                                            </span>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            {!isCollapsed && (
                                                <span className="hidden md:block text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">
                                                    Current SGPA: {semSummary.sgpa}
                                                </span>
                                            )}
                                            <button 
                                                onClick={(e) => { 
                                                    e.stopPropagation(); 
                                                    if(window.confirm("Delete entire semester?")) onUpdate(semesters.filter(s => s.id !== sem.id)); 
                                                }} 
                                                className="text-rose-300 hover:text-rose-500 p-2 transition-colors"
                                                title="Delete Semester"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>

                                    {/* SEMESTER CONTENT (Subjects) */}
                                    <AnimatePresence>
                                        {!isCollapsed && (
                                            <motion.div 
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-hidden"
                                            >
                                                {sem.subjects.map((sub, subIdx) => {
                                                    const stats = getSubjectStats(sub);
                                                    return (
                                                        <motion.div layout key={sub.id} className="bg-slate-50/50 rounded-4xl p-5 border border-slate-100 group transition-all relative">
                                                            {/* DELETE SUBJECT ICON */}
                                                            <button 
                                                                onClick={() => {
                                                                    const n = JSON.parse(JSON.stringify(semesters));
                                                                    n[sIdx].subjects.splice(subIdx, 1);
                                                                    onUpdate(n);
                                                                }}
                                                                className="absolute top-4 right-4 text-slate-300 hover:text-rose-500 transition-colors p-1"
                                                                title="Delete Subject"
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                                                </svg>
                                                            </button>

                                                            <div className="flex justify-between items-center mb-4 pr-6">
                                                                <input className="bg-transparent font-bold text-slate-800 outline-none w-2/3 focus:text-indigo-600" value={sub.title} onChange={(e) => { const n = JSON.parse(JSON.stringify(semesters)); n[sIdx].subjects[subIdx].title = e.target.value; onUpdate(n); }} placeholder="Subject Name" />
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">CH</span>
                                                                    <input type="number" className="w-10 bg-white border border-slate-200 rounded-lg text-center font-bold text-xs py-1 outline-none focus:border-indigo-400" value={sub.ch} onChange={(e) => { const n = JSON.parse(JSON.stringify(semesters)); n[sIdx].subjects[subIdx].ch = e.target.value; onUpdate(n); }} />
                                                                </div>
                                                            </div>

                                                            {/* MODE SELECTOR */}
                                                            <div className="flex gap-1 p-1 bg-slate-200/50 rounded-xl mb-4">
                                                                <button className={`flex-1 py-1 text-[9px] font-black uppercase rounded-lg transition-all ${sub.mode !== 'assessment' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`} onClick={() => { const n = JSON.parse(JSON.stringify(semesters)); n[sIdx].subjects[subIdx].mode = 'simple'; onUpdate(n); }}>Simple</button>
                                                                <button className={`flex-1 py-1 text-[9px] font-black uppercase rounded-lg transition-all ${sub.mode === 'assessment' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`} onClick={() => { const n = JSON.parse(JSON.stringify(semesters)); n[sIdx].subjects[subIdx].mode = 'assessment'; onUpdate(n); }}>Assessment</button>
                                                            </div>

                                                            {sub.mode === 'assessment' ? (
                                                                <div className="space-y-2 mb-4">
                                                                    {sub.assessments?.map((asm, aIdx) => (
                                                                        <div key={asm.id} className="grid grid-cols-12 gap-1 items-center">
                                                                            <select className="col-span-4 bg-white border border-slate-200 rounded-lg p-1 text-[10px] outline-none focus:border-indigo-300" value={asm.type} onChange={(e) => { const n = JSON.parse(JSON.stringify(semesters)); n[sIdx].subjects[subIdx].assessments[aIdx].type = e.target.value; onUpdate(n); }}>
                                                                                {assessmentTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                                                            </select>
                                                                            <input type="number" className="col-span-2 bg-white border border-slate-200 rounded-lg p-1 text-center text-[10px] outline-none" value={asm.weight} onChange={(e) => { const n = JSON.parse(JSON.stringify(semesters)); n[sIdx].subjects[subIdx].assessments[aIdx].weight = e.target.value; onUpdate(n); }} title="Weight %" />
                                                                            <input type="number" className="col-span-2 bg-indigo-50 border border-indigo-100 rounded-lg p-1 text-center text-[10px] font-bold outline-none" value={asm.obt} onChange={(e) => { const n = JSON.parse(JSON.stringify(semesters)); n[sIdx].subjects[subIdx].assessments[aIdx].obt = e.target.value; onUpdate(n); }} title="Obtained" />
                                                                            <input type="number" className="col-span-2 bg-white border border-slate-200 rounded-lg p-1 text-center text-[10px] outline-none" value={asm.total} onChange={(e) => { const n = JSON.parse(JSON.stringify(semesters)); n[sIdx].subjects[subIdx].assessments[aIdx].total = e.target.value; onUpdate(n); }} title="Total" />
                                                                            <button onClick={() => { const n = JSON.parse(JSON.stringify(semesters)); n[sIdx].subjects[subIdx].assessments.splice(aIdx, 1); onUpdate(n); }} className="col-span-2 text-rose-300 hover:text-rose-500 transition-colors flex justify-center">
                                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                                                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                                                                </svg>
                                                                            </button>
                                                                        </div>
                                                                    ))}
                                                                    <button onClick={() => { const n = JSON.parse(JSON.stringify(semesters)); if (!n[sIdx].subjects[subIdx].assessments) n[sIdx].subjects[subIdx].assessments = []; n[sIdx].subjects[subIdx].assessments.push({ id: Date.now(), type: 'Quiz', weight: 10, total: 100, obt: 0 }); onUpdate(n); }} className="w-full py-2 mt-2 border border-dashed border-slate-200 rounded-xl text-[10px] font-bold text-indigo-500 hover:bg-indigo-50 transition-all flex items-center justify-center gap-1">
                                                                        <span>+ Add Row</span>
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <div className="bg-white rounded-2xl p-4 border border-slate-100 text-center mb-4 shadow-inner">
                                                                    <input type="number" className="bg-transparent font-black text-4xl text-slate-800 text-center w-full outline-none focus:text-indigo-600" value={sub.simpleObt} onChange={(e) => { const n = JSON.parse(JSON.stringify(semesters)); n[sIdx].subjects[subIdx].simpleObt = e.target.value; onUpdate(n); }} />
                                                                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">Direct Percentage Yield</p>
                                                                </div>
                                                            )}

                                                            {/* STATS FOOTER */}
                                                            <div className="flex items-center justify-between px-2 pt-2 border-t border-slate-200/60">
                                                                <div className="text-center"><p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Grade</p><span className={`font-black text-sm ${gradeColors[stats.gInfo?.g] || 'text-slate-700'}`}>{stats.gInfo?.g}</span></div>
                                                                <div className="text-center"><p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Points</p><span className="font-bold text-slate-800 text-sm">{stats.gInfo?.p.toFixed(2)}</span></div>
                                                                <div className="text-center"><p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Marks</p><span className="font-bold text-indigo-600 text-sm">{stats.score.toFixed(0)}%</span></div>
                                                            </div>
                                                        </motion.div>
                                                    );
                                                })}
                                                <button onClick={() => { const n = JSON.parse(JSON.stringify(semesters)); n[sIdx].subjects.push({ id: Date.now(), title: '', ch: 3, simpleObt: 0, mode: 'simple', assessments: [] }); onUpdate(n); }} className="w-full py-12 border-2 border-dashed border-slate-200 rounded-4xl text-slate-300 font-black hover:bg-slate-50 hover:text-indigo-500 hover:border-indigo-200 transition-all flex flex-col items-center justify-center gap-2">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                    <span className="text-[10px] tracking-widest uppercase">Add Unit</span>
                                                </button>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </motion.div>
                            );
                        })}
                    </div>
                </LayoutGroup>

                <div className="mt-20 flex flex-col items-center gap-4">
                    <button onClick={() => auth.signOut()} className="text-slate-400 hover:text-rose-500 font-bold text-[10px] tracking-widest uppercase transition-colors flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Terminate Session
                    </button>
                </div>
            </main>
        </div>
    );
};

// --- SETTINGS PANEL & GRADE MODAL (UI Refined) ---
const SettingsPanel = ({ user, themes, activeTheme, setActiveTheme }) => {
    const [name, setName] = useState(user?.displayName || "");
    const [email, setEmail] = useState(user?.email || "");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);

    const handleUpdate = async () => {
        setLoading(true);
        try {
            if (name !== user.displayName) await user.updateProfile({ displayName: name });
            if (email !== user.email) await user.updateEmail(email);
            if (password) await user.updatePassword(password);
            alert("Profile Synchronized!");
        } catch (err) { alert(err.message); }
        setLoading(false);
    };

    return (
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="bg-white p-6 sm:p-8 rounded-[2.5rem] mb-12 border border-slate-200 shadow-2xl relative">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-4">
                    <h3 className="text-[10px] font-black uppercase text-indigo-600 mb-2 tracking-widest flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                        </svg>
                        User Profile
                    </h3>
                    <div className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-400 uppercase ml-2">Display Name</label>
                            <input className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none focus:border-indigo-400" value={name} onChange={e => setName(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-400 uppercase ml-2">Email Address</label>
                            <input className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none focus:border-indigo-400" value={email} onChange={e => setEmail(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-400 uppercase ml-2">New Password (Optional)</label>
                            <input type="password" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none focus:border-indigo-400" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} />
                        </div>
                        <button onClick={handleUpdate} disabled={loading} className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-black transition-all shadow-lg shadow-slate-200">
                            {loading ? "Processing..." : "Save Changes"}
                        </button>
                    </div>
                </div>
                <div>
                    <h3 className="text-[10px] font-black uppercase text-indigo-600 mb-6 tracking-widest flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v11a3 3 0 106 0V4a2 2 0 00-2-2H4zm1 14a1 1 0 100-2 1 1 0 000 2zm5-1.757l4.9-4.9a2 2 0 000-2.828L13.485 5.1a2 2 0 00-2.828 0L10 5.757v8.486z" clipRule="evenodd" />
                        </svg>
                        Interface Theme
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                        {Object.values(themes).map(t => (
                            <button key={t.id} onClick={() => { setActiveTheme(t.id); localStorage.setItem('userTheme', t.id); }} className={`p-4 rounded-2xl border-2 transition-all ${activeTheme === t.id ? 'border-indigo-600 bg-indigo-50 shadow-sm' : 'border-slate-100 opacity-60 hover:opacity-100'}`}>
                                <div className="font-bold text-slate-800 text-xs">{t.name}</div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

const GradeScaleModal = ({ onClose }) => (
    <div className="fixed inset-0 z-200 flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white w-full max-w-85 rounded-4xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-indigo-600 p-5 flex justify-between items-center text-white shadow-lg">
                <span className="font-black text-[10px] tracking-[0.2em] uppercase">Grading Schema Reference</span>
                <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                </button>
            </div>
            <div className="p-4 space-y-1">
                {[["85-100", "A", "4.00"], ["80-84", "A-", "3.66"], ["75-79", "B+", "3.33"], ["71-74", "B", "3.00"], ["68-70", "B-", "2.66"], ["Below 50", "F", "0.00"]].map(([r, g, p], i) => (
                    <div key={i} className="flex justify-between py-2.5 px-4 text-xs font-bold border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                        <span className="text-slate-400 font-mono">{r}%</span>
                        <span className="text-indigo-600 italic">{g}</span>
                        <span className="font-mono text-slate-800 tracking-tighter">{p}</span>
                    </div>
                ))}
            </div>
        </motion.div>
    </div>
);

export default Dashboard;