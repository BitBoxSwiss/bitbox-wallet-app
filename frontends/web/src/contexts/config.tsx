/**
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

import { createContext, Dispatch, SetStateAction, useEffect, useState } from 'react';
import { Config, getConfig, setConfig as postConfig } from '../api/config';
import { alertUser } from '../components/alert/Alert';

const CONFIG_PUSH_ERROR = 'There was an error updating the configuration. old configuration was restored.';
export interface ConfigContextInterface {
    config: Config | undefined
    setConfig: Dispatch<SetStateAction<Config>>
    configLoaded: boolean
}

let defaultContext: ConfigContextInterface = {
    config: undefined,
    setConfig: () => { },
    configLoaded: false
}

export const ConfigContext = createContext<ConfigContextInterface>(defaultContext);

export const ConfigContextProvider: React.FunctionComponent = ({ children }) => {
    const [config, updateConfig] = useState<Config | undefined>();

    useEffect(() => {
        getConfig().then(updateConfig);
    }, [])

    const setConfig: Dispatch<SetStateAction<Config>> = async (newConfigAction) => {
        const serverConfig = await getConfig().catch(() => config);

        let newConfig = typeof newConfigAction === 'function' ?
            newConfigAction(serverConfig as Config) :
            newConfigAction;

        updateConfig(newConfig);
        postConfig(newConfig)
            .catch(() => {
                updateConfig(serverConfig);
                alertUser(CONFIG_PUSH_ERROR);
            });
    }

    return <ConfigContext.Provider value={{
        config,
        setConfig,
        configLoaded: !!config
    }}
        children={children}
    />
}
