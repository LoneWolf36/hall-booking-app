import {
  ArgumentMetadata,
  Injectable,
  PipeTransform,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';

@Injectable()
export class CustomValidationPipe implements PipeTransform<any> {
  private readonly logger = new Logger(CustomValidationPipe.name);

  async transform(value: any, { metatype }: ArgumentMetadata) {
    if (!metatype || !this.toValidate(metatype)) {
      return value;
    }

    // Handle empty body case
    if (!value || Object.keys(value).length === 0) {
      const errors = [
        {
          property: 'body',
          constraints: ['Request body cannot be empty'],
          value: value,
        },
      ];

      this.logger.warn(
        `Validation failed: Empty request body for ${metatype.name}`,
      );

      throw new BadRequestException({
        statusCode: 400,
        error: 'BadRequest',
        message: 'Validation failed',
        details: 'Request body is required and cannot be empty',
        errors: errors,
        timestamp: new Date().toISOString(),
      });
    }

    const object = plainToInstance(metatype, value);
    const errors = await validate(object, {
      whitelist: true, // Strip properties that don't have decorators
      forbidNonWhitelisted: true, // Throw error for non-whitelisted properties
      transform: true, // Apply transformers
      validateCustomDecorators: true,
    });

    if (errors.length > 0) {
      const errorMessages = errors.map((error) => {
        const constraints = error.constraints;
        return {
          property: error.property,
          constraints: constraints
            ? Object.values(constraints)
            : ['Invalid value'],
          value: error.value,
          children:
            error.children && error.children.length > 0
              ? this.mapChildrenErrors(error.children)
              : undefined,
        };
      });

      // Log validation errors for debugging
      this.logger.warn(`Validation failed for ${metatype.name}:`, {
        input: value,
        errors: errorMessages,
      });

      throw new BadRequestException({
        statusCode: 400,
        error: 'BadRequest',
        message: 'Validation failed',
        details: `Invalid ${metatype.name} provided. Please check the required fields and format.`,
        errors: errorMessages,
        timestamp: new Date().toISOString(),
      });
    }

    return object;
  }

  private mapChildrenErrors(children: any[]): any[] {
    return children.map((child) => ({
      property: child.property,
      constraints: child.constraints
        ? Object.values(child.constraints)
        : ['Invalid nested value'],
      value: child.value,
    }));
  }

  private toValidate(metatype: Function): boolean {
    const types: Function[] = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }
}

/**
 * Enhanced Validation Pipe Features:
 *
 * 1. **Empty Body Handling**: Provides clear error for empty request bodies
 * 2. **Detailed Error Messages**: Shows exactly which fields failed validation
 * 3. **Nested Validation**: Handles validation errors in nested objects
 * 4. **Whitelist Mode**: Strips unknown properties and prevents injection
 * 5. **Transform Mode**: Automatically applies class-transformer decorators
 * 6. **Comprehensive Logging**: Logs validation failures for debugging
 * 7. **Consistent Error Format**: Returns structured error responses
 *
 * Error Response Format:
 * {
 *   "statusCode": 400,
 *   "error": "BadRequest",
 *   "message": "Validation failed",
 *   "details": "Human-readable description",
 *   "errors": [
 *     {
 *       "property": "fieldName",
 *       "constraints": ["Field is required", "Must be a valid email"],
 *       "value": "invalid-value"
 *     }
 *   ],
 *   "timestamp": "2025-10-26T09:00:00.000Z"
 * }
 */
