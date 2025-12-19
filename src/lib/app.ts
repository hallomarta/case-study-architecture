import { Application } from 'express';
import { json } from 'body-parser';
import helmet from 'helmet';
import cors from 'cors';
import { InversifyExpressHttpAdapter } from '@inversifyjs/http-express';
import { InversifyValidationErrorFilter } from '@inversifyjs/http-validation';
import { StandardSchemaValidationPipe } from '@inversifyjs/standard-schema-validation';
import { diContainer } from '../../inversify.config';

export async function getApp(): Promise<Application> {
    const adapter = new InversifyExpressHttpAdapter(diContainer, {
        logger: process.env.NODE_ENV !== 'test',
        useCookies: true,
    });

    // Configure global validation
    adapter.useGlobalFilters(InversifyValidationErrorFilter);
    adapter.useGlobalPipe(new StandardSchemaValidationPipe());

    // Build the Express application
    const app = await adapter.build();

    // Security headers
    app.use(helmet());

    // CORS configuration
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
        'http://localhost:3000',
    ];
    app.use(
        cors({
            origin: allowedOrigins,
            credentials: true,
        })
    );

    // Add body parser middleware
    app.use(json());

    return app;
}
