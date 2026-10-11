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

export default function DashboardPage() {
  const { session } = useSupabase();
  const [balance, setBalance] = useState<number>(0);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [sidebarExpanded, setSidebarExpanded] = useState(true);

  useEffect(() => {
    // In real app, fetch user's account balances from Supabase
    // For now, set demo values
    setBalance(65000);
    
    // Fetch recent transactions
    // Would call supabase from("transactions").select("*").eq("user_id", userId).order("created_at", { ascending: false })
  }, [session]);

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-neutral-900">
      {/* Sidebar */}
      <aside className="w-64 bg-white dark:bg-neutral-800 h-screen border2 border-zinc-200/50 flex-shrink-0">
        <div className="h-16 flex items-center justify-start px-4">
          <h2 className="font-semibold text-zinc-900 dark:text-zinc-100 text-lg">Bankism</h2>
        </div>
        <nav className="p-2">
          <ul className="space-y-2">
            <li>
              <a 
                href="/dashboard"
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-neutral-700 transition-colors",
                  "flex-1"
                )}
                >
                <LayoutDashboard className="w-5 h-5" />
                Dashboard
              </a>
            </li>
            <li>
              <a 
                href="/console"
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-neutral-700 transition-colors",
                  "flex-1"
                )}
                >
                <Microscope className="w-5 h-5" />
                Firewall Console
              </a>
            </li>
            <li>
              <a 
                href="/audit"
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-neutral-700 transition-colors",
                  "flex-1"
                )}
                >
                <FolderSearch className="w-5 h-5" />
                Audit Log
              </a>
            </li>
            <li>
              <a 
                href="/attack-lab"
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-neutral-700 transition-colors",
                  "flex-1"
                )}
                >
                <Loader2 className="w-5 h-5" />
                Attack Lab
              </a>
            </li>
          </ul>
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex-1 p-8">
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-2xl font-semibold text-zinc-900 dark:text-zinc-100">Dashboard</h1>
            <p className="text-zinc-500 dark:text-zinc-400">Secure banking firewall interface</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm hover:bg-indigo-500 transition-colors">
              New Request
            </button>
          </div>
        </header>

        {/* Balance Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="rounded-2xl p-5 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-neutral-900">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-indigo-600" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.21L7 14.14 2 9.27l6.91-1.02L12 2z" />
                  <path d="M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20zM4.93 6.53a2.5 2.5 0 0 1 3.07 0l1.18 5.89a1 1 0 0 1-.67.75l-2.39 2.12a1 1 0 0 1-.98 0L4.93 6.53z" />
                </svg>
              </div>
              <div>
                <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">₹{balance.toLocaleString()}</p>
                <p className="text-zinc-500 dark:text-zinc-400">Total Balance</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl p-5 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-neutral-900">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-emerald-600" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2v4l4 3h6v14h-6v5h-2v-5h-6v-3L12 2zM5 10h6v5H5zm0-5h6v5H5zm6 5h2v-5h-2zm0 5h2v-5h-2z" />
                </svg>
              </div>
              <div>
                <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">₹{balance > 50000 ? balance * 0.75 : balance * 1.25}</p>
                <p className="text-zinc-500 dark:text-zinc-400">Available for Transfer</p>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="rounded-2xl p-6 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-neutral-900">
          <h2 className="font-medium text-zinc-900 dark:text-zinc-100 mb-4">Recent Transactions</h2>
          {recentTransactions.length === 0 ? (
            <p className="text-zinc-500 dark:text-zinc-400">No transactions yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-700">
                    <th className="p-3 text-left text-zinc-600 dark:text-zinc-400 font-medium">Date</th>
                    <th className="p-3 text-left text-zinc-600 dark:text-zinc-400 font-medium">Type</th>
                    <th className="p-3 text-left text-zinc-600 dark:text-zinc-400 font-medium">Amount</th>
                    <th className="p-3 text-left text-zinc-600 dark:text-zinc-400 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTransactions.slice(0, 10).map((t: any) => (
                    <tr key={t.id} className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-neutral-800">
                      <td className="p-3">{t.created_at ? new Date(t.created_at).toLocaleDateString() : "-"}</td>
                      <td className="p-3">{t.intent}</td>
                      <td className="p-3">₹{t.amount?.toLocaleString()}</td>
                      <td className="p-3">
                        <span className={t.status === "completed" ? "text-green-600" : "text-yellow-600"} font-medium>
                          {t.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}