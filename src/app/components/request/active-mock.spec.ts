import { IData, IOhMyContext } from '@shared/type';
import { activeMockId } from './active-mock';

const context: IOhMyContext = { domain: 'example.com', preset: 'p1' };

const request = (over: Partial<IData>): IData => ({
  mocks: { m1: { id: 'm1', statusCode: 200 } },
  enabled: { p1: true },
  selected: { p1: 'm1' },
  ...over
} as IData);

describe('activeMockId', () => {
  it('is the picked response when everything lines up', () => {
    expect(activeMockId(request({}), context)).toBe('m1');
  });

  it('is nothing while the request is switched off for this preset', () => {
    expect(activeMockId(request({ enabled: { p1: false } }), context)).toBeUndefined();
  });

  it('is nothing when another preset is the one that is switched on', () => {
    expect(activeMockId(request({ enabled: { p2: true } }), context)).toBeUndefined();
  });

  it('is nothing when no response is picked', () => {
    expect(activeMockId(request({ selected: {} }), context)).toBeUndefined();
  });

  it('is nothing when the picked response was deleted', () => {
    expect(activeMockId(request({ selected: { p1: 'gone' } }), context)).toBeUndefined();
  });

  it('copes with no request or no context at all', () => {
    expect(activeMockId(undefined, context)).toBeUndefined();
    expect(activeMockId(request({}), undefined)).toBeUndefined();
  });
});
