describe('OhMyMock', () => {
  describe('Early call', () => {
    before((done) => {
      cy.visit('https://scaljeri.github.io/oh-my-mock/');
      cy.get("html").then(() => {
        window.addEventListener('message', e => {
          done()
        })

        window.postMessage({
          source: 'external',
          payload: {
            type: 'settings',
            data: { active: true }
          }
        }, '*');
      });
    });

    it('should be ok', () => {
      expect(name).to.not.equal('Jane');
    });
  })
})
