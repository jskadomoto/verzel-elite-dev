export class AppError extends Error { 
    constructor (
        public readonly code: string,
        public readonly message: string,
        public readonly status: number,
        public readonly details?: unknown
    ) {
        super(message)
    }
}

export const conflict = (code: string, message: string, details?: unknown): AppError => {
    return new AppError(code, message, 409, details)
}

export const notFound = (message = 'Recurso não encontrado', details?: unknown): AppError => {
    return new AppError('NOT_FOUND', message, 404, details)
}

export const badRequest = (code: string, message: string, details?: unknown): AppError => {
    return new AppError(code, message, 400, details)
}