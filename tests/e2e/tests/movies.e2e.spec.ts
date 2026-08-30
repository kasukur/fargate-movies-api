import { expect, request as playwrightRequest, test, type APIRequestContext } from '@playwright/test';

const API_URL = process.env.API_URL ?? 'http://localhost:3000';

/**
 * End-to-end: a user adds a movie through the Vue UI and sees it rendered
 * in the browse grid.
 *
 * The add-movie form's director dropdown and genre checkboxes are populated
 * from the API, so the test provisions one director and one genre directly
 * against the API in `beforeAll` rather than depending on `npm run db:seed`
 * having been run. DynamoDB Local (or a deployed table via API_URL) still
 * needs to be reachable.
 */
test.describe('Add movie flow', () => {
  const uniqueTitle = `Playwright Premiere ${Date.now()}`;

  let api: APIRequestContext;
  let directorId: string;
  let genreId: string;

  test.beforeAll(async () => {
    api = await playwrightRequest.newContext({ baseURL: API_URL });

    const directorRes = await api.post('/api/directors', {
      data: { name: `E2E Director ${Date.now()}`, bornYear: 1970, nationality: 'American' }
    });
    expect(directorRes.status()).toBe(201);
    directorId = (await directorRes.json()).id;

    const genreRes = await api.post('/api/genres', {
      data: { name: `E2E Genre ${Date.now()}`, description: 'Created by the Playwright E2E suite' }
    });
    expect(genreRes.status()).toBe(201);
    genreId = (await genreRes.json()).id;
  });

  test.afterAll(async () => {
    // Best-effort cleanup: the movie added through the UI references the
    // fixtures, so it has to go first.
    try {
      const found = await api.get(`/api/movies?search=${encodeURIComponent(uniqueTitle)}`);
      if (found.ok()) {
        const { items } = await found.json();
        for (const movie of items as Array<{ id: string }>) {
          await api.delete(`/api/movies/${movie.id}`);
        }
      }
      if (genreId) await api.delete(`/api/genres/${genreId}`);
      if (directorId) await api.delete(`/api/directors/${directorId}`);
    } finally {
      await api.dispose();
    }
  });

  test('user can add a movie and see it in the list', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Browse movies' })).toBeVisible();

    await page.getByRole('link', { name: 'Add movie' }).click();
    await expect(page.getByTestId('add-movie-form')).toBeVisible();

    await page.getByTestId('title-input').fill(uniqueTitle);
    await page.getByTestId('year-input').fill('2025');

    // Select the director provisioned in beforeAll (index 0 is the placeholder).
    const directorSelect = page.getByTestId('director-select');
    await expect(directorSelect.locator('option').nth(1)).toBeAttached();
    await directorSelect.selectOption({ index: 1 });

    // Tick the first genre checkbox.
    const firstGenre = page
      .getByTestId('add-movie-form')
      .locator('input[type="checkbox"]')
      .first();
    await firstGenre.check();

    await page
      .getByTestId('synopsis-input')
      .fill('Added by an automated Playwright end-to-end test.');
    await page.getByTestId('rating-input').fill('7.5');

    await page.getByTestId('submit-movie').click();

    // Back on the browse view, the new movie should be rendered.
    await expect(page.getByRole('heading', { name: 'Browse movies' })).toBeVisible();
    await expect(
      page.getByTestId('movie-grid').getByText(uniqueTitle)
    ).toBeVisible();

    // The search flow should also surface it.
    await page.getByTestId('search-input').fill('Playwright Premiere');
    await expect(
      page.getByTestId('movie-grid').getByText(uniqueTitle)
    ).toBeVisible();
  });
});
