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

import A from '../../../components/anchor/anchor';
import { Info } from '../types';
import style from './infocontent.module.css';

type TInfoContentProps = { info: Info };

export const MoonPayInfo = () => {
  return (
    <div className={style.container}>
      <p>Supports all major fiat currencies: USD, EUR, CHF and more.</p>
      <br />
      <p><A href="https://support.moonpay.com/hc/en-gb/articles/360011931457-Which-fiat-currencies-are-supported-">See full list of currencies here</A></p>
      <br />
      <p><b>Payments methods</b></p>
      <br />
      <p>Credit/debit Card</p>
      <ul>
        <li>Amex, Mastercard, Visa and Maestro</li>
        <li>Apple Pay/Android Pay</li>
        <li>Bank transfer*
          <ul>
            <li>SEPA and SEPA Instant (EUR transactions in SEPA countries only)</li>
            <li>UK Faster Payments (GBP transactions in the UK only)</li>
            <li>PIX (BR transactions in Brazil only)</li>
          </ul>
        </li>
      </ul>
      <br />
      <p><i>* Not available for US residents</i></p>
      <br />
      <p><A href="https://support.moonpay.com/hc/en-gb/articles/4406210084113-What-payment-methods-do-you-support-">See more details about payment methods</A></p>
      <br />
      <p><b>Fees</b></p>
      <ul>
        <li>Credit/debit card: 4.9%</li>
        <li>Bank transfer: 1.9%</li>
      </ul>
      <br />
      <p><A href="https://www.moonpay.com/">Learn more about MoonPay</A></p>
    </div>
  );
};

export const PocketInfo = () => {
  return (
    <div className={style.container}>
      <p>Supports CHF and SEPA (EUR) transfers.</p>
      <p>Fee: 1.5%</p>
      <br/>
      <p><A href="https://pocketbitcoin.com/">Learn more about Pocket</A></p>
    </div>
  );
};

const RegionInfo = () => {
  return (
    <div>
      <p>Region Info</p>
    </div>
  );
};


export const InfoContent = ({ info }: TInfoContentProps) => {
  switch (info) {
  case 'moonpay':
    return <MoonPayInfo />;
  case 'pocket':
    return <PocketInfo />;
  case 'region':
    return <RegionInfo />;
  }
  return <></>;
};