// import React from 'react';
// import { motion, AnimatePresence } from 'framer-motion';
// import { auth } from '../services/firebase';
// import { parseSuperiorTranscript, calculateGrade } from '../services/pdfParser';

// const Dashboard = ({ user, semesters, onUpdate }) => {

//     // --- Core Logic: PDF Import & State Management ---
//     const handlePdfImport = async (e) => {
//         if (!e.target.files[0]) return;
//         try {
//             const data = await parseSuperiorTranscript(e.target.files[0]);
//             onUpdate([...semesters, ...data]); //
//         } catch (err) {
//             alert("Superior PDF Error: " + err.message);
//         }
//     };

//     const addSemester = () => {
//         onUpdate([...semesters, { id: Date.now(), name: `Semester ${semesters.length + 1}`, subjects: [] }]);
//     };

//     const deleteSemester = (sId) => {
//         if (window.confirm("Poora semester delete kar dain?")) {
//             onUpdate(semesters.filter(s => s.id !== sId));
//         }
//     };

//     // --- Math Engine: Dual Mode Calculation ---
//     const getSubjectStats = (sub) => {
//         if (sub.mode === 'assessment' && sub.assessments?.length > 0) {
//             let totalWeight = 0, weightedScore = 0;
//             sub.assessments.forEach(a => {
//                 const w = parseFloat(a.weight) || 0;
//                 totalWeight += w;
//                 weightedScore += ((parseFloat(a.obt) || 0) / (parseFloat(a.total) || 1)) * w;
//             });
//             return { score: weightedScore, weight: totalWeight, gInfo: calculateGrade(weightedScore) };
//         }
//         const score = parseFloat(sub.simpleObt) || 0;
//         return { score, weight: 100, gInfo: calculateGrade(score) }; //
//     };

//     // Global GPA Calculation
//     let totalQP = 0, totalCH = 0;
//     semesters.forEach(s => s.subjects.forEach(sub => {
//         const stats = getSubjectStats(sub);
//         const ch = parseFloat(sub.ch) || 0;
//         totalQP += (stats.gInfo.p * ch); 
//         totalCH += ch;
//     }));
//     const cgpa = (totalCH > 0 ? (totalQP / totalCH) : 0).toFixed(2);

//     return (
//         <div className="min-h-screen bg-slate-50 pb-20 font-sans">
//             {/* LUXURY HEADER */}
//             <header className="bg-linear-to-br from-blue-900 to-blue-700 pt-10 pb-24 px-6 rounded-b-[3.5rem] shadow-2xl text-white">
//                 <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
//                     <div className="flex items-center gap-5">
//                         <img src={user.photoURL || `src/assets/uni_logo.png`} 
//                              className="w-20 h-20 rounded-full border-4 border-white/20 shadow-xl" alt="User" />
//                         <div>
//                             <h2 className="text-2xl font-extrabold tracking-tight">Welcome back, {user.displayName}</h2>
//                             <p className="text-blue-100/80 text-sm font-medium">{user.email}</p>
//                         </div>
//                     </div>
                    
//                     <motion.div initial={{scale: 0.9}} animate={{scale: 1}} className="bg-white/10 backdrop-blur-xl border border-white/20 p-8 rounded-[2.5rem] text-center min-w-55">
//                         <span className="text-[11px] font-black tracking-widest uppercase opacity-70">TOTAL CGPA</span>
//                         <h1 className="text-6xl font-black my-2 leading-none">{cgpa}</h1>
//                         <p className="text-xs font-bold opacity-60 italic">Credits: {totalCH}</p>
//                     </motion.div>
//                 </div>
//             </header>

//             <main className="max-w-5xl mx-auto -mt-14 px-6">
//                 {/* GLOBAL ACTIONS */}
//                 <div className="flex flex-wrap justify-center gap-4 mb-12">
//                     <button onClick={() => document.getElementById('mainPdfIn').click()}
//                             className="bg-white text-blue-700 px-6 py-2 rounded-2xl font-black shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all flex items-center gap-3 border border-blue-100">
//                         📄 Import Official PDF
//                     </button>
                    
//                     <input type="file" id="mainPdfIn" hidden onChange={handlePdfImport} accept=".pdf" />
//                 </div>

//                 <AnimatePresence>
//                     {semesters.map((sem, sIdx) => (
//                         <div key={sem.id} className="mb-16">
//                             <div className="flex items-center gap-6 mb-8 px-4">
//                                 <input className="bg-transparent border-none text-slate-400 font-black uppercase tracking-[0.3em] text-sm focus:outline-none w-fit"
//                                        value={sem.name} onChange={(e) => { const n = [...semesters]; n[sIdx].name = e.target.value; onUpdate(n); }} />
//                                 <div className="h-px bg-slate-200 grow"></div>
//                                 <button onClick={() => deleteSemester(sem.id)} className="text-red-300 hover:text-red-500 font-bold text-xs uppercase">Delete Sem</button>
//                             </div>

//                             {sem.subjects.map((sub, subIdx) => {
//                                 const stats = getSubjectStats(sub);
//                                 return (
//                                     <motion.div layout key={sub.id} className="bg-white border-2 border-black rounded-[2.5rem] p-8 mb-8 shadow-sm relative hover:shadow-md transition-shadow">
//                                         <button className="absolute -top-3 -right-3 bg-red-500 text-white w-9 h-9 rounded-xl shadow-lg flex items-center justify-center font-black hover:scale-110 transition-transform"
//                                                 onClick={() => { const n = [...semesters]; n[sIdx].subjects.splice(subIdx, 1); onUpdate(n); }}>✕</button>

//                                         {/* HEADER: TITLE & CH */}
//                                         <div className="flex flex-col xl:flex-row gap-8">
//                                             <div className="grow space-y-6">
//                                                 <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
//                                                     <div className="md:col-span-3">
//                                                         <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Subject Name</label>
//                                                         <input className="w-full bg-slate-50 border-2 border-black rounded-xl px-5 py-4 focus:border-blue-500 outline-none font-bold text-lg"
//                                                                value={sub.title} onChange={(e) => { const n = [...semesters]; n[sIdx].subjects[subIdx].title = e.target.value; onUpdate(n); }} />
//                                                     </div>
//                                                     <div>
//                                                         <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block text-center">CH</label>
//                                                         <input type="number" className="w-full bg-slate-50 border-2 border-black rounded-xl px-5 py-4 focus:border-blue-500 outline-none font-bold text-lg text-center"
//                                                                value={sub.ch} onChange={(e) => { const n = [...semesters]; n[sIdx].subjects[subIdx].ch = e.target.value; onUpdate(n); }} />
//                                                     </div>
//                                                 </div>

//                                                 {/* MODE TOGGLE */}
//                                                 <div className="inline-flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
//                                                     <button className={`px-6 py-2.5 rounded-xl text-[11px] font-black tracking-widest transition-all ${sub.mode !== 'assessment' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}
//                                                             onClick={() => { const n = [...semesters]; n[sIdx].subjects[subIdx].mode = 'simple'; onUpdate(n); }}>SIMPLE</button>
//                                                     <button className={`px-6 py-2.5 rounded-xl text-[11px] font-black tracking-widest transition-all ${sub.mode === 'assessment' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}
//                                                             onClick={() => { const n = [...semesters]; n[sIdx].subjects[subIdx].mode = 'assessment'; onUpdate(n); }}>ASSESSMENT</button>
//                                                 </div>
//                                             </div>

