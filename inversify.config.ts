import { Container } from 'inversify';
import { InversifyValidationErrorFilter } from '@inversifyjs/http-validation';
import { PrismaClient } from '@prisma/client';

import { BaseController } from './src/controllers/base-controller';
import { UserController } from './src/controllers/user-controller';

import { LoginRateLimitMiddleware } from './src/middleware/rate-limit-middleware';

import { UserRepository, UserRepositoryImpl } from './src/repositories/user-repository';
import { AuthGuard } from './src/guards/auth-guard';

import { TOKEN } from './src/lib/tokens';
import { PasswordManagerService, PasswordManagerServiceImpl } from './src/services/password-manager-service';
import { UserService, UserServiceImpl } from './src/services/user-service';
import prisma from './src/lib/prisma';

export const diContainer = new Container();

// Register PrismaClient as a singleton
diContainer.bind<PrismaClient>(TOKEN.PrismaClient).toConstantValue(prisma);

// Register error filters
diContainer.bind(InversifyValidationErrorFilter).toSelf().inSingletonScope();

// Register guards
diContainer.bind(AuthGuard).toSelf().inSingletonScope();

// Register middleware
// Use transient scope so each request gets fresh middleware (important for rate limiting in tests)
diContainer.bind(LoginRateLimitMiddleware).toSelf().inTransientScope();

// Register controllers
diContainer.bind(BaseController).toSelf().inSingletonScope();
diContainer.bind(UserController).toSelf().inSingletonScope();

// bind services
diContainer.bind<UserService>(TOKEN.UserService).to(UserServiceImpl);
diContainer
    .bind<PasswordManagerService>(TOKEN.PasswordManagerService)
    .to(PasswordManagerServiceImpl);

// bind repositories
diContainer.bind<UserRepository>(TOKEN.UserRepository).to(UserRepositoryImpl);
