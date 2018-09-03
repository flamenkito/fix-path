import { walk } from './index';
import { expect } from 'chai';

describe('flamenkito-fix-path plugin, walk function', () => {
  it('should return dir list', async () => {
    const result = await walk('./src');
    expect(result).to.deep.equal(['src/index.spec.ts', 'src/index.ts']);
  });
});
