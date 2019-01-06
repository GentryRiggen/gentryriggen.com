describe('Site launches', () => {
  beforeAll(async () => {
    await page.goto('http://localhost:3000');
  });

  it('should display "Hi, I\'m Gentry" text on page', async () => {
    await expect(page).toMatch('Hi, I\'m Gentry.');
  });
});
