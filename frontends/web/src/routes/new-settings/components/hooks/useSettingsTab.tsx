import { Main, Header } from '../../../../components/layout';
import { View, ViewContent } from '../../../../components/view/view';
import Tabs from '../tabs';

const useSettingsTab = (Component: () => JSX.Element) => {
  const ComponentWithTabs = () => (
    <Main>
      <Header title={<h2>Settings</h2>} />
      <View fullscreen={false}>
        <ViewContent>
          <Tabs />
          <Component />
        </ViewContent>
      </View>
    </Main>
  );
  return ComponentWithTabs;
};


export default useSettingsTab;