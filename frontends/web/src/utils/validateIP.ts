/**
 * Copyright 2019 Shift Devices AG
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

// internal function to validate number ranges
const validateNumberRange = (numberToValidate: number, min: number, max: number) => {
    return min <= numberToValidate && numberToValidate <= max;
};

// internal function to validate IP and port if a port was provided to validateIP
const validateIPAndPort = (input: string) => {
    const ipAndPort: string[] = input.split(':');
    const port: string = ipAndPort[1];
    return validateNumberRange(+port, 1, 65535) && validateIP(ipAndPort[0]);
};

// validateIP validates IP addresses and ports
export const validateIP = (input: string) => {
    if (input.includes(':')) {
        return validateIPAndPort(input);
    }
    const ip: string[] = input.split('.');
    return ip.length === 4 && ip.every(segment => {
        return validateNumberRange(+segment, 0, 255);
    });
};
