describe('OhMyMock', () => {
  describe('Early call', () => {
    beforeEach((done) => {
      // cy.visit('https://scaljeri.github.io/oh-my-mock/?type=fetch&method=get&response=json-external&responseType=blob');
      // // cy.visit('https://example.cypress.io');
      // // done();
      cy.visit('http://localhost:8000/?type=fetch&method=get&response=json-external&responseType=text');
      cy.get("html").then(() => {
        window.addEventListener('message', e => {
            done();
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

    it('displays two todo items by default', () => {
      // cy.contains('GO >>>');
      // cy.wait(1000);
      // cy.wait(3000);
      // cy.get('.response-type').then($select => {
      //   console.log('xxxxxxxxx', $select.length);
      //   //evaluates as true
      // });
      cy.get('.response-type').select('json');
      cy.get('.go').click();
      // cy.intercept({
      //   method: 'GET',
      //   url: '/users',
      // }).as('earlyCall');

      // cy.wait(1000);

      // cy.get('.body pre', { timeout: 10000 }).should('be.visible');
      // cy.get('.go').should('have.length', 1);
      // // cy.get('.go').first().contains('Go >>>')
      // cy.get('.go').click();
      // setTimeout(() => {
      //   cy.get('.body pre').should($pre => {
      //     // expect($pre.text()).to.contain.text('King')
      //     $pre.text().match(/Kinxg/);
      //     done();
      //   });

      // }, 500);
      // cy.wait('@earlyCall').its('response.statusCode').should('equal', 200)
      // We use the `cy.get()` command to get all elements that match the selector.
      // Then, we use `should` to assert that there are two matched items,
      // which are the two default items.
      // cy.get('.go').should('have.length', 1);
      // expect(true).to.equal(false);
      // cy.contains('GO >>>');
      // cy.pause();
      // cy.get('.body pre').should($pre => {
      //   // expect($pre.text()).to.contain.text('King')
      //   $pre.text().match(/Kinxxg/);
      // })
      // cy.get('.body pre').then(element => {
      //   const text = element.text()
      //   expect(text).to.match(/King/);
      // })
      // cy.get('.body > pre').should(($el) => {
      //   const text = $el.text()

      //   console.log('TEXT-', text);
      //   cy.log(text);
      //   const hasThisText = text.match(/King/)

      //   expect(hasThisText).to.equal(true);
      //   // ,
      //     // 'element has either this or that string').to.be.true
      // })
      // same check is
      // cy.url().should('include', 'response=json');

      // We can go even further and check that the default todos each contain
      // the correct text. We use the `first` and `last` functions
      // to get just the first and last matched elements individually,
      // and then perform an assertion with `should`.
      // cy.get('.go').first().contains('Go')
      // cy.get('.todo-list li').last().should('have.text', 'Walk the dog')
    })

    // it('should be ok', () => {
    //   // cy.get('.todo-list li').first().should('have.text', 'Pay electric bill')
    //   // // cy.get('pre').should(($pre) => {
    //   // cy.get(".go").then(function ($elem) {
    //   //   cy.log($elem.text())
    //   // })
    //   // cy.get('.go').text().then(text => {
    //   //   expect(text).toBe('Yolo');
    //   // })
    //   // .toContain('Go') => {
    //   //     expect($pre.get(0).innerText).toContain('king')
    //   // });
    //   // cy.get('.go').click();
    //   // cy.get('pre').should(($pre) => {
    //   //     expect($pre.get(0).innerText).toContain('king')
    //   // });
    //   expect('Luc').to.equal('Luc');
    // });
  })
})
