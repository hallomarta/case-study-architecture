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
    TokenService: Symbol.for('TokenService'),
    SessionService: Symbol.for('SessionService'),
    OAuthService: Symbol.for('OAuthService'),

    // Providers
    IdentityProvider: Symbol.for('IdentityProvider'),

    // Repositories
    UserRepository: Symbol.for('UserRepository'),
    RefreshTokenRepository: Symbol.for('RefreshTokenRepository'),
    PasswordResetTokenRepository: Symbol.for('PasswordResetTokenRepository'),
};
