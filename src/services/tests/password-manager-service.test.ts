import { TestBed } from '@suites/unit';
import { PasswordUtilityServiceImpl } from '../password-utility-service';

describe('PasswordManagerService', () => {
    let service: PasswordUtilityServiceImpl;

    beforeAll(async () => {
        const { unit } = await TestBed.solitary(
            PasswordUtilityServiceImpl
        ).compile();
        service = unit;
    });

    describe('toHash', () => {
        it('should hash a password', async () => {
            const password = 'Test123456';
            const hashed = await service.toHash(password);

            expect(hashed).toBeDefined();
            expect(typeof hashed).toBe('string');
            expect(hashed.split('.')).toHaveLength(2);
        });

        it('should generate different hashes for the same password', async () => {
            const password = 'Test123456';
            const hash1 = await service.toHash(password);
            const hash2 = await service.toHash(password);

            expect(hash1).not.toBe(hash2);
        });

        it('should generate salt of 32 bytes (64 hex chars)', async () => {
            const password = 'Test123456';
            const hashed = await service.toHash(password);
            const [salt] = hashed.split('.');

            expect(salt.length).toBe(64); // 32 bytes = 64 hex characters
        });
    });

    describe('compare', () => {
        it('should return true for matching password', async () => {
            const password = 'Test123456';
            const hashed = await service.toHash(password);
            const result = await service.compare(hashed, password);

            expect(result).toBe(true);
        });

        it('should return false for non-matching password', async () => {
            const password = 'Test123456';
            const wrongPassword = 'Wrong123456';
            const hashed = await service.toHash(password);
            const result = await service.compare(hashed, wrongPassword);

            expect(result).toBe(false);
        });

        it('should return false for empty password', async () => {
            const password = 'Test123456';
            const hashed = await service.toHash(password);
            const result = await service.compare(hashed, '');

            expect(result).toBe(false);
        });

        it('should handle different passwords correctly', async () => {
            const password1 = 'Test123456';
            const password2 = 'Different123';
            const hashed1 = await service.toHash(password1);
            const hashed2 = await service.toHash(password2);

            expect(await service.compare(hashed1, password1)).toBe(true);
            expect(await service.compare(hashed2, password2)).toBe(true);
            expect(await service.compare(hashed1, password2)).toBe(false);
            expect(await service.compare(hashed2, password1)).toBe(false);
        });
    });
});
