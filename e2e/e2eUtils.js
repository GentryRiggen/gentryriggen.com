const waitForPage = async (page, route, selector = false) => {
  jest.setTimeout(30000);
  await page.goto(`http://${require('ip').address()}:3000/${route}`);
  if (selector) {
    await page.waitForSelector(`[data-test="${selector}"]`);
  }
};

module.exports = {
  waitForPage,
};
