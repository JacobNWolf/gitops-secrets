import * as doppler from './providers/doppler';
import * as secrets from './secrets';

export * from './secrets';
export const providers = { doppler };

const noFs = {
   ...secrets,
   providers: {
      doppler,
   },
};

export default noFs;
