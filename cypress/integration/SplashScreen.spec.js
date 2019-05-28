it('Splash Screen', () => {
  cy.describe('When I want to view the splash screen', () => {
    cy.it('should show content', () => {
      cy.visit('/')
    })
  })
})
