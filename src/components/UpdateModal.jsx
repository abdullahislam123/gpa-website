import React from 'react';
import { motion } from 'framer-motion';
// Using standard Lucide-style SVG paths for reliability
import { 
    LayoutDashboard, 
    UserCircle, 
    RefreshCcw, 
    Sparkles, 
    CheckCircle2 
} from 'lucide-react';

const UpdateModal = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    const updates = [
        { 
            title: "Dual Entry Modes", 
            desc: "Toggle between entering raw percentages or selecting direct letter grades for faster calculations.",
            icon: <LayoutDashboard className="w-4 h-4" /> 
        },
        { 
            title: "Personalized Experience", 
            desc: "The portal now welcomes you by name, creating a more personalized academic dashboard.",
            icon: <UserCircle className="w-4 h-4" /> 
        },
        { 
            title: "Instant Profile Sync", 
            desc: "Fixed the 'NU' avatar glitch; your profile picture and name now update immediately after registration.",
            icon: <RefreshCcw className="w-4 h-4" /> 
        },
        { 
            title: "Modernized Interface", 
            desc: "Introduced a sleek Indigo design system with enhanced fluid animations and rounded aesthetics.",
            icon: <Sparkles className="w-4 h-4" /> 
        }
    ];

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
            <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden border-2 border-indigo-50"
            >
                {/* Header Section */}
                <div className="bg-indigo-600 p-8 text-center text-white relative">
                    <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
                    <div className="bg-white/20 w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm border border-white/30">
                        <span className="text-3xl">🚀</span>
                    </div>
                    <h2 className="text-2xl font-black tracking-tight text-white">System Upgrade</h2>
                    <p className="text-indigo-100 text-[10px] font-black uppercase tracking-[0.2em] mt-1">Version 2.0 • Superior Portal</p>
                </div>

                {/* Updates List */}
                <div className="p-8 space-y-6">
                    {updates.map((update, i) => (
                        <div key={i} className="flex gap-4 group">
                            <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                                {update.icon}
                            </div>
                            <div>
                                <h4 className="font-black text-slate-800 text-sm tracking-tight">{update.title}</h4>
                                <p className="text-[11px] text-slate-500 font-medium leading-relaxed mt-0.5">{update.desc}</p>
                            </div>
                        </div>
                    ))}

                    {/* Action Button */}
                    <button 
                        onClick={onClose}
                        className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] shadow-xl shadow-indigo-200 hover:bg-indigo-600 transition-all active:scale-95 mt-4 flex items-center justify-center gap-2"
                    >
                        <span>Explore New Features</span>
                        <CheckCircle2 className="w-3 h-3" />
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

export default UpdateModal;