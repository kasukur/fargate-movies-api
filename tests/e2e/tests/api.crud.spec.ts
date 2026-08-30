import { expect, test, type APIRequestContext } from '@playwright/test';

/**
 * API integration: exercises the full CRUD lifecycle directly against the
 * backend - create supporting director and genre, create a movie, read it,
 * update it, list/search it, then delete everything and verify the 404s.
 */
test.describe('Movies API CRUD', () => {
  let directorId: string;
  let genreId: string;
  let movieId: string;

  async function createFixtures(request: APIRequestContext): Promise<void> {
    const directorRes = await request.post('/api/directors', {
      data: { name: `Test Director ${Date.now()}`, bornYear: 1975, nationality: 'Australian' }
    });
    expect(directorRes.status()).toBe(201);
    directorId = (await directorRes.json()).id;

    const genreRes = await request.post('/api/genres', {
      data: { name: `Test Genre ${Date.now()}`, description: 'Created by the API test suite' }
    });
    expect(genreRes.status()).toBe(201);
    genreId = (await genreRes.json()).id;
  }

  test('full movie lifecycle: create, read, update, list, delete', async ({ request }) => {
    await createFixtures(request);
    const title = `API Test Movie ${Date.now()}`;

    // ---- Create ----
    const createRes = await request.post('/api/movies', {
      data: {
        title,
        year: 2024,
        directorId,
        genreIds: [genreId],
        synopsis: 'Created directly against the API.',
        rating: 6.5
      }
    });
    expect(createRes.status()).toBe(201);
    const created = await createRes.json();
    movieId = created.id;
    expect(created.title).toBe(title);
    expect(created.directorId).toBe(directorId);
    expect(created.genreIds).toEqual([genreId]);

    // ---- Read ----
    const getRes = await request.get(`/api/movies/${movieId}`);
    expect(getRes.status()).toBe(200);
    expect((await getRes.json()).title).toBe(title);

    // ---- Update ----
    const updateRes = await request.put(`/api/movies/${movieId}`, {
      data: { rating: 9.1, synopsis: 'Updated by the API test suite.' }
    });
    expect(updateRes.status()).toBe(200);
    const updated = await updateRes.json();
    expect(updated.rating).toBe(9.1);
    expect(updated.synopsis).toBe('Updated by the API test suite.');

    // ---- List and search ----
    const searchRes = await request.get(
      `/api/movies?search=${encodeURIComponent('API Test Movie')}`
    );
    expect(searchRes.status()).toBe(200);
    const searchBody = await searchRes.json();
    expect(searchBody.items.some((m: { id: string }) => m.id === movieId)).toBe(true);

    const byDirectorRes = await request.get(`/api/movies?directorId=${directorId}`);
    expect(byDirectorRes.status()).toBe(200);
    const byDirector = await byDirectorRes.json();
    expect(byDirector.items.some((m: { id: string }) => m.id === movieId)).toBe(true);

    const byGenreRes = await request.get(`/api/genres/${genreId}/movies`);
    expect(byGenreRes.status()).toBe(200);
    const byGenre = await byGenreRes.json();
    expect(byGenre.items.some((m: { movieId: string }) => m.movieId === movieId)).toBe(true);

    // ---- Validation guardrails ----
    const badRes = await request.post('/api/movies', {
      data: { title: '', year: 1200, directorId: '', genreIds: [] }
    });
    expect(badRes.status()).toBe(400);

    const orphanRes = await request.post('/api/movies', {
      data: { title: 'Orphan', year: 2020, directorId: 'DOES-NOT-EXIST', genreIds: [genreId] }
    });
    expect(orphanRes.status()).toBe(422);

    // ---- Delete ----
    const deleteRes = await request.delete(`/api/movies/${movieId}`);
    expect(deleteRes.status()).toBe(204);

    const goneRes = await request.get(`/api/movies/${movieId}`);
    expect(goneRes.status()).toBe(404);

    // ---- Cleanup fixtures ----
    expect((await request.delete(`/api/genres/${genreId}`)).status()).toBe(204);
    expect((await request.delete(`/api/directors/${directorId}`)).status()).toBe(204);
  });
});
