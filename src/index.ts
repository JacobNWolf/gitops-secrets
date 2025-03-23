import * as doppler from './providers/doppler';
import * as secrets from './secrets';
import * as secretsFiles from './secrets-files';

export const providers = { doppler };

export default {
   ...secrets,
   ...secretsFiles,
   providers,
};
