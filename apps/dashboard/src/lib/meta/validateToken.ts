// lib/meta/validateToken.ts — Server-side ONLY
// Valida um access_token do Facebook chamando a Graph API /me.
// Retorna { id, name } se válido, ou null se inválido/expirado.

const GRAPH_API_URL = "https://graph.facebook.com/v19.0/me";

interface FacebookMeResponse {
  id: string;
  name: string;
}

interface FacebookErrorResponse {
  error: {
    message: string;
    type: string;
    code: number;
  };
}

type GraphApiResponse = FacebookMeResponse | FacebookErrorResponse;

function isFacebookError(res: GraphApiResponse): res is FacebookErrorResponse {
  return "error" in res;
}

/**
 * Valida um Meta (Facebook) access_token chamando a endpoint /me da Graph API.
 *
 * @param token - O access_token a ser validado.
 * @returns { id, name } do usuário se o token for válido, ou `null` caso contrário.
 */
export async function validateMetaToken(
  token: string
): Promise<{ id: string; name: string } | null> {
  try {
    const url = `${GRAPH_API_URL}?fields=id,name&access_token=${encodeURIComponent(token)}`;

    const response = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      // Não cacheia para sempre obter o estado atual do token
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as GraphApiResponse;

    if (isFacebookError(data)) {
      return null;
    }

    return { id: data.id, name: data.name };
  } catch {
    return null;
  }
}
