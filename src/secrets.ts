import { type EnvObject, EnvTarget } from './types';
import { base64ToUint8Array, uint8ArrayToBase64 } from './utils';

const PBKDF2_ROUNDS = process.env.GITOPS_SECRETS_PBKDF2_ROUNDS || 1000000;
const PBKDF2_KEYLEN = 32;
const PBKDF2_DIGEST = 'SHA-256';
const ALGORITHM = 'AES-GCM';
const AES_IV_BYTES = 12;
const AES_SALT_BYTES = 8;
const ENCODING = 'base64';
const TEXT_ENCODING = 'utf8';

function masterKey() {
   if (!process.env.GITOPS_SECRETS_MASTER_KEY || process.env.GITOPS_SECRETS_MASTER_KEY.length < 16) {
      throw new Error(
         `The 'GITOPS_SECRETS_MASTER_KEY' environment variable must be set to a string of 16 characters or more`,
      );
   }

   return process.env.GITOPS_SECRETS_MASTER_KEY;
}

/**
 * Derive encryption key using the Web Crypto API's PBKDF2
 *
 * @param {string} masterKeyString - The master key string
 * @param {Uint8Array} salt - The salt for key derivation
 * @param {number} iterations - The number of iterations for key derivation
 * @returns {Promise<CryptoKey>} - The derived key
 */
async function deriveKey(
   masterKeyString: string,
   salt: Uint8Array,
   iterations: number = Number(PBKDF2_ROUNDS),
): Promise<CryptoKey> {
   const masterKeyBuffer = new TextEncoder().encode(masterKeyString);
   const importedKey = await crypto.subtle.importKey('raw', masterKeyBuffer, { name: 'PBKDF2' }, false, ['deriveKey']);

   return crypto.subtle.deriveKey(
      {
         name: 'PBKDF2',
         salt: salt,
         iterations: iterations,
         hash: PBKDF2_DIGEST,
      },
      importedKey,
      { name: ALGORITHM, length: PBKDF2_KEYLEN * 8 },
      false,
      ['encrypt', 'decrypt'],
   );
}

/**
 * Encrypt secrets to a secure format
 *
 * @param {string} secrets - The data to encrypt
 * @returns {Promise<string>} - Encrypted data in format "base64:rounds:salt:iv:encryptedData"
 */
async function encrypt(secrets: string): Promise<string> {
   const salt = crypto.getRandomValues(new Uint8Array(AES_SALT_BYTES));
   const iv = crypto.getRandomValues(new Uint8Array(AES_IV_BYTES));
   const key = await deriveKey(masterKey(), salt);

   const dataBuffer = new TextEncoder().encode(secrets);
   const encryptedBuffer = await crypto.subtle.encrypt(
      {
         name: ALGORITHM,
         iv: iv,
      },
      key,
      dataBuffer,
   );

   const saltBase64 = uint8ArrayToBase64(salt);
   const ivBase64 = uint8ArrayToBase64(iv);
   const encryptedBase64 = uint8ArrayToBase64(new Uint8Array(encryptedBuffer));

   return `${ENCODING}:${PBKDF2_ROUNDS}:${saltBase64}:${ivBase64}:${encryptedBase64}`;
}

/**
 * Decrypt secrets from secure format
 *
 * @param {string} ciphertext - Data in format "base64:rounds:salt:iv:encryptedData"
 * @returns {Promise<string>} - Decrypted data
 */
async function decrypt(ciphertext: string): Promise<string> {
   const encodedData = ciphertext.startsWith(`${ENCODING}:`) ? ciphertext.substring(`${ENCODING}:`.length) : ciphertext;

   const parts = encodedData.split(':');
   if (parts.length !== 4) {
      throw new Error(`Encrypted payload invalid. Expected 4 sections but got ${parts.length}`);
   }

   const rounds = Number.parseInt(parts[0], 10);
   const salt = base64ToUint8Array(parts[1]);
   const iv = base64ToUint8Array(parts[2]);
   const encryptedContent = base64ToUint8Array(parts[3]);

   try {
      const key = await deriveKey(masterKey(), salt, rounds);

      const decryptedBuffer = await crypto.subtle.decrypt(
         {
            name: ALGORITHM,
            iv: iv,
         },
         key,
         encryptedContent,
      );

      const decrypted = new TextDecoder(TEXT_ENCODING).decode(decryptedBuffer);
      return decrypted;
   } catch (error) {
      throw new Error(`Decryption failed: ${error instanceof Error ? error.message : String(error)}`);
   }
}

/**
 * Get the appropriate environment object based on the target
 *
 * @param {EnvTarget} target - The environment target
 * @returns {EnvObject} - The environment object
 */
function getEnvObject(target: EnvTarget): EnvObject {
   if (typeof import.meta === 'undefined') {
      if (typeof process !== 'undefined' && process.env) {
         return process.env;
      }
      throw new Error('process.env is not available in this environment');
   }

   switch (target) {
      case EnvTarget.PROCESS:
         if (typeof process !== 'undefined' && process.env) {
            return process.env;
         }
         throw new Error('process.env is not available in this environment');
      case EnvTarget.IMPORT_META:
         if (typeof import.meta !== 'undefined' && import.meta.env) {
            return import.meta.env;
         }
         throw new Error('import.meta.env is not available in this environment');
      default:
         throw new Error(`Unsupported environment target: ${target}`);
   }
}

/**
 * Merge secrets payload into the specified environment
 *
 * @param {Record<string, string>} payload - The payload object containing secrets
 * @param {EnvTarget} target - The environment target to merge secrets into
 * @returns {EnvObject} - The environment object with merged secrets
 */
function mergeSecrets(payload: Record<string, string>, target: EnvTarget): EnvObject {
   const envObject = getEnvObject(target);

   if (typeof import.meta === 'undefined') {
      if (typeof process !== 'undefined' && process.env) {
         for (const [key, value] of Object.entries(payload)) {
            process.env[key] = value;
         }
      }
      return envObject;
   }

   for (const [key, value] of Object.entries(payload)) {
      if (target === EnvTarget.PROCESS && typeof process !== 'undefined') {
         process.env[key] = value;
      } else if (target === EnvTarget.IMPORT_META && typeof import.meta !== 'undefined') {
         import.meta.env[key] = value;
      }
   }

   return envObject;
}

/**
 * Load encrypted secrets, decrypt them, and merge into the specified environment
 *
 * @param {string} encryptedSecrets - The encrypted secrets string
 * @param {EnvTarget} target - The environment target to merge with
 * @returns {Promise<EnvObject>} - The environment with merged secrets
 */
async function loadSecrets(encryptedSecrets: string, target: EnvTarget = EnvTarget.PROCESS): Promise<EnvObject> {
   try {
      const decryptedJson = await decrypt(encryptedSecrets);
      const secretsPayload = JSON.parse(decryptedJson) as Record<string, string>;

      return mergeSecrets(secretsPayload, target);
   } catch (error) {
      console.error('Failed to load secrets:', error);
      return getEnvObject(target);
   }
}

export { encrypt, decrypt, mergeSecrets, loadSecrets };
