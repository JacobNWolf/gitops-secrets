/**
 * Fetch secrets from the Doppler API.
 * @param {{dopplerToken: string}} [{dopplerToken: process.env.DOPPLER_TOKEN}] Requires a Doppler Token for API authentication. See https://docs.doppler.com/docs/enclave-service-tokens
 * @param {{dopplerProject: string | null}} [{dopplerProject: null}] Optional Doppler Project. Required when using any token type other than Service Tokens.
 * @param {{dopplerConfig: string | null}} [{dopplerConfig: null}] Optional Doppler Config. Required when using any token type other than Service Tokens.
 * @returns {() => Promise<Record<string, string>>}
 */
async function fetchSecrets({
   dopplerToken = process.env.DOPPLER_TOKEN || import.meta.env.DOPPLER_TOKEN,
   dopplerProject = null,
   dopplerConfig = null,
}: { dopplerToken?: string; dopplerProject?: string | null; dopplerConfig?: string | null }) {
   if (!dopplerToken) {
      throw new Error("Doppler API Error: The 'DOPPLER_TOKEN' environment variable is required");
   }

   return new Promise((resolve, reject) => {
      const url = new URL('https://api.doppler.com/v3/configs/config/secrets/download');

      url.searchParams.set('format', 'json');

      if (dopplerProject) {
         url.searchParams.set('project', dopplerProject);
      }

      if (dopplerConfig) {
         url.searchParams.set('config', dopplerConfig);
      }

      const headers = new Headers();
      headers.set('Authorization', `Bearer ${dopplerToken}`);
      headers.set('user-agent', '@jacobwolf/gitoops-secrets');

      fetch(url.toString(), { headers })
         .then((response) => {
            if (response.ok) {
               return response.json();
            }

            return response
               .json()
               .then((data) => {
                  const errorMessage = data.messages
                     ? data.messages.join(' ')
                     : `${response.status} ${response.statusText}`;
                  throw new Error(`Doppler API Error: ${errorMessage}`);
               })
               .catch(() => {
                  throw new Error(`Doppler API Error: ${response.status} ${response.statusText}`);
               });
         })
         .then((data) => resolve(data))
         .catch((error) => reject(new Error(`Doppler API Error: ${error.message || error}`)));
   });
}

export { fetchSecrets };
