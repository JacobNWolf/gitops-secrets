import * as doppler from './providers/doppler';
import * as secrets from './secrets';

const noFs = {
   ...secrets,
   providers: {
      doppler,
   },
};

export default noFs;

export * from './secrets';
export const providers = { doppler };
