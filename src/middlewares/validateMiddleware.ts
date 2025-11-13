import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema, ZodError } from 'zod';

/**
 * Validation Middleware Factory
 * 
 * Bu funksiya berilgan Zod schema bo'yicha request body ni validate qiladi
 * 
 * @param schema - Zod validation schema
 * @returns Express middleware
 * 
 * FOYDALANISH:
 * const userSchema = z.object({
 *   username: z.string().min(3),
 *   password: z.string().min(6),
 * });
 * 
 * app.post('/register', validate(userSchema), controller);
 */
export const validate = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Request body ni validate qilish
      schema.parse(req.body);
      
      // Validation muvaffaqiyatli - davom etish
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        // Zod xatolarini user-friendly formatga o'zgartirish
        const errors = error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        }));

        res.status(400).json({
          success: false,
          message: 'Validation xatosi',
          errors,
        });
        return;
      }

      // Boshqa xatolar
      res.status(500).json({
        success: false,
        message: 'Validation da noma\'lum xato',
      });
    }
  };
};

/**
 * Query validation middleware
 * Query parametrlarni validate qilish uchun
 */
export const validateQuery = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      schema.parse(req.query);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        }));

        res.status(400).json({
          success: false,
          message: 'Query validation xatosi',
          errors,
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: 'Query validation da noma\'lum xato',
      });
    }
  };
};

/**
 * Params validation middleware
 * URL parametrlarni validate qilish uchun
 */
export const validateParams = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      schema.parse(req.params);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        }));

        res.status(400).json({
          success: false,
          message: 'Params validation xatosi',
          errors,
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: 'Params validation da noma\'lum xato',
      });
    }
  };
};

/**
 * Multiple validation middleware
 * Body, query va params ni bir vaqtda validate qilish uchun
 */
export const validateAll = (schemas: {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Body validation
      if (schemas.body) {
        schemas.body.parse(req.body);
      }

      // Query validation
      if (schemas.query) {
        schemas.query.parse(req.query);
      }

      // Params validation
      if (schemas.params) {
        schemas.params.parse(req.params);
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        }));

        res.status(400).json({
          success: false,
          message: 'Validation xatosi',
          errors,
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: 'Validation da noma\'lum xato',
      });
    }
  };
};