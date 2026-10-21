export type PanelMetaAccount = {
  id: string;
  name: string | null;
  external_id: string;
  status: string;
  currency: string | null;
  connected_at: string | null;
  token_expires_at: string | null;
  client_name: string | null;
};

export type MetaConnectionSummary = {
  status: string;
  connectedAt: string | null;
  tokenExpiresAt: string | null;
};

export type Feedback = { type: "success" | "error"; message: string };

export type LinkedAccountConflict = { id: string; name: string; clientName: string | null };
