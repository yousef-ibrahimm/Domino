"use client";

import { Component, ReactNode } from "react";

export class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-900 text-slate-100">
          <div className="bg-red-900/40 p-10 rounded-2xl border border-red-700/50 text-center shadow-[0_0_30px_rgba(220,38,38,0.2)]">
             <h2 className="text-3xl font-black text-red-500 mb-4">Connection Lost</h2>
             <p className="text-slate-300 mb-8 max-w-sm font-medium">{this.state.error?.message || "An unexpected error occurred while communicating with the server."}</p>
             <button 
                onClick={() => window.location.reload()}
                className="bg-red-600 hover:bg-red-500 px-8 py-3 rounded-xl font-bold transition-all shadow-lg hover:shadow-xl active:scale-95"
              >
                 Reconnect to Game
             </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
