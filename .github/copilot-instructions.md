# Inversify HTTP with Express - Usage Guide

## Setup

### 1. Install Dependencies
```bash
npm install inversify reflect-metadata @inversifyjs/http-core @inversifyjs/http-express
```

### 2. Configure TypeScript
Enable experimental decorators in `tsconfig.json`:
```json
{
  "experimentalDecorators": true,
  "emitDecoratorMetadata": true
}
```

### 3. Create Server
```typescript
import 'reflect-metadata';
import { Container } from 'inversify';
import { InversifyExpressHttpAdapter } from '@inversifyjs/http-express';

const container = new Container();

// Register controllers
container.bind(MyController).toSelf().inSingletonScope();

// Build Express app
const adapter = new InversifyExpressHttpAdapter(container);
const app = await adapter.build();

app.listen(3000);
```

## Controllers

Controllers are classes with the `@Controller()` decorator that group request handlers for a feature area.

### Basic Controller
```typescript
import { Controller, Get, Post } from '@inversifyjs/http-core';

@Controller('/users')
export class UserController {
    @Get('/')
    async getUsers() {
        return [{ id: 1, name: 'John' }]; // Inversify converts to JSON response
    }
    
    @Post('/')
    async createUser() {
        return { id: 2, name: 'Jane' }; // Returns 200 with JSON
    }
}
```

### Implementation Approaches

#### 1. Framework-Agnostic (Recommended)
Return plain values - Inversify handles HTTP responses:
- Objects → JSON with 200 status
- Strings → text/plain with 200 status  
- `CreatedHttpResponse` → 201 status
- `throw ErrorHttpResponse` → error status

```typescript
import { Controller, Get, Post, Body, Params } from '@inversifyjs/http-core';
import { CreatedHttpResponse, ErrorHttpResponse } from '@inversifyjs/http-express';
import { HttpStatusCode } from '@inversifyjs/http-core';

@Controller('/users')
export class UserController {
    // Return plain object - sent as JSON with 200
    @Get('/')
    async getUsers(): Promise<User[]> {
        return [
            { id: 1, name: 'John', email: 'john@example.com' },
            { id: 2, name: 'Jane', email: 'jane@example.com' }
        ];
    }
    
    // Return CreatedHttpResponse for 201 status
    @Post('/')
    async createUser(@Body() userData: CreateUserDto): Promise<CreatedHttpResponse> {
        const newUser = await this.service.create(userData);
        return new CreatedHttpResponse(newUser);
    }
    
    // Return string - sent as text/plain with 200
    @Get('/status')
    async getStatus(): Promise<string> {
        return 'Service is healthy';
    }
    
    // Throw ErrorHttpResponse for errors
    @Get('/:id')
    async getUser(@Params({ name: 'id' }) id: string): Promise<User> {
        const user = await this.service.findById(id);
     equest Parameter Decorators
```typescript
import { Controller, Get, Post, Put, Delete, Body, Params, Query, Headers } from '@inversifyjs/http-core';

@Controller('/users')
export class UserController {
    // Path parameters
    @Get('/:id')
    async getUser(@Params({ name: 'id' }) id: string) {
        return this.userService.findById(id);
    }
    
    // Query parameters
    @Get('/')
    async search(@Query({ name: 'email' }) email?: string) {
        return this.userService.search(email);
    }
    
    // Request body
    @Post('/')
    async create(@Body() userData: CreateUserDto) {
        return this.userService.create(userData);
    }
    
    // Headers
    @Get('/me')
    async getProfile(@Headers({ name: 'authorization' }) token: string) {
        return this.userService.getProfile(token);
    }
    
    // Multiple parameters
    @Put('/:id')
    async update(
        @Params({ name: 'id' }) id: string,
        @Body() data: UpdateUserDto
    ) {
        return this.userService.update(id, data);
    }
}
```

### Controller Inheritance
Reuse common routes via base classes:

```typescript
abstract class BaseResourceController {
    @Get('/')
    async list(): Promise<Resource[]> {
        return [
            { id: 1, name: 'Resource 1' },
            { id: 2, name: 'Resource 2' }
        ];
    }
    
