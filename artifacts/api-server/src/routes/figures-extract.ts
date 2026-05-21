import { Router, type Request, type Response } from "express";
import multer from "multer";
import Anthropic from "@anthropic-ai/sdk";
import { fromBuffer } from "pdf2pic";
import sharp from "sharp";
import { logger } from "../lib/logger";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "image/jpeg", "image/png", "image/webp",
    ];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Type de fichier non supporté. Utilisez PDF, Word, PowerPoint ou image."));
  },
});

// ── A4 dimensions at 300 DPI ──────────────────────────────────────────────────
const A4_W = 2480;
const A4_H = 3508;

// ─── Claude Vision: detect figure regions on a rendered page ─────────────────

interface FigureRegion {
  type: string;
  description: string;
  x: number; y: number; w: number; h: number;
  suggested_caption: string;
  suggested_source: string;
}

interface PageDetection {
  has_figures: boolean;
  regions: FigureRegion[];
}

async function detectFiguresOnPage(pageImageBuffer: Buffer, pageNumber: number): Promise<PageDetection> {
  const client = new Anthropic();
  const response = await client.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 1000,
    messages: [{
      role: "user",
      content: [
        {
          type: "image",
          source: {
            type: "base64",
            media_type: "image/png",
            data: pageImageBuffer.toString("base64"),
          },
        },
        {
          type: "text",
          text: `Analyze this page from an academic document (page ${pageNumber}).

Return ONLY valid JSON (no markdown):
{
  "has_figures": true,
  "regions": [
    {
      "type": "chart|table|diagram|photo|graph|map|other",
      "description": "Brief description of what this figure shows",
      "x": 0.1,
      "y": 0.2,
      "w": 0.8,
      "h": 0.35,
      "suggested_caption": "Suggested French academic caption for this figure",
      "suggested_source": "Source : [À compléter par l'auteur]"
    }
  ]
}

Include only actual figures: charts, tables, diagrams, photos, graphs, maps.
Exclude: headers, footers, page numbers, body text paragraphs, equations.
If no figures: {"has_figures": false, "regions": []}`,
        },
      ],
    }],
  });

  try {
    const raw = (response.content[0] as { type: string; text: string }).text.trim();
    const json = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    return JSON.parse(json) as PageDetection;
  } catch {
    return { has_figures: false, regions: [] };
  }
}

// ─── PDF → array of figure base64 images ─────────────────────────────────────

async function extractFiguresFromPDF(pdfBuffer: Buffer): Promise<ExtractedFigure[]> {
  const convert = fromBuffer(pdfBuffer, {
    density: 300,
    format:  "png",
    width:   A4_W,
    height:  A4_H,
  });

  // Convert all pages
  const pages = await convert.bulk(-1, { responseType: "buffer" });
  const figures: ExtractedFigure[] = [];

  for (let i = 0; i < pages.length; i++) {
    const pageBuffer = pages[i]?.buffer;
    if (!pageBuffer) continue;

    let detection: PageDetection;
    try {
      detection = await detectFiguresOnPage(pageBuffer, i + 1);
    } catch {
      continue;
    }

    if (!detection.has_figures) continue;

    for (const region of detection.regions) {
      try {
        const cropped = await sharp(pageBuffer)
          .extract({
            left:   Math.max(0, Math.round(region.x * A4_W)),
            top:    Math.max(0, Math.round(region.y * A4_H)),
            width:  Math.min(A4_W, Math.round(region.w * A4_W)),
            height: Math.min(A4_H, Math.round(region.h * A4_H)),
          })
          .png({ quality: 100 })
          .toBuffer();

        figures.push({
          page:              i + 1,
          image_base64:      `data:image/png;base64,${cropped.toString("base64")}`,
          mime_type:         "image/png",
          type:              region.type,
          auto_description:  region.description,
          suggested_caption: region.suggested_caption,
          suggested_source:  region.suggested_source,
        });
      } catch { /* skip bad crop */ }
    }
  }

  return figures;
}

// ─── DOCX → extract embedded images via JSZip-style binary walk ──────────────

