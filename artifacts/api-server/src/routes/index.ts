import { Router, type IRouter } from "express";
import healthRouter from "./health";
import generateRouter from "./generate";
import juryRouter from "./jury";

const router: IRouter = Router();

router.use(healthRouter);
router.use(generateRouter);
router.use(juryRouter);

export default router;
