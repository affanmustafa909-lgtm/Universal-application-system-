export type AccessTokenClaims = {
  sub: string;
  organizationId: string;
  permissions: string[];
  role?: string;
  branchScope?: string;
  systemType?: string;
  exp?: number;
};

export function decodeAccessToken(token: string): AccessTokenClaims {
  const part = token.split(".")[1];
  if (!part) throw new Error("Invalid token");
  const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
  return JSON.parse(json) as AccessTokenClaims;
}
