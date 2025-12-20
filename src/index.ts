import 'reflect-metadata';
import { getApp } from './lib/app';
import { config } from './lib/config';

(async () => {
    try {
        const application = await getApp();

        application.listen(config.port, () => {
            console.log(`Server listening on port ${config.port}`);
        });
    } catch (err) {
        console.error(err);
    }
})();