//                                             {/* GRADE PREVIEW */}
//                                             <div className="xl:w-56 bg-blue-50/50 border-2 border-blue-100 rounded-[2.5rem] p-8 flex flex-col items-center justify-center text-center">
//                                                 <span className="text-[10px] font-black text-blue-400 uppercase mb-1">Percentage</span>
//                                                 <div className="text-4xl font-black text-blue-800">{stats.score.toFixed(0)}%</div>
//                                                 <div className="mt-4 px-5 py-2 bg-blue-600 text-white rounded-xl font-black text-lg shadow-md tracking-wider">GPA: {stats.gInfo.p.toFixed(2)}</div>
//                                             </div>
//                                         </div>

//                                         {/* DYNAMIC CONTENT AREA */}
//                                         <div className="mt-8">
//                                             {sub.mode !== 'assessment' ? (
//                                                 <div className="p-6 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
//                                                     <label className="text-[11px] font-black text-slate-400 uppercase mb-3 block">Total Obtained Marks (out of 100)</label>
//                                                     <input type="number" className="w-full bg-white border-2 border-black rounded-xl px-5 py-4 font-black text-xl text-blue-600"
//                                                            value={sub.simpleObt} onChange={(e) => { const n = [...semesters]; n[sIdx].subjects[subIdx].simpleObt = e.target.value; onUpdate(n); }} />
//                                                 </div>
//                                             ) : (
//                                                 <div className="space-y-6">
//                                                     {stats.weight !== 100 && (
//                                                         <motion.div initial={{x: -10}} animate={{x: 0}} className="bg-amber-50 border-l-4 border-amber-400 p-4 text-amber-800 text-xs font-bold rounded-r-xl">
//                                                             ⚠️ Warning: Total weightage is {stats.weight}% (Must add up to 100%)
//                                                         </motion.div>
//                                                     )}

//                                                     <div className="hidden md:grid grid-cols-12 gap-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
//                                                         <div className="col-span-4">Type</div>
//                                                         <div className="col-span-2 text-center">W%</div>
//                                                         <div className="col-span-2 text-center">Tot</div>
//                                                         <div className="col-span-2 text-center">Obt</div>
//                                                         <div className="col-span-2"></div>
//                                                     </div>

//                                                     <AnimatePresence>
//                                                         {sub.assessments?.map((asm, aIdx) => (
//                                                             <div key={asm.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 p-5 bg-slate-50 rounded-2xl border border-slate-100 items-center">
//                                                                 <div className="md:col-span-4">
//                                                                     <select className="w-full bg-white border-2 border-black rounded-xl p-3 font-bold text-sm outline-none cursor-pointer"
//                                                                             value={asm.type} onChange={(e) => { const n = [...semesters]; n[sIdx].subjects[subIdx].assessments[aIdx].type = e.target.value; onUpdate(n); }}>
//                                                                         <option>Quiz</option><option>Assignment</option><option>Mid Exam</option><option>Final Exam</option><option>Project</option><option>Presentation</option><option>Other</option>
//                                                                     </select>
//                                                                 </div>
//                                                                 <div className="md:col-span-2"><input type="number" placeholder="W%" className="w-full bg-white border-2 border-black rounded-xl p-3 text-sm font-bold text-center"
//                                                                            value={asm.weight} onChange={(e) => { const n = [...semesters]; n[sIdx].subjects[subIdx].assessments[aIdx].weight = e.target.value; onUpdate(n); }} /></div>
//                                                                 <div className="md:col-span-2"><input type="number" placeholder="Tot" className="w-full bg-white border-2 border-black rounded-xl p-3 text-sm font-bold text-center"
//                                                                            value={asm.total} onChange={(e) => { const n = [...semesters]; n[sIdx].subjects[subIdx].assessments[aIdx].total = e.target.value; onUpdate(n); }} /></div>
//                                                                 <div className="md:col-span-2"><input type="number" placeholder="Obt" className="w-full bg-blue-50 border-2 border-blue-600 rounded-xl p-3 text-sm font-black text-center text-blue-700"
//                                                                            value={asm.obt} onChange={(e) => { const n = [...semesters]; n[sIdx].subjects[subIdx].assessments[aIdx].obt = e.target.value; onUpdate(n); }} /></div>
//                                                                 <div className="md:col-span-2 text-right"><button className="text-red-400 hover:text-red-600 font-black text-[10px] uppercase tracking-tighter"
//                                                                             onClick={() => { const n = [...semesters]; n[sIdx].subjects[subIdx].assessments.splice(aIdx, 1); onUpdate(n); }}>Remove</button></div>
//                                                             </div>
//                                                         ))}
//                                                     </AnimatePresence>
//                                                     <button className="w-full py-4 border-2 border-dashed border-slate-300 rounded-2xl text-slate-400 text-xs font-black hover:border-blue-400 hover:text-blue-600 transition-all uppercase tracking-widest"
//                                                             onClick={() => {
//                                                                 const n = [...semesters];
//                                                                 if(!n[sIdx].subjects[subIdx].assessments) n[sIdx].subjects[subIdx].assessments = [];
//                                                                 n[sIdx].subjects[subIdx].assessments.push({id: Date.now(), type:'Quiz', weight:10, total:40, obt:0});
//                                                                 onUpdate(n);
//                                                             }}>+ Add Assessment Component</button>
//                                                 </div>
//                                             )}
//                                         </div>
//                                     </motion.div>
//                                 );
//                             })}
                            
//                             <button onClick={() => {
//                                 const n = [...semesters];
//                                 n[sIdx].subjects.push({id: Date.now(), title: 'New Course', ch: 3, simpleObt: 0, mode: 'simple', assessments: []});
//                                 onUpdate(n);
//                             }} className="w-full bg-green-50 text-green-600 border-2 border-dashed border-green-200 py-5 rounded-[2.5rem] font-black text-sm hover:bg-green-100 transition-colors uppercase tracking-[0.2em]">+ Add New Course to {sem.name}
//                             </button>
//                             <button onClick={addSemester} className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-black shadow-lg hover:bg-blue-700 transition-all items-center">
//                                 + Add Semester
//                             </button>
//                         </div>
//                     ))}
//                 </AnimatePresence>

//                 <div className="flex flex-col items-center mt-20 gap-6">
//                     <button onClick={() => window.print()} 
//                             className="bg-purple-600 text-white px-12 py-5 rounded-[2.5rem] font-black shadow-2xl hover:bg-purple-700 hover:-translate-y-2 transition-all w-full max-w-md text-lg tracking-widest shadow-purple-200">
//                         🖨️ PRINT ACADEMIC CARD
//                     </button>
//                     <button onClick={() => auth.signOut()} className="text-slate-400 font-bold hover:text-red-500 transition-colors uppercase tracking-widest text-xs">Logout Session</button>
//                 </div>
//             </main>
//         </div>
//     );
// };

// export default Dashboard;


// import React from 'react';
// import { motion, AnimatePresence } from 'framer-motion';
// import { auth } from '../services/firebase';
// import { parseSuperiorTranscript, calculateGrade } from '../services/pdfParser';

// const Dashboard = ({ user, semesters, onUpdate }) => {

//     // --- Core Logic: Functionality preserved 100% ---
//     const handlePdfImport = async (e) => {
//         if (!e.target.files[0]) return;
//         try {
//             const data = await parseSuperiorTranscript(e.target.files[0]);
//             onUpdate([...semesters, ...data]);
//         } catch (err) {
//             alert("Superior PDF Error: " + err.message);
//         }
//     };

