import { Container } from 'inversify';
import { InversifyValidationErrorFilter } from '@inversifyjs/http-validation';
import { PrismaClient } from '@prisma/client';

import { BaseController } from './src/controllers/base-controller';
import { UserController } from './src/controllers/user-controller';
import { PasswordController } from './src/controllers/password-controller';
import { OAuthController } from './src/controllers/oauth-controller';
import { SocialAuthController } from './src/controllers/social-auth-controller';

import { LoginRateLimitMiddleware, PasswordResetRateLimitMiddleware } from './src/middleware/rate-limit-middleware';

import { UserRepository, UserRepositoryImpl } from './src/repositories/user-repository';
import { RefreshTokenRepository, RefreshTokenRepositoryImpl } from './src/repositories/refresh-token-repository';
import { PasswordResetTokenRepository, PasswordResetTokenRepositoryImpl } from './src/repositories/password-reset-token-repository';
import { AuthGuard } from './src/guards/auth-guard';

import { TOKEN } from './src/lib/tokens';
import { PasswordManagerService, PasswordManagerServiceImpl } from './src/services/password-manager-service';
import { UserService, UserServiceImpl } from './src/services/user-service';
import { PasswordService, PasswordServiceImpl } from './src/services/password-service';
import { MailService, ConsoleMailService } from './src/services/mail-service';
import { TokenService, TokenServiceImpl } from './src/services/token-service';
import { SessionService, SessionServiceImpl } from './src/services/session-service';
import { OAuthService } from './src/services/oauth-service';
import { IdentityProvider } from './src/providers/identity-provider';
import { LocalIdentityProvider } from './src/providers/local-provider';
import prisma from './src/lib/prisma';
import { config } from './src/lib/config';
import type { Config } from './src/types/Config';

export const diContainer = new Container();

// Register Config as a singleton
diContainer.bind<Config>(TOKEN.Config).toConstantValue(config);

// Register PrismaClient as a singleton
diContainer.bind<PrismaClient>(TOKEN.PrismaClient).toConstantValue(prisma);

// Register error filters
diContainer.bind(InversifyValidationErrorFilter).toSelf().inSingletonScope();

// Register guards
diContainer.bind(AuthGuard).toSelf().inSingletonScope();

// Register middleware
// Use transient scope so each request gets fresh middleware (important for rate limiting in tests)
diContainer.bind(LoginRateLimitMiddleware).toSelf().inTransientScope();
diContainer.bind(PasswordResetRateLimitMiddleware).toSelf().inTransientScope();

// Register controllers
diContainer.bind(BaseController).toSelf().inSingletonScope();
diContainer.bind(UserController).toSelf().inSingletonScope();
diContainer.bind(PasswordController).toSelf().inSingletonScope();
diContainer.bind(OAuthController).toSelf().inSingletonScope();
diContainer.bind(SocialAuthController).toSelf().inSingletonScope();

// bind services
diContainer.bind<UserService>(TOKEN.UserService).to(UserServiceImpl);
diContainer
    .bind<PasswordManagerService>(TOKEN.PasswordManagerService)
    .to(PasswordManagerServiceImpl);
diContainer
    .bind<PasswordService>(TOKEN.PasswordService)
    .to(PasswordServiceImpl);
diContainer
    .bind<MailService>(TOKEN.MailService)
    .to(ConsoleMailService);
diContainer
    .bind<TokenService>(TOKEN.TokenService)
    .to(TokenServiceImpl);
diContainer
    .bind<SessionService>(TOKEN.SessionService)
    .to(SessionServiceImpl);
diContainer
    .bind<OAuthService>(TOKEN.OAuthService)
    .to(OAuthService);

// bind providers
diContainer
    .bind<IdentityProvider>(TOKEN.IdentityProvider)
    .to(LocalIdentityProvider);

// bind repositories
diContainer.bind<UserRepository>(TOKEN.UserRepository).to(UserRepositoryImpl);
diContainer
    .bind<RefreshTokenRepository>(TOKEN.RefreshTokenRepository)
    .to(RefreshTokenRepositoryImpl);
diContainer
    .bind<PasswordResetTokenRepository>(TOKEN.PasswordResetTokenRepository)
    .to(PasswordResetTokenRepositoryImpl);
