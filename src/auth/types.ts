export interface KeycloakJwtPayload {
  sub: string;
  email: string;
  name?: string;
  preferred_username?: string;
  realm_access?: { roles: string[] };
  iss: string;
  exp: number;
  iat: number;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  roles: string[];
}
