import type { Request, Response, NextFunction } from 'express';
import type { AppDeps } from '../types.js';
import { forbidden } from '../lib/http.js';

/**
 * Middleware enforcing feature flags at route level.
 * Checks whether the feature flag is enabled for the current zone.
 */
export const requireFeatureFlag = (deps: AppDeps, flagKey: string) => {
  return async (_req: Request, res: Response, next: NextFunction) => {
    try {
      if (!deps.flagStore) {
        return next();
      }

      const flag = await deps.flagStore.find(flagKey);
      if (!flag) {
        // If flag is not configured, default to allow if it's not a known hard restriction
        return next();
      }

      const isPublic = deps.zone === 'public';

      if (isPublic) {
        const allowed = flag.zonePublic && !flag.isHardInternal;
        if (!allowed) {
          throw forbidden('FEATURE_DISABLED', `Feature '${flagKey}' is disabled in the public zone`);
        }
      } else {
        const allowed = flag.zoneInternal;
        if (!allowed) {
          throw forbidden('FEATURE_DISABLED', `Feature '${flagKey}' is disabled in the internal zone`);
        }
      }

      next();
    } catch (err) {
      next(err);
    }
  };
};
