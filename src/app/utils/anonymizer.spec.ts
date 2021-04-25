import { applyRules } from './anonymizer';

describe('Util: Anonymizer', () => {
  describe('#ApplyRules', () => {
    const json = [
      {
        name: 'king arthur',
        password: 'password1',
        profession: 'king',
        id: 1
      },
      {
        name: 'rob kendal',
        password: 'password3',
        profession: 'code fiddler',
        id: 2
      },
      {
        name: 'teresa may',
        password: 'password2',
        profession: 'brexit destroyer',
        id: 6,
        messages: [
          { id: 1, name: 'xyz' },
          { id: 2 }
        ]
      }
    ]

    it('should apply multiple rules', () => {
      const output = applyRules(json, [
        { type: 'fullName', path: 'name' },
        { type: 'password', path: 'password' }]);
      json.forEach((item, i) => {
        expect(output[i].name).not.toEqual(item.name);
        expect(output[i].password).not.toEqual(item.password);
      });
    });

    it('should apply multiple rule many levels deep', () => {
      const output = applyRules(json, [
        { type: 'username', path: 'messages.name' }]);

      expect(output[2].messages[0].name).not.toEqual(json[2].messages[0].name);
    });
  });
})
