import { View, ViewContent } from '../../components/view/view';
import { Header, Main } from '../../components/layout';
import style from './appearance.module.css';
import { ReactNode } from 'react';

const ContentContainer = ({ children }: {children: ReactNode}) => <div className={style.contentContainer}>{children}</div>;

export const Appearance = () => {
  return (
    <Main>
      <Header title={<h2>Settings</h2>} />
      <View fullscreen={false}>
        <ViewContent>
          <ContentContainer>
           content here...
          </ContentContainer>
        </ViewContent>
      </View>
    </Main>
  );
};
