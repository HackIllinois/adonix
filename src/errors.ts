class JWTError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "JWTError";
        Error.captureStackTrace(this, JWTError);
    }
}