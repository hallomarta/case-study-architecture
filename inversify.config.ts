import { Container } from 'inversify';

import './src/lib/base-controller';
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

// // bind services
// diContainer.bind<ExampleService>(TYPES.ExampleService).to(ExampleServiceImpl);
// diContainer.bind<UserService>(TYPES.UserService).to(UserServiceImpl);
// diContainer
//     .bind<PasswordManagerService>(TYPES.PasswordManagerService)
//     .to(PasswordManagerServiceImpl);

// // bind repositories
// diContainer.bind<UserRepository>(TYPES.UserRepository).to(UserRepositoryImpl);
