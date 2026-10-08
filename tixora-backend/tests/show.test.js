import { runSeed } from '../scripts/seed.js';
import { ShowService } from '../src/services/show.service.js';
import { ValidationError } from '../src/utils/errors.js';

describe('Show Creation Business Rule Validation', () => {
  let seedData;

  beforeAll(async () => {
    seedData = await runSeed();
  }, 60000);

  test('Reject show if requested format is not authorized', async () => {
    await expect(
      ShowService.createShow(seedData.cinemaOwner.id, {
        movieId: seedData.movie.id,
        cinemaId: seedData.cinema.id,
        screenId: seedData.screens[0].id,
        authorizationId: seedData.authorization.id,
        showDate: '2026-09-22',
        startTime: '14:00:00',
        endTime: '16:30:00',
        language: 'English',
        format: '4DX' // Screen / Auth only supports 2D / 3D
      })
    ).rejects.toThrow(ValidationError);
  });

  test('Reject show if date falls outside authorized period', async () => {
    await expect(
      ShowService.createShow(seedData.cinemaOwner.id, {
        movieId: seedData.movie.id,
        cinemaId: seedData.cinema.id,
        screenId: seedData.screens[0].id,
        authorizationId: seedData.authorization.id,
        showDate: '2026-10-15', // Authorization is only 19-25 Sep 2026
        startTime: '14:00:00',
        endTime: '16:30:00',
        language: 'English',
        format: '2D'
      })
    ).rejects.toThrow(ValidationError);
  });

  test('Accept show when all rules match and snapshot show_seats inventory', async () => {
    const result = await ShowService.createShow(seedData.cinemaOwner.id, {
      movieId: seedData.movie.id,
      cinemaId: seedData.cinema.id,
      screenId: seedData.screens[0].id,
      authorizationId: seedData.authorization.id,
      showDate: '2026-09-23',
      startTime: '10:30:00',
      endTime: '13:00:00',
      language: 'English',
      format: '2D'
    });

    expect(result.show).toBeDefined();
    expect(result.show.status).toBe('PUBLISHED');
    expect(result.seatInventoryCreated).toBeGreaterThan(0);
  });
});
