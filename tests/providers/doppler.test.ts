import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { fetchSecrets } from '../../src/providers/doppler';

const server = setupServer(
   http.get('https://api.doppler.com/v3/configs/config/secrets/download', () => {
      return HttpResponse.json({ MY_SECRET: 'test-value' });
   }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

afterEach(() => server.resetHandlers());

afterAll(() => server.close());

describe('Doppler Provider', () => {
   it('should fetch secrets successfully', async () => {
      const secrets = await fetchSecrets({
         dopplerToken: 'test-token',
      });

      expect(secrets).toEqual({ MY_SECRET: 'test-value' });
   });

   it('should include project and config when provided', async () => {
      let projectParam: string | null = null;
      let configParam: string | null = null;
      let formatParam: string | null = null;

      server.use(
         http.get('https://api.doppler.com/v3/configs/config/secrets/download', ({ request }) => {
            const url = new URL(request.url);
            projectParam = url.searchParams.get('project');
            configParam = url.searchParams.get('config');
            formatParam = url.searchParams.get('format');
            return HttpResponse.json({ PROJECT_SECRET: 'project-value' });
         }),
      );

      await fetchSecrets({
         dopplerToken: 'test-token',
         dopplerProject: 'test-project',
         dopplerConfig: 'test-config',
      });

      expect(projectParam).toBe('test-project');
      expect(configParam).toBe('test-config');
      expect(formatParam).toBe('json');
   });

   it('should throw error when no token is provided', async () => {
      await expect(
         fetchSecrets({
            dopplerToken: undefined,
         }),
      ).rejects.toThrow("Doppler API Error: The 'DOPPLER_TOKEN' environment variable is required");
   });

   it('should handle API errors correctly', async () => {
      server.use(
         http.get('https://api.doppler.com/v3/configs/config/secrets/download', () => {
            return new HttpResponse(
               JSON.stringify({
                  messages: ['Invalid authentication credentials'],
               }),
               {
                  status: 401,
                  headers: { 'Content-Type': 'application/json' },
               },
            );
         }),
      );

      await expect(
         fetchSecrets({
            dopplerToken: 'invalid-token',
         }),
      ).rejects.toThrow('Doppler API Error: Doppler API Error: 401 Unauthorized');
   });

   it('should handle API errors without messages', async () => {
      server.use(
         http.get('https://api.doppler.com/v3/configs/config/secrets/download', () => {
            return new HttpResponse(JSON.stringify({}), {
               status: 500,
               headers: { 'Content-Type': 'application/json' },
            });
         }),
      );

      await expect(
         fetchSecrets({
            dopplerToken: 'test-token',
         }),
      ).rejects.toThrow('Doppler API Error: Doppler API Error: 500 Internal Server Error');
   });

   it('should send correct authorization header', async () => {
      let authHeader: string | null = null;

      server.use(
         http.get('https://api.doppler.com/v3/configs/config/secrets/download', ({ request }) => {
            authHeader = request.headers.get('authorization');
            return HttpResponse.json({ AUTH_TEST: 'success' });
         }),
      );

      await fetchSecrets({
         dopplerToken: 'test-token-123',
      });

      expect(authHeader).toBe('Bearer test-token-123');
   });
});
