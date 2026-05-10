import { Router, type Request, type Response } from "express";

const router = Router();

// Each entry: [abbreviation variants, domain]
const SCHOOLS: [string[], string][] = [
  [["EMSI", "ECOLE MAROCAINE DES SCIENCES DE L'INGENIEUR"], "emsi.ma"],
  [["ISCAE", "INSTITUT SUPERIEUR DE COMMERCE ET D'ADMINISTRATION DES ENTREPRISES"], "iscae.ac.ma"],
  [["HEM", "HAUTES ETUDES DE MANAGEMENT"], "hem.ac.ma"],
  [["UIR", "UNIVERSITE INTERNATIONALE DE RABAT"], "uir.ac.ma"],
  [["UM5", "UM6", "UNIVERSITE MOHAMMED V", "UNIVERSITE MOHAMMED 5"], "um5.ac.ma"],
  [["UH2", "UH2C", "UNIVERSITE HASSAN II", "UNIVERSITE HASSAN 2"], "uh2c.ac.ma"],
  [["UCA", "UNIVERSITE CADI AYYAD"], "uca.ma"],
  [["ENCG", "ECOLE NATIONALE DE COMMERCE ET DE GESTION"], "encg.ac.ma"],
  [["INSEA", "INSTITUT NATIONAL DE STATISTIQUE ET D'ECONOMIE APPLIQUEE"], "insea.ac.ma"],
  [["EHTP", "ECOLE HASSANIA DES TRAVAUX PUBLICS"], "ehtp.ac.ma"],
  [["EMI", "ECOLE MOHAMMADIA D'INGENIEURS"], "emi.ac.ma"],
  [["IAV", "INSTITUT AGRONOMIQUE ET VETERINAIRE"], "iav.ac.ma"],
  [["ENIM", "ECOLE NATIONALE DE L'INDUSTRIE MINERALE"], "enim.ac.ma"],
  [["ENSMR", "ECOLE NATIONALE SUPERIEURE DES MINES DE RABAT"], "ensmr.ac.ma"],
  [["ENSA", "ECOLE NATIONALE DES SCIENCES APPLIQUEES"], "ensa.ac.ma"],
  [["SUPDECO", "SUP DE CO"], "supdeco.ac.ma"],
  [["ESCA", "ECOLE SUPERIEURE DE COMMERCE ET D'AFFAIRES"], "esca.ma"],
  [["ISGA", "INSTITUT SUPERIEUR DE GESTION ET D'ADMINISTRATION"], "isga.ma"],
  [["IGA", "INSTITUT DE GESTION ET D'ADMINISTRATION"], "iga.ac.ma"],
  [["ENAM", "ECOLE NATIONALE D'ADMINISTRATION ET DE MANAGEMENT"], "enam.ac.ma"],
  [["FSJES", "FACULTE DES SCIENCES JURIDIQUES"], "fsjes-agdal.um5.ac.ma"],
  [["FSEG", "FACULTE DES SCIENCES ECONOMIQUES"], "fseg.ac.ma"],
  [["FSAC", "FACULTE DES SCIENCES AIN CHOCK"], "fsac.ac.ma"],
  [["ESTC", "ECOLE SUPERIEURE DE TECHNOLOGIE DE CASABLANCA"], "estc.ac.ma"],
  [["EST", "ECOLE SUPERIEURE DE TECHNOLOGIE"], "est.usmba.ac.ma"],
  [["GINF", "GROUPE INFORMATIQUE"], "ginf.ma"],
  [["EEAC", "ECOLE EUROPEENNE DES AFFAIRES"], "eeac.ma"],
  [["USMBA", "UNIVERSITE SIDI MOHAMMED BEN ABDELLAH"], "usmba.ac.ma"],
  [["UM6P", "UNIVERSITE MOHAMMED VI POLYTECHNIQUE"], "um6p.ma"],
  [["AUI", "AL AKHAWAYN", "UNIVERSITE AL AKHAWAYN"], "aui.ma"],
  [["MUNDIAPOLIS"], "mundiapolis.ma"],
  [["UNIVERSIAPOLIS"], "universiapolis.ma"],
  [["UCAM", "UNIVERSITE CHOUAIB DOUKKALI"], "ucd.ac.ma"],
  [["UIT", "UNIVERSITE IBN TOFAIL"], "uit.ac.ma"],
  [["ENSA MARRAKECH"], "ensa-marrakech.ac.ma"],
  [["ENSET", "ECOLE NORMALE SUPERIEURE DE L'ENSEIGNEMENT TECHNIQUE"], "enset.ac.ma"],
];

function normalize(s: string): string {
  return s
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .replace(/[^A-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findDomain(input: string): string | null {
  const q = normalize(input);

  for (const [variants, domain] of SCHOOLS) {
    for (const v of variants) {
      const nv = normalize(v);
      // exact match or contained
      if (q === nv || q.includes(nv) || nv.includes(q)) {
        return domain;
      }
    }
  }
  return null;
}

router.get("/logo", async (req: Request, res: Response) => {
  const school = ((req.query.school as string) ?? "").trim();

  if (!school) {
    res.status(400).json({ error: "school query param required" });
    return;
  }

  const domain = findDomain(school);

  if (!domain) {
    res.json({ logoUrl: null });
    return;
  }

  const logoUrl = `https://logo.clearbit.com/${domain}`;

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
