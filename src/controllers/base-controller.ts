import { Controller, Get } from '@inversifyjs/http-core';

@Controller('/health-check')
export class BaseController {
    // service health check
    @Get('/')
    public async healthCheck() {
        return { message: 'Service is up and running' };
    }
}
