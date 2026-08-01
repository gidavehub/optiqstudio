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
      <div className="optiq-app flex h-screen items-center justify-center bg-background">
        <Loader2 className="animate-spin text-muted" size={22} />
      </div>
    );
  }

  return (
    // `optiq-app` is the theme scope: it redefines --background/--surface/--line
    // and the rest of the palette to their light values for everything below.
    // The marketing site sits outside it and stays dark. See app/globals.css.
    //
    // h-dvh (not h-screen) so mobile browser chrome doesn't crop the layout
    <div className="optiq-app flex h-dvh flex-col bg-background text-foreground relative overflow-hidden">
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