//     const addSemester = () => {
//         onUpdate([...semesters, { id: Date.now(), name: 'New Semester', subjects: [] }]);
//     };

//     const deleteSemester = (sId) => {
//         if (window.confirm("Poora semester delete kar dain?")) {
//             onUpdate(semesters.filter(s => s.id !== sId));
//         }
//     };

//     const getSubjectStats = (sub) => {
//         let score = 0, weight = 0;
//         if (sub?.mode === 'assessment' && sub?.assessments?.length > 0) {
//             sub.assessments.forEach(a => {
//                 const w = parseFloat(a.weight) || 0;
//                 const obt = parseFloat(a.obt) || 0;
//                 const tot = parseFloat(a.total) || 1;
//                 weight += w;
//                 score += (obt / tot) * w;
//             });
//         } else {
//             score = parseFloat(sub?.simpleObt) || 0;
//             weight = 100;
//         }
//         const gInfo = calculateGrade(score) || { g: 'F', p: 0.0 };
//         return { score, weight, gInfo };
//     };

//     let totalQP = 0, totalCH = 0;
//     (semesters || []).forEach(s => (s.subjects || []).forEach(sub => {
//         const stats = getSubjectStats(sub);
//         const ch = parseFloat(sub.ch) || 0;
//         totalQP += (stats.gInfo.p * ch); 
//         totalCH += ch;
//     }));
//     const cgpa = (totalCH > 0 ? (totalQP / totalCH) : 0).toFixed(2);

//     return (
//         <div className="min-h-screen bg-[#f8fafc] pb-24 font-sans text-slate-900">
//             {/* 1. Header Section with Deep Gradient */}
//             <header className="bg-gradient-to-br from-[#0f172a] via-[#1e3a8a] to-[#2563eb] pt-12 pb-32 px-6 rounded-b-[4rem] shadow-2xl text-white">
//                 <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-10">
//                     <div className="flex items-center gap-6">
//                         <img src={user?.photoURL || `https://ui-avatars.com/api/?name=${user?.displayName}&background=random`} 
//                              className="w-20 h-20 rounded-full border-4 border-white/20 shadow-xl" alt="Profile" />
//                         <div>
//                             <h2 className="text-3xl font-black tracking-tight leading-tight">Welcome back, {user?.displayName}</h2>
//                             <p className="text-blue-100/70 text-sm font-medium tracking-wide italic">{user?.email}</p>
//                         </div>
//                     </div>
                    
//                     <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} 
//                                 className="bg-white/10 backdrop-blur-3xl border border-white/20 p-8 rounded-[3rem] text-center min-w-[240px] shadow-inner">
//                         <span className="text-[11px] font-black tracking-[0.3em] uppercase opacity-60">Total CGPA</span>
//                         <h1 className="text-7xl font-black my-1 tracking-tighter leading-none">{cgpa}</h1>
//                         <p className="text-[10px] font-bold opacity-50 uppercase tracking-widest mt-2">Credits: {totalCH}</p>
//                     </motion.div>
//                 </div>
//             </header>

//             <main className="max-w-5xl mx-auto -mt-20 px-6">
//                 {/* 2. Primary Action Bar */}
//                 <div className="flex flex-wrap justify-center gap-4 mb-16">
//                     <button onClick={() => document.getElementById('mainPdfIn').click()}
//                             className="bg-white text-blue-700 px-10 py-5 rounded-2xl font-black shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all flex items-center gap-3 border border-blue-100 group">
//                         <span className="text-xl group-hover:rotate-12 transition-transform">📄</span> Import Official PDF
//                     </button>
//                     <button onClick={addSemester} className="bg-blue-600 text-white px-10 py-5 rounded-2xl font-black shadow-lg hover:bg-blue-700 hover:-translate-y-1 transition-all">
//                         + Add Semester
//                     </button>
//                     <input type="file" id="mainPdfIn" hidden onChange={handlePdfImport} accept=".pdf" />
//                 </div>

//                 <AnimatePresence>
//                     {(semesters || []).map((sem, sIdx) => (
//                         <motion.div layout initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} key={sem.id} className="mb-24">
//                             {/* Semester Header with Automatic Numbering */}
//                             <div className="flex items-center gap-6 mb-10 px-6">
//                                 <div className="flex items-center gap-3">
//                                     <span className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-black text-xs">{sIdx + 1}</span>
//                                     <input className="bg-transparent border-none text-slate-800 font-black uppercase tracking-[0.4em] text-sm outline-none focus:text-blue-600 w-fit"
//                                            value={sem.name} onChange={(e) => { const n = [...semesters]; n[sIdx].name = e.target.value; onUpdate(n); }} />
//                                 </div>
//                                 <div className="h-[2px] bg-slate-200 grow"></div>
//                                 <button onClick={() => deleteSemester(sem.id)} className="text-red-300 hover:text-red-500 font-bold text-[10px] uppercase tracking-widest transition-colors">Remove Semester</button>
//                             </div>

//                             {/* 3. Subject Cards */}
//                             {(sem.subjects || []).map((sub, subIdx) => {
//                                 const stats = getSubjectStats(sub);
//                                 return (
//                                     <div key={sub.id} className="bg-white border-2 border-slate-200 rounded-[3rem] p-8 md:p-12 mb-10 shadow-sm relative group hover:border-black transition-all hover:shadow-2xl">
//                                         <button className="absolute -top-4 -right-4 bg-red-500 text-white w-10 h-10 rounded-2xl shadow-xl flex items-center justify-center font-black opacity-0 group-hover:opacity-100 transition-opacity z-10"
//                                                 onClick={() => { const n = [...semesters]; n[sIdx].subjects.splice(subIdx, 1); onUpdate(n); }}>✕</button>

//                                         <div className="flex flex-col xl:flex-row gap-12">
//                                             <div className="grow space-y-10">
//                                                 <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
//                                                     <div className="md:col-span-3">
//                                                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 mb-3 block">Course Name</label>
//                                                         <input className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl px-6 py-5 focus:border-black outline-none font-bold text-xl transition-all"
//                                                                value={sub.title} onChange={(e) => { const n = [...semesters]; n[sIdx].subjects[subIdx].title = e.target.value; onUpdate(n); }} />
//                                                     </div>
//                                                     <div>
//                                                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 mb-3 block text-center">CH</label>
//                                                         <input type="number" className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl px-6 py-5 outline-none font-black text-xl text-center focus:border-black"
//                                                                value={sub.ch} onChange={(e) => { const n = [...semesters]; n[sIdx].subjects[subIdx].ch = e.target.value; onUpdate(n); }} />
//                                                     </div>
//                                                 </div>

//                                                 <div className="inline-flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-inner">
//                                                     <button className={`px-10 py-3.5 rounded-xl text-[10px] font-black tracking-widest transition-all ${sub.mode !== 'assessment' ? 'bg-white shadow-md text-blue-600' : 'text-slate-500'}`}
//                                                             onClick={() => { const n = [...semesters]; n[sIdx].subjects[subIdx].mode = 'simple'; onUpdate(n); }}>SIMPLE</button>
//                                                     <button className={`px-10 py-3.5 rounded-xl text-[10px] font-black tracking-widest transition-all ${sub.mode === 'assessment' ? 'bg-white shadow-md text-blue-600' : 'text-slate-500'}`}
//                                                             onClick={() => { const n = [...semesters]; n[sIdx].subjects[subIdx].mode = 'assessment'; onUpdate(n); }}>ADVANCED</button>
//                                                 </div>
//                                             </div>

