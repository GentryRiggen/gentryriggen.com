Cypress.Commands.add('describe', (description, func) => {
  cy.log(`DESCRIBE: ${description}`)
  func()
})
Cypress.Commands.add('it', (description, func) => {
  cy.log(`IT: ${description}`)
  func()
})
import './querySelectorsCommands'
