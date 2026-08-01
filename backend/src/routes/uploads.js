/**
 * routes/uploads.js
 * Image upload endpoint — saves to static/uploads, returns public URL.
 */

import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { verifyToken } from '../middleware/auth.js';

const router = Router();

const ALLOWED_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg']);
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const uploadDir = path.resolve('static/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
    const uniqueName = `${uuidv4()}.${ext}`;
    cb(null, uniqueName);
  },
});

const fileFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
  if (ALLOWED_EXTENSIONS.has(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed. Allowed: ${[...ALLOWED_EXTENSIONS].join(', ')}`));
  }
};

const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE_BYTES },
  fileFilter,
});

// ── POST /api/upload/image ─────────────────────────────────────────
router.post('/upload/image', verifyToken, (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File too large (max 5 MB)' });
      }
      return res.status(400).json({ error: err.message || 'File upload error' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file selected' });
    }

    const url = `/api/static/uploads/${req.file.filename}`;
    return res.status(201).json({ url });
  });
});

export default router;
