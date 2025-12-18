// import { injectable, inject } from 'inversify';
// import { TYPES } from '../lib';
// import { DomainEvents } from '@marta/eventbus/dist';

// export interface ExampleService {
//     test(): Promise<{ message: string }>;
//     publishEventTest(message: string): Promise<void>;
// }

// @injectable()
// export class ExampleServiceImpl implements ExampleService {
//     constructor(@inject(TYPES.producer) private producer) {}

//     async test() {
//         return Promise.resolve({ message: 'Test message' });
//     }

//     async publishEventTest(message: string) {
//         await this.producer.publish({
//             topic: 'test-topic',
//             events: [
//                 {
//                     type: DomainEvents.TEST_EVENT,
//                     data: [{ key: 'test-key', value: message }],
//                 },
//             ],
//         });
//     }
// }
