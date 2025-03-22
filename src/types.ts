export enum EnvTarget {
   PROCESS = 'process',
   IMPORT_META = 'import.meta',
}

type EnvObject = {
   [key: string]: string | boolean | number | undefined | null | object;
};

type Provider = 'doppler';

export type { EnvObject, Provider };
