abstract class Constants {
	// Status codes
	static readonly SUCCESS:number = 200;
	static readonly BAD_REQUEST:number = 400;
	static readonly FAILURE:number = 400;
	static readonly UNAUTHORIZED_REQUEST: number = 401;
	static readonly NOT_FOUND:number = 404;
	static readonly OLD_API:number = 418;
	static readonly INTERNAL_ERROR:number = 500;

	// URLs
	static readonly GITHUB_OAUTH_CALLBACK:string = "https://hackillinois.org/auth/github/callback/";
	static readonly GOOGLE_OAUTH_CALLBACK:string = "https://hackillinois.org/auth/google/callback/";
}

export default Constants;
