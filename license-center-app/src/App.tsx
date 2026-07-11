import React, { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { trpc } from "@/lib/trpc";
import { AuthProvider, useAuth } from "@/auth/AuthContext";
import LoginPage from "@/auth/LoginPage";
import LicenseCenterPage from "@/pages/LicenseCenterPage";

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 30_000 },
    },
  });
}

function Root() {
  const [queryClient] = useState(createQueryClient);
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: "/api/trpc",
          transformer: superjson,
          fetch: (url, options) =>
            fetch(url, { ...options, credentials: "include" }),
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider queryClient={queryClient}>
          <AppShell />
        </AuthProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}

function AppShell() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#F8F5EF" }}>
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto" style={{ backgroundColor: "#1B2B5C" }}>
            <span className="text-[14px] font-black" style={{ color: "#C9A84C" }}>LC</span>
          </div>
          <p className="text-[14px]" style={{ color: "#9CA3AF" }}>جارٍ التحميل...</p>
        </div>
      </div>
    );
  }

  if (!user) return <LoginPage />;

  return <LicenseCenterPage />;
}

export default Root;
