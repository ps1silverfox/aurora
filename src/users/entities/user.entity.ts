import { Role } from './role.entity';

export interface User {
  id: string;
  keycloakId: string;
  email: string;
  name: string;
  roleId: number | null;
  role?: Role;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
