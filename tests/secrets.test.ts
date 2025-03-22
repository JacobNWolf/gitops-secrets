import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { encrypt, decrypt, mergeSecrets, loadSecrets } from '../src/secrets';
import { EnvTarget } from '../src/types';

process.env.GITOPS_SECRETS_MASTER_KEY = 'test-master-key-16chars+';

describe('Secrets module', () => {
   const originalEnv = { ...process.env };

   beforeEach(() => {
      process.env.GITOPS_SECRETS_MASTER_KEY = 'test-master-key-16chars+';

      // biome-ignore lint/suspicious/noExplicitAny: Hard to type this correctly
      (global.crypto.getRandomValues as any) = vi.fn((array: Uint8Array) => {
         for (let i = 0; i < array.length; i++) {
            array[i] = i + 1;
         }
         return array;
      });

      // biome-ignore lint/suspicious/noExplicitAny: Hard to type this correctly
      (global.crypto.subtle.importKey as any) = vi.fn().mockResolvedValue({} as CryptoKey);
      // biome-ignore lint/suspicious/noExplicitAny: Hard to type this correctly
      (global.crypto.subtle.deriveKey as any) = vi.fn().mockResolvedValue({} as CryptoKey);
      // biome-ignore lint/suspicious/noExplicitAny: Hard to type this correctly
      (global.crypto.subtle.encrypt as any) = vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4, 5]).buffer);
      // biome-ignore lint/suspicious/noExplicitAny: Hard to type this correctly
      (global.crypto.subtle.decrypt as any) = vi
         .fn()
         .mockResolvedValue(new TextEncoder().encode(JSON.stringify({ TEST_SECRET: 'test-value' })).buffer);

      vi.clearAllMocks();
   });

   afterEach(() => {
      process.env = { ...originalEnv };
      vi.restoreAllMocks();
   });

   describe('encrypt', () => {
      it('should encrypt data with expected format', async () => {
         const result = await encrypt('test-secret');

         expect(result).toMatch(/^base64:\d+:[A-Za-z0-9+/]+=*:[A-Za-z0-9+/]+=*:[A-Za-z0-9+/]+=*$/);

         expect(global.crypto.getRandomValues).toHaveBeenCalledTimes(2);
         expect(global.crypto.subtle.importKey).toHaveBeenCalledTimes(1);
         expect(global.crypto.subtle.deriveKey).toHaveBeenCalledTimes(1);
         expect(global.crypto.subtle.encrypt).toHaveBeenCalledTimes(1);
      });
   });

   describe('decrypt', () => {
      it('should decrypt properly formatted data', async () => {
         const mockDecrypted = 'decrypted-test-data';
         const mockDecryptedBuffer = new TextEncoder().encode(mockDecrypted);

         // biome-ignore lint/suspicious/noExplicitAny: Hard to type this correctly
         (global.crypto.subtle.decrypt as any) = vi.fn().mockResolvedValue(mockDecryptedBuffer.buffer);

         const encrypted = 'base64:1000000:AQIDBAUG:CQoLDA0ODxARElM=:FRUWEQ==';
         const result = await decrypt(encrypted);

         expect(result).toBe(mockDecrypted);
         expect(global.crypto.subtle.decrypt).toHaveBeenCalledTimes(1);
      });

      it('should throw error for invalid data format', async () => {
         const invalidData = 'base64:invalid-format';
         await expect(decrypt(invalidData)).rejects.toThrow('Encrypted payload invalid');
      });
   });

   describe('mergeSecrets', () => {
      it('should merge secrets into process.env', () => {
         const payload = { TEST_SECRET: 'test-value', ANOTHER_SECRET: 'another-value' };

         mergeSecrets(payload, EnvTarget.PROCESS);

         expect(process.env.TEST_SECRET).toBe('test-value');
         expect(process.env.ANOTHER_SECRET).toBe('another-value');
      });
   });

   describe('loadSecrets', () => {
      it('should decrypt and merge secrets', async () => {
         const testPayload = {
            TEST_SECRET: 'test-value',
            ANOTHER_SECRET: 'another-value',
         };
         const mockJson = JSON.stringify(testPayload);
         const mockJsonBuffer = new TextEncoder().encode(mockJson);

         // biome-ignore lint/suspicious/noExplicitAny: Hard to type this correctly
         (global.crypto.subtle.decrypt as any) = vi.fn().mockResolvedValue(mockJsonBuffer.buffer);

         const encryptedData = 'base64:1000000:AQIDBAUG:CQoLDA0ODxARElM=:FRUWEQ==';
         await loadSecrets(encryptedData);

         expect(process.env.TEST_SECRET).toBe('test-value');
         expect(process.env.ANOTHER_SECRET).toBe('another-value');
      });

      it('should handle decryption errors gracefully', async () => {
         const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

         // biome-ignore lint/suspicious/noExplicitAny: Hard to type this correctly
         (global.crypto.subtle.decrypt as any) = vi.fn().mockRejectedValue(new Error('Decryption failed'));

         const encryptedData = 'invalid-data';
         const result = await loadSecrets(encryptedData);

         expect(consoleErrorSpy).toHaveBeenCalledWith(
            expect.stringContaining('Failed to load secrets'),
            expect.any(Error),
         );
         expect(result).toBe(process.env);

         consoleErrorSpy.mockRestore();
      });
   });
});