//                                             {/* Grade Result Box */}
//                                             <div className="xl:w-64 bg-slate-50 border-2 border-slate-100 rounded-[3.5rem] p-12 flex flex-col items-center justify-center text-center shadow-inner group-hover:bg-white transition-colors">
//                                                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Score</span>
//                                                 <div className="text-6xl font-black text-slate-900 tracking-tighter">{(stats.score || 0).toFixed(0)}%</div>
//                                                 <div className="mt-6 px-8 py-3 bg-blue-600 text-white rounded-2xl font-black text-xl shadow-lg shadow-blue-200">
//                                                     {stats.gInfo?.g} ({(stats.gInfo?.p || 0.0).toFixed(1)})
//                                                 </div>
//                                             </div>
//                                         </div>

//                                         {/* Dynamic Logic Area */}
//                                         <div className="mt-12">
//                                             {sub.mode !== 'assessment' ? (
//                                                 <div className="p-10 bg-blue-50/50 rounded-[3rem] border-2 border-dashed border-blue-200 text-center">
//                                                     <label className="text-[11px] font-black text-blue-400 uppercase tracking-[0.2em] mb-4 block">Total Obtained Marks</label>
//                                                     <input type="number" className="w-full max-w-xs bg-white border-2 border-blue-200 rounded-3xl px-8 py-6 font-black text-5xl text-center text-blue-700 outline-none shadow-sm focus:border-blue-500"
//                                                            value={sub.simpleObt} onChange={(e) => { const n = [...semesters]; n[sIdx].subjects[subIdx].simpleObt = e.target.value; onUpdate(n); }} />
//                                                 </div>
//                                             ) : (
//                                                 <div className="space-y-6">
//                                                     {stats.weight !== 100 && (
//                                                         <div className="bg-amber-50 border-l-8 border-amber-400 p-5 text-amber-900 text-[11px] font-bold rounded-r-2xl shadow-sm flex items-center gap-3">
//                                                             <span>⚠️</span> Total weightage is {stats.weight}% (Should be 100%)
//                                                         </div>
//                                                     )}
//                                                     {sub.assessments?.map((asm, aIdx) => (
//                                                         <div key={asm.id} className="grid grid-cols-1 md:grid-cols-12 gap-5 p-6 bg-slate-50/50 rounded-3xl border border-slate-100 items-center hover:bg-white transition-colors">
//                                                             <div className="md:col-span-4">
//                                                                 <select className="w-full bg-white border-2 border-slate-200 rounded-xl p-4 font-bold text-sm outline-none focus:border-black appearance-none"
//                                                                         value={asm.type} onChange={(e) => { const n = [...semesters]; n[sIdx].subjects[subIdx].assessments[aIdx].type = e.target.value; onUpdate(n); }}>
//                                                                     <option>Quiz</option><option>Assignment</option><option>Mid Exam</option><option>Final Exam</option><option>Project</option><option>Presentation</option>
//                                                                 </select>
//                                                             </div>
//                                                             <div className="md:col-span-2"><input type="number" placeholder="W%" className="w-full bg-white border-2 border-slate-200 rounded-xl p-4 text-sm font-bold text-center outline-none focus:border-black"
//                                                                        value={asm.weight} onChange={(e) => { const n = [...semesters]; n[sIdx].subjects[subIdx].assessments[aIdx].weight = e.target.value; onUpdate(n); }} /></div>
//                                                             <div className="md:col-span-2"><input type="number" placeholder="Tot" className="w-full bg-white border-2 border-slate-200 rounded-xl p-4 text-sm font-bold text-center outline-none focus:border-black"
//                                                                        value={asm.total} onChange={(e) => { const n = [...semesters]; n[sIdx].subjects[subIdx].assessments[aIdx].total = e.target.value; onUpdate(n); }} /></div>
//                                                             <div className="md:col-span-2"><input type="number" placeholder="Obt" className="w-full bg-blue-50 border-2 border-blue-200 rounded-xl p-4 text-sm font-black text-center text-blue-700 outline-none focus:border-blue-600"
//                                                                        value={asm.obt} onChange={(e) => { const n = [...semesters]; n[sIdx].subjects[subIdx].assessments[aIdx].obt = e.target.value; onUpdate(n); }} /></div>
//                                                             <div className="md:col-span-2 text-right"><button className="text-red-400 hover:text-red-600 font-black text-[10px] uppercase tracking-widest transition-colors"
//                                                                         onClick={() => { const n = [...semesters]; n[sIdx].subjects[subIdx].assessments.splice(aIdx, 1); onUpdate(n); }}>Remove</button></div>
//                                                         </div>
//                                                     ))}
//                                                     <button className="w-full py-6 border-2 border-dashed border-slate-200 rounded-[2.5rem] text-slate-400 text-xs font-black tracking-[0.3em] hover:bg-slate-50 hover:border-blue-400 hover:text-blue-600 transition-all uppercase"
//                                                             onClick={() => {
//                                                                 const n = [...semesters];
//                                                                 if(!n[sIdx].subjects[subIdx].assessments) n[sIdx].subjects[subIdx].assessments = [];
//                                                                 n[sIdx].subjects[subIdx].assessments.push({id: Date.now(), type:'Quiz', weight:10, total:40, obt:0});
//                                                                 onUpdate(n);
//                                                             }}>+ Add Component</button>
//                                                 </div>
//                                             )}
//                                         </div>
//                                     </div>
//                                 );
//                             })}
//                             <button onClick={() => {
//                                 const n = [...semesters];
//                                 n[sIdx].subjects.push({id: Date.now(), title: '', ch: 3, simpleObt: 0, mode: 'simple', assessments: []});
//                                 onUpdate(n);
//                             }} className="w-full bg-white text-slate-400 border-2 border-dashed border-slate-200 py-7 rounded-[3.5rem] font-black text-[10px] tracking-[0.4em] hover:border-black hover:text-black transition-all shadow-sm">+ ADD COURSE TO {sem.name.toUpperCase()}</button>
//                         </motion.div>
//                     ))}
//                 </AnimatePresence>

//                 {/* 4. Final Actions */}
//                 <div className="flex flex-col items-center mt-32 space-y-8">
//                     <button onClick={() => window.print()} 
//                             className="bg-[#0f172a] text-white px-16 py-7 rounded-[3.5rem] font-black shadow-2xl hover:bg-black hover:-translate-y-2 transition-all w-full max-w-xl text-xl tracking-[0.3em] shadow-slate-300">
//                         🖨️ PRINT TRANSCRIPT
//                     </button>
//                     <button onClick={() => auth.signOut()} className="text-slate-400 font-bold hover:text-red-500 uppercase tracking-[0.4em] text-[10px] pb-10">End Academic Session</button>
//                 </div>
//             </main>
//         </div>
//     );
// };

// export default Dashboard;


// import React from 'react';
// import { motion, AnimatePresence } from 'framer-motion';
// import { auth } from '../services/firebase';
// import { parseSuperiorTranscript, calculateGrade } from '../services/pdfParser';

// const Dashboard = ({ user, semesters, onUpdate }) => {

