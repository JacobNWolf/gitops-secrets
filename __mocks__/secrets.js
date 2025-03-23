module.exports = {
   encrypt: vi.fn().mockResolvedValue('encrypted-content'),
   decrypt: vi.fn().mockResolvedValue('{"key":"decrypted-value"}'),
   mergeSecrets: vi.fn(),
};
