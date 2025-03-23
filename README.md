# GitOps Secrets

Easily and securely inject environment variable secrets—no matter the size—into any JavaScript runtime. Bypass the 4KB environment variable limit in AWS Lambda, Vercel, and Netlify, and run on the edge in environments like Deno, Bun, and others where NodeJS built-in modules aren't available.

## Table of Contents
- [Installation](#installation)
- [Usage Options](#usage-options)
  - [File System Access Available](#file-system-access-available)
  - [No File System Access (Edge Functions)](#no-file-system-access-edge-functions)
- [Secret Storage Formats](#secret-storage-formats)
  - [JSON Format](#json-format)
  - [JS Module Format](#js-module-format)
- [Providers](#providers)
- [Background](#background)

## Installation

```bash
# npm
npm install @jacobwolf/gitops-secrets

# yarn
yarn add @jacobwolf/gitops-secrets

# pnpm
pnpm add @jacobwolf/gitops-secrets

# bun
bun add @jacobwolf/gitops-secrets
```

## Usage Options

### File System Access Available

#### 1. Build the encryption file at bundle time

Create a script (e.g., `scripts/build-secrets.ts`) to generate your encrypted secrets:

```typescript
import * as gitopsSecrets from '@jacobwolf/gitops-secrets';

// Fetch secrets from provider (e.g., Doppler)
const secretsData = await gitopsSecrets.providers.doppler.fetchSecrets({
    dopplerToken: process.env.DOPPLER_TOKEN
});

// Encrypt and store secrets
await gitopsSecrets.build(secretsData, {
    // Optional: Custom path (defaults to .secrets/.secrets.enc.js)
    path: './config/secrets.enc.js',
    // Optional: Only export cipher text without loading logic
    cipherTextOnly: false
});
```

Run this script during your build process by adding it to your `package.json`:

```json
{
  "scripts": {
    "prebuild": "ts-node scripts/build-secrets.ts",
    "build": "your-build-command"
  }
}
```

This ensures your secrets are encrypted and available before your application builds. Make sure you have `ts-node` installed:

```bash
npm install --save-dev ts-node
# or
yarn add -D ts-node
# or
pnpm add -D ts-node
# or
bun add -D ts-node
```

#### 2. Load secrets at runtime

```typescript
import * as gitopsSecrets from '@jacobwolf/gitops-secrets';

// Method 1: Default path (.secrets/.secrets.enc.js)
await gitopsSecrets.loadSecrets();

// Method 2: Custom module path
const secretsModule = require('./config/secrets.enc.js');
await secretsModule.loadSecrets();

// Method 3: From JSON file
const decryptedSecrets = await gitopsSecrets.decryptFromFile('./path/to/secrets.enc.json');
decryptedSecrets.mergeSecrets();

// Now process.env has all your secrets
console.log(process.env.API_KEY); // "your-secret-api-key"
```

### No File System Access (Edge Functions)

For environments without file system access (Vercel Edge, Cloudflare Workers, browsers):

#### 1. Import the no-fs version

```typescript
// Import the edge-compatible version
import * as gitopsSecrets from '@jacobwolf/gitops-secrets/no-fs';
// Or import specific functions
import { providers, encrypt, decrypt } from '@jacobwolf/gitops-secrets/no-fs';
```

#### 2. Handle encryption/decryption directly

```typescript
// Encrypt secrets to string
// Uses GITOPS_SECRETS_MASTER_KEY environment variable
const encryptedSecrets = await gitopsSecrets.encrypt(JSON.stringify(secretsData));

// Later, decrypt and use
const decryptedJson = await gitopsSecrets.decrypt(encryptedSecrets);
const secrets = JSON.parse(decryptedJson);

// Or load directly into environment
await gitopsSecrets.loadSecrets(encryptedSecrets);
```

#### 3. Recommended pattern for edge functions

```typescript
// During build time (build script)
import { providers, encrypt } from '@jacobwolf/gitops-secrets';

const secretsData = await providers.doppler.fetchSecrets({
    dopplerToken: process.env.DOPPLER_TOKEN
});
const encryptedText = await encrypt(JSON.stringify(secretsData));

// Add to your edge code as a constant
console.log(`const ENCRYPTED_SECRETS = "${encryptedText}";`);

// In your edge function:
import { decrypt } from '@jacobwolf/gitops-secrets/no-fs';

export default async function handler(request) {
    const decryptedJson = await decrypt(ENCRYPTED_SECRETS);
    const secrets = JSON.parse(decryptedJson);
    
    // Use your secrets
    const apiKey = secrets.API_KEY;
    // ...your edge function logic
}
```

## Secret Storage Formats

There are two file formats for bundling encrypted secrets:

### JSON Format

Stores encrypted data in a JSON file.

```typescript
import * as gitopsSecrets from '@jacobwolf/gitops-secrets';

// Encrypt to JSON file
async function encryptToJSON() {
    const payload = await gitopsSecrets.providers.doppler.fetchSecrets({
        dopplerToken: process.env.DOPPLER_TOKEN
    });

    // Default path (.secrets/.secrets.enc.json)
    await gitopsSecrets.encryptToFile(payload);
    
    // Or custom path
    await gitopsSecrets.encryptToFile(payload, { 
        path: "./custom/path/secrets.enc.json" 
    });
}

// Decrypt from JSON file
async function decryptFromJSON() {
    // Default path
    const secrets = await gitopsSecrets.decryptFromFile();
    
    // Or custom path
    const customSecrets = await gitopsSecrets.decryptFromFile('./custom/path/secrets.enc.json');
    
    // Merge into environment
    secrets.mergeSecrets();
}
```

### JS Module Format

Ideal for restricted environments like Vercel where file access is problematic.

```typescript
import * as gitopsSecrets from '@jacobwolf/gitops-secrets';

// Encrypt to JS module
async function buildJSModule() {
    const payload = await gitopsSecrets.providers.doppler.fetchSecrets({
        dopplerToken: process.env.DOPPLER_TOKEN
    });

    // Default path (.secrets/.secrets.enc.js)
    await gitopsSecrets.build(payload);
    
    // Custom path
    await gitopsSecrets.build(payload, { 
        path: "lib/secrets.js" 
    });
    
    // Only export cipher text
    await gitopsSecrets.build(payload, { 
        path: "lib/secrets.js", 
        cipherTextOnly: true 
    });
}

// Load from default path
async function loadFromDefaultPath() {
    import { loadSecrets } from '@jacobwolf/gitops-secrets';
    await loadSecrets();
}

// Load from custom module
async function loadFromCustomModule() {
    // CommonJS
    const { loadSecrets } = require("./lib/secrets");
    await loadSecrets();
    
    // ES modules
    import { loadSecrets } from "./lib/secrets";
    await loadSecrets();
}
```

## Providers

Currently supported remote secrets providers:
- [Doppler](https://www.doppler.com/)

More providers will be added in future releases.

## Background

Serverless platforms like Vercel, Netlify, and AWS Lambda limit environment variables to 4KB, which complex applications can quickly exceed.

This package was inspired by [Doppler's GitOps Secrets package](https://github.com/DopplerHQ/gitops-secrets-nodejs/), but it uses the Web Crypto API instead of `node:crypto` for broader compatibility with modern web environments like edge functions.