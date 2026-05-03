import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EncryptionService } from './encryption.service';

describe('EncryptionService', () => {
  let service: EncryptionService;

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: string) => {
      const config: Record<string, string> = {
        'app.encryptionKey': 'test-encryption-key-32-chars-ok!',
        'auth.jwtSecret': 'fallback-secret',
      };
      return config[key] ?? defaultValue ?? '';
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EncryptionService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<EncryptionService>(EncryptionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('encrypt / decrypt', () => {
    it('should encrypt and decrypt a string', () => {
      const plaintext = 'Hello, World!';
      const encrypted = service.encrypt(plaintext);

      expect(encrypted).not.toBe(plaintext);
      expect(encrypted.split(':')).toHaveLength(3);

      const decrypted = service.decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('should produce different ciphertexts for same input', () => {
      const plaintext = 'Same text';
      const encrypted1 = service.encrypt(plaintext);
      const encrypted2 = service.encrypt(plaintext);

      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should return as-is for invalid ciphertext format', () => {
      const result = service.decrypt('not-valid');
      expect(result).toBe('not-valid');
    });
  });

  describe('encryptJson / decryptJson', () => {
    it('should encrypt and decrypt JSON objects', () => {
      const data = { apiToken: 'secret-token', apiSecret: '12345' };
      const encrypted = service.encryptJson(data);

      expect(typeof encrypted).toBe('string');

      const decrypted = service.decryptJson(encrypted);
      expect(decrypted).toEqual(data);
    });

    it('should handle nested objects', () => {
      const data = {
        credentials: { token: 'abc', nested: { key: 'value' } },
        enabled: true,
      };
      const encrypted = service.encryptJson(data);
      const decrypted = service.decryptJson(encrypted);
      expect(decrypted).toEqual(data);
    });
  });

  describe('isEncrypted', () => {
    it('should detect encrypted values', () => {
      const encrypted = service.encrypt('test');
      expect(service.isEncrypted(encrypted)).toBe(true);
    });

    it('should not detect plain text as encrypted', () => {
      expect(service.isEncrypted('plain text')).toBe(false);
      expect(service.isEncrypted('not:encrypted')).toBe(false);
    });
  });
});
