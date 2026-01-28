import React, { useState } from 'react';
import { motion } from 'framer-motion';
import emailjs from '@emailjs/browser';
import { db } from '../services/firebase'; // Firebase sync ke liye

const FeedbackModal = ({ isOpen, onClose, user }) => {
    const [msg, setMsg] = useState("");
    const [type, setType] = useState("Suggestion");
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        const feedbackData = {
            from_name: user?.displayName || "Anonymous Student",
            from_email: user?.email || "No Email",
            message: msg,
            type: type,
            date: new Date().toLocaleString()
        };

        try {
            // 1. Backup in Firebase (Unlimited)
            await db.collection('feedback').add(feedbackData);

            // 2. Send Email via EmailJS
            await emailjs.send(
                'YOUR_SERVICE_ID', 
                'YOUR_TEMPLATE_ID', 
                feedbackData, 
                'YOUR_PUBLIC_KEY'
            );

            alert("Feedback sent successfully! ❤️");
            setMsg("");
            onClose();
        } catch (error) {
            console.error("Error:", error);
            alert("Something went wrong, but we saved your feedback in our database.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-100">
                <div className="bg-indigo-600 p-6 text-white text-center">
                    <h2 className="text-xl font-black uppercase tracking-widest">Feedback & Support</h2>
                    <p className="text-indigo-100 text-[10px] font-bold mt-1">Help us make the Superior Portal better!</p>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-4">
                    <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Message Type</label>
                        <select 
                            className="w-full mt-1 bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:border-indigo-400"
                            value={type} onChange={(e) => setType(e.target.value)}
                        >
                            <option>Suggestion</option>
                            <option>Report a Bug</option>
                            <option>Technical Help</option>
                            <option>Other</option>
                        </select>
                    </div>

                    <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Your Message</label>
                        <textarea 
                            required
                            className="w-full mt-1 bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-medium outline-none focus:border-indigo-400 min-h-[120px]"
                            placeholder="Describe your suggestion or issue here..."
                            value={msg} onChange={(e) => setMsg(e.target.value)}
                        />
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose} className="flex-1 py-4 rounded-2xl font-black text-[10px] uppercase text-slate-400 hover:bg-slate-50 transition-all">Cancel</button>
                        <button 
                            type="submit" 
                            disabled={loading}
                            className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-black text-[10px] uppercase shadow-lg shadow-indigo-100 hover:scale-105 active:scale-95 transition-all"
                        >
                            {loading ? "Sending..." : "Send Message"}
                        </button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
};

export default FeedbackModal;