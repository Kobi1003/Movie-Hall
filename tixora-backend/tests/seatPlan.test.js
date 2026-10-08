import { SeatPlanService } from '../src/services/seatPlan.service.js';

describe('Seat Plan Validation & Studio Logic', () => {
  const screenId = 'screen-test-id';

  test('Detects overlapping seats', () => {
    const layout = {
      canvasWidth: 1200,
      canvasHeight: 800,
      sections: [{ name: 'vip' }],
      categories: [{ name: 'vip', basePrice: 500 }],
      seats: [
        { rowLabel: 'A', seatNumber: 1, categoryName: 'vip', sectionName: 'vip', xPosition: 100, yPosition: 100, width: 32, height: 32 },
        { rowLabel: 'A', seatNumber: 2, categoryName: 'vip', sectionName: 'vip', xPosition: 105, yPosition: 105, width: 32, height: 32 } // overlaps A1
      ]
    };

    const result = SeatPlanService.validateLayout(screenId, layout);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'SEAT_OVERLAP')).toBe(true);
  });

  test('Detects duplicate seat row/number combinations', () => {
    const layout = {
      canvasWidth: 1200,
      canvasHeight: 800,
      sections: [{ name: 'vip' }],
      categories: [{ name: 'vip', basePrice: 500 }],
      seats: [
        { rowLabel: 'B', seatNumber: 7, categoryName: 'vip', sectionName: 'vip', xPosition: 100, yPosition: 100 },
        { rowLabel: 'B', seatNumber: 7, categoryName: 'vip', sectionName: 'vip', xPosition: 300, yPosition: 300 } // Duplicate B7
      ]
    };

    const result = SeatPlanService.validateLayout(screenId, layout);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'DUPLICATE_SEAT_LABEL')).toBe(true);
  });

  test('Valid layout passes validation with zero errors', () => {
    const layout = {
      canvasWidth: 1200,
      canvasHeight: 800,
      sections: [{ name: 'vip' }],
      categories: [{ name: 'vip', basePrice: 500 }],
      seats: [
        { rowLabel: 'A', seatNumber: 1, categoryName: 'vip', sectionName: 'vip', xPosition: 100, yPosition: 100, width: 32, height: 32 },
        { rowLabel: 'A', seatNumber: 2, categoryName: 'vip', sectionName: 'vip', xPosition: 150, yPosition: 100, width: 32, height: 32 }
      ]
    };

    const result = SeatPlanService.validateLayout(screenId, layout);
    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
  });
});
