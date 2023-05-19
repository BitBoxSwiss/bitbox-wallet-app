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

import { FunctionComponent, ReactNode } from 'react';
import { useDarkmode } from '../../hooks/darkmode';
import { LanguageSwitch } from '../language/language';
import { Version } from '../layout/version';
import { AppLogo, AppLogoInverted, SwissMadeOpenSource, SwissMadeOpenSourceDark } from '../icon/logo';
import { AnimatedChecked, Close } from '../icon/icon';
import style from './view.module.css';

type TViewProps = {
    dialog?: boolean;
    fitContent?: boolean;
    fullscreen?: boolean;
    children: ReactNode;
    minHeight?: string;
    onClose?: () => void;
    textCenter?: boolean;
    verticallyCentered?: boolean;
    width?: string;
    withBottomBar?: boolean;
};

/**
 * View component is used as a container component to wrap ViewHeader, ViewContent and ViewButtons
 * @param dialog wether to render the view as a dialog
 * @param fitContent tries to squeeze the whole view into the visible area, if true the icon specified through ViewContent withIcon will shrink if the visible area is bigger than the window height
 * @param fullscreen wether the View container should cover the whole window
 * @param minHeight optional minimum height, useful for keeping content area same size through multiple views
 * @param onClose if a callback is provided it will render a close button that triggers the callback
 * @param textCenter centers all text content in the view
 * @param verticallyCentered centers all text content in the view, has no effect in dialog mode
 * @param width can be used to overwrite the default width of the inner area
 * @param withBottomBar enables a footer with some logo and language switch
 */
export const View = ({
  dialog = false,
  fitContent = false,
  fullscreen,
  children,
  minHeight,
  onClose,
  textCenter,
  verticallyCentered = false,
  width,
  withBottomBar,
}: TViewProps) => {
  const { isDarkMode } = useDarkmode();
  const containerClasses = `${
    style[fullscreen ? 'fullscreen' : 'fill']
  } ${
    verticallyCentered ?
      withBottomBar
        ? style.verticallyCenteredWithBottomBar
        : style.verticallyCentered
      : ''
  } ${
    dialog ? style.dialog : ''
  }`;
  let classNames = style.inner;
  if (fitContent) {
    classNames += ` ${style.fit}`;
  }
  if (textCenter) {
    classNames += ` ${style.textCenter}`;
  }
  const inlineStyles = {
    ...(minHeight && { minHeight }),
    ...(width && { width }),
  };
  return (
    <div className={containerClasses}>
      <div
        className={classNames}
        style={inlineStyles}>
        {children}
      </div>
      {onClose && (
        <button className={style.closeButton} onClick={onClose}>
          <Close />
        </button>
      )}
      {withBottomBar && (
        <div style={{ marginTop: 'auto' }}>
          <footer className={style.footer}>
            {isDarkMode ? (<SwissMadeOpenSourceDark />) : (<SwissMadeOpenSource />)}
            <div className="m-right-half hide-on-small">
              <Version />
            </div>
            <LanguageSwitch />
          </footer>
        </div>
      )}
    </div>
  );
};

type TViewContentProps = {
    children: ReactNode;
    fullWidth?: boolean;
    minHeight?: string;
    textAlign?: 'center' | 'left';
    withIcon?: 'success';
}

/**
 * ViewContent useful for all sorts of content, text, images, grids and forms
 * @param fullWidth useful to present content on small screen on the full width of the screen
 * @param minHeight can be used to set a minimum content height to keep the same height over multiple views
 * @param textAlign allows overwriting text alignment in the content area
 * @param withIcon supports success icon currently, but could support other icons in the future
 */
export const ViewContent = ({
  children,
  fullWidth,
  minHeight,
  textAlign,
  withIcon,
  ...props
}: TViewContentProps) => {
  const align = textAlign ? style[`text-${textAlign}`] : '';
  const containerWidth = fullWidth ? style.fullWidth : '';
  const classes = `${style.content} ${containerWidth} ${align}`;
  return (
    <div
      className={classes}
      style={minHeight ? { minHeight } : {}}
      {...props}>
      {withIcon === 'success' && (
        <AnimatedChecked className={style.largeIcon} />
      )}
      {children}
    </div>
  );
};

type THeaderProps = {
    small?: boolean;
    title?: ReactNode;
    withAppLogo?: boolean;
}

/**
 * ViewHeader component to render the view's title and a byline
 * @param small option to reduce the size of the header
 * @param title the title of the view
 * @param withAppLogo if true includes the BitBoxApp logo before the title
 */
export const ViewHeader: FunctionComponent<THeaderProps> = ({
  children,
  small,
  title,
  withAppLogo,
}) => {
  const { isDarkMode } = useDarkmode();
  const headerStyles = small ? `${style.header} ${style.smallHeader}` : style.header;
  return (
    <header className={headerStyles}>
      {withAppLogo && (
        isDarkMode ? <AppLogoInverted /> : <AppLogo />
      )}
      {title && (
        <h1 className={style.title}>{title}</h1>
      )}
      {children}
    </header>
  );
};

type TViewButtonsProps = {
  children: ReactNode;
}

/**
 * ViewButtons component use as container for buttons
 */
export const ViewButtons = ({ children }: TViewButtonsProps) => {
  return (
    <div className={style.buttons}>
      {children}
    </div>
  );
};
