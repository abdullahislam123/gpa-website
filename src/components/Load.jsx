import React from 'react';
import { motion } from 'framer-motion';

const Loading = () => {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-50 overflow-hidden">
      {/* Background Soft Orbs - Lightened */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-100/50 blur-[120px] rounded-full animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-100/40 blur-[120px] rounded-full animate-pulse delay-700"></div>

      {/* Main Loader Container */}
      <div className="relative flex items-center justify-center">
        {/* Outer Rotating Ring - Indigo Theme */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }}
          className="w-24 h-24 border-t-4 border-b-4 border-indigo-600 border-l-transparent border-r-transparent rounded-full"
        ></motion.div>
        
        {/* Inner Pulsing Core - Indigo/Blue Gradient */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0.5 }}
          animate={{ scale: [0.8, 1.1, 0.8], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          className="absolute w-12 h-12 bg-linear-to-br from-indigo-500 to-indigo-700 rounded-2xl shadow-[0_10px_30px_rgba(79,70,229,0.3)]"
        ></motion.div>
      </div>

      {/* Branded Text - Darkened for Light Mode */}
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="mt-10 text-center px-6"
      >
        <h2 className="text-slate-900 text-xl font-black tracking-[0.25em] uppercase">Superior University</h2>
        <p className="text-indigo-600/70 text-[10px] font-black tracking-[0.4em] mt-3 uppercase">
          GPA Calc <span className="animate-pulse">Processing...</span>
        </p>
      </motion.div>

      {/* Progress Bar Line - Indigo Accent */}
      <div className="absolute bottom-20 w-48 h-1 bg-slate-200 rounded-full overflow-hidden">
        <motion.div
          initial={{ x: "-100%" }}
          animate={{ x: "100%" }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          className="w-1/2 h-full bg-linear-to-r from-transparent via-indigo-600 to-transparent"
        ></motion.div>
      </div>
    </div>
  );
};

export default Loading;