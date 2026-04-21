"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { register } from "@/lib/api";
import { UserPlus, User, Mail, Lock, CheckCircle2, Circle, AlertCircle } from "lucide-react";

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    role: "rider",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const data = await register(formData);
      router.push(`/app/${data.user.profile?.role || "rider"}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center bg-[#0d1117] overflow-hidden px-4">
      {/* Background Glows */}
      <div className="absolute top-0 right-0 w-[50%] h-[50%] bg-indigo-500/10 blur-[150px] rounded-full" />
      <div className="absolute bottom-0 left-0 w-[50%] h-[50%] bg-emerald-500/5 blur-[150px] rounded-full" />

      <div className="relative w-full max-w-xl animate-in fade-in zoom-in slide-in-from-top-4 duration-700">
        <div className="bg-white/[0.03] border border-white/[0.08] backdrop-blur-2xl rounded-[3rem] p-10 shadow-2xl">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.3)] mb-6">
              <UserPlus className="text-white" size={32} />
            </div>
            <h1 className="text-4xl font-black text-white tracking-tighter uppercase mb-2">Join Hitch-Hike</h1>
            <p className="text-slate-500 font-medium text-sm">Create your identity and start moving</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Role Selection */}
            <div className="grid grid-cols-2 gap-4">
              {[
                { id: "rider", label: "I want to Ride", desc: "Book & request rides" },
                { id: "driver", label: "I want to Drive", desc: "Earn by sharing seats" },
              ].map((role) => (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => setFormData({ ...formData, role: role.id })}
                  className={`relative flex flex-col items-start p-5 rounded-3xl border-2 transition-all duration-300 text-left ${
                    formData.role === role.id
                      ? "bg-indigo-500/10 border-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.2)]"
                      : "bg-white/[0.02] border-white/[0.06] hover:border-white/[0.2]"
                  }`}
                >
                  <div className="absolute top-5 right-5">
                    {formData.role === role.id ? (
                      <CheckCircle2 size={18} className="text-indigo-400" />
                    ) : (
                      <Circle size={18} className="text-slate-700" />
                    )}
                  </div>
                  <h3 className={`text-sm font-black uppercase tracking-widest mb-1 ${formData.role === role.id ? "text-indigo-400" : "text-white"}`}>
                    {role.id}
                  </h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">{role.desc}</p>
                </button>
              ))}
            </div>

            <div className="grid md:grid-cols-2 gap-5">
              <div className="relative group">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-400 transition-colors" size={18} />
                <input
                  type="text"
                  placeholder="Username"
                  required
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-emerald-500/50 outline-none rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-slate-600 font-medium transition-all"
                />
              </div>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-400 transition-colors" size={18} />
                <input
                  type="email"
                  placeholder="Email Address"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-emerald-500/50 outline-none rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-slate-600 font-medium transition-all"
                />
              </div>
            </div>

            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-400 transition-colors" size={18} />
              <input
                type="password"
                placeholder="Create Password"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-emerald-500/50 outline-none rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-slate-600 font-medium transition-all"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-rose-400 bg-rose-400/10 border border-rose-400/20 px-4 py-3 rounded-xl text-xs font-bold animate-in fade-in">
                <AlertCircle size={14} />
                {error}
              </div>
            )}

            <button
              disabled={loading}
              className="w-full py-5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl transition-all shadow-lg shadow-emerald-600/20 active:scale-[0.98]"
            >
              {loading ? "Creating Profile..." : "Create Account"}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-xs font-bold text-slate-500">
              Already have an account?{" "}
              <button
                onClick={() => router.push("/login")}
                className="text-emerald-400 hover:text-emerald-300 transition-colors ml-1"
              >
                Sign in instead
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