    @Get('/:id')
    async getById(@Params({ name: 'id' }) id: string): Promise<Resource> {
        return { id: parseInt(id), name: `Resource ${id}` };
    }
}

@Controller('/users')
export class UsersController extends BaseResourceController {
    // Inherits list() and getById() routes
}

@Controller('/products')
export class ProductsController extends BaseResourceController {
    // Override inherited route
    @Get('/')
    override async list(): Promise<Resource[]> {
        return [
            { id: 1, name: 'Product A' },
            { id: 2, name: 'Product B' }
        ];
    }
}
#### 2. Native Types (Advanced)
For direct Express control, inject `@Response()`:

```typescript
import { Controller, Get, Response } from '@inversifyjs/http-core';
import type { Response as ExpressResponse } from 'express';

@Controller('/files')
export class FileController {
    @Get('/download')
    async download(@Response() res: ExpressResponse): Promise<void> {
        res.setHeader('Content-Type', 'application/pdf');
        res.send(buffer);
    }
}
```

**Important:** Choose one approach per route. Don't mix returning values with using `@Response()`.

### Dependency Injection
Controllers automatically get `@injectable()`. Inject services via constructor:

```typescript
import { Controller, Get } from '@inversifyjs/http-core';
import { inject } from 'inversify';
import { TYPES } from './types';

@Controller('/users')
export class UserController {
    constructor(
        @inject(TYPES.UserService) private userService: UserService
    ) {}
    
    @Get('/')
    async getUsers() {
        return this.userService.findAll();
    }
}
```

### Route Parameters
```typescript
@Get('/:id')
async getUser(@Params({ name: 'id' }) id: string) {
    return this.userService.findById(id);
}

@Get('/')
async search(@Query({ name: 'email' }) email?: string) {
    return this.userService.search(email);
}
```

## Container Registration
Register controllers in your DI container:

```typescript
import { Container } from 'inversify';
import { UserController } from './controllers/user-controller';

const container = new Container();

// Register controller
container.bind(UserController).toSelf().inSingletonScope();

// Register services
container.bind(TYPES.UserService).to(UserServiceImpl);
```

## Error Filters

Error filters provide centralized error handling, transforming application errors into appropriate HTTP responses.

### Custom Error and Filter
```typescript
// Custom error class
export class InvalidOperationError extends Error {
    constructor(message: string = 'Invalid operation', options?: ErrorOptions) {
        super(`[InvalidOperationError]: ${message}`, options);
    }
}

// Error filter
import { CatchError, ErrorFilter } from '@inversifyjs/http-core';
import { UnprocessableEntityHttpResponse } from '@inversifyjs/http-express';

@CatchError(InvalidOperationError)
export class InvalidOperationErrorFilter implements ErrorFilter<InvalidOperationError> {
    public catch(error: InvalidOperationError): void {
        throw new UnprocessableEntityHttpResponse(
            { message: error.message },
            error.message,
            { cause: error }
        );
    }
}

// Apply to controller
import { Controller, Get, UseErrorFilter } from '@inversifyjs/http-core';

@Controller('/products')
@UseErrorFilter(InvalidOperationErrorFilter)
export class ProductController {
    @Get('/:id/validate')
    async validateProduct(): Promise<void> {
        throw new InvalidOperationError('Product validation failed');
    }
}
```

### Global Error Filter (Express 5)
For catching all errors globally:

