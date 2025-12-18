// import { Request, Response } from 'express';
// import { inject } from 'inversify';
// import {
//     controller,
//     httpGet,
//     httpPost,
//     request,
//     response,
// } from 'inversify-express-utils';
// import { ExampleService } from 'services/example-service';

// import { BaseController, TYPES } from '../lib';

// @controller('/example')
// export class ExampleController extends BaseController {
//     constructor(
//         @inject(TYPES.ExampleService) private exampleService: ExampleService
//     ) {
//         super();
//     }

//     @httpGet('/test')
//     async test() {
//         return await this.exampleService.test();
//     }

//     @httpPost('/publish-event')
//     async publishEvent(@request() req: Request, @response() res: Response) {
//         try {
//             await this.exampleService.publishEventTest(req.body.message);
//             res.status(200).json({
//                 message: 'Successfully published message to eventbus',
//             });
//         } catch (error: any) {
//             res.status(400).json({ error: error.message });
//         }
//     }
// }
