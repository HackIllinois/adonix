import { Request, Response, NextFunction } from 'express';
import { StatusCode } from "status-code-enum";

export class RouterError {
    statusCode: number;
    message: string;
    data?: any;
    catchErrorMessage?: string;

    constructor(statusCode?: number, message?: string, data?: any, catchErrorMessage?: string) {
        if (statusCode) this.statusCode = statusCode;
        else this.statusCode = 500;
        if (message) this.message = message;
        else this.message = "Internal Server Error";
        if (data) this.data = data;
        else this.data = null;
        if (catchErrorMessage) {
            this.catchErrorMessage = catchErrorMessage;
            console.error(catchErrorMessage);
        } else this.catchErrorMessage = "";
    }
}
export function ErrorHandler(error: RouterError, _req: Request, resp: Response, _next: NextFunction) {
    const statusCode: number = error.statusCode;
    const message: string = error.message;
    const data: any = error.data;
    const catchErrorMessage: string | undefined = error.catchErrorMessage;

    let jsonData: { [key: string]: any } = {
        success: statusCode === StatusCode.SuccessOK ? true : false,
        error: message
    };
    if (data) jsonData["data"] = data;
    if (catchErrorMessage) jsonData["error_message"] = catchErrorMessage;

    resp.status(statusCode).json(jsonData);
}