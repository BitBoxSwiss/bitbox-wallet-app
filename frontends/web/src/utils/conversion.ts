export const toSat = (msat: number): number => Math.floor(msat / 1000);

export const toMsat = (sat: number): number => sat * 1000;