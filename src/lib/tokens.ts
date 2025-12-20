export const TOKEN = {
    // Libs
    DB: Symbol.for('DB'),
    PrismaClient: Symbol.for('PrismaClient'),
    Config: Symbol.for('Config'),

    // Services
    UserService: Symbol.for('UserService'),
    PasswordManagerService: Symbol.for('PasswordManagerService'),
    PasswordService: Symbol.for('PasswordService'),
    MailService: Symbol.for('MailService'),

    // Repositories
    UserRepository: Symbol.for('UserRepository'),
    RefreshTokenRepository: Symbol.for('RefreshTokenRepository'),
    PasswordResetTokenRepository: Symbol.for('PasswordResetTokenRepository'),
};
