"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpExceptionFilter = void 0;
const common_1 = require("@nestjs/common");
let HttpExceptionFilter = class HttpExceptionFilter {
    catch(error, host) {
        const context = host.switchToHttp();
        const request = context.getRequest();
        const response = context.getResponse();
        let statusCode;
        let message;
        let details;
        if (error instanceof common_1.HttpException) {
            statusCode = error.getStatus();
            const errorResponse = error.getResponse();
            // Extract message safely
            if (typeof errorResponse === 'string') {
                message = errorResponse;
            }
            else {
                message =
                    errorResponse.message || 'Something went wrong';
            }
        }
        else {
            // If it's an unexpected error
            statusCode = common_1.HttpStatus.INTERNAL_SERVER_ERROR;
            message = 'Internal server error';
            if (error instanceof Error) {
                // Log server-side for debugging
                // eslint-disable-next-line no-console
                console.error(error);
                // In development, return the actual error message to help debugging.
                if ((process.env.NODE_ENV ?? 'development') !== 'production') {
                    details = error.message;
                }
            }
        }
        // Send clean, consistent response
        response.status(statusCode).json({
            error: {
                statusCode,
                message,
                ...(details ? { details } : {}),
                path: request.url,
                timestamp: new Date().toISOString(),
            },
        });
    }
};
exports.HttpExceptionFilter = HttpExceptionFilter;
exports.HttpExceptionFilter = HttpExceptionFilter = __decorate([
    (0, common_1.Catch)() // Catch ALL errors
], HttpExceptionFilter);
// This is a Global Exception Filter in NestJS.
// Its job is to catch errors and return a clean, consistent JSON response instead of messy default errors.
//# sourceMappingURL=http-exception.filter.js.map