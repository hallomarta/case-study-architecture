export const TOKEN = {
    // Libs
    DB: Symbol.for('DB'),
    PrismaClient: Symbol.for('PrismaClient'),

    // Services
    UserService: Symbol.for('UserService'),
    PasswordManagerService: Symbol.for('PasswordManagerService'),

    // Repositories
    UserRepository: Symbol.for('UserRepository'),
};
