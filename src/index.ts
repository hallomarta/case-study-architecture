import 'reflect-metadata';
import dotenv from 'dotenv';
import { getApp } from './lib/app';

dotenv.config();

(async () => {
    try {
        const application = await getApp();
        const PORT = process.env.PORT || 9000;

        application.listen(PORT, () => {
            console.log(`Server listening on port ${PORT}`);
        });
    } catch (err) {
        console.error(err);
    }
})();
