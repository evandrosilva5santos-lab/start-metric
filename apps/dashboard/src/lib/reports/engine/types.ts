export type VariableScope = "universal" | "calculated" | "channel" | "alert" | "lead";
export type VariableChannel = "meta" | "google" | "instagram";
export type VariableReturnType = "number" | "currency" | "percent" | "text" | "block";

export type VariableCategory =
  | "metrics"
  | "conversions"
  | "costs"
  | "video"
  | "identification"
  | "metadata"
  | "universal"
  | "calculated"
  | "alert"
  | "lead";

export interface VariableDefinition {
  slug: string;
  label: string;
  category: VariableCategory;
  scope: VariableScope;
  channel?: VariableChannel;
  returns: VariableReturnType;
  aggregatable: boolean;
  description?: string;
  exampleValue?: string | number;
  /** "soon": depende de uma integração que ainda não existe; "per_campaign": só se preenche no modo por campanha. */
  availability?: "soon" | "per_campaign";
}
