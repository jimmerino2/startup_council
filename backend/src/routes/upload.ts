import { Router } from "express";
import multer from "multer";
import { detectUploadType, extractText } from "../services/documentParser.js";
import { requireAuth } from "../middleware/requireAuth.js";

const upload = multer({
  storage: multer.memoryStorage(),
  // Vercel rejects request bodies over ~4.5MB, so cap slightly under that.
  limits: { fileSize: 4 * 1024 * 1024 },
});

export const uploadRouter = Router();

uploadRouter.post("/extract", requireAuth, upload.single("file"), async (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ error: "No file uploaded (field name must be 'file')" });
  }

  const type = detectUploadType(file.originalname, file.mimetype);
  if (!type) {
    return res.status(415).json({ error: "Unsupported file type. Use PDF, DOCX, MD, or TXT." });
  }

  try {
    const text = await extractText(file.buffer, type);
    res.json({ text, filename: file.originalname, type });
  } catch (err) {
    res.status(500).json({ error: `Failed to parse ${file.originalname}: ${(err as Error).message}` });
  }
});
