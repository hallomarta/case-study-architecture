import { Body, Controller, Get, Post } from '@inversifyjs/http-core';
import { ValidateStandardSchemaV1 } from '@inversifyjs/standard-schema-validation';
import { z } from 'zod';

interface TestMessage {
    content: string;
    priority?: number;
}

@Controller('/health-check')
export class BaseController {
    // service health check
    @Get('/')
    public async healthCheck() {
        return { message: 'Service is up and running' };
    }

    // test validation endpoint
    @Post('/test-validation')
    public async testValidation(
        @Body()
        @ValidateStandardSchemaV1(
            z
                .object({
                    content: z.string().min(1).max(100),
                    priority: z.number().int().min(1).max(5).optional(),
                })
                .strict()
        )
        message: TestMessage
    ): Promise<TestMessage> {
        return {
            ...message,
            content: `Validated: ${message.content}`,
        };
    }
}
