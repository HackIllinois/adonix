import "dotenv";

abstract class Constants {
	// Status codes
	static readonly SUCCESS:number = 200;
	static readonly BAD_REQUEST:number = 400;
	static readonly FAILURE:number = 400;
	static readonly UNAUTHORIZED_REQUEST:number = 401;
	static readonly FORBIDDEN:number = 403;
	static readonly NOT_FOUND:number = 404;
	static readonly OLD_API:number = 418;
	static readonly INTERNAL_ERROR:number = 500;

	// URLs
	// static readonly GITHUB_OAUTH_CALLBACK:string = "https://adonix.hackillinois.org/auth/github/callback/";
	static readonly GITHUB_OAUTH_CALLBACK:string = "https://hackillinois.org/auth?redirect_uri=https://hackillinois.org/auth/?isiOS=1";
	static readonly GOOGLE_OAUTH_CALLBACK:string = "https://adonix.hackillinois.org/auth/google/callback/";

	static readonly SYSTEM_ADMIN_LIST:string[] = (process.env.SYSTEM_ADMINS ?? "").split(",");
	
	static readonly DEFAULT_JWT_OFFSET: string = "48h";

	// Conversions for datetimes
	static readonly MILLISECONDS_PER_SECOND:number = 1000;
}

export default Constants;
