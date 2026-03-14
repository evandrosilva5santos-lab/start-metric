import { useQuery, UseQueryOptions, UseQueryResult } from "@tanstack/react-query";
import { useUIStore } from "@/store/ui-store";
import { useEffect } from "react";

type AppQueryOptions<TData, TError> = UseQueryOptions<TData, TError> & {
  /**
   * Se true, sincroniza loading/error com o UIStore global (GlobalStatusOverlay).
   * Use apenas para a query principal da página — não para queries secundárias em paralelo.
   * @default false
   */
  syncGlobalState?: boolean;
};

export function useAppQuery<TData = unknown, TError = Error>(
  options: AppQueryOptions<TData, TError>,
): UseQueryResult<TData, TError> {
  const { syncGlobalState = false, ...queryOptions } = options;
  const result = useQuery(queryOptions);
  const { setLoading, setError } = useUIStore();

  const { isFetching, error } = result;

  useEffect(() => {
    if (!syncGlobalState) return;
    setLoading(isFetching);
  }, [isFetching, syncGlobalState, setLoading]);

  useEffect(() => {
    if (!syncGlobalState) return;
    if (error) {
      setError((error as any)?.message ?? String(error) ?? "Ocorreu um erro inesperado");
    } else {
      setError(null);
    }
  }, [error, syncGlobalState, setError]);

  return result;
}
