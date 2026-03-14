import AuthPageClient from "./AuthPageClient";

type SearchParams = Record<string, string | string[] | undefined>;

function getParam(searchParams: SearchParams, key: string): string | null {
  const value = searchParams[key];
  return typeof value === "string" ? value : null;
}

export default function AuthPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <AuthPageClient
      nextParam={getParam(searchParams, "next")}
      errorParam={getParam(searchParams, "error")}
    />
  );
}
