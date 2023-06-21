import { useTranslation } from 'react-i18next';
import { Dialog } from '../../../../components/dialog/dialog';
import { Button } from '../../../../components/forms';
import { Spinner } from '../../../../components/spinner/Spinner';
import style from '../send.module.css';

type TProps = {
    activeScanQR: boolean;
    toggleScanQR: () => void;
    videoLoading: boolean;
    onLoadedVideo: () => void;
}

const DialogScanQR = ({ activeScanQR, toggleScanQR, videoLoading, onLoadedVideo }: TProps) => {
  const { t } = useTranslation();
  return (
    <Dialog
      open={activeScanQR}
      title={t('send.scanQR')}
      onClose={toggleScanQR}>
      {videoLoading && <Spinner guideExists />}
      <video
        id="video"
        width={400}
        height={300 /* fix height to avoid ugly resize effect after open */}
        className={style.qrVideo}
        onLoadedData={onLoadedVideo} />
      <div className={['buttons', 'flex', 'flex-row', 'flex-between'].join(' ')}>
        <Button
          secondary
          onClick={toggleScanQR}>
          {t('button.back')}
        </Button>
      </div>
    </Dialog>
  );
};

export default DialogScanQR;