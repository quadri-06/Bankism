"use client";

import { useState, useEffect } from "react";
import { useSupabase } from "../../lib/supabase/client";
import { 
  Mail, MessageCircle, Microscope, Shield, 
  Layout, LayoutDashboard, Users, BarChart3,
  LogIn, UserPlus, Loader2, TrendingUp,
  MessageSquare, MessageSquareWarning,
  FolderDown, FolderSearch, Settings,
  LogOut
} from "lucide-react";
import { cn } from "../../lib/utils";

export default function LoginPage() {
  const { signIn, signUp, session } = useSupabase();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // If already signed in, redirect
    if (session?.user) {
      // In real app, would redirect to /dashboard
    }
  }, [session]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      await signIn("password", { email, password });
    } catch (err: any) {
      setError(err.message || "Sign in failed");
    }
    setLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      await signUp({
        email,
        password,
        options: {
          data: {
            full_name: email.split('@')[0],
          },
        },
      });
    } catch (err: any) {
      setError(err.message || "Sign up failed");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-neutral-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-neutral-800 rounded-2xl p-8 border border-zinc-200 dark:border-zinc-700 shadow-lg">
        {session?.user ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-indigo-600" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <h2 className="font-2xl font-semibold text-zinc-900 dark:text-zinc-100">Welcome back!</h2>
            <p className="text-zinc-500 dark:text-zinc-400">Sign in to continue to Bankism</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <h2 className="font-2xl font-semibold text-zinc-900 dark:text-zinc-100 text-center mb-2">Bankism</h2>
            <p className="text-zinc-500 dark:text-zinc-400 text-center">AI-powered blue-team firewall</p>
            
            <div>
              <label className="block text-sm text-zinc-600 dark:text-zinc-400 mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@email.com"
                required
                className="w-full rounded-xl border border-zinc-300 dark:border-zinc-600 px-4 py-3 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:outline-none transition-colors"
              />
            </div>
            
            <div>
              <label className="block text-sm text-zinc-600 dark:text-zinc-400 mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full rounded-xl border border-zinc-300 dark:border-zinc-600 px-4 py-3 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:outline-none transition-colors"
              />
            </div>
            
            {error && (
              <div className="alert alert-error">
                <span className="text-red-600">{error}</span>
              </div>
            )}
            
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="submit"
                disabled={loading}
                className={`w-full rounded-xl px-6 py-3 text-white font-medium text-sm ${
                  loading ? 'opacity-50 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 transition-colors'
                }`}
              >
                {loading ? "Signing in..." : "Sign In"}
              </button>
              <button
                type="button"
                onClick={() => setLoading(true)}
                disabled={loading}
                className={`w-full rounded-xl px-6 py-3 text-zinc-600 dark:text-zinc-400 border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-neutral-900 transition-colors font-medium text-sm ${
                  loading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                Create Account
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}