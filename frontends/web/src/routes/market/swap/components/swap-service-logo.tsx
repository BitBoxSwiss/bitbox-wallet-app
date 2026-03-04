// SPDX-License-Identifier: Apache-2.0

import nearLogoSVG from './assets/near-logo.svg';

const SWAP_LOGO_MAP: Readonly<Record<string, string>> = {
  near: nearLogoSVG,
};

type TProps = {
  name: string;
};

export const SwapServiceLogo = ({
  name,
}: TProps) => {
  switch (name) {
  case 'near':
    return (
      <img src={SWAP_LOGO_MAP[name]} style={{ width: 19, height: 19 }} />
    );
  default:
    return null;
  }
};
