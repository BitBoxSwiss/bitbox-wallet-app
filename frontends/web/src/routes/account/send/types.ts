import { FeeTargetCode, Fiat, IAmount } from '../../../api/account';
import { BtcUnit } from '../../../api/coins';


export type TSignProgress = {
    steps: number;
    step: number;
  }

export type TransactionDetailsState = {
    recipientAddress: string;
    amount: string;
    proposedFee?: IAmount;
    proposedTotal?: IAmount;
    proposedAmount?: IAmount;
    valid: boolean;
    fiatAmount: string;
    fiatUnit: Fiat;
    sendAll: boolean;
    feeTarget?: FeeTargetCode;
    customFee: string;
}

export type TransactionStatusState = {
    isConfirming: boolean;
    isSent: boolean;
    isAborted: boolean;
    isUpdatingProposal: boolean;
    signProgress?: TSignProgress;
    signConfirm: boolean;
}


export type ErrorHandlingState = {
    addressError?: string;
    amountError?: string;
    feeError?: string;
    noMobileChannelError?: boolean;
}

export type CoinControlSettingsState = {
    coinControl: boolean;
    btcUnit: BtcUnit;
    activeCoinControl: boolean;
}

export type CameraState = {
    hasCamera: boolean;
    activeScanQR: boolean;
    videoLoading: boolean;
}