//     // --- 🧮 Math Engine: Functionality ---
//     const getSubjectStats = (sub) => {
//         let score = 0, weight = 0;
//         if (sub?.mode === 'assessment' && sub?.assessments?.length > 0) {
//             sub.assessments.forEach(a => {
//                 const w = parseFloat(a.weight) || 0;
//                 const obt = parseFloat(a.obt) || 0;
//                 const tot = parseFloat(a.total) || 1;
//                 weight += w;
//                 score += (obt / tot) * w;
//             });
//         } else {
//             score = parseFloat(sub?.simpleObt) || 0;
//             weight = 100;
//         }
//         const gInfo = calculateGrade(score) || { g: 'F', p: 0.0 };
//         return { score, weight, gInfo };
//     };

//     // ✅ Per Semester SGPA Calculation
//     const calculateSGPA = (subjects) => {
//         let semQP = 0, semCH = 0;
//         (subjects || []).forEach(sub => {
//             const stats = getSubjectStats(sub);
//             const ch = parseFloat(sub.ch) || 0;
//             semQP += (stats.gInfo.p * ch);
//             semCH += ch;
//         });
//         return (semCH > 0 ? (semQP / semCH) : 0).toFixed(2);
//     };

//     // Global CGPA Calculation
//     let totalQP = 0, totalCH = 0;
//     (semesters || []).forEach(s => (s.subjects || []).forEach(sub => {
//         const stats = getSubjectStats(sub);
//         const ch = parseFloat(sub.ch) || 0;
//         totalQP += (stats.gInfo.p * ch); 
//         totalCH += ch;
//     }));
//     const cgpa = (totalCH > 0 ? (totalQP / totalCH) : 0).toFixed(2);

//     return (
//         <div className="min-h-screen bg-[#f8fafc] pb-24 font-sans text-slate-900">
//             {/* Header Section */}
//             <header className="bg-linear-to-br from-[#0f172a] via-superior-blue to-[#2563eb] pt-12 pb-32 px-6 rounded-b-[4rem] shadow-2xl text-white">
//                 <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-10">
//                     <div className="flex items-center gap-6">
//                         <img src={user?.photoURL || `src/assets/uni_logo.png`} 
//                              className="w-20 h-20 rounded-full border-4 border-white/20 shadow-xl" alt="Profile" />
//                         <div>
//                             <h2 className="text-3xl font-black tracking-tight leading-tight">{user?.displayName}</h2>
//                             <p className="text-blue-100/70 text-sm font-medium italic">{user?.email}</p>
//                         </div>
//                     </div>
                    
//                     <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} 
//                                 className="bg-white/10 backdrop-blur-3xl border border-white/20 p-8 rounded-[3rem] text-center min-w-60 shadow-inner">
//                         <span className="text-[11px] font-black tracking-[0.3em] uppercase opacity-60 text-blue-100">OVERALL CGPA</span>
//                         <h1 className="text-7xl font-black my-1 tracking-tighter leading-none">{cgpa}</h1>
//                         <p className="text-[10px] font-bold opacity-50 uppercase tracking-widest mt-2">Credits: {totalCH}</p>
//                     </motion.div>
//                 </div>
//             </header>

//             <main className="max-w-5xl mx-auto -mt-20 px-6">
//                 {/* Global Action Bar */}
//                 <div className="flex flex-wrap justify-center gap-4 mb-16">
//                     <button onClick={() => document.getElementById('mainPdfIn').click()}
//                             className="bg-white text-blue-700 px-10 py-5 rounded-2xl font-black shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all flex items-center gap-3 border border-blue-100">
//                         📄 Import PDF
//                     </button>
//                     <button onClick={() => onUpdate([...semesters, { id: Date.now(), name: 'New Semester', subjects: [] }])} 
//                             className="bg-blue-600 text-white px-10 py-5 rounded-2xl font-black shadow-lg hover:bg-blue-700 hover:-translate-y-1 transition-all">
//                         + Add Semester
//                     </button>
//                     <input type="file" id="mainPdfIn" hidden onChange={(e) => {
//                         if (!e.target.files[0]) return;
//                         parseSuperiorTranscript(e.target.files[0]).then(data => onUpdate([...semesters, ...data]));
//                     }} accept=".pdf" />
//                 </div>

//                 <AnimatePresence>
//                     {(semesters || []).map((sem, sIdx) => {
//                         const semSGPA = calculateSGPA(sem.subjects); // Calculate SGPA here
//                         return (
//                             <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} key={sem.id} className="mb-20">
//                                 {/* Semester Header with SGPA Display */}
//                                 <div className="flex items-center gap-6 mb-8 px-6">
//                                     <div className="flex items-center gap-4">
//                                         <span className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-black text-xs shadow-lg shadow-blue-200">{sIdx + 1}</span>
//                                         <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-4">
//                                             <input className="bg-transparent border-none text-slate-800 font-black uppercase tracking-[0.3em] text-sm outline-none w-fit"
//                                                    value={sem.name} onChange={(e) => { const n = [...semesters]; n[sIdx].name = e.target.value; onUpdate(n); }} />
//                                             <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm">SGPA: {semSGPA}</span>
//                                         </div>
//                                     </div>
//                                     <div className="h-0.5 bg-slate-200 grow"></div>
//                                     <button onClick={() => onUpdate(semesters.filter(s => s.id !== sem.id))} className="text-red-300 hover:text-red-500 font-bold text-[10px] uppercase tracking-widest">Remove</button>
//                                 </div>

//                                 {(sem.subjects || []).map((sub, subIdx) => {
//                                     const stats = getSubjectStats(sub);
//                                     return (
//                                         <div key={sub.id} className="bg-white border-2 border-slate-200 rounded-[2.5rem] p-6 md:p-8 mb-6 shadow-sm relative group hover:border-black transition-all hover:shadow-xl">
//                                             <button className="absolute -top-3 -right-3 bg-red-500 text-white w-8 h-8 rounded-xl shadow-lg flex items-center justify-center font-black opacity-0 group-hover:opacity-100 transition-opacity z-10"
//                                                     onClick={() => { const n = [...semesters]; n[sIdx].subjects.splice(subIdx, 1); onUpdate(n); }}>✕</button>

//                                             <div className="flex flex-col xl:flex-row gap-6">
//                                                 <div className="grow space-y-6">
//                                                     <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
//                                                         <div className="md:col-span-3">
//                                                             <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Course</label>
//                                                             <input className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 focus:border-black outline-none font-bold text-base"
//                                                                    value={sub.title} onChange={(e) => { const n = [...semesters]; n[sIdx].subjects[subIdx].title = e.target.value; onUpdate(n); }} />
//                                                         </div>
//                                                         <div>
//                                                             <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block text-center">CH</label>
//                                                             <input type="number" className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 outline-none font-black text-base text-center focus:border-black"
//                                                                    value={sub.ch} onChange={(e) => { const n = [...semesters]; n[sIdx].subjects[subIdx].ch = e.target.value; onUpdate(n); }} />
//                                                         </div>
//                                                     </div>

//                                                     <div className="inline-flex bg-slate-50 p-1 rounded-xl border border-slate-200">
//                                                         <button className={`px-6 py-2 rounded-lg text-[9px] font-black tracking-widest transition-all ${sub.mode !== 'assessment' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}
//                                                                 onClick={() => { const n = [...semesters]; n[sIdx].subjects[subIdx].mode = 'simple'; onUpdate(n); }}>SIMPLE</button>
//                                                         <button className={`px-6 py-2 rounded-lg text-[9px] font-black tracking-widest transition-all ${sub.mode === 'assessment' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}
//                                                                 onClick={() => { const n = [...semesters]; n[sIdx].subjects[subIdx].mode = 'assessment'; onUpdate(n); }}>ADVANCED</button>
//                                                     </div>
//                                                 </div>

