

export interface encodingDecodingPayload {
    user: string,
    data: any
}

export interface hackWebTokenPayload {
    secretKey: string,
    iv: string
}

export interface encodedPayload {
    token: string,
    context: {
        additional_info: string
    }
}