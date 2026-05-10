import { Router, type Request, type Response } from "express";

const router = Router();

// Known Moroccan schools mapped to their website domain for Clearbit logo lookup
const SCHOOL_DOMAINS: Record<string, string> = {
  "EMSI":    "emsi.ma",
  "ISCAE":   "iscae.ac.ma",
  "HEM":     "hem.ac.ma",
  "UIR":     "uir.ac.ma",
  "UM5":     "um5.ac.ma",
  "UH2":     "uh2c.ac.ma",
  "UCA":     "uca.ma",
  "ENCG":    "encg.ac.ma",
  "FSJES":   "fsjes-agdal.um5.ac.ma",
  "INSEA":   "insea.ac.ma",
  "EHTP":    "ehtp.ac.ma",
  "EMI":     "emi.ac.ma",
  "IAV":     "iav.ac.ma",
  "ENIM":    "enim.ac.ma",
  "ENSMR":   "ensmr.ac.ma",
  "ESTC":    "estc.ac.ma",
  "ENSA":    "ensa.ac.ma",
  "EST":     "est.usmba.ac.ma",
  "ENCGJ":   "encg.uae.ac.ma",
  "FSAC":    "fsac.ac.ma",
  "GINF":    "ginf.ma",
  "SUPDECO": "supdeco.ac.ma",
  "ESCA":    "esca.ma",
  "EEAC":    "eeac.ma",
  "ISGA":    "isga.ma",
  "ENAM":    "enam.ac.ma",
  "IGA":     "iga.ac.ma",
  "FSEG":    "fseg.ac.ma",
};

router.get("/logo", async (req: Request, res: Response) => {
  const school = ((req.query.school as string) ?? "").trim().toUpperCase();

  if (!school) {
    res.status(400).json({ error: "school query param required" });
    return;
  }

  // Exact match first
  let domain = SCHOOL_DOMAINS[school];

  // Partial match — e.g. "EMSI Casablanca" → still finds "EMSI"
  if (!domain) {
    for (const [key, val] of Object.entries(SCHOOL_DOMAINS)) {
      if (school.includes(key) || key.includes(school)) {
        domain = val;
        break;
      }
    }
  }

  if (!domain) {
    res.json({ logoUrl: null });
    return;
  }

  // Clearbit logo API — free, no key needed, returns PNG
  const logoUrl = `https://logo.clearbit.com/${domain}`;

  // Verify it exists with a HEAD request
  try {
    const check = await fetch(logoUrl, { method: "HEAD" });
    if (check.ok) {
      res.json({ logoUrl });
    } else {
      res.json({ logoUrl: null });
    }
  } catch {
    res.json({ logoUrl: null });
  }
});

export default router;
