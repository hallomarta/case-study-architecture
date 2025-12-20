import { Application } from 'express';
import { json } from 'body-parser';
import helmet from 'helmet';
import cors from 'cors';
import { InversifyExpressHttpAdapter } from '@inversifyjs/http-express';
import { InversifyValidationErrorFilter } from '@inversifyjs/http-validation';
import { StandardSchemaValidationPipe } from '@inversifyjs/standard-schema-validation';
import { diContainer } from '../../inversify.config';
import { getConfig } from './config';

export async function getApp(): Promise<Application> {
    const config = getConfig();

    const adapter = new InversifyExpressHttpAdapter(diContainer, {
        logger: config.nodeEnv !== 'test',
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
    app.use(
        cors({
            origin: config.allowedOrigins,
            credentials: true,
        })
    );

    // Add body parser middleware
    app.use(json());

    return app;
}
