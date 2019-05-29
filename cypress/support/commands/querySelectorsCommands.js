const getDataTag = (tag, value) => `[data-${tag}="${value}"]`
const getDataTestTag = value => getDataTag('test', value)

Cypress.Commands.add('getByDataTest', tag => cy.get(getDataTestTag(tag)))
Cypress.Commands.add('getByDataTag', (tag, value) =>
  cy.get(getDataTag(tag, value)),
)
Cypress.Commands.add('getToast', () => cy.get('.Toastify__toast-container'))
Cypress.Commands.add('getByDataTestChild', (tag, childTag) =>
  cy.get(`${getDataTestTag(tag)} ${childTag}`),
)
