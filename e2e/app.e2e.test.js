describe('Site launches', () => {
  beforeAll(async () => {
    await page.goto(`http://${'127.0.0.1'}:3000`);
    await page.waitForSelector('[data-test="screen-container"]');
  });

  it('should display "Hi, I\'m Gentry" text on page', async () => {
    await expect(page).toMatch('Hi, I\'m Gentry.');
  });
});
