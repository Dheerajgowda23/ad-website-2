import type { Store } from 'express-session';
import type { Permission, Role, Zone } from '@ada/shared';
import type { PrismaClient } from '@prisma/client';
import type { Env } from './config/env.js';

/** A staff principal, always re-read from the database - never from the cookie. */
export interface StaffPrincipal {
  id: string;
  role: Role;
  name: string;
  email: string;
  employeeCode: string | null;
  directorateId: string | null;
  isActive: boolean;
}

export interface FlagView {
  key: string;
  zonePublic: boolean;
  zoneInternal: boolean;
  isHardInternal: boolean;
  description: string | null;
  updatedBy: string | null;
  updatedAt: Date;
}

export interface FlagStore {
  list(): Promise<FlagView[]>;
  find(key: string): Promise<FlagView | null>;
  upsert(input: {
    key: string;
    zonePublic: boolean;
    zoneInternal: boolean;
    isHardInternal: boolean;
    description?: string | null;
    updatedBy: string | null;
  }): Promise<FlagView>;
}

export interface AppDeps {
  env: Env;
  zone: Zone;
  sessionStore: Store;
  /** Absent only in hermetic tests. Routes that need data refuse without it. */
  prisma?: PrismaClient;
  /** Default reads users through Prisma; tests may supply a stub. */
  loadStaffUser?: (id: string) => Promise<StaffPrincipal | null>;
  flagStore?: FlagStore;
  /** Built SPA directory served by this zone; absent in tests. */
  webDist?: string;
  now?: () => Date;
}

export type Locals = {
  staff?: StaffPrincipal;
  role?: Role;
  permissions?: readonly Permission[];
};
