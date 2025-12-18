import { json } from 'body-parser';

import 'reflect-metadata';
import dotenv from 'dotenv';
import { InversifyExpressHttpAdapter } from '@inversifyjs/http-express';

import { diContainer } from '../inversify.config';


dotenv.config();

(async () => {
    try {
        // Create adapter with the container
        const adapter = new InversifyExpressHttpAdapter(diContainer);

        // Build the Express application
        const application = await adapter.build();

        // Add body parser middleware
        application.use(json());

        const PORT = process.env.PORT || 9000;

        application.listen(PORT, () => {
            console.log(`Server listening on port ${PORT}`);
        });
    } catch (err) {
        console.error(err);
    }
})();
