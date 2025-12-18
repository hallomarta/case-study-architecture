import {
    controller,
    httpGet,
    BaseHttpController,
} from 'inversify-express-utils';

@controller('/health-check')
export abstract class BaseController extends BaseHttpController {
    // service health check
    @httpGet('/')
    public async healthCheck() {
        return this.json({ message: 'Service is up and running' }, 200);
    }
}
