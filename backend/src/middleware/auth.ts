import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { AppError } from './errorHandler';
import { User, UserRole, IUser } from '../models/User';

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: UserRole;
  userName?: string;
  userEmail?: string;
  assignedSiteIds?: string[];
  user?: IUser;
}

export async function authenticate(req: AuthRequest, _res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      // In dev mode, if no auth token is passed, allow fallback only if explicitly set
      if (config.nodeEnv === 'development' && req.headers['x-dev-bypass'] === 'true') {
        req.userId = 'USR001';
        req.userRole = 'ADMIN';
        req.userName = 'Alex Mercer (Admin)';
        req.userEmail = 'admin@catrent.io';
        req.assignedSiteIds = [];
        return next();
      }
      throw new AppError('Authentication required. Please sign in.', 401);
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.jwtSecret) as {
      userId: string;
      role: UserRole;
      name?: string;
      email?: string;
      assignedSiteIds?: string[];
    };

    req.userId = decoded.userId;
    req.userRole = decoded.role;
    req.userName = decoded.name;
    req.userEmail = decoded.email;
    req.assignedSiteIds = decoded.assignedSiteIds || [];

    // Optionally attach full user document if needed
    const userDoc = await User.findOne({ userId: decoded.userId }).lean();
    if (userDoc) {
      req.user = userDoc as IUser;
      req.userRole = userDoc.role;
      req.userName = userDoc.name;
      req.userEmail = userDoc.email;
      req.assignedSiteIds = userDoc.assignedSiteIds || [];
    }

    next();
  } catch (error) {
    if (error instanceof AppError) throw error;
    next(new AppError('Invalid or expired authentication session', 401));
  }
}

/**
 * RBAC Middleware to restrict route to specific roles
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    if (!req.userRole) {
      return next(new AppError('Authentication required', 401));
    }

    if (!allowedRoles.includes(req.userRole)) {
      return next(
        new AppError(
          `Forbidden: Role '${req.userRole}' is not authorized to perform this action. Required roles: ${allowedRoles.join(', ')}`,
          403
        )
      );
    }

    next();
  };
}

/**
 * Middleware to check that Site Manager only accesses assigned sites
 */
export function requireSiteAccess(paramKey: string = 'siteId') {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    // Admins and Rental Managers have global site access
    if (req.userRole === 'ADMIN' || req.userRole === 'RENTAL_MANAGER') {
      return next();
    }

    if (req.userRole === 'SITE_MANAGER') {
      const targetSiteId = (req.params[paramKey] || req.body[paramKey] || req.query[paramKey]) as string;
      if (!targetSiteId) {
        return next();
      }

      const assigned = req.assignedSiteIds || [];
      if (!assigned.includes(targetSiteId)) {
        return next(
          new AppError(
            `Forbidden: You do not have management authorization for site ${targetSiteId}. Your assigned sites: ${assigned.join(', ') || 'None'}`,
            403
          )
        );
      }
      return next();
    }

    // Customers and Operators cannot access site management
    next(new AppError('Forbidden: Site management authorization required', 403));
  };
}
