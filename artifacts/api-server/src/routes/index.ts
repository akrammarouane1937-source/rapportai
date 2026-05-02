import { Router, type IRouter } from "express";
import healthRouter from "./health";
import generateRouter from "./generate";
import juryRouter from "./jury";
import figuresRouter from "./figures";
import shareRouter from "./share";

const router: IRouter = Router();

router.use(healthRouter);
router.use(generateRouter);
router.use(juryRouter);
router.use(figuresRouter);
router.use(shareRouter);

export default router;
