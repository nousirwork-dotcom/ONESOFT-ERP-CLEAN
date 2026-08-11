import { trpc } from "@/shared/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { useCallback, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { clearSessionTabs } from "@/core/contexts/TabManagerContext";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath = '/login' } =
    options ?? {};
  const utils = trpc.useUtils();
  const queryClient = useQueryClient();

  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const logoutMutation = trpc.auth.logout.useMutation();

  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (error: unknown) {
      // إذا كانت الجلسة منتهية بالفعل أو أي خطأ آخر — نكمل التنظيف على أي حال
      if (!(error instanceof TRPCClientError && error.data?.code === "UNAUTHORIZED")) {
        console.warn('[logout] mutation error (continuing cleanup):', error);
      }
    } finally {
      // مسح بيانات المستخدم من localStorage و sessionStorage
      localStorage.removeItem('manus-runtime-user-info');
      localStorage.removeItem('onesoft_user_permissions');
      localStorage.removeItem('onesoft_current_user');
      // مسح التبويبات المحفوظة في sessionStorage
      clearSessionTabs();
      // مسح علامة الجلسة — يمنع tryAutoLogin من تجاوز شاشة الدخول
      sessionStorage.removeItem('onesoft_login_launch');
      queryClient.clear();
      // إعادة توجيه كاملة (replace) لمنع زر Back من إظهار الصفحات المحمية
      // كذلك تمسح كل React state و cache تلقائياً بإعادة تحميل الصفحة
      window.location.replace('/login');
    }
  }, [logoutMutation, queryClient]);

  const state = useMemo(() => {
    localStorage.setItem(
      "manus-runtime-user-info",
      JSON.stringify(meQuery.data)
    );
    return {
      user: meQuery.data ?? null,
      loading: meQuery.isLoading || logoutMutation.isPending,
      error: meQuery.error ?? logoutMutation.error ?? null,
      isAuthenticated: Boolean(meQuery.data),
    };
  }, [
    meQuery.data,
    meQuery.error,
    meQuery.isLoading,
    logoutMutation.error,
    logoutMutation.isPending,
  ]);

  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (meQuery.isLoading || logoutMutation.isPending) return;
    if (state.user) return;
    if (typeof window === "undefined") return;
    if (window.location.pathname === redirectPath) return;

    window.location.replace(redirectPath);
  }, [
    redirectOnUnauthenticated,
    redirectPath,
    logoutMutation.isPending,
    meQuery.isLoading,
    state.user,
  ]);

  return {
    ...state,
    refresh: () => meQuery.refetch(),
    logout,
  };
}
