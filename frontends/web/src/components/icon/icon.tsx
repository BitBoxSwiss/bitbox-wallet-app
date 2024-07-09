/**
 * Copyright 2018 Shift Devices AG
 * Copyright 2021 Shift Crypto AG
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

import alert from './assets/icons/alert-triangle.svg';
import BB02StylizedDark from '@/assets/device/bitbox02-stylized-reflection-dark.png';
import BB02StylizedLight from '@/assets/device/bitbox02-stylized-reflection-light.png';
import info from './assets/icons/info.svg';
import arrowDownSVG from './assets/icons/arrow-down-active.svg';
import arrowDownRedSVG from './assets/icons/arrow-down-red.svg';
import arrowUpGreenSVG from './assets/icons/arrow-up-green.svg';
import arrowCircleLeftSVG from './assets/icons/arrow-circle-left.svg';
import arrowCircleLeftActiveSVG from './assets/icons/arrow-circle-left-active.svg';
import arrowCircleRightSVG from './assets/icons/arrow-circle-right.svg';
import arrowCircleRightActiveSVG from './assets/icons/arrow-circle-right-active.svg';
import bankDarkSVG from './assets/icons/bank.svg';
import bankLightSVG from './assets/icons/bank-light.svg';
import buyInfoSVG from './assets/icons/buy-info.svg';
import checkedSmallSVG from './assets/icons/checked-small.svg';
import checkSVG from './assets/icons/check.svg';
import chevronRightDark from './assets/icons/chevron-right-dark.svg';
import chevronLeftDark from './assets/icons/chevron-left-dark.svg';
import cancelSVG from './assets/icons/cancel.svg';
import creditCardDarkSVG from './assets/icons/credit-card.svg';
import creditCardLightSVG from './assets/icons/credit-card-light.svg';
import editSVG from './assets/icons/edit.svg';
import editLightSVG from './assets/icons/edit-light.svg';
import editActiveSVG from './assets/icons/edit-active.svg';
import ethColorSVG from './assets//eth-color.svg';
import redDotSVG from './assets/icons/red-dot.svg';
import greenDotSVG from './assets/icons/green-dot.svg';
import yellowDotSVG from './assets/icons/yellow-dot.svg';
import orangeDotSVG from './assets/icons/orange-dot.svg';
import copySVG from './assets/icons/copy.svg';
import shieldSVG from './assets/icons/shield.svg';
import closeSVG from './assets/icons/close.svg';
import closeXWhiteSVG from './assets/icons/close-x-white.svg';
import closeXDarkSVG from './assets/icons/close-x-dark.svg';
import externalLink from './assets/icons/external-link.svg';
import eyeClosedSVG from './assets/icons/eye-closed.svg';
import eyeOpenedSVG from './assets/icons/eye-opened.svg';
import eyeOpenedDarkSVG from './assets/icons/eye-opened-dark.svg';
import globeDarkSVG from './assets/icons/globe-dark.svg';
import globeLightSVG from './assets/icons/globe-light.svg';
import guideSVG from './assets/icons/guide.svg';
import menuDarkSVG from './assets/icons/menu-dark.svg';
import menuLightSVG from './assets/icons/menu-light.svg';
import walletConnectDarkSVG from './assets/icons/wallet-connect-dark.svg';
import walletConnectLightSVG from './assets/icons/wallet-connect-light.svg';
import walletConnectDefaultSVG from './assets/icons/wallet-connect-default.svg';
import warningPNG from './assets/icons/warning.png';
import warningOutlinedSVG from './assets/icons/warning-outlined.svg';
import qrCodeDarkSVG from './assets/icons/qr-dark.svg';
import qrCodeLightSVG from './assets/icons/qr-light.svg';
import saveSVG from './assets/icons/save.svg';
import saveLightSVG from './assets/icons/save-light.svg';
import starSVG from './assets/icons/star.svg';
import starInactiveSVG from './assets/icons/star-inactive.svg';
import syncSVG from './assets/icons/sync.svg';
import syncLightSVG from './assets/icons/sync-light.svg';
import selectedCheckLightSVG from './assets/icons/selected-check-light.svg';
import usbSuccessSVG from './assets/icons/usb-success.svg';
import statusInfoSVG from './assets/icons/icon-info.svg';
import statusSuccessSVG from './assets/icons/icon-success.svg';
import statusWarningSVG from './assets/icons/icon-warning.svg';
import statusErrorSVG from './assets/icons/icon-error.svg';
import style from './icon.module.css';

export const ExpandOpen = () => (
  <svg
    className={style.expandIcon}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"></circle>
    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
    <line x1="11" y1="8" x2="11" y2="14"></line>
    <line x1="8" y1="11" x2="14" y2="11"></line>
  </svg>
);

export const ExpandClose = () => (
  <svg
    className={style.expandIcon}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"></circle>
    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
    <line x1="8" y1="11" x2="14" y2="11"></line>
  </svg>
);

type SVGProps = JSX.IntrinsicElements['svg'];

export const AnimatedChecked = ({ className, ...props }: SVGProps) => (
  <svg className={`checked ${className || ''}`} viewBox="0 0 52 52" {...props}>
    <circle className="checked-circle" cx="26" cy="26" r="25" fill="none"/>
    <path className="checked-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
  </svg>
);

export const CaretDown = ({ className, ...props }: SVGProps) => (
  <svg className={`caretDown ${className || ''}`} viewBox="0 0 1024 1024" {...props}>
    <path d="M840.4 300H183.6c-19.7 0-30.7 20.8-18.5 35l328.4 380.8c9.4 10.9 27.5 10.9 37 0L858.9 335c12.2-14.2 1.2-35-18.5-35z"></path>
  </svg>
);

interface ExpandIconProps {
    expand: boolean;
}

export const ExpandIcon = ({
  expand = true,
}: ExpandIconProps) => (
  expand ? <ExpandOpen /> : <ExpandClose />
);

type ImgProps = JSX.IntrinsicElements['img'];

export const ArrowDown = (props: ImgProps) => (<img src={arrowDownSVG} draggable={false} {...props} />);
export const ArrowDownRed = (props: ImgProps) => (<img src={arrowDownRedSVG} draggable={false} {...props} />);
export const ArrowUpGreen = (props: ImgProps) => (<img src={arrowUpGreenSVG} draggable={false} {...props} />);
export const ArrowCirlceLeft = (props: ImgProps) => (<img src={arrowCircleLeftSVG} draggable={false} {...props} />);
export const ArrowCirlceLeftActive = (props: ImgProps) => (<img src={arrowCircleLeftActiveSVG} draggable={false} {...props} />);
export const ArrowCirlceRight = (props: ImgProps) => (<img src={arrowCircleRightSVG} draggable={false} {...props} />);
export const ArrowCirlceRightActive = (props: ImgProps) => (<img src={arrowCircleRightActiveSVG} draggable={false} {...props} />);
export const BankDark = (props: ImgProps) => (<img src={bankDarkSVG} draggable={false} {...props} />);
export const Bank = (props: ImgProps) => (<img src={bankLightSVG} draggable={false} {...props} />);
export const BitBox02StylizedDark = (props: ImgProps) => (<img src={BB02StylizedDark} draggable={false} {...props} />);
export const BitBox02StylizedLight = (props: ImgProps) => (<img src={BB02StylizedLight} draggable={false} {...props} />);
export const BuyInfo = (props: ImgProps) => (<img src={buyInfoSVG} draggable={false} {...props} />);
// check icon on a green circle
export const Checked = (props: ImgProps) => (<img src={checkedSmallSVG} draggable={false} {...props} />);
// simple check for copy component
export const Check = (props: ImgProps) => (<img src={checkSVG} draggable={false} {...props} />);
export const ChevronLeftDark = (props: ImgProps) => (<img src={chevronLeftDark} draggable={false} {...props} />);
export const ChevronRightDark = (props: ImgProps) => (<img src={chevronRightDark} draggable={false} {...props} />);
export const Cancel = (props: ImgProps) => (<img src={cancelSVG} draggable={false} {...props} />);
export const CreditCardDark = (props: ImgProps) => (<img src={creditCardDarkSVG} draggable={false} {...props} />);
export const CreditCard = (props: ImgProps) => (<img src={creditCardLightSVG} draggable={false} {...props} />);
export const Copy = (props: ImgProps) => (<img src={copySVG} draggable={false} {...props} />);
export const Close = (props: ImgProps) => (<img src={closeSVG} draggable={false} {...props} />);
export const CloseXWhite = (props: ImgProps) => (<img src={closeXWhiteSVG} draggable={false} {...props} />);
export const CloseXDark = (props: ImgProps) => (<img src={closeXDarkSVG} draggable={false} {...props} />);
export const Edit = (props: ImgProps) => (<img src={editSVG} draggable={false} {...props} />);
export const EditLight = (props: ImgProps) => (<img src={editLightSVG} draggable={false} {...props} />);
export const EditActive = (props: ImgProps) => (<img src={editActiveSVG} draggable={false} {...props} />);
export const ETHLogo = (props: ImgProps) => (<img src={ethColorSVG} draggable={false} {...props} />);
export const ExternalLink = (props: ImgProps) => (<img src={externalLink} draggable={false} {...props} />);
export const EyeClosed = (props: ImgProps) => (<img src={eyeClosedSVG} draggable={false} {...props} />);
export const EyeOpened = (props: ImgProps) => (<img src={eyeOpenedSVG} draggable={false} {...props} />);
export const EyeOpenedDark = (props: ImgProps) => (<img src={eyeOpenedDarkSVG} draggable={false} {...props} />);
export const GlobeDark = (props: ImgProps) => (<img src={globeDarkSVG} draggable={false} {...props} />);
export const GlobeLight = (props: ImgProps) => (<img src={globeLightSVG} draggable={false} {...props} />);
export const GreenDot = (props: ImgProps) => (<img src={greenDotSVG} draggable={false} {...props} />);
export const GuideActive = (props: ImgProps) => (<img src={guideSVG} draggable={false} {...props} />);
export const Info = (props: ImgProps) => (<img src={info} draggable={false} {...props} />);
export const MenuDark = (props: ImgProps) => (<img src={menuDarkSVG} draggable={false} {...props} />);
export const MenuLight = (props: ImgProps) => (<img src={menuLightSVG} draggable={false} {...props} />);
export const OrangeDot = (props: ImgProps) => (<img src={orangeDotSVG} draggable={false} {...props} />);
export const WalletConnectDark = (props: ImgProps) => (<img src={walletConnectDarkSVG} draggable={false} {...props} />);
export const WalletConnectLight = (props: ImgProps) => (<img src={walletConnectLightSVG} draggable={false} {...props} />);
export const WalletConnectDefaultLogo = (props: ImgProps) => (<img src={walletConnectDefaultSVG} draggable={false} {...props} />);
export const QRCodeDark = (props: ImgProps) => (<img src={qrCodeDarkSVG} draggable={false} {...props} />);
export const QRCodeLight = (props: ImgProps) => (<img src={qrCodeLightSVG} draggable={false} {...props} />);
export const RedDot = (props: ImgProps) => (<img src={redDotSVG} draggable={false} {...props} />);
export const Save = (props: ImgProps) => (<img src={saveSVG} draggable={false} {...props} />);
export const SaveLight = (props: ImgProps) => (<img src={saveLightSVG} draggable={false} {...props} />);
export const Shield = (props: ImgProps) => (<img src={shieldSVG} draggable={false} {...props} />);
export const Star = (props: ImgProps) => (<img src={starSVG} draggable={false} {...props} />);
export const StarInactive = (props: ImgProps) => (<img src={starInactiveSVG} draggable={false} {...props} />);
export const Sync = (props: ImgProps) => (<img src={syncSVG} draggable={false} {...props} />);
export const SyncLight = (props: ImgProps) => (<img src={syncLightSVG} draggable={false} {...props} />);
export const SelectedCheckLight = (props: ImgProps) => (<img src={selectedCheckLightSVG} draggable={false} {...props} />);
export const Warning = (props: ImgProps) => (<img src={warningPNG} draggable={false} {...props} />);
export const WarningOutlined = (props: ImgProps) => (<img src={warningOutlinedSVG} draggable={false} {...props} />);
export const YellowDot = (props: ImgProps) => (<img src={yellowDotSVG} draggable={false} {...props} />);
export const USBSuccess = (props: ImgProps) => (<img src={usbSuccessSVG} draggable={false} {...props} />);
export const StatusSuccess = (props: ImgProps) => (<img src={statusSuccessSVG} draggable={false} {...props} />);
export const StatusInfo = (props: ImgProps) => (<img src={statusInfoSVG} draggable={false} {...props} />);
export const StatusWarning = (props: ImgProps) => (<img src={statusWarningSVG} draggable={false} {...props} />);
export const StatusError = (props: ImgProps) => (<img src={statusErrorSVG} draggable={false} {...props} />);
/**
 * @deprecated Alert is only used for BitBox01 use `Warning` icon instead
 */
export const Alert = (props: ImgProps) => (<img src={alert} draggable={false} {...props} />);
