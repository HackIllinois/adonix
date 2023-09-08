export interface EncodeFormat {
	user: string,
	data: never,
}

export interface DecodeToken {
	token: string,
}
export interface DecodeFormat {
	data: EncodeFormat,
	time: number,
}
