import { scrypt, randomBytes } from 'crypto';
import { injectable } from 'inversify';
import { promisify } from 'util';

export interface PasswordManagerService {
    toHash(password: string): Promise<string>;
    compare(storedPassword: string, suppliedPassword: string): Promise<boolean>;
}

const scryptAsync = promisify(scrypt);

/**
 * A utility class to hash user password before storing in DB
 * and compares user supplied password with the stored hash
 */
@injectable()
export class PasswordManagerServiceImpl implements PasswordManagerService {
    async toHash(password: string): Promise<string> {
        const salt = randomBytes(32).toString('hex');
        const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
        return `${salt}.${derivedKey.toString('hex')}`;
    }

    async compare(
        storedPassword: string,
        suppliedPassword: string
    ): Promise<boolean> {
        const [salt, hash] = storedPassword.split('.');
        const derivedKey = (await scryptAsync(
            suppliedPassword,
            salt,
            64
        )) as Buffer;
        return hash === derivedKey.toString('hex');
    }
}
