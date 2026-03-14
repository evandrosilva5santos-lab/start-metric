import { useQuery, UseQueryOptions, UseQueryResult } from "@tanstack/react-query";
import { useUIStore } from "@/store/ui-store";
import { useEffect, useMemo } from "react";

type AppQueryOptions<TData, TError> = UseQueryOptions<TData, TError> & {
  /**
   * Se true, sincroniza loading/error com o UIStore global (GlobalStatusOverlay).
   * Use apenas para a query principal da página — não para queries secundárias em paralelo.
   * @default false
   */
  syncGlobalState?: boolean;
  /**
   * Identificador opcional para sincronizar loading/error no store global.
   * Quando omitido, usa hash simplificado da queryKey.
   */
  globalStateKey?: string;
};

export function useAppQuery<TData = unknown, TError = Error>(
  options: AppQueryOptions<TData, TError>,
): UseQueryResult<TData, TError> {
  const { syncGlobalState = false, globalStateKey, ...queryOptions } = options;
  const result = useQuery(queryOptions);
  const startLoading = useUIStore((state) => state.startLoading);
  const stopLoading = useUIStore((state) => state.stopLoading);
  const setErrorByKey = useUIStore((state) => state.setErrorByKey);
  const clearErrorByKey = useUIStore((state) => state.clearErrorByKey);

  const { isFetching, error } = result;
  const resolvedGlobalKey = useMemo(() => {
    if (globalStateKey) return globalStateKey;
    const key = queryOptions.queryKey;
    if (!key) return "query:unknown";
    if (typeof key === "string") return `query:${key}`;

    try {
      return `query:${JSON.stringify(key)}`;
    } catch {
      return "query:unserializable";
    }
  }, [globalStateKey, queryOptions.queryKey]);

  useEffect(() => {
    if (!syncGlobalState) return;
    if (isFetching) startLoading(resolvedGlobalKey);
    else stopLoading(resolvedGlobalKey);
  }, [isFetching, syncGlobalState, resolvedGlobalKey, startLoading, stopLoading]);

  useEffect(() => {
    if (!syncGlobalState) return;
    if (error) {
      setErrorByKey((resolvedGlobalKey), (error as { message?: string })?.message ?? String(error) ?? "Ocorreu um erro inesperado");
    } else {
      clearErrorByKey(resolvedGlobalKey);
    }
  }, [error, syncGlobalState, resolvedGlobalKey, setErrorByKey, clearErrorByKey]);

  useEffect(() => {
    if (!syncGlobalState) return;
    return () => {
      stopLoading(resolvedGlobalKey);
      clearErrorByKey(resolvedGlobalKey);
    };
  }, [syncGlobalState, resolvedGlobalKey, stopLoading, clearErrorByKey]);

  return result;
}
