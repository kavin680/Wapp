import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32;
  private readonly ivLength = 16;
  private readonly tagLength = 16;
  private readonly encryptionKey: Buffer;

  constructor(private readonly configService: ConfigService) {
    const secret = this.configService.get<string>('app.encryptionKey', '');

    if (secret && secret.length >= this.keyLength) {
      this.encryptionKey = Buffer.from(secret.slice(0, this.keyLength));
    } else {
      this.encryptionKey = crypto
        .createHash('sha256')
        .update(
          secret ||
            this.configService.get<string>('auth.jwtSecret', 'default-key'),
        )
        .digest();
    }
  }

  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipheriv(
      this.algorithm,
      this.encryptionKey,
      iv,
    );

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
  }

  decrypt(ciphertext: string): string {
    const parts = ciphertext.split(':');
    if (parts.length !== 3) {
      this.logger.warn('Invalid ciphertext format, returning as-is');
      return ciphertext;
    }

    const iv = Buffer.from(parts[0], 'hex');
    const tag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];

    const decipher = crypto.createDecipheriv(
      this.algorithm,
      this.encryptionKey,
      iv,
    );
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  encryptJson(data: Record<string, unknown>): string {
    return this.encrypt(JSON.stringify(data));
  }

  decryptJson(ciphertext: string): Record<string, unknown> {
    const plaintext = this.decrypt(ciphertext);
    return JSON.parse(plaintext) as Record<string, unknown>;
  }

  isEncrypted(value: string): boolean {
    const parts = value.split(':');
    return parts.length === 3 && parts[0].length === this.ivLength * 2;
  }
}
