import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { AppError } from './errorHandler';

export function authorize(...roles: string[]) {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    if (!req.userRole || !roles.includes(req.userRole)) {
      throw new AppError('Insufficient permissions', 403);
    }
    next();
  };
}
