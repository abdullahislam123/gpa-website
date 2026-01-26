import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { auth, db } from '../services/firebase';
// import { Github as GithubIcon, Linkedin as LinkedinIcon } from 'lucide-react';
import { calculateGrade, parseSuperiorTranscript } from '../services/pdfParser';
import UpdateModal from './UpdateModal';

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

const GithubIcon = (props) => (
    <svg
        xmlns="http://www.w3.org/2000/svg" width="20" height="20"
        viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}
    >
        <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
        <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
);
const LinkedinIcon = (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2z"></path>
        <circle cx="4" cy="4" r="2"></circle>
    </svg>
);

const gradeColors = {
    'A': 'text-emerald-600 font-bold', 'A-': 'text-teal-600', 'B+': 'text-blue-600',
    'F': 'text-rose-600 animate-pulse font-black', 'default': 'text-slate-500'
};

const gradeToMarks = {
    'A': 85, 'A-': 80, 'B+': 75, 'B': 71, 'B-': 68,
    'C+': 64, 'C': 61, 'C-': 58, 'D+': 54, 'D': 50, 'F': 0
};

const Dashboard = ({ user, semesters, handleSyncUpdate }) => {

    // --- UPDATE MODAL LOGIC ---
    const CURRENT_VERSION = "2.0"; // Jab bhi naya update aye, bas ye number badal dein (e.g., 2.1)
    const [showUpdateModal, setShowUpdateModal] = useState(false);

    useEffect(() => {
        // Check karein ke browser memory mein pehle se koi version saved hai?
        const seenVersion = localStorage.getItem('app_version');

        // Agar saved version current version se match nahi karta, toh modal dikhayein
        if (seenVersion !== CURRENT_VERSION) {
            setShowUpdateModal(true);
        }
    }, []);

    const handleCloseUpdate = () => {
        // "Got it" dabane par current version save kar dein taake dobara na dikhayi de
        localStorage.setItem('app_version', CURRENT_VERSION);
        setShowUpdateModal(false);
    };

    const fileInputRef = useRef(null);
    const [isParsing, setIsParsing] = useState(false);

    // --- UI States ---
    const [showSettings, setShowSettings] = useState(false);
    const [showGradeTable, setShowGradeTable] = useState(false);
    const [collapsedSems, setCollapsedSems] = useState([]);

    // --- Custom Assessment Types ---
    const defaultAssessments = ['Quiz', 'Assignment', 'Mid Exam', 'Final Exam', 'Project', 'Viva', 'Others'];
    const [customAssessments, setCustomAssessments] = useState(() => {
        const saved = localStorage.getItem(`custom_asm_${user?.uid}`);
        return saved ? JSON.parse(saved) : [];
    });

    const assessmentTypes = [...defaultAssessments, ...customAssessments];
    const [activeTheme, setActiveTheme] = useState(localStorage.getItem('userTheme') || 'professional');
    const theme = themes[activeTheme] || themes.professional;

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

    const toggleSemester = (id) => {
        setCollapsedSems(prev => prev.includes(id) ? prev.filter(sId => sId !== id) : [...prev, id]);
    };

    const totalCH = semesters.reduce((acc, s) => acc + s.subjects.reduce((a, b) => a + (parseFloat(b.ch) || 0), 0), 0);
    const cgpa = (semesters.reduce((acc, s) => acc + s.subjects.reduce((a, sub) => a + (getSubjectStats(sub).gInfo.p * (parseFloat(sub.ch) || 0)), 0), 0) / (totalCH || 1)).toFixed(2);

    // --- 1. CLOUD SE DATA FETCH KARNA (For Mobile Sync) ---
    useEffect(() => {
        const loadInitialData = async () => {
            if (user?.uid) {
                try {
                    const docRef = db.collection('users').doc(user.uid);
                    const docSnap = await docRef.get();

                    if (docSnap.exists) {
                        const cloudSemesters = docSnap.data().semesters || [];
                        // Agar local storage khali hai ya cloud par naya data hai, to update karein
                        if (semesters.length === 0 && cloudSemesters.length > 0) {
                            handleSyncUpdate(cloudSemesters);
                        }
                    }
                } catch (error) {
                    console.error("Cloud loading error:", error);
                }
            }
        };
        loadInitialData();
    }, [user?.uid]); // Jab user login ho, tabhi chale

    // --- 2. CLOUD PAR DATA SAVE KARNA (For Laptop Sync) ---
    // Hum aik wrapper function banate hain jo  ko call karega aur Firestore ko bhi
    const handleSyncUpdate = async (newSemesters) => {
        onUpdate(newSemesters);

        // Phir Firestore mein save karein
        if (user?.uid) {
            try {
                await db.collection('users').doc(user.uid).set({
                    semesters: newSemesters,
                    lastUpdated: new Date()
                }, { merge: true });
                console.log("Cloud synced!");
            } catch (error) {
                console.error("Cloud sync error:", error);
            }
        }
    };
    // --- 2. LOAD FROM CLOUD (Mobile ke liye) ---
    useEffect(() => {
        const loadInitialData = async () => {
            if (user?.uid && semesters.length === 0) { 
                try {
                    const docRef = db.collection('users').doc(user.uid);
                    const docSnap = await docRef.get();
                    if (docSnap.exists) {
                        const cloudData = docSnap.data().semesters || [];
                        handleSyncUpdate(cloudData); // Screen par data dikhao
                    }
                } catch (error) { console.error("Error fetching cloud data:", error); }
            }
        };
        loadInitialData();
    }, [user?.uid]);
    return (

        <div className={`min-h-screen ${theme.bg} transition-colors duration-500 pb-32 font-sans`}>

            {/* ✅ UPDATE MODAL KO AISE RAKHEIN */}
            <UpdateModal
                isOpen={showUpdateModal}
                onClose={handleCloseUpdate}
            />



            {/* TOP NAVIGATION */}
            <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 px-4 py-3 shadow-sm">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        {showSettings ? (
                            <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-slate-100 rounded-full transition-all text-slate-600">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                            </button>
                        ) : (
                            /* FIX: Agar displayName null ho tou 'Student' ka 'S' dikhaye na ke 'NU' */
                            <img
                                src={user?.photoURL || `https://ui-avatars.com/api/?name=${user?.displayName || 'Student'}&background=6366f1&color=fff`}
                                className="w-9 h-9 rounded-full border border-slate-200 shadow-sm"
                                alt="profile"
                            />
                        )}

                        {/* FIX: Naam ke liye bhi fallback add kiya */}
                        <span className="font-bold text-slate-800 text-sm">
                            {showSettings ? "User Profile" : (user?.displayName || 'Student')}
                        </span>
                    </div>

                    {!showSettings && semesters.length > 0 && (
                        <div className="flex flex-col items-center">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Total CGPA</span>
                            <span className="text-2xl font-black text-indigo-600 leading-none">{cgpa}</span>
                        </div>
                    )}
                    <div className="w-9 h-9" />
                </div>
            </nav>

            <AnimatePresence>{showGradeTable && <GradeScaleModal onClose={() => setShowGradeTable(false)} />}</AnimatePresence>

            <main className="max-w-6xl mx-auto px-4 relative z-10">
                {showSettings ? (
                    <div className="mt-8">
                        <SettingsPanel
                            user={user} themes={themes} activeTheme={activeTheme} setActiveTheme={setActiveTheme}
                            customAssessments={customAssessments} setCustomAssessments={setCustomAssessments}
                        />
                    </div>
                ) : (
                    <>
                        {/* UPDATED: Greeting Card vs Standard Header */}
                        {semesters.length === 0 ? (
                            <div className="mt-12 mb-12">
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-[3rem] p-10 text-white shadow-2xl relative overflow-hidden"
                                >
                                    <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
                                    <div className="relative z-10">
                                        <h2 className="text-3xl md:text-4xl font-black tracking-tight">
                                            Ready to track your progress, <span className="text-yellow-300">{user?.displayName?.split(' ')[0] || 'Student'}</span>?
                                        </h2>
                                        <p className="mt-4 text-indigo-100 text-base md:text-lg leading-relaxed max-w-xl font-medium">
                                            Apne grades add karna shuru karein taake hum aapka CGPA calculate kar saken aur aapko academic insights de saken.
                                        </p>
                                        <div className="mt-10 flex items-center gap-3 justify-center animate-bounce text-yellow-300">
                                            <span className="text-[10px] font-black uppercase  tracking-[0.2em]">Start by adding a semester</span>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                <line x1="12" y1="5" x2="12" y2="19"></line>
                                                <polyline points="19 12 12 19 5 12"></polyline>
                                            </svg>
                                        </div>
                                    </div>
                                </motion.div>
                            </div>
                        ) : (
                            <header className={`bg-linear-to-br ${theme.header} -mx-4 pt-12 pb-24 px-6 rounded-b-[3.5rem] text-center border-b border-slate-200/50 mb-12`}>
                                <h1 className="text-4xl font-black text-slate-900 tracking-tight">Academic Portal</h1>
                                <p className="text-slate-600 mt-2 font-medium">
                                    Welcome, <span className="text-indigo-600 font-black">{user?.displayName || 'User'}</span>! Manage your progress.
                                </p>
                            </header>
                        )}

                        {/* ACTION BUTTONS */}
                        <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mb-12">
                            <button onClick={() => handleSyncUpdate([...semesters, { id: Date.now(), name: `Semester ${semesters.length + 1}`, subjects: [] }])} className={`${theme.primary} text-white w-full sm:w-auto px-10 py-4 rounded-2xl font-bold shadow-xl shadow-indigo-200 hover:scale-[1.02] transition-all flex items-center justify-center gap-2`}>
                                <span>+ Add Semester</span>
                            </button>
                            <input type="file" ref={fileInputRef} onChange={async (e) => {
                                const file = e.target.files[0];
                                if (!file) return;
                                setIsParsing(true);
                                try {
                                    const data = await parseSuperiorTranscript(file);
                                    if (data) handleSyncUpdate([...semesters, ...data]);
                                } finally { setIsParsing(false); e.target.value = null; }
                            }} accept="application/pdf" className="hidden" />
                            <button onClick={() => fileInputRef.current.click()} disabled={isParsing} className="bg-white text-slate-700 w-full sm:w-auto px-10 py-4 rounded-2xl font-bold border border-slate-200 shadow-sm hover:bg-slate-50 transition-all flex items-center justify-center gap-2">
                                📄 {isParsing ? 'Processing...' : 'Import PDF'}
                            </button>
                            <button
                                onClick={() => {
                                    if (window.confirm("Are you sure you want to delete ALL semesters?")) {
                                        handleSyncUpdate([]);
                                    }
                                }}
                                className="bg-rose-50 text-rose-600 w-full sm:w-auto px-10 py-4 rounded-2xl font-bold border border-rose-100 shadow-sm hover:bg-rose-100 transition-all flex items-center justify-center gap-2"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                <span>Clear All</span>
                            </button>
                        </div>

                        {/* SEMESTER LIST WITH LAYOUT TAG */}
                        <LayoutGroup>
                            <div className="space-y-6">
                                {semesters.map((sem, sIdx) => {
                                    const isCollapsed = collapsedSems.includes(sem.id);
                                    const semSummary = calculateSGPAData(sem.subjects);
                                    return (
                                        <motion.div layout key={sem.id} className={`${theme.card} rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden`}>
                                            <div
                                                className={`p-5 flex justify-between items-center cursor-pointer transition-all duration-300 ${isCollapsed ? 'bg-slate-50/80 hover:bg-indigo-50/30' : 'bg-white border-b border-slate-100'}`}
                                                onClick={() => toggleSemester(sem.id)}
                                            >
                                                <div className="flex items-center gap-4">
                                                    <motion.div animate={{ rotate: isCollapsed ? 0 : 90 }} className={`p-1.5 rounded-xl transition-colors ${isCollapsed ? 'bg-white text-slate-400 border border-slate-100' : 'bg-indigo-600 text-white shadow-md shadow-indigo-200'}`}>
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
                                                    </motion.div>
                                                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                                                        <h3 className="font-black text-slate-800 uppercase text-[11px] tracking-[0.15em]">{sem.name}</h3>
                                                        <AnimatePresence>
                                                            {isCollapsed && (
                                                                <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2">
                                                                    <span className="text-[10px] font-black bg-white border border-slate-100 text-indigo-600 px-2.5 py-0.5 rounded-lg shadow-xs">⭐ {semSummary.sgpa} SGPA</span>
                                                                    <span className="text-[10px] font-black bg-emerald-50 text-emerald-600 px-2.5 py-0.5 rounded-lg border border-emerald-100">🎯 {semSummary.grade}</span>
                                                                </motion.div>
                                                            )}
                                                        </AnimatePresence>
                                                    </div>
                                                </div>
                                                <button onClick={(e) => { e.stopPropagation(); if (window.confirm("Delete this semester?")) handleSyncUpdate(semesters.filter(s => s.id !== sem.id)); }} className="text-slate-300 hover:text-rose-500 transition-colors p-2 hover:bg-rose-50 rounded-xl">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            </div>

                                            <AnimatePresence>
                                                {!isCollapsed && (
                                                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 pt-6">
                                                        {sem.subjects.map((sub, subIdx) => {
                                                            const stats = getSubjectStats(sub);
                                                            return (
                                                                <div key={sub.id} className="bg-slate-50/50 rounded-3xl p-5 border border-slate-100 relative group">
                                                                    <button onClick={() => { const n = JSON.parse(JSON.stringify(semesters)); n[sIdx].subjects.splice(subIdx, 1); handleSyncUpdate(n); }} className="absolute top-4 right-4 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                                                                    <input className="bg-transparent font-bold text-sm outline-none mb-3 block w-full focus:text-indigo-600" value={sub.title} onChange={(e) => { const n = JSON.parse(JSON.stringify(semesters)); n[sIdx].subjects[subIdx].title = e.target.value; handleSyncUpdate(n); }} placeholder="Subject Name" />

                                                                    <div className="flex gap-1 p-1 bg-slate-200/50 rounded-lg mb-4">
                                                                        <button className={`flex-1 py-1 text-[8px] font-black uppercase rounded-md transition-all ${sub.mode !== 'assessment' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`} onClick={() => { const n = JSON.parse(JSON.stringify(semesters)); n[sIdx].subjects[subIdx].mode = 'simple'; handleSyncUpdate(n); }}>Simple</button>
                                                                        <button className={`flex-1 py-1 text-[8px] font-black uppercase rounded-md transition-all ${sub.mode === 'assessment' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`} onClick={() => { const n = JSON.parse(JSON.stringify(semesters)); n[sIdx].subjects[subIdx].mode = 'assessment'; handleSyncUpdate(n); }}>Assessment</button>
                                                                    </div>

                                                                    {sub.mode === 'assessment' ? (
                                                                        /* 1. ASSESSMENT MODE: Detailed Weightage Entry */
                                                                        <div className="space-y-2 mb-4">
                                                                            {sub.assessments?.length > 0 && (
                                                                                <div className="grid grid-cols-12 gap-1 px-1 mb-1">
                                                                                    <span className="col-span-5 text-[8px] font-black text-slate-400 uppercase ml-1 tracking-tighter text-left">Assessment Type</span>
                                                                                    <span className="col-span-2 text-[8px] font-black text-slate-400 uppercase text-center tracking-tighter">Obt.</span>
                                                                                    <span className="col-span-2 text-[8px] font-black text-slate-400 uppercase text-center tracking-tighter">Total</span>
                                                                                    <span className="col-span-2 text-[8px] font-black text-slate-400 uppercase text-center tracking-tighter">Weight%</span>
                                                                                </div>
                                                                            )}
                                                                            {sub.assessments?.map((asm, aIdx) => (
                                                                                <div key={asm.id} className="grid grid-cols-12 gap-1 items-center">
                                                                                    <select className="col-span-5 bg-white border border-slate-100 rounded-lg p-1 text-[9px] font-bold outline-none" value={asm.type} onChange={(e) => { const n = JSON.parse(JSON.stringify(semesters)); n[sIdx].subjects[subIdx].assessments[aIdx].type = e.target.value; handleSyncUpdate(n); }}>
                                                                                        {assessmentTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                                                                    </select>
                                                                                    <input type="number" className="col-span-2 bg-indigo-50 rounded-lg p-1 text-center text-[9px] font-bold outline-none" value={asm.obt} onChange={(e) => { const n = JSON.parse(JSON.stringify(semesters)); n[sIdx].subjects[subIdx].assessments[aIdx].obt = e.target.value; handleSyncUpdate(n); }} />
                                                                                    <input type="number" className="col-span-2 bg-white border border-slate-100 rounded-lg p-1 text-center text-[9px] outline-none" value={asm.total} onChange={(e) => { const n = JSON.parse(JSON.stringify(semesters)); n[sIdx].subjects[subIdx].assessments[aIdx].total = e.target.value; handleSyncUpdate(n); }} />
                                                                                    <input type="number" className="col-span-2 bg-white border border-slate-100 rounded-lg p-1 text-center text-[9px] outline-none" value={asm.weight} onChange={(e) => { const n = JSON.parse(JSON.stringify(semesters)); n[sIdx].subjects[subIdx].assessments[aIdx].weight = e.target.value; handleSyncUpdate(n); }} />
                                                                                    <button onClick={() => { const n = JSON.parse(JSON.stringify(semesters)); n[sIdx].subjects[subIdx].assessments.splice(aIdx, 1); handleSyncUpdate(n); }} className="col-span-1 text-rose-300 hover:text-rose-500 transition-colors">✕</button>
                                                                                </div>
                                                                            ))}

                                                                            {/* Assessment Row Addition */}
                                                                            <button
                                                                                onClick={() => {
                                                                                    const n = JSON.parse(JSON.stringify(semesters));
                                                                                    if (!n[sIdx].subjects[subIdx].assessments) n[sIdx].subjects[subIdx].assessments = [];
                                                                                    n[sIdx].subjects[subIdx].assessments.push({ id: Date.now(), type: 'Quiz', weight: 10, total: 100, obt: 0 });
                                                                                    handleSyncUpdate(n);
                                                                                }}
                                                                                className="w-full py-2 border border-dashed border-indigo-200 rounded-xl text-[9px] font-black uppercase text-indigo-500 hover:bg-indigo-50 transition-all mt-2"
                                                                            >
                                                                                + Add Assessment Row
                                                                            </button>
                                                                        </div>
                                                                    ) : (
                                                                        /* 2. DUAL SIMPLE MODE: Grade Selector vs. Manual Marks */
                                                                        <div className="space-y-4 mb-4">
                                                                            {/* Credit Hours Input Row */}
                                                                            <div className="bg-white p-2 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between px-4 transition-all hover:border-indigo-200">
                                                                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">Course Credit Hours</span>
                                                                                <input
                                                                                    type="number"
                                                                                    className="w-12 bg-slate-50 border border-slate-100 rounded-lg font-bold text-center outline-none text-indigo-600 text-sm py-1 focus:ring-1 focus:ring-indigo-400"
                                                                                    value={sub.ch}
                                                                                    onChange={(e) => {
                                                                                        const n = JSON.parse(JSON.stringify(semesters));
                                                                                        n[sIdx].subjects[subIdx].ch = e.target.value;
                                                                                        handleSyncUpdate(n);
                                                                                    }}
                                                                                />
                                                                            </div>

                                                                            {/* Mode Toggle (Grade vs Marks) */}
                                                                            <div className="flex gap-1 p-1 bg-slate-100 rounded-[1rem] max-w-[150px] mx-auto shadow-inner">
                                                                                <button
                                                                                    className={`flex-1 py-1 text-[7px] font-black uppercase rounded-lg transition-all ${!sub.isManual ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                                                                    onClick={() => {
                                                                                        const n = JSON.parse(JSON.stringify(semesters));
                                                                                        n[sIdx].subjects[subIdx].isManual = false;
                                                                                        handleSyncUpdate(n);
                                                                                    }}
                                                                                >By Grade</button>
                                                                                <button
                                                                                    className={`flex-1 py-1 text-[7px] font-black uppercase rounded-lg transition-all ${sub.isManual ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                                                                    onClick={() => {
                                                                                        const n = JSON.parse(JSON.stringify(semesters));
                                                                                        n[sIdx].subjects[subIdx].isManual = true;
                                                                                        handleSyncUpdate(n);
                                                                                    }}
                                                                                >By Marks</button>
                                                                            </div>

                                                                            {/* Dynamic Display for Grade or Marks */}
                                                                            <div className="bg-indigo-50/50 rounded-[2rem] p-5 border border-indigo-100 text-center relative overflow-hidden group">
                                                                                {!sub.isManual ? (
                                                                                    /* Sub-Mode A: Grade Selection */
                                                                                    <div className="space-y-3 relative z-10">
                                                                                        <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest leading-none">Select Grade</p>
                                                                                        <select
                                                                                            className="bg-white border-2 border-indigo-100 rounded-2xl px-6 py-2.5 font-black text-indigo-600 outline-none cursor-pointer shadow-lg hover:border-indigo-300 transition-all text-sm appearance-none"
                                                                                            value={Object.keys(gradeToMarks).find(key => gradeToMarks[key] === parseFloat(sub.simpleObt)) || "F"}
                                                                                            onChange={(e) => {
                                                                                                const marks = gradeToMarks[e.target.value] || 0;
                                                                                                const n = JSON.parse(JSON.stringify(semesters));
                                                                                                n[sIdx].subjects[subIdx].simpleObt = marks;
                                                                                                handleSyncUpdate(n);
                                                                                            }}
                                                                                        >
                                                                                            {Object.keys(gradeToMarks).map(g => <option key={g} value={g}>{g}</option>)}
                                                                                        </select>
                                                                                        <div className="flex flex-col items-center mt-2 opacity-60 group-hover:opacity-100 transition-opacity">
                                                                                            <span className="text-2xl font-black text-indigo-700">{sub.simpleObt || 0}%</span>
                                                                                            <span className="text-[7px] font-bold text-indigo-300 uppercase tracking-tighter">Mapped Percentage</span>
                                                                                        </div>
                                                                                    </div>
                                                                                ) : (
                                                                                    /* Sub-Mode B: Manual Marks Entry */
                                                                                    <div className="space-y-3 relative z-10">
                                                                                        <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest leading-none">Direct Marks %</p>
                                                                                        <input
                                                                                            type="number"
                                                                                            className="bg-white border-2 border-indigo-100 rounded-2xl px-4 py-2 w-28 text-center font-black text-3xl text-indigo-600 outline-none shadow-lg focus:border-indigo-400 transition-all"
                                                                                            value={sub.simpleObt}
                                                                                            placeholder="0"
                                                                                            onChange={(e) => {
                                                                                                const n = JSON.parse(JSON.stringify(semesters));
                                                                                                n[sIdx].subjects[subIdx].simpleObt = e.target.value;
                                                                                                handleSyncUpdate(n);
                                                                                            }}
                                                                                        />
                                                                                        <p className="text-[7px] text-indigo-300 font-black uppercase italic tracking-widest">Type Exact Score</p>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                    <div className="flex justify-between px-2 pt-2 border-t border-slate-100 text-[10px] font-bold">
                                                                        <span>Grade: <span className={gradeColors[stats.gInfo.g]}>{stats.gInfo.g} ({stats.gInfo.p})</span></span>
                                                                        <span className="text-indigo-600">{stats.score.toFixed(0)}%</span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                        <button onClick={() => { const n = JSON.parse(JSON.stringify(semesters)); n[sIdx].subjects.push({ id: Date.now(), title: '', ch: 3, simpleObt: 0, mode: 'simple', assessments: [] }); handleSyncUpdate(n); }} className="py-12 border-2 border-dashed border-slate-200 rounded-4xl text-slate-300 font-bold hover:bg-slate-50 transition-all hover:text-indigo-600 hover:border-indigo-600">+ Add Course</button>
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

            {/* FOOTER */}
            <footer className="py-6 mt-10 border-t border-gray-100 px-6 md:px-12 bg-white/50 backdrop-blur-sm">
                <p className="text-center text-[10px] uppercase tracking-[0.3em] text-gray-400 font-bold mb-6">Crafted with Precision</p>
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-1.5 text-sm text-gray-600 order-2 md:order-1">
                        <span>Made with</span> <span className="text-red-500 animate-pulse text-lg">❤️</span> <span>by</span>
                        <span className="font-bold text-indigo-600 hover:underline cursor-pointer">Abdullah</span>
                    </div>
                    <div className="flex items-center gap-6 text-gray-400 order-1 md:order-2">
                        <a href="#" target="_blank"><GithubIcon className="w-5 h-5 hover:text-black transition-all" /></a>
                        <a href="#" target="_blank"><LinkedinIcon className="w-5 h-5 hover:text-blue-600 transition-all" /></a>
                    </div>
                </div>
                <div className="mt-8 pt-4 border-t border-gray-50 flex justify-center">
                    <p className="text-[10px] text-gray-300 italic tracking-wider">Superior Academic Portal — 2026</p>
                </div>
            </footer>

            {/* BOTTOM NAVIGATION */}
            <div className="fixed bottom-6 left-0 right-0 z-50 flex justify-center px-6">
                <nav className="bg-slate-900/90 backdrop-blur-xl border border-white/10 p-2 rounded-3xl shadow-2xl flex items-center gap-2">
                    <button onClick={() => setShowSettings(false)} className={`flex flex-col items-center p-3 rounded-2xl transition-all ${!showSettings ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400'}`}>
                        <span className="text-xl">🏠</span><span className="text-[7px] font-black uppercase mt-1">Home</span>
                    </button>
                    <button onClick={() => setShowGradeTable(true)} className="flex flex-col items-center p-3 rounded-2xl text-slate-400">
                        <span className="text-xl">📊</span><span className="text-[7px] font-black uppercase mt-1">Scale</span>
                    </button>
                    <button onClick={() => setShowSettings(true)} className={`flex flex-col items-center p-3 rounded-2xl transition-all ${showSettings ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400'}`}>
                        <span className="text-xl">⚙️</span><span className="text-[7px] font-black uppercase mt-1">Profile</span>
                    </button>
                    <div className="w-[1px] h-8 bg-white/10 mx-1" />
                    <button onClick={() => auth.signOut()} className="flex flex-col items-center p-3 rounded-2xl text-rose-400 hover:bg-rose-500/10 transition-all">
                        <span className="text-xl">🚪</span><span className="text-[7px] font-black uppercase mt-1">Exit</span>
                    </button>
                </nav>
            </div>
        </div>
    );
};

// --- SETTINGS PANEL (With Custom Assessment Logic) ---
const SettingsPanel = ({ user, themes, activeTheme, setActiveTheme, customAssessments, setCustomAssessments }) => {
    const [name, setName] = useState(user?.displayName || "");
    const [loading, setLoading] = useState(false);
    const [newAsm, setNewAsm] = useState("");

    // States for Assessment Editing
    const [editIndex, setEditIndex] = useState(null);
    const [editText, setEditText] = useState("");

    const defaultAssessments = ['Quiz', 'Assignment', 'Mid Exam', 'Final Exam', 'Project', 'Viva', 'Others'];

    const handleProfileUpdate = async () => {
        setLoading(true);
        try {
            if (name.trim() !== user.displayName) {
                await user.updateProfile({ displayName: name.trim() });
                alert("Profile Name Updated!");
            }
        } catch (err) {
            alert(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleAddAsm = () => {
        const trimmed = newAsm.trim();
        if (!trimmed || defaultAssessments.includes(trimmed) || customAssessments.includes(trimmed)) return;
        const updated = [...customAssessments, trimmed];
        saveToLocal(updated);
        setNewAsm("");
    };

    const handleSaveEdit = (idx) => {
        const trimmed = editText.trim();
        if (!trimmed) {
            setEditIndex(null);
            return;
        }
        const updated = [...customAssessments];
        updated[idx] = trimmed;
        saveToLocal(updated);
        setEditIndex(null);
    };

    const saveToLocal = (arr) => {
        setCustomAssessments(arr);
        localStorage.setItem(`custom_asm_${user?.uid}`, JSON.stringify(arr));
    };

    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 pb-10">

            {/* 1. PROFILE CARD (Name & Email) */}
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden">
                <div className="flex flex-col sm:flex-row items-center gap-6">
                    <img
                        src={user?.photoURL || `https://ui-avatars.com/api/?name=${name || 'S'}`}
                        className="w-24 h-24 rounded-3xl border-4 border-indigo-50 shadow-md object-cover"
                        alt="Profile"
                    />
                    <div className="flex-1 w-full space-y-4">
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Full Name</label>
                            <div className="flex gap-2 mt-1">
                                <input
                                    className="flex-1 bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-indigo-400 focus:bg-white transition-all shadow-inner"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                />
                                <button
                                    onClick={handleProfileUpdate}
                                    disabled={loading}
                                    className="bg-slate-900 text-white px-6 rounded-2xl text-[10px] font-black uppercase hover:bg-black transition-all shadow-lg active:scale-95"
                                >
                                    {loading ? '...' : 'Save'}
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Email Address</label>
                            <p className="text-sm font-bold text-slate-500 bg-slate-50/80 p-3 px-4 rounded-2xl border border-slate-100 italic shadow-sm">
                                {user?.email || 'No email found'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. THEME CARD */}
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl">
                <h3 className="text-[10px] font-black uppercase text-indigo-600 tracking-widest mb-6">Interface Theme</h3>
                <div className="grid grid-cols-2 gap-3">
                    {Object.values(themes).map(t => (
                        <button
                            key={t.id}
                            onClick={() => { setActiveTheme(t.id); localStorage.setItem('userTheme', t.id); }}
                            className={`p-4 rounded-2xl border-2 text-[10px] font-black transition-all ${activeTheme === t.id ? 'border-indigo-600 bg-indigo-50 text-indigo-600 shadow-sm' : 'border-slate-50 text-slate-400'}`}
                        >
                            {t.name}
                        </button>
                    ))}
                </div>
            </div>

            {/* 3. MANAGE DROPDOWNS (Edit Button Fixed) */}
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl">
                <h3 className="text-[10px] font-black uppercase text-indigo-600 tracking-widest mb-6">Custom Assessment Labels</h3>

                <div className="flex gap-2 mb-8">
                    <input
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-xs font-bold outline-none focus:border-indigo-400 shadow-inner"
                        placeholder="Add new (e.g. Lab Task)"
                        value={newAsm}
                        onChange={e => setNewAsm(e.target.value)}
                    />
                    <button onClick={handleAddAsm} className="bg-indigo-600 text-white px-8 rounded-2xl text-[10px] font-black uppercase shadow-lg active:scale-95 transition-all">Add</button>
                </div>

                <div className="space-y-8">
                    {/* SYSTEM DEFAULTS - LOCKED */}
                    <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase mb-3 ml-2">System Defaults (Locked)</p>
                        <div className="flex flex-wrap gap-2 opacity-50 grayscale">
                            {defaultAssessments.map((item, idx) => (
                                <div key={idx} className="bg-slate-100 px-3 py-2 rounded-full border border-slate-200 text-[10px] font-bold text-slate-500">{item}</div>
                            ))}
                        </div>
                    </div>

                    {/* CUSTOM TAGS - WITH VISIBLE EDIT BTN */}
                    <div className="pt-6 border-t border-slate-100">
                        <p className="text-[9px] font-black text-indigo-400 uppercase mb-3 ml-2">Your Categories</p>
                        <div className="flex flex-wrap gap-3">
                            {customAssessments.map((item, idx) => (
                                <div key={idx} className="bg-white px-3 py-2 rounded-2xl flex items-center gap-3 border border-slate-200 shadow-sm hover:border-indigo-200 transition-all">
                                    {editIndex === idx ? (
                                        <div className="flex items-center gap-1">
                                            <input
                                                className="w-24 bg-indigo-50 px-2 py-0.5 rounded-lg text-[10px] font-black text-indigo-600 outline-none border border-indigo-200"
                                                value={editText}
                                                onChange={e => setEditText(e.target.value)}
                                                autoFocus
                                                onBlur={() => handleSaveEdit(idx)}
                                                onKeyDown={e => e.key === 'Enter' && handleSaveEdit(idx)}
                                            />
                                            <button onClick={() => handleSaveEdit(idx)} className="text-emerald-500 font-bold ml-1">✓</button>
                                        </div>
                                    ) : (
                                        <>
                                            <span className="text-[10px] font-black text-indigo-600">{item}</span>
                                            <div className="flex items-center gap-1 border-l pl-2 border-slate-100">
                                                {/* Dedicated Edit Button */}
                                                <button
                                                    onClick={() => { setEditIndex(idx); setEditText(item); }}
                                                    className="text-slate-300 hover:text-indigo-500 p-1 transition-colors"
                                                    title="Edit Name"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                                    </svg>
                                                </button>
                                                <button
                                                    onClick={() => saveToLocal(customAssessments.filter((_, i) => i !== idx))}
                                                    className="text-slate-300 hover:text-rose-500 p-1 transition-colors"
                                                    title="Delete"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

const GradeScaleModal = ({ onClose }) => {
    const grades = [["85+", "A", "4.0"], ["80-84", "A-", "3.6"], ["75-79", "B+", "3.3"], ["71-74", "B", "3.0"], ["68-70", "B-", "2.6"], ["64-67", "C+", "2.3"], ["61-63", "C", "2.0"], ["58-60", "C-", "1.6"], ["54-57", "D+", "1.3"], ["50-53", "D", "1.0"], ["<50", "F", "0.0"]];
    const statuses = [["I", "Inc"], ["W", "Wdr"], ["R", "Repl"], ["Imp", "Imp"]];
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 bg-slate-900/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white w-full max-w-[280px] rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
                <div className="bg-indigo-600 px-4 py-3 flex justify-between items-center text-white"><span className="font-black text-[9px] tracking-widest uppercase">Grading Scale</span><button onClick={onClose}>✕</button></div>
                <div className="p-2 space-y-0.5">
                    {grades.map(([r, g, p], i) => (
                        <div key={i} className="flex justify-between items-center px-3 py-1 text-[10px] font-bold border-b border-slate-50 last:border-0"><span className="text-slate-500 w-16">{r}%</span><span className="text-indigo-600 w-6 text-center">{g}</span><span className="text-slate-800 w-8 text-right">{p}</span></div>
                    ))}
                    <div className="mt-2 grid grid-cols-2 gap-1 pt-2 border-t border-slate-100">{statuses.map(([c, l], i) => (<div key={i} className="flex gap-2 items-center bg-slate-50 px-2 py-1 rounded-lg"><span className="text-[10px] text-indigo-600 font-black">{c}</span><span className="text-[9px] text-slate-400 font-bold truncate">{l}</span></div>))}</div>
                </div>
            </motion.div>
        </div>
    );
};

export default Dashboard;