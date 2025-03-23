import path from 'node:path';
import { fs as memfs, vol } from 'memfs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as secretsModule from '../src/secrets';
import * as secretsFilesModule from '../src/secrets-files';

vi.mock('../src/secrets', () => ({
   encrypt: vi.fn(),
   decrypt: vi.fn(),
   mergeSecrets: vi.fn(),
}));

vi.mock('node:fs', () => {
   return {
      ...memfs,
      default: memfs,
      __esModule: true,
   };
});

vi.mock('../.secrets/.secrets.enc.js', () => ({
   loadSecrets: vi.fn().mockReturnValue({
      API_KEY: 'test-api-key',
      SECRET_TOKEN: 'test-secret-token',
   }),
}));

describe('secrets-files', () => {
   const SECRETS_FOLDER = path.join(__dirname, '../.secrets');
   const DEFAULT_JS_PATH = path.join(SECRETS_FOLDER, '.secrets.enc.js');
   const DEFAULT_JSON_PATH = path.join(SECRETS_FOLDER, '.secrets.enc.json');

   const testPayload = {
      API_KEY: 'test-api-key',
      SECRET_TOKEN: 'test-secret-token',
   };

   const mockCipherText = 'encrypted-data-mock';

   beforeEach(() => {
      vol.reset();
      vol.mkdirSync(SECRETS_FOLDER, { recursive: true });

      vi.mocked(secretsModule.encrypt).mockResolvedValue(mockCipherText);
      vi.mocked(secretsModule.decrypt).mockResolvedValue(JSON.stringify(testPayload));

      vol.writeFileSync(
         DEFAULT_JS_PATH,
         `
        module.exports = { 
          CIPHER_TEXT: "${mockCipherText}",
          loadSecrets: () => ({ API_KEY: 'test-api-key', SECRET_TOKEN: 'test-secret-token' })
        }
      `,
      );
   });

   afterEach(() => {
      vi.clearAllMocks();
   });

   describe('build', () => {
      it('should create a CJS module with full exports by default', async () => {
         await secretsFilesModule.build(testPayload);

         expect(vol.existsSync(DEFAULT_JS_PATH)).toBe(true);

         const fileContent = vol.readFileSync(DEFAULT_JS_PATH, 'utf-8');
         expect(fileContent).toContain('const secrets = require');
         expect(fileContent).toContain(`const CIPHER_TEXT = "${mockCipherText}"`);
         expect(fileContent).toContain('const loadSecrets = () =>');
         expect(fileContent).toContain('module.exports = { CIPHER_TEXT, loadSecrets }');
      });

      it('should create a CJS module with cipher text only when specified', async () => {
         await secretsFilesModule.build(testPayload, { path: null, cipherTextOnly: true });

         const fileContent = vol.readFileSync(DEFAULT_JS_PATH, 'utf-8');
         expect(fileContent).toContain(`const CIPHER_TEXT = "${mockCipherText}"`);
         expect(fileContent).toContain('module.exports = { CIPHER_TEXT }');
         expect(fileContent).not.toContain('const loadSecrets');
      });

      it('should create a file at custom path when specified', async () => {
         const customPath = path.join(SECRETS_FOLDER, 'custom.js');
         await secretsFilesModule.build(testPayload, { path: customPath, cipherTextOnly: false });

         expect(vol.existsSync(customPath)).toBe(true);
      });

      it('should format as ESM when file extension is .js and package type is module', async () => {
         const originalEnv = process.env.npm_package_type;
         process.env.npm_package_type = 'module';

         const customPath = path.join(SECRETS_FOLDER, 'module.js');
         await secretsFilesModule.build(testPayload, { path: customPath, cipherTextOnly: false });

         const fileContent = vol.readFileSync(customPath, 'utf-8');
         expect(fileContent).toContain('import secrets from');
         expect(fileContent).toContain('export { CIPHER_TEXT, loadSecrets }');

         process.env.npm_package_type = originalEnv;
      });
   });

   describe('encryptToFile', () => {
      it('should encrypt payload and write to default file path', async () => {
         await secretsFilesModule.encryptToFile(testPayload);

         expect(vol.existsSync(DEFAULT_JSON_PATH)).toBe(true);
         expect(vol.readFileSync(DEFAULT_JSON_PATH, 'utf-8')).toBe(mockCipherText);
         expect(secretsModule.encrypt).toHaveBeenCalledWith(JSON.stringify(testPayload));
      });

      it('should write to custom path when specified', async () => {
         const customPath = path.join(SECRETS_FOLDER, 'custom.json');
         await secretsFilesModule.encryptToFile(testPayload, { path: customPath });

         expect(vol.existsSync(customPath)).toBe(true);
         expect(vol.readFileSync(customPath, 'utf-8')).toBe(mockCipherText);
      });
   });

   describe('decryptFromFile', () => {
      it('should read, decrypt and parse file contents from default path', async () => {
         vol.writeFileSync(DEFAULT_JSON_PATH, mockCipherText);

         const result = await secretsFilesModule.decryptFromFile(DEFAULT_JSON_PATH);

         expect(result).toEqual({
            ...testPayload,
            mergeSecrets: expect.any(Function),
         });
         expect(secretsModule.decrypt).toHaveBeenCalledWith(mockCipherText);
      });

      it('should throw error when file cannot be read or decrypted', async () => {
         await expect(secretsFilesModule.decryptFromFile('non-existent-path')).rejects.toThrow();
      });

      it('should call mergeSecrets when mergeSecrets() is called', async () => {
         vol.writeFileSync(DEFAULT_JSON_PATH, mockCipherText);

         const result = await secretsFilesModule.decryptFromFile(DEFAULT_JSON_PATH);
         result.mergeSecrets();

         expect(secretsModule.mergeSecrets).toHaveBeenCalledWith(testPayload, expect.anything());
      });
   });

   describe('loadSecrets', () => {
      it('should call loadSecrets from imported module', () => {
         const loadSecretsSpy = vi.spyOn(secretsFilesModule, 'loadSecrets').mockImplementation(() => testPayload);

         const result = secretsFilesModule.loadSecrets();
         expect(result).toEqual(testPayload);
         expect(loadSecretsSpy).toHaveBeenCalled();

         loadSecretsSpy.mockRestore();
      });
   });
});
