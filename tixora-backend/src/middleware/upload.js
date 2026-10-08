import multer from 'multer';
import { ValidationError } from '../utils/errors.js';

// Memory storage for forwarding directly to Supabase Storage
const storage = multer.memoryStorage();

const allowedMimeTypes = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

export const uploadDocument = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10 MB maximum
  },
  fileFilter: (req, file, cb) => {
    const mime = file.mimetype?.toLowerCase();
    if (allowedMimeTypes.includes(mime) || mime?.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new ValidationError(`Unsupported file type: ${file.mimetype}. Allowed: JPG, PNG, WEBP, PDF, DOC, DOCX`));
    }
  }
});
