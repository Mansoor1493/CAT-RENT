import { Request, Response, NextFunction } from 'express';
import { Operator, Equipment } from '../models';

export async function getOperators(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status, qualification } = req.query;

    const query: any = {};
    if (status) query.status = status;
    if (qualification) query.qualification = qualification;

    const operators = await Operator.find(query).sort({ name: 1 }).lean();

    res.json({
      success: true,
      data: operators,
    });
  } catch (error) {
    next(error);
  }
}
