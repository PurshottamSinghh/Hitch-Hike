"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/api";
import { LogIn, User, Lock, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Already logged in? Redirect to dashboard
    const user = localStorage.getItem("user");
    if (user) {
      const { profile } = JSON.parse(user);
      router.push(`/app/${profile?.role || "rider"}`);
    }
  }, [router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const data = await login(username, password);
      // Success - Redirect based on role
      const role = data.user.profile?.role || "rider";
      router.push(`/app/${role}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center bg-[#0d1117] overflow-hidden px-4">
      {/* Dynamic Background */}
      <div className="absolute top-0 left-0 w-full h-full">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 blur-[120px] rounded-full" />
      </div>

      <div className="relative w-full max-w-md animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="bg-white/[0.03] border border-white/[0.08] backdrop-blur-2xl rounded-[2.5rem] p-10 shadow-2xl">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-indigo-500 shadow-[0_0_30px_rgba(99,102,241,0.3)] mb-6">
              <LogIn className="text-white" size={32} />
            </div>
            <h1 className="text-3xl font-black text-white tracking-tighter uppercase mb-2">Welcome Back</h1>
            <p className="text-slate-500 font-medium text-sm">Sign in to continue your journey</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="relative group">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={18} />
                <input
                  type="text"
                  placeholder="Username"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-indigo-500/50 outline-none rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-slate-600 font-medium transition-all"
                />
              </div>

              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={18} />
                <input
                  type="password"
                  placeholder="Password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-indigo-500/50 outline-none rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-slate-600 font-medium transition-all"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-rose-400 bg-rose-400/10 border border-rose-400/20 px-4 py-3 rounded-xl text-xs font-bold animate-in zoom-in duration-300">
                <AlertCircle size={14} />
                {error}
              </div>
            )}

            <button
              disabled={loading}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl transition-all shadow-lg shadow-indigo-600/20 active:scale-[0.98]"
            >
              {loading ? "Authenticating..." : "Sign In"}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-xs font-bold text-slate-500">
              New to Hitch-Hike?{" "}
              <button
                onClick={() => router.push("/register")}
                className="text-indigo-400 hover:text-indigo-300 transition-colors ml-1"
              >
                Create an account
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
