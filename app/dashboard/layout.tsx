"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "../../components/AuthProvider";
import { EditorFlowProvider } from "./_flow/EditorFlowProvider";
import FloatingChrome from "./_views/FloatingChrome";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <Loader2 className="animate-spin text-neutral-500" size={22} />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-black text-white relative overflow-hidden">
      {/* Main Full-Screen Layout Wrapper */}
      <div className="flex min-h-0 flex-1 relative overflow-hidden">
        <div className="min-w-0 flex-1 overflow-y-auto transition-all duration-300">
          <EditorFlowProvider>
            {/* Floating logo + account pills; hides itself in the timeline editor */}
            <FloatingChrome />
            {children}
          </EditorFlowProvider>
        </div>
      </div>
    </div>
  );
}