async function extractFiguresFromDocx(buffer: Buffer): Promise<ExtractedFigure[]> {
  // mammoth can extract images as buffers
  const mammoth = await import("mammoth");
  const figures: ExtractedFigure[] = [];
  let idx = 0;

  await mammoth.convertToHtml(
    { buffer },
    {
      convertImage: mammoth.images.imgElement(async (image) => {
        const imgBuffer = await image.read("base64") as string;
        const ct = image.contentType ?? "image/png";
        if (!ct.startsWith("image/")) return { src: "" };
        figures.push({
          page:              idx + 1,
          image_base64:      `data:${ct};base64,${imgBuffer}`,
          mime_type:         ct,
          type:              "photo",
          auto_description:  `Image extraite du document (image ${idx + 1})`,
          suggested_caption: `Figure — [Titre à compléter]`,
          suggested_source:  "Source : [À compléter par l'auteur]",
        });
        idx++;
        return { src: "" };
      }),
    },
  );

  return figures;
}

// ─── PPTX → extract images from zip entries ──────────────────────────────────

async function extractFiguresFromPptx(buffer: Buffer): Promise<ExtractedFigure[]> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buffer);
  const figures: ExtractedFigure[] = [];
  let idx = 0;

  const imageEntries = Object.entries(zip.files).filter(([name]) =>
    /^ppt\/media\/image\d+\.(png|jpg|jpeg|gif|bmp)$/i.test(name),
  );

  for (const [, entry] of imageEntries) {
    const imgBuffer = await entry.async("base64");
    const ext = entry.name.split(".").pop()?.toLowerCase() ?? "png";
    const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : `image/${ext}`;
    figures.push({
      page:              idx + 1,
      image_base64:      `data:${mime};base64,${imgBuffer}`,
      mime_type:         mime,
      type:              "photo",
      auto_description:  `Diapositive ${idx + 1} — image extraite`,
      suggested_caption: `Figure — [Titre à compléter]`,
      suggested_source:  "Source : [À compléter par l'auteur]",
    });
    idx++;
  }

  return figures;
}

// ─── Shared type ─────────────────────────────────────────────────────────────

interface ExtractedFigure {
  page:              number;
  image_base64:      string;  // data:image/png;base64,...
  mime_type:         string;
  type:              string;
  auto_description:  string;
  suggested_caption: string;
  suggested_source:  string;
}

// ─── POST /api/figures/extract ───────────────────────────────────────────────
// Accepts PDF / DOCX / PPTX / image. Extracts all figures with Claude Vision.
// Returns array of base64 images + auto-generated captions for caption builder.

router.post(
  "/figures/extract",
  upload.single("document"),
  async (req: Request, res: Response): Promise<void> => {
    const file = req.file;
    if (!file) { res.status(400).json({ error: "Aucun fichier reçu" }); return; }

    logger.info({ event: "figures_extract_start", mimetype: file.mimetype, size: file.size });

    try {
      let figures: ExtractedFigure[] = [];

      if (file.mimetype === "application/pdf") {
        figures = await extractFiguresFromPDF(file.buffer);
      } else if (file.mimetype.includes("wordprocessingml")) {
        figures = await extractFiguresFromDocx(file.buffer);
      } else if (file.mimetype.includes("presentationml")) {
        figures = await extractFiguresFromPptx(file.buffer);
      } else {
        // Direct image upload — single figure
        figures = [{
          page:              1,
          image_base64:      `data:${file.mimetype};base64,${file.buffer.toString("base64")}`,
          mime_type:         file.mimetype,
          type:              "photo",
          auto_description:  "Image uploadée directement",
          suggested_caption: "Figure — [Titre à compléter]",
          suggested_source:  "Source : Élaboré par l'auteur",
        }];
      }

      logger.info({ event: "figures_extract_done", count: figures.length });

      res.json({
        figures,
        count:   figures.length,
        message: `${figures.length} figure(s) extraite(s) avec succès`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Extraction failed";
      logger.error({ event: "figures_extract_error", error: msg });
      res.status(500).json({ error: msg });
    }
  },
);

export default router;
