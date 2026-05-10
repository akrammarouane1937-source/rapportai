import { Router, type IRouter } from "express";
import healthRouter from "./health";
import generateRouter from "./generate";
import sessionRouter from "./session";
import juryRouter from "./jury";
import figuresRouter from "./figures";
import shareRouter from "./share";
import stripeRouter from "./stripe";
import reviseRouter from "./revise";
import chatRouter from "./chat";
import humanizeRouter from "./humanize";

const router: IRouter = Router();

router.use(healthRouter);
router.use(generateRouter);
router.use(sessionRouter);
router.use(juryRouter);
router.use(figuresRouter);
router.use(shareRouter);
router.use(stripeRouter);
router.use(reviseRouter);
router.use(chatRouter);
router.use(humanizeRouter);

export default router;
