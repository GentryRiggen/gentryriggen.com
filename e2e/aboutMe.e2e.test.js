const utils = require('./e2eUtils');

describe('About Me Page loads properly', () => {
  beforeAll(async () => {
    await utils.waitForPage(page, 'about', 'about-me');
  });

  it('should display "Hi, I\'m Gentry" text on page', async () => {
    await expect(page).toMatch('Hi, I\'m Gentry.');
  });
});
