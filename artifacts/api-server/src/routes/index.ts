import { Router, type IRouter } from "express";
import announcementsRouter from "./announcements";
import dashboardRouter from "./dashboard";
import documentsRouter from "./documents";
import healthRouter from "./health";
import teacherRouter from "./teacher";

const router: IRouter = Router();

router.use(healthRouter);
router.use(documentsRouter);
router.use(announcementsRouter);
router.use(dashboardRouter);
router.use(teacherRouter);

export default router;
