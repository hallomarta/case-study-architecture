# E2E Test Suite

## Test Results Summary

**Status:** 15/24 tests passing (62.5%)

### ✅ Passing Tests (15)
1. Register new user with valid data
2. Fail on duplicate email registration
3. Login with valid credentials
4. Fail login with invalid email
5. Fail login with invalid password
6. Get profile with valid token
7. Fail profile access without token
8. Fail profile access with invalid token
9. Fail profile access with malformed header
10. Update profile with valid data
11. Update only firstName
12. Update only lastName
13. Fail profile update without token
14. Fail profile update with invalid token
15. Complete full user lifecycle

### ❌ Failing Tests (9)

#### Validation Issues
1. **Email validation** - "invalid-email" is accepted (should fail)
2. **Password validation (no uppercase)** - "test123456" is accepted (should fail)
3. **Password validation (no lowercase)** - "TEST123456" is accepted (should fail)
4. **Password validation (no number)** - "TestPassword" is accepted (should fail)
5. **Password too short** - "Test123" is accepted (should fail)
6. **Missing required fields** - Returns 500 instead of 422
7. **Missing login password** - Returns 500 instead of 422
8. **Empty firstName update** - Returns 200 instead of 422
9. **Empty lastName update** - Returns 200 instead of 422

## Investigation Needed

The validation schemas are defined correctly in the controller, but they're not rejecting invalid data. Possible causes:

1. **Zod validation not executing**: The `@ValidateStandardSchemaV1` decorator may not be properly configured
2. **Validation pipe configuration**: Check global validation setup in `inversify.config.ts`
3. **Strict mode**: The `.strict()` modifier might not be working as expected
4. **Error handling**: 500 errors suggest exceptions aren't being caught properly

## Test Database

Tests use the real PostgreSQL database defined in `.env`. The database is cleaned before each test using:
- `prisma.userIdentity.deleteMany()`
- `prisma.user.deleteMany()`

## Running Tests

```bash
# Run all E2E tests
yarn test

# Run in watch mode
yarn test:watch
```

## Test Structure

```
tests/
├── setup.ts                    # Test configuration
├── helpers/
│   ├── test-server.ts         # Express app instance
│   └── database.ts            # Database helpers
└── e2e/
    └── user-auth.test.ts      # User authentication E2E tests
```

## Next Steps

1. Investigate why Zod validation is not rejecting invalid data
2. Fix validation error handling to return 422 instead of 500
3. Ensure all validation rules are properly enforced
4. Add additional test cases for edge cases
