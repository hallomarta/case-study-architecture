// import { scrypt, randomBytes } from 'crypto';
// import { injectable } from 'inversify';
// import { promisify } from 'util';

// export interface PasswordManagerService {
//     toHash(password: string): Promise<string>;
//     compare(storedPassword: string, suppliedPassword: string): Promise<boolean>;
// }

// const scryptAsync = promisify(scrypt);

// /**
//  * A utility class to hash user password before storing in DB
//  * and compares user supplied passowrd with the stored hash
//  */
// @injectable()
// export class PasswordManagerServiceImpl implements PasswordManagerService {
//     async toHash(password: string) {
//         // HANDLE HASHING HERE
//     }

//     async compare(storedPassword: string, suppliedPassword: string) {
//         // HANDLE COMPARISON HERE
//     }
// }
