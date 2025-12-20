import { Application } from 'express';
import { json } from 'body-parser';
import helmet from 'helmet';
import cors from 'cors';
import { InversifyExpressHttpAdapter } from '@inversifyjs/http-express';
import { InversifyValidationErrorFilter } from '@inversifyjs/http-validation';
import { StandardSchemaValidationPipe } from '@inversifyjs/standard-schema-validation';
import { diContainer } from '../../inversify.config';
import { config } from './config';
import { SwaggerUiProvider } from '@inversifyjs/http-open-api';
import { generateOpenApiComponents } from './openapi-components';

export async function getApp(): Promise<Application> {
    const adapter = new InversifyExpressHttpAdapter(diContainer, {
        logger: config.nodeEnv !== 'test',
        useCookies: true,
    });

    // Configure Swagger UI for API documentation
    if (config.nodeEnv !== 'production') {
        const swaggerProvider = new SwaggerUiProvider({
            api: {
                openApiObject: {
                    info: {
                        title: 'User Authentication API',
                        version: '1.0.0',
                        description:
                            'A comprehensive authentication API supporting local and OAuth providers',
                    },
                    openapi: '3.1.0',
                    components: {
                        schemas: generateOpenApiComponents(),
                        securitySchemes: {
                            bearerAuth: {
                                type: 'http',
                                scheme: 'bearer',
                                bearerFormat: 'JWT',
                            },
                        },
                    },
                },
                path: '/docs',
            },
            ui: {
                title: 'User Authentication API Documentation',
            },
        });

        swaggerProvider.provide(diContainer);
    }

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
