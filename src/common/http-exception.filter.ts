import {
  ArgumentsHost,//gives access to request/response objects
  Catch,//decorator that tells NestJS this is an error catcher
  ExceptionFilter,
  HttpException,//base class for Nest HTTP errors (BadRequest, Unauthorized, etc.)
  HttpStatus,//enum of status codes (400, 401, 500…)
} from '@nestjs/common';
import type { Request, Response } from 'express';
@Catch() // Catch ALL errors
export class HttpExceptionFilter implements ExceptionFilter {

  catch(error: unknown, host: ArgumentsHost) {

    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();

    let statusCode: number;
    let message: string;

    if (error instanceof HttpException) {
      statusCode = error.getStatus();

      const errorResponse = error.getResponse();

      // Extract message safely
      if (typeof errorResponse === 'string') {
        message = errorResponse;
      } else {
        message =
          (errorResponse as any).message || 'Something went wrong';
      }

    } else {
      // If it's an unexpected error
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';
    }

    // Send clean, consistent response
    response.status(statusCode).json({
      error: {
        statusCode,
        message,
        path: request.url,
        timestamp: new Date().toISOString(),
      },
    });
  }
}
// This is a Global Exception Filter in NestJS.
// Its job is to catch errors and return a clean, consistent JSON response instead of messy default errors.