```typescript
import { CatchError } from '@inversifyjs/http-core';
import { ExpressErrorFilter, isHttpResponse } from '@inversifyjs/http-express';
import type { Request, Response } from 'express';

@CatchError()
export class GlobalErrorFilter implements ExpressErrorFilter {
    public catch(
        err: unknown,
        _request: Request,
        response: Response
    ): void {
        // Handle HttpResponse errors (avoid infinite loops)
        if (isHttpResponse(err)) {
            console.log(`HttpResponse error: ${JSON.stringify(err, Object.getOwnPropertyNames(err))}`);
            response.status(err.statusCode).send(err.body);
            return;
        }
        
        // Handle generic errors
        console.error(`Unhandled error: ${JSON.stringify(err, Object.getOwnPropertyNames(err))}`);
        response.status(500).send({
            error: 'Internal Server Error',
            message: 'Unhandled error',
            statusCode: 500
        });
    }
}

// Register globally in server setup
const adapter = new InversifyExpressHttpAdapter(container);
adapter.useGlobalFilters(GlobalErrorFilter);
const app = await adapter.build();
```

**Important:**
- Error filters don't need `@injectable()` - `@CatchError()` adds it automatically
- Use `isHttpResponse()` to check if error is an HttpResponse instance
- For global error filters, directly manipulate the response to avoid infinite loops
- Use `JSON.stringify(err, Object.getOwnPropertyNames(err))` to properly serialize errors

## Guards

Guards decide whether a request can continue. They run before middleware and handlers.

### Guard Interface
Guards must implement the `Guard<TRequest>` interface:

```typescript
interface Guard<TRequest = any> {
    activate(request: TRequest): Promise<boolean> | boolean;
}
```

- If `activate()` returns `true`, the request proceeds
- If `activate()` returns `false`, the request is blocked with 403 Forbidden
- Can throw `ErrorHttpResponse` for custom error responses

### Allow Guard (Express 5)
```typescript
import { ExpressGuard } from '@inversifyjs/http-express';
import type { Request } from 'express';

export class ExpressAllowGuard implements ExpressGuard {
    public async activate(_request: Request): Promise<boolean> {
        return true;
    }
}
```

### Deny Guard with Custom Response (Express 5)
```typescript
import { ExpressGuard, ForbiddenHttpResponse } from '@inversifyjs/http-express';
import type { Request } from 'express';

export class ExpressDenyGuard implements ExpressGuard {
    public activate(_request: Request): boolean {
        throw new ForbiddenHttpResponse(
            { message: 'Missing or invalid credentials' },
            'Missing or invalid credentials'
        );
    }
}
```

### Authentication Guard Example
```typescript
import { ExpressGuard, UnauthorizedHttpResponse } from '@inversifyjs/http-express';
import type { Request } from 'express';

export class AuthGuard implements ExpressGuard {
    public activate(request: Request): boolean {
        const token = request.headers.authorization;
        
        if (!token) {
            throw new UnauthorizedHttpResponse(
                { message: 'Authorization token required' },
                'Authorization token required'
            );
        }
        
        // Validate token (simplified)
        const isValid = this.validateToken(token);
        if (!isValid) {
            throw new UnauthorizedHttpResponse(
                { message: 'Invalid or expired token' },
                'Invalid or expired token'
            );
        }
        
        return true;
    }
    
    private validateToken(token: string): boolean {
        // Implement token validation logic
        return true;
    }
}
```

### Attaching Guards
Apply guards at controller or method level:

```typescript
import { Controller, Get, UseGuard } from '@inversifyjs/http-core';

// Apply to all routes in controller
@Controller('/users')
@UseGuard(AuthGuard)
export class UserController {
    @Get('/profile')
    async getProfile() {
        return { id: 1, name: 'John' };
    }
    
    // Apply additional guard to specific route
    @Get('/admin')
    @UseGuard(AdminGuard)
    async getAdminData() {
        return { sensitive: 'data' };
    }
}
```

### Global Guards
Register guards globally using the adapter:

```typescript
const adapter = new InversifyExpressHttpAdapter(container);
adapter.useGlobalGuards(AuthGuard);
const app = await adapter.build();
```

## Key Points
- Controllers don't need `@injectable()` - `@Controller()` adds it automatically
- Return plain objects/values for framework-agnostic code
- Use `@Body()`, `@Params()`, `@Query()` decorators for request data
- Register controllers with `.bind(Controller).toSelf().inSingletonScope()`
- Inversify builds routes at runtime from controller metadata
