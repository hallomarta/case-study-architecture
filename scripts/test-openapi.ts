import {
    extendZodWithOpenApi,
    OpenAPIRegistry,
    OpenApiGeneratorV31,
} from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

// Extend Zod with OpenAPI capabilities
extendZodWithOpenApi(z);

// Create registry
const registry = new OpenAPIRegistry();

// Test schema
const testSchema = z
    .object({
        email: z.string().email().openapi({
            example: 'test@example.com',
            description: 'User email',
        }),
        password: z.string().min(8).openapi({
            example: 'MyP@ssw0rd',
            description: 'User password',
        }),
    })
    .openapi({
        description: 'Test request schema',
    });

console.log('=== Test 1: Direct schema ===');
console.log(JSON.stringify(testSchema, null, 2));

console.log('\n=== Test 2: Register component ===');
registry.registerComponent('schemas', 'TestSchema', testSchema);

console.log('\n=== Test 3: Generate full document ===');
const generator = new OpenApiGeneratorV31(registry.definitions);
const doc = generator.generateDocument({
    openapi: '3.1.0',
    info: {
        title: 'Test API',
        version: '1.0.0',
    },
});
console.log(JSON.stringify(doc, null, 2));

console.log('\n=== Test 4: Registry definitions ===');
console.log(JSON.stringify(registry.definitions, null, 2));

console.log('\n=== Test 5: What we need for decorators ===');
// What structure do we need for the decorators?
const schemaForDecorator = {
    content: {
        'application/json': {
            schema: {
                // This is what we need to figure out
                type: 'object',
                properties: {
                    email: { type: 'string', format: 'email' },
                    password: { type: 'string', minLength: 8 },
                },
                required: ['email', 'password'],
            },
        },
    },
};
console.log(JSON.stringify(schemaForDecorator, null, 2));
