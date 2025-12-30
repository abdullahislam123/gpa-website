import React from 'react';
import { motion } from 'framer-motion';

const Loading = () => {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0f172a] overflow-hidden">
      {/* Background Animated Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 blur-[120px] rounded-full animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-400/10 blur-[120px] rounded-full animate-pulse delay-700"></div>

      {/* Main Loader */}
      <div className="relative flex items-center justify-center">
        {/* Outer Rotating Ring */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="w-24 h-24 border-t-4 border-b-4 border-blue-500 rounded-full"
        ></motion.div>
        
        {/* Inner Pulsing Core */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0.5 }}
          animate={{ scale: [0.8, 1.1, 0.8], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          className="absolute w-12 h-12 bg-linear-to-br from-blue-400 to-blue-600 rounded-2xl shadow-[0_0_30px_rgba(59,130,246,0.5)]"
        ></motion.div>
      </div>

      {/* Branded Text */}
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="mt-10 text-center"
      >
        <h2 className="text-white text-xl font-black tracking-[0.3em] uppercase">Superior University</h2>
        <p className="text-blue-400/60 text-[10px] font-bold tracking-[0.5em] mt-2 uppercase">GPA Calc is Loading</p>
      </motion.div>

      {/* Progress Bar Line */}
      <div className="absolute bottom-20 w-48 h-0.5 bg-white/5 rounded-full overflow-hidden">
        <motion.div
          initial={{ x: "-100%" }}
          animate={{ x: "100%" }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          className="w-1/2 h-full bg-linear-to-r from-transparent via-blue-500 to-transparent"
        ></motion.div>
      </div>
    </div>
  );
};

export default Loading;