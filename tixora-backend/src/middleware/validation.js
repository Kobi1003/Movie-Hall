import { ValidationError } from '../utils/errors.js';

export function validateRequest({ body, query, params }) {
  return (req, res, next) => {
    try {
      if (body) {
        req.body = body.parse(req.body);
      }
      if (query) {
        req.query = query.parse(req.query);
      }
      if (params) {
        req.params = params.parse(req.params);
      }
      next();
    } catch (err) {
      if (err.errors) {
        const fields = {};
        err.errors.forEach(e => {
          const fieldPath = e.path.join('.');
          fields[fieldPath] = e.message;
        });
        return next(new ValidationError('Invalid request payload', fields));
      }
      next(err);
    }
  };
}
