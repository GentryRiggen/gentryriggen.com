describe('About Me Page loads properly', () => {
  beforeAll(async () => {
    console.log('IP Address:', require('ip').address());
    await page.waitFor(1000);
    await page.goto(`http://${require('ip').address()}:3000/about`);
    await page.waitForSelector('[data-test="about-me"]');
  });

  it('should display "Hi, I\'m Gentry" text on page', async () => {
    await expect(page).toMatch('Hi, I\'m Gentry.');
  });
});
