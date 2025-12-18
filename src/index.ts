import { json } from 'body-parser';

import 'reflect-metadata';
import dotenv from 'dotenv';
import { InversifyExpressServer } from 'inversify-express-utils';

// import { createKafkaClient, Producer, Consumer } from '@marta/eventbus/dist';

// import { getDataSource } from './typeormconfig';

import { diContainer } from '../inversify.config';
// import { TYPES } from './lib';
// import { exampleEventHandler } from './events/handlers';

dotenv.config();

(async () => {
    try {
        // Create Kafka producer and consumer instance
        // const kafkaClient = await createKafkaClient();
        // const producer = new Producer(kafkaClient);
        // const consumer = new Consumer(kafkaClient, 'test-service-group');

        // Subscribe to all the topics the service is interested in
        // await consumer.subscribe([
        //     { topic: 'test-topic', eventHandler: exampleEventHandler },
        // ]);

        // Bind producer instance to the DI container so it can be accessed from anywhere
        // diContainer.bind(TYPES.producer).toConstantValue(producer);

        // DB setup
        // const dataSource = await getDataSource();
        // await dataSource.initialize();
        // diContainer.bind(TYPES.DB).toConstantValue(dataSource);

        // Create app server
        const app = new InversifyExpressServer(diContainer, null, {
            rootPath: '/partner-app/api',
        });
        app.setConfig(app => {
            app.use(json());
        });

        const server = app.build();

        const PORT = process.env.PORT || 9000;

        server.listen(PORT, () => {
            console.log(`Server listening on port ${PORT}`);
        });
    } catch (err) {
        console.error(err);
    }
})();