//                                                 {/* Grade Result Box - Shrinked Padding */}
//                                                 <div className="xl:w-48 bg-slate-50 border-2 border-slate-100 rounded-[2.5rem] p-6 flex flex-col items-center justify-center text-center shadow-inner group-hover:bg-white transition-colors">
//                                                     <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Score</span>
//                                                     <div className="text-3xl font-black text-slate-900 tracking-tighter">{(stats.score || 0).toFixed(0)}%</div>
//                                                     <div className="mt-4 px-4 py-1.5 bg-blue-600 text-white rounded-xl font-black text-base shadow-lg shadow-blue-200">
//                                                         {stats.gInfo?.g} ({(stats.gInfo?.p || 0.0).toFixed(1)})
//                                                     </div>
//                                                 </div>
//                                             </div>

//                                             {/* Content Area - Shrinked Padding */}
//                                             <div className="mt-6">
//                                                 {sub.mode !== 'assessment' ? (
//                                                     <div className="p-6 bg-blue-50/30 rounded-[2.5rem] border-2 border-dashed border-blue-100 text-center">
//                                                         <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-3 block">Total Obtained Marks</label>
//                                                         <input type="number" className="w-full max-w-xs bg-white border-2 border-blue-100 rounded-2xl px-6 py-4 font-black text-3xl text-center text-blue-700 outline-none"
//                                                                value={sub.simpleObt} onChange={(e) => { const n = [...semesters]; n[sIdx].subjects[subIdx].simpleObt = e.target.value; onUpdate(n); }} />
//                                                     </div>
//                                                 ) : (
//                                                     <div className="space-y-4">
//                                                         {sub.assessments?.map((asm, aIdx) => (
//                                                             <div key={asm.id} className="grid grid-cols-1 md:grid-cols-12 gap-3 p-4 bg-slate-50/50 rounded-2xl border border-slate-100 items-center">
//                                                                 <div className="md:col-span-4">
//                                                                     <select className="w-full bg-white border border-slate-200 rounded-xl p-3 font-bold text-xs outline-none"
//                                                                             value={asm.type} onChange={(e) => { const n = [...semesters]; n[sIdx].subjects[subIdx].assessments[aIdx].type = e.target.value; onUpdate(n); }}>
//                                                                         <option>Quiz</option><option>Assignment</option><option>Mid Exam</option><option>Final Exam</option><option>Project</option>
//                                                                     </select>
//                                                                 </div>
//                                                                 <div className="md:col-span-2"><input type="number" placeholder="W%" className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-bold text-center"
//                                                                            value={asm.weight} onChange={(e) => { const n = [...semesters]; n[sIdx].subjects[subIdx].assessments[aIdx].weight = e.target.value; onUpdate(n); }} /></div>
//                                                                 <div className="md:col-span-2"><input type="number" placeholder="Tot" className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-bold text-center"
//                                                                            value={asm.total} onChange={(e) => { const n = [...semesters]; n[sIdx].subjects[subIdx].assessments[aIdx].total = e.target.value; onUpdate(n); }} /></div>
//                                                                 <div className="md:col-span-2"><input type="number" placeholder="Obt" className="w-full bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs font-black text-center text-blue-700"
//                                                                            value={asm.obt} onChange={(e) => { const n = [...semesters]; n[sIdx].subjects[subIdx].assessments[aIdx].obt = e.target.value; onUpdate(n); }} /></div>
//                                                                 <div className="md:col-span-2 text-right"><button className="text-red-400 font-black text-[9px] uppercase tracking-widest"
//                                                                             onClick={() => { const n = [...semesters]; n[sIdx].subjects[subIdx].assessments.splice(aIdx, 1); onUpdate(n); }}>Remove</button></div>
//                                                             </div>
//                                                         ))}
//                                                         <button className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 text-[10px] font-black tracking-[0.3em] hover:bg-slate-50"
//                                                                 onClick={() => {
//                                                                     const n = [...semesters];
//                                                                     if(!n[sIdx].subjects[subIdx].assessments) n[sIdx].subjects[subIdx].assessments = [];
//                                                                     n[sIdx].subjects[subIdx].assessments.push({id: Date.now(), type:'Quiz', weight:10, total:40, obt:0});
//                                                                     onUpdate(n);
//                                                                 }}>+ ADD COMPONENT</button>
//                                                     </div>
//                                                 )}
//                                             </div>
//                                         </div>
//                                     );
//                                 })}
//                                 <button onClick={() => {
//                                     const n = [...semesters];
//                                     n[sIdx].subjects.push({id: Date.now(), title: '', ch: 3, simpleObt: 0, mode: 'simple', assessments: []});
//                                     onUpdate(n);
//                                 }} className="w-full bg-white text-slate-400 border-2 border-dashed border-slate-200 py-5 rounded-[2.5rem] font-black text-[9px] tracking-[0.4em] hover:border-black hover:text-black transition-all shadow-sm">+ ADD COURSE</button>
//                             </motion.div>
//                         );
//                     })}
//                 </AnimatePresence>

//                 <div className="flex flex-col items-center mt-32 space-y-8">
//                     <button onClick={() => window.print()} 
//                             className="bg-[#0f172a] text-white px-16 py-7 rounded-[3.5rem] font-black shadow-2xl hover:scale-105 active:scale-95 transition-all w-full max-w-xl text-xl tracking-[0.3em]">
//                         🖨️ PRINT TRANSCRIPT
//                     </button>
//                     <button onClick={() => auth.signOut()} className="text-slate-400 font-bold hover:text-red-500 uppercase tracking-[0.4em] text-[10px] pb-10">End Session</button>
//                 </div>
//             </main>
//         </div>
//     );
// };

// export default Dashboard;



import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { auth } from '../services/firebase';
import { parseSuperiorTranscript, calculateGrade } from '../services/pdfParser';

