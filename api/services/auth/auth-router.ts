import { Router, Request, Response} from "express";

const authRouter:Router = Router();

authRouter.get("/test/", (_: Request, res: Response) => {
	console.log("Received log!");
	res.end("Auth endpoint is working!");
});

export default authRouter;
