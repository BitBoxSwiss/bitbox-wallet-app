import { ReactNode } from 'react';
import { View, ViewContent } from '../../components/view/view';
import { Header, Main } from '../../components/layout';
import { DarkmodeToggleSetting } from '../../components/settings/settingsItems/darkmodeToggleSetting';
import { DisplaySatsToggleSetting } from '../../components/settings/settingsItems/displaySatsToggleSetting';
import style from './appearance.module.css';

const ContentContainer = ({ children }: {children: ReactNode}) => <div className={style.contentContainer}>{children}</div>;

export const Appearance = () => {
  return (
    <Main>
      <Header title={<h2>Settings</h2>} />
      <View fullscreen={false}>
        <ViewContent>
          <ContentContainer>
            <DarkmodeToggleSetting />
            <DisplaySatsToggleSetting />
          </ContentContainer>
        </ViewContent>
      </View>
    </Main>
  );
};
