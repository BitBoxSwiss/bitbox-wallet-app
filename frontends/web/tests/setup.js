import { createSerializer } from 'enzyme-to-json';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
expect.addSnapshotSerializer(createSerializer({ mode: 'deep' }));
