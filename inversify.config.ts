import { Container } from 'inversify';

import { BaseController } from './src/lib/base-controller';
// import './src/controllers';

// import {
//     ExampleService,
//     ExampleServiceImpl,
//     UserService,
//     UserServiceImpl,
//     PasswordManagerService,
//     PasswordManagerServiceImpl,
// } from './src/services';
// import { UserRepository, UserRepositoryImpl } from './src/repositories';

// import { TYPES } from './src/lib';

export const diContainer = new Container();

// Register controllers
diContainer.bind(BaseController).toSelf().inSingletonScope();

// // bind services
// diContainer.bind<ExampleService>(TYPES.ExampleService).to(ExampleServiceImpl);
// diContainer.bind<UserService>(TYPES.UserService).to(UserServiceImpl);
// diContainer
//     .bind<PasswordManagerService>(TYPES.PasswordManagerService)
//     .to(PasswordManagerServiceImpl);

// // bind repositories
// diContainer.bind<UserRepository>(TYPES.UserRepository).to(UserRepositoryImpl);
