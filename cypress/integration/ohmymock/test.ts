describe('OhMyMock', () => {
  describe('Early call', () => {
    before((done) => {
      cy.visit('http://localhost:8000');
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
