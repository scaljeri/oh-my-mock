import { OhMyForDirective } from './for.directive';
describe('ForDirective', () => {
  it('should create an instance', () => {
    const directive = new OhMyForDirective({} as any);
    expect(directive).toBeTruthy();
  });
});
