/**
 * Convert a base64 string to a Uint8Array
 *
 * @param {string} base64
 * @returns {Uint8Array}
 */
function base64ToUint8Array(base64: string): Uint8Array {
   const binaryString = atob(base64);
   const bytes = new Uint8Array(binaryString.length);

   for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
   }

   return bytes;
}

/**
 * Convert a Uint8Array to a base64 string
 *
 * @param {Uint8Array} buffer - The binary data to convert
 * @returns {string} - Base64 encoded string
 */
function uint8ArrayToBase64(buffer: Uint8Array): string {
   return btoa(
      Array.from(buffer)
         .map((byte) => String.fromCharCode(byte))
         .join(''),
   );
}

export { uint8ArrayToBase64, base64ToUint8Array };
