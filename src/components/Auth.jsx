import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { auth, googleProvider } from '../services/firebase';
// Added updateProfile and standard modular methods
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signInWithPopup, 
    updateProfile 
} from 'firebase/auth';

const Auth = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState(''); // ✅ State for name
    const [showPassword, setShowPassword] = useState(false);
    
    const handleSubmit = async (e) => {
    e.preventDefault();
    try {
        if (isLogin) {
            await signInWithEmailAndPassword(auth, email, password);
        } else {
            // 1. Account create karein
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            
            // 2. Profile update karein
            await updateProfile(userCredential.user, {
                displayName: fullName.trim()
            });

            // ✅ CRITICAL FIX: User ko reload karein taake latest displayName fetch ho
            await userCredential.user.reload(); 

            // Taake local session foran sync ho jaye
            console.log("Profile Name Synced:", auth.currentUser.displayName);
        }
    } catch (err) {
        alert(err.message);
    }
};
    const handleGoogle = () => signInWithPopup(auth, googleProvider);

    return (
        <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-6 relative overflow-hidden">
            {/* Background Decorative Elements */}
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/20 blur-[120px] rounded-full"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-400/10 blur-[120px] rounded-full"></div>

            <motion.div 
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-[3.5rem] p-8 md:p-12 w-full max-w-md shadow-2xl border-2 border-black relative z-10"
            >
                <div className="text-center mb-10">
                    <div className="flex justify-center mb-6">
                        <img src="src/assets/favicon-96x96.png" alt="Superior Logo" className="h-16 w-auto object-contain" />
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">
                        {isLogin ? 'Welcome Back' : 'Create Account'}
                    </h1>
                    <p className="text-slate-500 text-sm font-medium italic mt-2">
                        {isLogin ? 'Secure access to your GPA vault' : 'Join the academic progress tracker'}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <AnimatePresence mode="wait">
                        {!isLogin && (
                            <motion.div
                                key="name"
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                            >
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Full Name</label>
                                <input 
                                    className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-5 py-4 focus:border-blue-600 outline-none font-bold" 
                                    type="text" 
                                    placeholder="Enter full name" 
                                    value={fullName} // ✅ Linked to state
                                    onChange={(e) => setFullName(e.target.value)} // ✅ Update state
                                    required 
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>
                    
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Email Address</label>
                        <input className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-5 py-4 focus:border-blue-600 outline-none font-bold" type="email" placeholder="name@university.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                    </div>

                    <div className="relative">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Password</label>
                        <div className="relative">
                            <input 
                                className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-5 py-4 focus:border-blue-600 outline-none font-bold pr-14" 
                                type={showPassword ? "text" : "password"} 
                                placeholder="••••••••" 
                                value={password} 
                                onChange={(e) => setPassword(e.target.value)} 
                                required 
                            />
                            <button 
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600 transition-colors p-2"
                            >
                                {showPassword ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.822 7.822L21 21m-2.278-2.278L15.07 15.07m-4.47-4.47L9 9" />
                                    </svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                )}
                            </button>
                        </div>
                    </div>

                    <motion.button 
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full bg-blue-600 text-white rounded-2xl py-4 font-black tracking-[0.2em] shadow-xl shadow-blue-900/20 hover:bg-blue-700 transition-all mt-6 uppercase text-xs"
                        type="submit"
                    >
                        {isLogin ? 'Login Now' : 'Create Account'}
                    </motion.button>
                </form>

                <div className="flex items-center gap-4 my-8">
                    <div className="h-1 bg-slate-200 grow"></div>
                    <span className="text-[10px] font-black text-slate-400">OR</span>
                    <div className="h-1 bg-slate-200 grow"></div>
                </div>

                <button className="w-full bg-white border-2 border-slate-200 rounded-2xl py-4 flex items-center justify-center gap-3 font-bold text-slate-700 hover:border-black transition-all" onClick={handleGoogle}>
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="G" className="w-5 h-5" />
                    Continue with Google
                </button>

                <p className="mt-8 text-center text-sm font-medium text-slate-500">
                    {isLogin ? "New to Vault? " : "Joined already? "}
                    <span onClick={() => setIsLogin(!isLogin)} className="text-blue-600 font-black cursor-pointer hover:underline ml-1">
                        {isLogin ? 'Register' : 'Login'}
                    </span>
                </p>
            </motion.div>
        </div>
    );
};

export default Auth;