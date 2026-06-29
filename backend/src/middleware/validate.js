/**
 * Zod schema validation middleware.
 * Usage:
 *   router.post('/', validate(bodySchema), controller)
 *   router.post('/', validate({ body: bodySchema, params: paramsSchema, query: querySchema }), controller)
 */
import { ValidationError } from '../utils/errors.js';

export function validate(schemas = {}) {
  return (req, _res, next) => {
    try {
      // Accept either a single schema (for body) or an object
      const map = schemas && schemas.safeParse ? { body: schemas } : schemas;

      for (const [loc, schema] of Object.entries(map)) {
        if (!schema || !schema.safeParse) continue;
        const result = schema.safeParse(req[loc]);
        if (!result.success) {
          const details = result.error.issues.map(i => ({
            path: i.path.join('.'),
            message: i.message,
          }));
          return next(new ValidationError(`Invalid ${loc}`, details));
        }
        req[loc] = result.data; // replace with validated+coerced
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
