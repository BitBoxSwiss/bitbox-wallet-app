/**
 * Copyright 2022 Shift Crypto AG
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Button } from '../../components/forms';
import { isPocketSupported, isMoonpayBuySupported } from '../../api/exchanges';
import { route } from '../../utils/route';
import { useLoad } from '../../hooks/api';

interface TProps {
    code: string;
}

// TODO:
// - add layout
export const Exchange = ({ code }: TProps) => {
  const showPocket = useLoad(isPocketSupported(code));
  const showMoonpay = useLoad(isMoonpayBuySupported(code));

  const goToExchange = (exchange: string) => {
    route(`/buy/${exchange}/${code}`);
  };

  return (
    <div>
      {/* TODO: define text and add use locales*/}
      <div>Choose you exchange!</div>
      <div>
        { showMoonpay && (<Button
          primary
          onClick={() => goToExchange('moonpay')} >
          Moonpay
        </Button>) }
      </div>
      <div>
        { showPocket && (<Button
          primary
          onClick={() => goToExchange('pocket')} >
          Pocket
        </Button>) }
      </div>

    </div>
  );
};
