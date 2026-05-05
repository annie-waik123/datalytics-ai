import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { HiOutlineEye, HiOutlineEyeSlash } from 'react-icons/hi2';

const API_URL = "/api/auth";

export default function AuthSystem({ onClose, onSuccess, initialView = 'login' }) {
  const [view, setView] = useState(initialView); // login, signup, otp, forgot, reset
  const [form, setForm] = useState({ fullName: '', email: '', password: '', confirmPassword: '', otp: '', acceptedTerms: false });
  const [loading, setLoading] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm({ ...form, [name]: type === 'checkbox' ? checked : value });
    setError('');

    // Auto-verify when OTP reaches 6 digits
    if (name === 'otp' && value.length === 6 && view === 'otp') {
      setTimeout(() => {
        onVerifyOTP({ preventDefault: () => {} }, value);
      }, 100);
    }
  };

  const handleAction = async (endpoint, payload) => {
    setLoading(true); setError(''); setMessage('');
    try {
      const res = await fetch(`${API_URL}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Request failed');
      return data;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const onLogin = async (e) => {
    e.preventDefault();
    const data = await handleAction('login', { email: form.email, password: form.password });
    if (data?.token) {
      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('datalytics_welcome_shown', 'false');
      localStorage.setItem('datalytics_welcome_type', 'back');
      setMessage("Login Successful!");
      setIsRedirecting(true);
      setTimeout(() => {
        onSuccess(data.user);
        // Dispatch with a small delay to ensure AppShell is ready
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('datalytics:login-success'));
        }, 100);
      }, 1000);
    } else if (data) { 
      setMessage(data.message); 
      setView('otp'); 
    }
  };

  const onSignup = async (e) => {
    e.preventDefault();
    if(form.password !== form.confirmPassword) return setError("Passwords don't match");
    if(!form.acceptedTerms) return setError("Please accept the Terms & Conditions and Privacy Policy.");
    const data = await handleAction('signup', { fullName: form.fullName, email: form.email, password: form.password, confirmPassword: form.confirmPassword, acceptedTerms: form.acceptedTerms });
    if (data) { 
      setMessage(data.message); 
      setIsRedirecting(true);
      setTimeout(() => {
        setView('otp');
        setIsRedirecting(false);
      }, 1500);
    }
  };

  const onVerifyOTP = async (e, directOtp) => {
    if (e) e.preventDefault();
    const otpValue = directOtp || form.otp;
    const data = await handleAction('verify-otp', { email: form.email, otp: otpValue });
    if (data?.token) {
      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('datalytics_welcome_shown', 'false');
      localStorage.setItem('datalytics_welcome_type', 'new');
      setMessage("Verification Successful!");
      setIsRedirecting(true);
      setTimeout(() => {
        onSuccess(data.user);
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('datalytics:login-success'));
        }, 100);
      }, 1000);
    }
  };

  const onForgotPassword = async (e) => {
    e.preventDefault();
    const data = await handleAction('forgot-password', { email: form.email });
    if (data) {
      setMessage(data.message || 'Password reset code sent.');
      setView('reset');
    }
  };

  const onResetPassword = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) return setError("Passwords don't match");
    const data = await handleAction('reset-password', {
      email: form.email,
      otp: form.otp,
      password: form.password,
      confirmPassword: form.confirmPassword,
    });
    if (data) {
      setMessage(data.message || 'Password reset successful.');
      setForm((prev) => ({ ...prev, password: '', confirmPassword: '', otp: '' }));
      setView('login');
    }
  };

  const onGoogleSuccess = async (cred) => {
    const data = await handleAction('google', { token: cred.credential });
    if (data?.token) {
      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('datalytics_welcome_shown', 'false');
      localStorage.setItem('datalytics_welcome_type', 'back');
      setMessage("Google Login Successful!");
      setIsRedirecting(true);
      setTimeout(() => {
        onSuccess(data.user);
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('datalytics:login-success'));
        }, 100);
      }, 1000);
    }
  };

  return (
    <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "dummy-id"}>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#050811]/90 backdrop-blur-[20px] overflow-y-auto p-4 md:p-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          className="relative w-full max-w-4xl flex flex-col md:flex-row bg-[#0a0e1a] border border-white/10 rounded-2xl overflow-hidden shadow-2xl shadow-black/50 my-auto"
        >
          {/* LEFT SIDE: Features & Branding */}
          <div className="md:w-[45%] p-8 lg:p-10 bg-gradient-to-br from-[#0d1225] to-[#0a0e1a] flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none">
              <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#ff4d2e]/10 rounded-full blur-[120px]" />
              <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#ff9d00]/10 rounded-full blur-[120px]" />
            </div>

            <div className="relative z-10">
              <div className="inline-block px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[9px] font-bold tracking-[0.2em] text-white/60 mb-6">
                DATALYTICS
              </div>
              
              <h1 className="text-2xl lg:text-3xl font-extrabold text-white leading-tight mb-4">
                Login to a real-time <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff4d2e] to-[#ff9d00]">data science cockpit</span> built for unified analytics.
              </h1>
              
              <p className="text-slate-400 text-sm mb-8 max-w-sm leading-relaxed">
                Analyze datasets, train models, and get AI-driven insights in one place. Experience the future of automated ML.
              </p>

              <div className="space-y-2.5">
                {[
                  { icon: "📊", text: "Live dashboard with advanced data insights" },
                  { icon: "🧠", text: "AI copilot for quick decisions and chat support" },
                  { icon: "🛠️", text: "Auto-ML and interactive reporting engine" }
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors group">
                    <span className="text-base">{item.icon}</span>
                    <span className="text-[11px] font-medium text-slate-400 group-hover:text-white transition-colors">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 relative z-10">
              <p className="text-[9px] text-slate-600 font-medium tracking-wider uppercase">© 2026 DATALYTICS | Developed by SANGAM SINGH</p>
            </div>
          </div>

          {/* RIGHT SIDE: Form */}
          <div className="md:w-[55%] p-8 lg:p-10 bg-[#0d1225]/30 flex flex-col justify-center relative">
            {!isRedirecting && !loading && (
              <button 
                onClick={onClose} 
                type="button" 
                className="absolute top-6 right-6 text-slate-500 hover:text-white transition-all p-1.5 bg-white/5 hover:bg-white/10 rounded-full z-[100]"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            )}

            <div className="max-w-xs mx-auto w-full">
              <div className="text-center mb-8">
                <div className="flex items-center justify-center gap-2.5 mb-4">
                  <div className="flex items-end gap-1 h-8">
                    <div className="w-2 h-[60%] rounded-full bg-gradient-to-t from-[#ff4d2e] to-[#ff9d00]" />
                    <div className="w-2 h-[100%] rounded-full bg-gradient-to-t from-[#ff4d2e] to-[#ff9d00]" />
                    <div className="w-2 h-[80%] rounded-full bg-gradient-to-t from-[#ff4d2e] to-[#ff9d00]" />
                  </div>
                  <span className="text-2xl font-extrabold text-white tracking-tight">Datalytics</span>
                </div>
                <h2 className="text-xl font-bold text-white mb-1.5">Welcome Back</h2>
                <p className="text-slate-500 text-[10px]">Login to your dashboard</p>
              </div>

              {error && <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] font-medium flex items-center gap-2.5">
                <span className="w-1 h-1 rounded-full bg-red-500 animate-pulse" />
                {error}
              </div>}
              
              {message && <div className="mb-4 p-3 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[11px] font-medium flex items-center gap-2.5">
                <span className="w-1 h-1 rounded-full bg-orange-500 animate-pulse" />
                {message}
              </div>}

              <AnimatePresence mode="wait">
                {view === 'login' && (
                  <motion.form key="login" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} onSubmit={onLogin} className="space-y-3">
                    <div className="relative group">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm group-focus-within:text-[#ff9d00] transition-colors">✉</span>
                      <input required type="email" name="email" value={form.email} onChange={handleChange} placeholder="Email Address" className="w-full pl-10 pr-4 py-3 rounded-full bg-[#0a0e1a] border border-white/10 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-[#ff9d00]/50 focus:ring-4 focus:ring-[#ff9d00]/10 transition-all" />
                    </div>
                    <div className="relative group">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm group-focus-within:text-[#ff9d00] transition-colors">🔒</span>
                      <input required type={showPassword ? "text" : "password"} name="password" value={form.password} onChange={handleChange} placeholder="Password" className="w-full pl-10 pr-12 py-3 rounded-full bg-[#0a0e1a] border border-white/10 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-[#ff9d00]/50 focus:ring-4 focus:ring-[#ff9d00]/10 transition-all" />
                      <button 
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                      >
                        {showPassword ? <HiOutlineEyeSlash size={18} /> : <HiOutlineEye size={18} />}
                      </button>
                    </div>
                    <div className="flex justify-end">
                      <button type="button" onClick={() => { setView('forgot'); setError(''); setMessage(''); }} className="text-[11px] font-semibold text-[#ff9d00] hover:text-[#ffb347] transition-colors">
                        Forgot password?
                      </button>
                    </div>
                    <button disabled={loading || isRedirecting} type="submit" className="w-full py-3 rounded-full bg-gradient-to-r from-[#ff4d2e] to-[#ff9d00] text-white text-sm font-bold hover:shadow-lg hover:shadow-[#ff4d2e]/30 transition-all flex justify-center items-center gap-2 disabled:opacity-50 mt-2">
                      {loading || isRedirecting ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Login"}
                    </button>
                    {(loading || isRedirecting) && (
                      <p className="text-center text-[10px] text-[#ff9d00] mt-2 animate-pulse font-medium">
                        {isRedirecting ? "Preparing your data cockpit... Please wait." : "Authenticating..."}
                      </p>
                    )}
                  </motion.form>
                )}

                {view === 'signup' && (
                  <motion.form key="signup" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} onSubmit={onSignup} className="space-y-3">
                    <div className="relative group">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm group-focus-within:text-[#ff9d00] transition-colors">👤</span>
                      <input required type="text" name="fullName" value={form.fullName} onChange={handleChange} placeholder="Full Name" className="w-full pl-10 pr-4 py-3 rounded-full bg-[#0a0e1a] border border-white/10 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-[#ff9d00]/50 focus:ring-4 focus:ring-[#ff9d00]/10 transition-all" />
                    </div>
                    <div className="relative group">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm group-focus-within:text-[#ff9d00] transition-colors">✉</span>
                      <input required type="email" name="email" value={form.email} onChange={handleChange} placeholder="Email Address" className="w-full pl-10 pr-4 py-3 rounded-full bg-[#0a0e1a] border border-white/10 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-[#ff9d00]/50 focus:ring-4 focus:ring-[#ff9d00]/10 transition-all" />
                    </div>
                    <div className="relative group">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm group-focus-within:text-[#ff9d00] transition-colors">🔒</span>
                      <input required type={showPassword ? "text" : "password"} name="password" value={form.password} onChange={handleChange} placeholder="Password" className="w-full pl-10 pr-12 py-3 rounded-full bg-[#0a0e1a] border border-white/10 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-[#ff9d00]/50 focus:ring-4 focus:ring-[#ff9d00]/10 transition-all" />
                      <button 
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                      >
                        {showPassword ? <HiOutlineEyeSlash size={18} /> : <HiOutlineEye size={18} />}
                      </button>
                    </div>
                    <div className="relative group">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm group-focus-within:text-[#ff9d00] transition-colors">🛡️</span>
                      <input required type={showConfirmPassword ? "text" : "password"} name="confirmPassword" value={form.confirmPassword} onChange={handleChange} placeholder="Confirm Password" className="w-full pl-10 pr-12 py-3 rounded-full bg-[#0a0e1a] border border-white/10 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-[#ff9d00]/50 focus:ring-4 focus:ring-[#ff9d00]/10 transition-all" />
                      <button 
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                      >
                        {showConfirmPassword ? <HiOutlineEyeSlash size={18} /> : <HiOutlineEye size={18} />}
                      </button>
                    </div>
                    <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-[11px] leading-relaxed text-slate-400">
                      <input
                        required
                        type="checkbox"
                        name="acceptedTerms"
                        checked={form.acceptedTerms}
                        onChange={handleChange}
                        className="mt-0.5 h-4 w-4 rounded border-white/20 bg-[#0a0e1a] accent-[#ff9d00]"
                      />
                      <span>
                        I agree to the <span className="font-semibold text-slate-200">Terms & Conditions</span>, <span className="font-semibold text-slate-200">Privacy Policy</span>, and responsible data-use guidelines.
                      </span>
                    </label>
                    <button disabled={loading || isRedirecting} type="submit" className="w-full py-3 rounded-full bg-gradient-to-r from-[#ff4d2e] to-[#ff9d00] text-white text-sm font-bold hover:shadow-lg hover:shadow-[#ff4d2e]/30 transition-all flex justify-center items-center gap-2 disabled:opacity-50 mt-2">
                      {loading || isRedirecting ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Create Account"}
                    </button>
                    {(loading || isRedirecting) && (
                      <p className="text-center text-[10px] text-[#ff9d00] mt-2 animate-pulse font-medium">
                        {isRedirecting ? "Creating your account..." : "Setting up your workspace..."}
                      </p>
                    )}
                  </motion.form>
                )}

                {view === 'otp' && (
                  <motion.form key="otp" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} onSubmit={onVerifyOTP} className="space-y-5 text-center">
                    <p className="text-slate-400 text-[11px] mb-3">We've sent a 6-digit code to {form.email}</p>
                    <input required type="text" name="otp" maxLength={6} value={form.otp} onChange={handleChange} placeholder="000000" className="w-full px-4 py-4 rounded-full bg-[#0a0e1a] border border-[#ff9d00]/30 text-white text-xl placeholder-slate-700 focus:outline-none focus:border-[#ff9d00] text-center tracking-[0.8em] font-bold transition-all" />
                    <button disabled={loading || isRedirecting} type="submit" className="w-full py-3 rounded-full bg-gradient-to-r from-[#ff4d2e] to-[#ff9d00] text-white text-sm font-bold hover:shadow-lg hover:shadow-[#ff4d2e]/30 transition-all flex justify-center items-center gap-2 disabled:opacity-50">
                      {loading || isRedirecting ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Verify & Enter"}
                    </button>
                    {(loading || isRedirecting) && (
                      <p className="text-center text-[10px] text-[#ff9d00] mt-2 animate-pulse font-medium">
                        {isRedirecting ? "Finalizing verification..." : "Verifying code..."}
                      </p>
                    )}
                    <button type="button" onClick={() => setView('login')} className="text-slate-500 hover:text-white text-[11px] font-medium transition-colors">
                      Back to login
                    </button>
                  </motion.form>
                )}

                {view === 'forgot' && (
                  <motion.form key="forgot" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} onSubmit={onForgotPassword} className="space-y-4">
                    <p className="text-center text-[11px] leading-relaxed text-slate-400">
                      Enter your registered email and we will send a secure reset code.
                    </p>
                    <div className="relative group">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm group-focus-within:text-[#ff9d00] transition-colors">Email</span>
                      <input required type="email" name="email" value={form.email} onChange={handleChange} placeholder="Email Address" className="w-full pl-16 pr-4 py-3 rounded-full bg-[#0a0e1a] border border-white/10 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-[#ff9d00]/50 focus:ring-4 focus:ring-[#ff9d00]/10 transition-all" />
                    </div>
                    <button disabled={loading} type="submit" className="w-full py-3 rounded-full bg-gradient-to-r from-[#ff4d2e] to-[#ff9d00] text-white text-sm font-bold hover:shadow-lg hover:shadow-[#ff4d2e]/30 transition-all flex justify-center items-center gap-2 disabled:opacity-50">
                      {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Send Reset Code"}
                    </button>
                    <button type="button" onClick={() => setView('login')} className="w-full text-slate-500 hover:text-white text-[11px] font-medium transition-colors">
                      Back to login
                    </button>
                  </motion.form>
                )}

                {view === 'reset' && (
                  <motion.form key="reset" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} onSubmit={onResetPassword} className="space-y-3">
                    <p className="text-center text-[11px] leading-relaxed text-slate-400">
                      Use the 6-digit code sent to {form.email || 'your email'} and create a new password.
                    </p>
                    <input required type="text" name="otp" maxLength={6} value={form.otp} onChange={handleChange} placeholder="000000" className="w-full px-4 py-4 rounded-full bg-[#0a0e1a] border border-[#ff9d00]/30 text-white text-xl placeholder-slate-700 focus:outline-none focus:border-[#ff9d00] text-center tracking-[0.8em] font-bold transition-all" />
                    <div className="relative group">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm group-focus-within:text-[#ff9d00] transition-colors">New</span>
                      <input required minLength={8} type={showPassword ? "text" : "password"} name="password" value={form.password} onChange={handleChange} placeholder="New Password" className="w-full pl-14 pr-12 py-3 rounded-full bg-[#0a0e1a] border border-white/10 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-[#ff9d00]/50 focus:ring-4 focus:ring-[#ff9d00]/10 transition-all" />
                    </div>
                    <div className="relative group">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm group-focus-within:text-[#ff9d00] transition-colors">Confirm</span>
                      <input required minLength={8} type={showConfirmPassword ? "text" : "password"} name="confirmPassword" value={form.confirmPassword} onChange={handleChange} placeholder="Confirm Password" className="w-full pl-20 pr-12 py-3 rounded-full bg-[#0a0e1a] border border-white/10 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-[#ff9d00]/50 focus:ring-4 focus:ring-[#ff9d00]/10 transition-all" />
                    </div>
                    <button disabled={loading} type="submit" className="w-full py-3 rounded-full bg-gradient-to-r from-[#ff4d2e] to-[#ff9d00] text-white text-sm font-bold hover:shadow-lg hover:shadow-[#ff4d2e]/30 transition-all flex justify-center items-center gap-2 disabled:opacity-50">
                      {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Reset Password"}
                    </button>
                    <button type="button" onClick={() => setView('login')} className="w-full text-slate-500 hover:text-white text-[11px] font-medium transition-colors">
                      Back to login
                    </button>
                  </motion.form>
                )}
              </AnimatePresence>

              {view !== 'otp' && view !== 'forgot' && view !== 'reset' && (
                <div className="mt-6 space-y-4">
                  <div className="relative flex items-center justify-center">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5"></div></div>
                    <span className="relative px-3 bg-transparent text-[9px] font-bold text-slate-600 uppercase tracking-widest">Or continue with</span>
                  </div>

                  <div className="flex justify-center w-full google-pill-fix scale-90">
                    {process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ? (
                      <GoogleLogin 
                        onSuccess={onGoogleSuccess} 
                        onError={() => setError("Google Login Failed")} 
                        theme="outline" 
                        shape="pill"
                        width="320px" 
                      />
                    ) : (
                      <div className="text-[10px] text-slate-600 text-center italic border border-white/5 rounded-full px-4 py-2">
                        Google Sign-in currently unavailable
                      </div>
                    )}
                  </div>
                  {(loading || isRedirecting) && (
                    <p className="text-center text-[10px] text-[#ff9d00] animate-pulse font-medium">
                      {isRedirecting ? "Entering cockpit..." : "Syncing with Google..."}
                    </p>
                  )}

                  <style jsx global>{`
                    .google-pill-fix iframe {
                      border-radius: 9999px !important;
                    }
                    .google-pill-fix > div {
                      border-radius: 9999px !important;
                    }
                  `}</style>

                  <p className="text-center text-sm text-slate-500">
                    {view === 'login' ? "Don't have an account? " : "Already have an account? "}
                    <button onClick={() => { setView(view === 'login' ? 'signup' : 'login'); setError(''); setMessage(''); }} className="text-[#ff9d00] font-bold hover:text-[#ff9d00]/80 transition-colors ml-1">
                      {view === 'login' ? "Register" : "Login"}
                    </button>
                  </p>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </GoogleOAuthProvider>
  );
}