const Dashboard = ({ user, semesters, onUpdate }) => {

    // --- Math Engine & Functionality ---
    const getSubjectStats = (sub) => {
        let score = 0, weight = 0;
        if (sub?.mode === 'assessment' && sub?.assessments?.length > 0) {
            sub.assessments.forEach(a => {
                const w = parseFloat(a.weight) || 0;
                const obt = parseFloat(a.obt) || 0;
                const tot = parseFloat(a.total) || 1;
                weight += w;
                score += (obt / tot) * w;
            });
        } else {
            score = parseFloat(sub?.simpleObt) || 0;
            weight = 100;
        }
        const gInfo = calculateGrade(score) || { g: 'F', p: 0.0 };
        return { score, weight, gInfo };
    };

    const calculateSGPA = (subjects) => {
        let semQP = 0, semCH = 0;
        (subjects || []).forEach(sub => {
            const stats = getSubjectStats(sub);
            const ch = parseFloat(sub.ch) || 0;
            semQP += (stats.gInfo.p * ch);
            semCH += ch;
        });
        return (semCH > 0 ? (semQP / semCH) : 0).toFixed(2);
    };

    let totalQP = 0, totalCH = 0;
    (semesters || []).forEach(s => (s.subjects || []).forEach(sub => {
        const stats = getSubjectStats(sub);
        const ch = parseFloat(sub.ch) || 0;
        totalQP += (stats.gInfo.p * ch); 
        totalCH += ch;
    }));
    const cgpa = (totalCH > 0 ? (totalQP / totalCH) : 0).toFixed(2);

    return (
        <div className="min-h-screen bg-[#f8fafc] pb-10 font-sans text-slate-900 overflow-x-hidden">
            {/* 1. Header: Responsive Flex */}
            <header className="bg-linear-to-br from-[#0f172a] via-superior-blue to-[#2563eb] pt-10 pb-24 md:pb-32 px-4 md:px-6 rounded-b-[2.5rem] md:rounded-b-[4rem] shadow-2xl text-white">
                <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
                    <div className="flex items-center gap-4 md:gap-6">
                        <img src={user?.photoURL || `https://ui-avatars.com/api/?name=${user?.displayName}&background=random`} 
                             className="w-14 h-14 md:w-20 md:h-20 rounded-full border-4 border-white/20 shadow-xl" alt="Profile" />
                        <div>
                            <h2 className="text-xl md:text-3xl font-black tracking-tight">{user?.displayName || 'Student'}</h2>
                            <p className="text-blue-100/70 text-xs md:text-sm font-medium italic truncate max-w-50 md:max-w-none">{user?.email}</p>
                        </div>
                    </div>
                    
                    <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} 
                                className="bg-white/10 backdrop-blur-3xl border border-white/20 p-6 md:p-8 rounded-4xl md:rounded-[3rem] text-center min-w-45 md:min-w-60 shadow-inner">
                        <span className="text-[9px] md:text-[11px] font-black tracking-[0.3em] uppercase opacity-60">OVERALL CGPA</span>
                        <h1 className="text-5xl md:text-7xl font-black my-1 leading-none">{cgpa}</h1>
                        <p className="text-[9px] md:text-[10px] font-bold opacity-50 uppercase tracking-widest mt-2">Total Credits: {totalCH}</p>
                    </motion.div>
                </div>
            </header>

            <main className="max-w-5xl mx-auto -mt-12 md:-mt-20 px-4 md:px-6">
                {/* 2. Responsive Action Bar */}
                <div className="flex flex-col sm:flex-row justify-center gap-3 md:gap-4 mb-10 md:mb-16">
                    <button onClick={() => document.getElementById('mainPdfIn').click()}
                            className="w-full sm:w-auto bg-white text-blue-700 px-6 md:px-10 py-4 md:py-5 rounded-xl md:rounded-2xl font-black shadow-lg hover:shadow-2xl transition-all flex items-center justify-center gap-2 border border-blue-100">
                        📄 <span className="text-sm md:text-base">Import PDF</span>
                    </button>
                    <button onClick={() => onUpdate([...semesters, { id: Date.now(), name: 'New Semester', subjects: [] }])} 
                            className="w-full sm:w-auto bg-blue-600 text-white px-6 md:px-10 py-4 md:py-5 rounded-xl md:rounded-2xl font-black shadow-lg hover:bg-blue-700 transition-all text-sm md:text-base">
                        + Add Semester
                    </button>
                    <input type="file" id="mainPdfIn" hidden onChange={(e) => {
                        if (!e.target.files[0]) return;
                        parseSuperiorTranscript(e.target.files[0]).then(data => onUpdate([...semesters, ...data]));
                    }} accept=".pdf" />
                </div>

                <AnimatePresence>
                    {(semesters || []).map((sem, sIdx) => {
                        const semSGPA = calculateSGPA(sem.subjects);
                        return (
                            <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} key={sem.id} className="mb-12 md:mb-20">
                                {/* 3. Responsive Semester Header */}
                                <div className="flex flex-wrap items-center gap-3 md:gap-6 mb-6 md:mb-8 px-2 md:px-6">
                                    <div className="flex items-center gap-2 md:gap-4">
                                        <span className="bg-blue-600 text-white w-6 h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center font-black text-[10px] md:text-xs shadow-lg shadow-blue-200">{sIdx + 1}</span>
                                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                                            <input className="bg-transparent border-none text-slate-800 font-black uppercase tracking-[0.2em] md:tracking-[0.3em] text-xs md:text-sm outline-none w-fit"
                                                   value={sem.name} onChange={(e) => { const n = [...semesters]; n[sIdx].name = e.target.value; onUpdate(n); }} />
                                            <span className="bg-blue-100 text-blue-700 px-2 md:px-3 py-1 rounded-full text-[8px] md:text-[10px] font-black uppercase tracking-widest w-fit">SGPA: {semSGPA}</span>
                                        </div>
                                    </div>
                                    <div className="hidden sm:block h-2 bg-slate-200 grow"></div>
                                    <button onClick={() => onUpdate(semesters.filter(s => s.id !== sem.id))} className="text-red-300 hover:text-red-500 font-bold text-[8px] md:text-[10px] uppercase tracking-widest ml-auto sm:ml-0">Remove</button>
                                </div>

                                {/* 4. Responsive Subject Cards */}
                                {(sem.subjects || []).map((sub, subIdx) => {
                                    const stats = getSubjectStats(sub);
                                    return (
                                        <div key={sub.id} className="bg-white border-2 border-slate-200 rounded-3xl md:rounded-3xl p-5 md:p-8 mb-4 md:mb-6 shadow-sm relative group hover:border-black transition-all hover:shadow-xl">
                                            <button className="absolute -top-2 -right-2 md:-top-3 md:-right-3 bg-red-500 text-white w-6 h-6 md:w-8 md:h-8 rounded-lg md:rounded-xl shadow-lg flex items-center justify-center font-black z-10 sm:opacity-0 group-hover:opacity-100 transition-opacity"
                                                    onClick={() => { const n = [...semesters]; n[sIdx].subjects.splice(subIdx, 1); onUpdate(n); }}>✕</button>

                                            <div className="flex flex-col xl:flex-row gap-6">
                                                <div className="grow space-y-4 md:space-y-6">
                                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 md:gap-4">
                                                        <div className="md:col-span-3">
                                                            <label className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Course</label>
                                                            <input className="w-full bg-slate-50 border-2 border-slate-100 rounded-lg md:rounded-xl px-3 md:px-4 py-2 md:py-3 focus:border-black outline-none font-bold text-sm md:text-base"
                                                                   value={sub.title} onChange={(e) => { const n = [...semesters]; n[sIdx].subjects[subIdx].title = e.target.value; onUpdate(n); }} />
                                                        </div>
                                                        <div className="w-20 md:w-auto">
                                                            <label className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block md:text-center">CH</label>
                                                            <input type="number" className="w-full bg-slate-50 border-2 border-slate-100 rounded-lg md:rounded-xl px-3 md:px-4 py-2 md:py-3 outline-none font-black text-sm md:text-base md:text-center focus:border-black"
                                                                   value={sub.ch} onChange={(e) => { const n = [...semesters]; n[sIdx].subjects[subIdx].ch = e.target.value; onUpdate(n); }} />
                                                        </div>
                                                    </div>

                                                    <div className="inline-flex bg-slate-50 p-1 rounded-lg md:rounded-xl border border-slate-200">
                                                        <button className={`px-4 md:px-6 py-1.5 md:py-2 rounded-md md:rounded-lg text-[8px] md:text-[9px] font-black tracking-widest transition-all ${sub.mode !== 'assessment' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}
                                                                onClick={() => { const n = [...semesters]; n[sIdx].subjects[subIdx].mode = 'simple'; onUpdate(n); }}>SIMPLE</button>
                                                        <button className={`px-4 md:px-6 py-1.5 md:py-2 rounded-md md:rounded-lg text-[8px] md:text-[9px] font-black tracking-widest transition-all ${sub.mode === 'assessment' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}
                                                                onClick={() => { const n = [...semesters]; n[sIdx].subjects[subIdx].mode = 'assessment'; onUpdate(n); }}>ADVANCED</button>
                                                    </div>
                                                </div>

                                                {/* 5. Responsive Grade Preview */}
                                                <div className="xl:w-48 bg-slate-50 border-2 border-slate-100 rounded-3xl md:rounded-[2.5rem] p-5 md:p-6 flex flex-row xl:flex-col items-center justify-between xl:justify-center text-center shadow-inner group-hover:bg-white transition-colors">
                                                    <div className="text-left xl:text-center">
                                                        <span className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Score</span>
                                                        <div className="text-2xl md:text-3xl font-black text-slate-900 tracking-tighter">{(stats.score || 0).toFixed(0)}%</div>
                                                    </div>
                                                    <div className="mt-0 xl:mt-4 px-3 md:px-4 py-1.5 bg-blue-600 text-white rounded-lg md:rounded-xl font-black text-xs md:text-base shadow-lg shadow-blue-200">
                                                        {stats.gInfo?.g} ({(stats.gInfo?.p || 0.0).toFixed(1)})
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Dynamic Content: Simple/Advanced Modes */}
                                            <div className="mt-4 md:mt-6">
                                                {sub.mode !== 'assessment' ? (
                                                    <div className="p-4 md:p-6 bg-blue-50/30 rounded-3xl md:rounded-[2.5rem] border-2 border-dashed border-blue-100 text-center">
                                                        <label className="text-[8px] md:text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2 md:mb-3 block">Obtained Marks</label>
                                                        <input type="number" className="w-full max-w-37.5 md:max-w-xs bg-white border-2 border-blue-100 rounded-xl md:rounded-2xl px-4 md:px-6 py-3 md:py-4 font-black text-2xl md:text-3xl text-center text-blue-700 outline-none"
                                                               value={sub.simpleObt} onChange={(e) => { const n = [...semesters]; n[sIdx].subjects[subIdx].simpleObt = e.target.value; onUpdate(n); }} />
                                                    </div>
                                                ) : (
                                                    <div className="space-y-3 md:space-y-4">
                                                        {sub.assessments?.map((asm, aIdx) => (
                                                            <div key={asm.id} className="grid grid-cols-2 md:grid-cols-12 gap-2 md:gap-3 p-3 md:p-4 bg-slate-50/50 rounded-xl md:rounded-2xl border border-slate-100 items-center">
                                                                <div className="col-span-2 md:col-span-4">
                                                                    <select className="w-full bg-white border border-slate-200 rounded-lg md:rounded-xl p-2 md:p-3 font-bold text-[10px] md:text-xs outline-none"
                                                                            value={asm.type} onChange={(e) => { const n = [...semesters]; n[sIdx].subjects[subIdx].assessments[aIdx].type = e.target.value; onUpdate(n); }}>
                                                                        <option>Quiz</option><option>Assignment</option><option>Mid Exam</option><option>Final Exam</option><option>Project</option>
                                                                    </select>
                                                                </div>
                                                                <div className="md:col-span-2 flex flex-col items-center">
                                                                    <span className="md:hidden text-[7px] font-bold text-slate-400 uppercase">Weight %</span>
                                                                    <input type="number" className="w-full bg-white border border-slate-200 rounded-lg md:rounded-xl p-2 md:p-3 text-[10px] md:text-xs font-bold text-center"
                                                                           value={asm.weight} onChange={(e) => { const n = [...semesters]; n[sIdx].subjects[subIdx].assessments[aIdx].weight = e.target.value; onUpdate(n); }} />
                                                                </div>
                                                                <div className="md:col-span-2 flex flex-col items-center">
                                                                    <span className="md:hidden text-[7px] font-bold text-slate-400 uppercase">Total</span>
                                                                    <input type="number" className="w-full bg-white border border-slate-200 rounded-lg md:rounded-xl p-2 md:p-3 text-[10px] md:text-xs font-bold text-center"
                                                                           value={asm.total} onChange={(e) => { const n = [...semesters]; n[sIdx].subjects[subIdx].assessments[aIdx].total = e.target.value; onUpdate(n); }} />
                                                                </div>
                                                                <div className="md:col-span-2 flex flex-col items-center">
                                                                    <span className="md:hidden text-[7px] font-bold text-slate-400 uppercase">Obtained</span>
                                                                    <input type="number" className="w-full bg-blue-50 border border-blue-200 rounded-lg md:rounded-xl p-2 md:p-3 text-[10px] md:text-xs font-black text-center text-blue-700"
                                                                           value={asm.obt} onChange={(e) => { const n = [...semesters]; n[sIdx].subjects[subIdx].assessments[aIdx].obt = e.target.value; onUpdate(n); }} />
                                                                </div>
                                                                <div className="col-span-2 md:col-span-2 text-right">
                                                                    <button className="text-red-400 font-black text-[8px] md:text-[9px] uppercase tracking-widest w-full md:w-auto"
                                                                            onClick={() => { const n = [...semesters]; n[sIdx].subjects[subIdx].assessments.splice(aIdx, 1); onUpdate(n); }}>Remove</button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                        <button className="w-full py-3 md:py-4 border-2 border-dashed border-slate-200 rounded-xl md:rounded-4xl text-slate-400 text-[8px] md:text-[10px] font-black tracking-[0.2em] hover:bg-slate-50"
                                                                onClick={() => {
                                                                    const n = [...semesters];
                                                                    if(!n[sIdx].subjects[subIdx].assessments) n[sIdx].subjects[subIdx].assessments = [];
                                                                    n[sIdx].subjects[subIdx].assessments.push({id: Date.now(), type:'Quiz', weight:10, total:40, obt:0});
                                                                    onUpdate(n);
                                                                }}>+ ADD COMPONENT</button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                                <button onClick={() => {
                                    const n = [...semesters];
                                    n[sIdx].subjects.push({id: Date.now(), title: '', ch: 3, simpleObt: 0, mode: 'simple', assessments: []});
                                    onUpdate(n);
                                }} className="w-full bg-white text-slate-400 border-2 border-dashed border-slate-200 py-4 md:py-5 rounded-3xl md:rounded-[2.5rem] font-black text-[8px] md:text-[9px] tracking-[0.3em] hover:border-black hover:text-black transition-all shadow-sm">+ ADD COURSE</button>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>

                <div className="flex flex-col items-center mt-16 md:mt-32 space-y-6 md:space-y-8">
                    <button onClick={() => window.print()} 
                            className="bg-[#0f172a] text-white px-8 md:px-16 py-5 md:py-7 rounded-4xl md:rounded-[3.5rem] font-black shadow-2xl hover:scale-105 active:scale-95 transition-all w-full max-w-xl text-sm md:text-xl tracking-[0.2em]">
                        🖨️ PRINT TRANSCRIPT
                    </button>
                    <button onClick={() => auth.signOut()} className="text-slate-400 font-bold hover:text-red-500 uppercase tracking-[0.3em] text-[8px] md:text-[10px] pb-10">End Session</button>
                </div>
            </main>
        </div>
    );
};

export default Dashboard;