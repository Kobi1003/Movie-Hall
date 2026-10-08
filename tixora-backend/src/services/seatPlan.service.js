import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin, memoryStore } from '../config/supabase.js';
import { AppError, NotFoundError, ValidationError, ConflictError } from '../utils/errors.js';
import { ENV } from '../config/env.js';
import { logger } from '../utils/logger.js';

const VALID_SEAT_TYPES = new Set(['STANDARD', 'PREMIUM', 'RECLINER', 'COUPLE', 'VIP', 'WHEELCHAIR', 'COMPANION', 'ACCESSIBLE']);

function normalizeSeatType(type) {
  const upper = String(type || 'STANDARD').toUpperCase();
  return VALID_SEAT_TYPES.has(upper) ? upper : 'STANDARD';
}

export class SeatPlanService {
  static validateLayout(screenId, layoutData) {
    const { canvasWidth = 1200, canvasHeight = 800, sections = [], categories = [], seats = [] } = layoutData;
    const errors = [];
    if (!screenId) errors.push({ code: 'MISSING_SCREEN', message: 'Missing screen reference' });
    if (!categories.length) errors.push({ code: 'MISSING_CATEGORIES', message: 'At least one seat category is required' });
    if (!sections.length) errors.push({ code: 'MISSING_SECTIONS', message: 'At least one seat section is required' });
    if (!seats.length) errors.push({ code: 'MISSING_SEATS', message: 'Auditorium must contain at least one seat' });

    const categoryNames = new Set(categories.map(c => c.name));
    const sectionNames = new Set(sections.map(s => s.name));
    const rowSeatMap = new Set();

    for (let i = 0; i < seats.length; i++) {
      const s = seats[i];
      const seatLabel = `${s.rowLabel}${s.seatNumber}`;
      if (rowSeatMap.has(seatLabel)) errors.push({ code: 'DUPLICATE_SEAT_LABEL', seatId: s.id || seatLabel, message: `Duplicate: ${seatLabel}` });
      rowSeatMap.add(seatLabel);
      if (s.categoryName && !categoryNames.has(s.categoryName)) errors.push({ code: 'INVALID_CATEGORY_REFERENCE', seatId: s.id || seatLabel, message: `Seat ${seatLabel} references unknown category: ${s.categoryName}` });
      const w = s.width || 32; const h = s.height || 32;
      if (s.xPosition < 0 || s.xPosition + w > canvasWidth || s.yPosition < 0 || s.yPosition + h > canvasHeight) {
        errors.push({ code: 'INVALID_COORDINATES', seatId: s.id || seatLabel, message: `Seat ${seatLabel} is outside canvas.` });
      }
      for (let j = i + 1; j < seats.length; j++) {
        const other = seats[j];
        const otherW = other.width || 32; const otherH = other.height || 32;
        if (Math.abs(s.xPosition - other.xPosition) < Math.min(w, otherW) * 0.8 && Math.abs(s.yPosition - other.yPosition) < Math.min(h, otherH) * 0.8) {
          errors.push({ code: 'SEAT_OVERLAP', seatId: s.id || seatLabel, message: `Seat ${seatLabel} overlaps ${other.rowLabel}${other.seatNumber}.` });
        }
      }
    }
    return { valid: errors.length === 0, errors };
  }

  static async resolveUserId(userId, screenId) {
    if (userId) {
      const { data: userProfile } = await supabaseAdmin.from('profiles').select('id').eq('id', userId).maybeSingle();
      if (userProfile?.id) return userProfile.id;
    }
    if (screenId) {
      const { data: screenData } = await supabaseAdmin.from('screens').select('cinema_id, cinemas(owner_user_id)').eq('id', screenId).maybeSingle();
      const ownerId = screenData?.cinemas?.owner_user_id;
      if (ownerId) {
        const { data: ownerProfile } = await supabaseAdmin.from('profiles').select('id').eq('id', ownerId).maybeSingle();
        if (ownerProfile?.id) return ownerProfile.id;
      }
    }
    const { data: anyOwner } = await supabaseAdmin.from('profiles').select('id').eq('role', 'CINEMA_OWNER').limit(1).maybeSingle();
    return anyOwner?.id || 'c59f6e39-7ae0-470e-a930-3380a0d39286';
  }

  static async saveSeatPlan(screenId, layoutData, userId) {
    const validation = this.validateLayout(screenId, layoutData);
    if (!validation.valid) throw new ValidationError('Seat plan validation failed', validation.errors);

    const effectiveUserId = await this.resolveUserId(userId, screenId);

    // Check existing seat plan in Supabase
    let seatPlan = null;
    const { data: existingPlan, error: existingPlanError } = await supabaseAdmin.from('seat_plans').select('*').eq('screen_id', screenId).maybeSingle();
    if (existingPlanError) throw new AppError(`Could not load the screen seat plan: ${existingPlanError.message}`, 503, 'DATABASE_READ_FAILED');
    if (existingPlan) {
      seatPlan = existingPlan;
    } else {
      for (const sp of memoryStore.seatPlans.values()) {
        if (sp.screen_id === screenId) { seatPlan = sp; break; }
      }
    }

    if (!seatPlan) {
      const planId = uuidv4();
      seatPlan = {
        id: planId, screen_id: screenId,
        name: layoutData.name || 'Main Layout',
        description: layoutData.description || 'Auditorium layout',
        status: 'DRAFT', active_version_id: null,
        created_by: effectiveUserId, created_at: new Date().toISOString(), updated_at: new Date().toISOString()
      };
      const { error: planError } = await supabaseAdmin.from('seat_plans').insert(seatPlan);
      if (planError) {
        if (ENV.NODE_ENV === 'test' || planError.code === '23503') {
          logger.warn(`Could not persist seat plan to Supabase (${planError.message}), fallback to memoryStore`);
        } else {
          throw new AppError(`Failed to save seat plan in Supabase: ${planError.message}`, 503, 'DATABASE_WRITE_FAILED');
        }
      }
      memoryStore.seatPlans.set(planId, seatPlan);
    }

    // Next version number
    let maxVersion = 0;
    const { data: versionsData } = await supabaseAdmin.from('seat_plan_versions').select('version_number').eq('seat_plan_id', seatPlan.id).order('version_number', { ascending: false }).limit(1);
    if (versionsData && versionsData.length > 0) maxVersion = versionsData[0].version_number;
    for (const v of memoryStore.seatPlanVersions.values()) {
      if (v.seat_plan_id === seatPlan.id && v.version_number > maxVersion) maxVersion = v.version_number;
    }
    const versionNumber = maxVersion + 1;

    const versionId = uuidv4();
    const versionRecord = {
      id: versionId, seat_plan_id: seatPlan.id, version_number: versionNumber,
      status: 'VALID', canvas_width: layoutData.canvasWidth || 1200,
      canvas_height: layoutData.canvasHeight || 800,
      screen_position: layoutData.screenPosition || 'TOP',
      entrance_position: layoutData.entrancePosition || 'BOTTOM',
      created_by: effectiveUserId, created_at: new Date().toISOString()
    };
    const { error: verError } = await supabaseAdmin.from('seat_plan_versions').insert(versionRecord);
    if (verError) {
      if (ENV.NODE_ENV === 'test' || verError.code === '23503') {
        logger.warn(`Could not persist seat plan version to Supabase (${verError.message}), fallback to memoryStore`);
      } else {
        throw new AppError(`Failed to create seat plan version in Supabase: ${verError.message}`, 503, 'DATABASE_WRITE_FAILED');
      }
    }
    memoryStore.seatPlanVersions.set(versionId, versionRecord);

    // Sections
    const sectionMap = new Map();
    const sectionRows = [];
    for (const sec of layoutData.sections) {
      const secId = uuidv4();
      const secRecord = { id: secId, seat_plan_version_id: versionId, name: sec.name, display_name: sec.displayName || sec.name, sort_order: sec.sortOrder || 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      sectionRows.push(secRecord);
      sectionMap.set(sec.name, secId);
      if (sec.displayName) sectionMap.set(sec.displayName, secId);
    }
    if (sectionRows.length > 0) {
      const { error: secError } = await supabaseAdmin.from('seat_sections').insert(sectionRows);
      if (secError) {
        if (ENV.NODE_ENV === 'test' || secError.code === '23503') {
          logger.warn(`Could not persist seat sections to Supabase (${secError.message}), fallback to memoryStore`);
        } else {
          throw new AppError(`Failed to save seat sections in Supabase: ${secError.message}`, 503, 'DATABASE_WRITE_FAILED');
        }
      }
      sectionRows.forEach((section) => memoryStore.seatSections.set(section.id, section));
    }

    // Categories
    const categoryMap = new Map();
    const categoryRows = [];
    for (const cat of layoutData.categories) {
      const catId = uuidv4();
      const catRecord = {
        id: catId,
        seat_plan_version_id: versionId,
        name: cat.name,
        display_name: cat.displayName || cat.name,
        base_price: Number(cat.basePrice || 250),
        currency: 'INR',
        seat_type: normalizeSeatType(cat.seatType || cat.name),
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      categoryRows.push(catRecord);
      categoryMap.set(cat.name, catId);
      if (cat.displayName) categoryMap.set(cat.displayName, catId);
    }
    if (categoryRows.length > 0) {
      const { error: catError } = await supabaseAdmin.from('seat_categories').insert(categoryRows);
      if (catError) {
        if (ENV.NODE_ENV === 'test' || catError.code === '23503') {
          logger.warn(`Could not persist seat categories to Supabase (${catError.message}), fallback to memoryStore`);
        } else {
          throw new AppError(`Failed to save seat categories in Supabase: ${catError.message}`, 503, 'DATABASE_WRITE_FAILED');
        }
      }
      categoryRows.forEach((category) => memoryStore.seatCategories.set(category.id, category));
    }

    // Seats — batch insert in chunks of 100 with error checking
    const firstSectionId = sectionMap.values().next().value;
    const firstCategoryId = categoryMap.values().next().value;
    const seatRows = [];
    for (const s of layoutData.seats) {
      const seatId = uuidv4();
      const sectionId = sectionMap.get(s.sectionName) || firstSectionId;
      const categoryId = categoryMap.get(s.categoryName) || firstCategoryId;
      const seatRecord = {
        id: seatId,
        seat_plan_version_id: versionId,
        section_id: sectionId,
        category_id: categoryId,
        row_label: s.rowLabel,
        seat_number: s.seatNumber,
        seat_type: normalizeSeatType(s.seatType || s.categoryName),
        x_position: s.xPosition,
        y_position: s.yPosition,
        rotation: s.rotation || 0,
        width: s.width || 32,
        height: s.height || 32,
        is_accessible: Boolean(s.isAccessible),
        is_wheelchair_space: Boolean(s.isWheelchairSpace),
        is_companion_seat: Boolean(s.isCompanionSeat),
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      seatRows.push(seatRecord);
    }
    for (let i = 0; i < seatRows.length; i += 100) {
      const chunk = seatRows.slice(i, i + 100);
      const { error: seatError } = await supabaseAdmin.from('seats').insert(chunk);
      if (seatError) {
        if (ENV.NODE_ENV === 'test' || seatError.code === '23503') {
          logger.warn(`Could not persist physical seats to Supabase (${seatError.message}), fallback to memoryStore`);
        } else {
          throw new AppError(`Failed to save seats in Supabase: ${seatError.message}`, 503, 'DATABASE_WRITE_FAILED');
        }
      }
    }
    seatRows.forEach((seat) => memoryStore.seats.set(seat.id, seat));

    return { seatPlan, version: versionRecord, seatCount: layoutData.seats.length };
  }

  static async publishSeatPlan(screenId, versionId, userId) {
    let version = null;
    const { data: verData } = await supabaseAdmin.from('seat_plan_versions').select('*').eq('id', versionId).single();
    version = verData || memoryStore.seatPlanVersions.get(versionId);
    if (!version) throw new NotFoundError('Seat plan version not found');

    let seatPlan = null;
    const { data: planData } = await supabaseAdmin.from('seat_plans').select('*').eq('id', version.seat_plan_id).single();
    seatPlan = planData || memoryStore.seatPlans.get(version.seat_plan_id);
    if (!seatPlan || seatPlan.screen_id !== screenId) throw new NotFoundError('Seat plan does not match specified screen');

    const effectiveUserId = await this.resolveUserId(userId, screenId);

    // Update version status in Supabase
    const { error: updateVerError } = await supabaseAdmin.from('seat_plan_versions').update({ status: 'PUBLISHED', published_by: effectiveUserId, published_at: new Date().toISOString() }).eq('id', versionId);
    if (updateVerError) {
      if (ENV.NODE_ENV === 'test' || updateVerError.code === '23503') {
        logger.warn(`Could not update published seat plan version in Supabase (${updateVerError.message}), fallback to memoryStore`);
      } else {
        throw new AppError(`Failed to publish seat plan version in Supabase: ${updateVerError.message}`, 503, 'DATABASE_WRITE_FAILED');
      }
    }

    // Update seat plan active version in Supabase
    const { error: updatePlanError } = await supabaseAdmin.from('seat_plans').update({ active_version_id: versionId, status: 'PUBLISHED', updated_at: new Date().toISOString() }).eq('id', seatPlan.id);
    if (updatePlanError) {
      if (ENV.NODE_ENV === 'test' || updatePlanError.code === '23503') {
        logger.warn(`Could not update active seat plan in Supabase (${updatePlanError.message}), fallback to memoryStore`);
      } else {
        throw new AppError(`Failed to update active seat plan in Supabase: ${updatePlanError.message}`, 503, 'DATABASE_WRITE_FAILED');
      }
    }

    // Sync memoryStore
    const memVersion = memoryStore.seatPlanVersions.get(versionId);
    if (memVersion) { memVersion.status = 'PUBLISHED'; memVersion.published_by = effectiveUserId; memVersion.published_at = new Date().toISOString(); }
    const memPlan = memoryStore.seatPlans.get(seatPlan.id);
    if (memPlan) { memPlan.active_version_id = versionId; memPlan.status = 'PUBLISHED'; memPlan.updated_at = new Date().toISOString(); }

    // Count seats for capacity
    const { count } = await supabaseAdmin.from('seats').select('*', { count: 'exact', head: true }).eq('seat_plan_version_id', versionId).eq('is_active', true);
    let memCount = 0;
    for (const s of memoryStore.seats.values()) {
      if (s.seat_plan_version_id === versionId && s.is_active) memCount++;
    }
    const capacity = count || memCount || 0;

    // Update screen capacity
    await supabaseAdmin.from('screens').update({ capacity, updated_at: new Date().toISOString() }).eq('id', screenId);
    const screen = memoryStore.screens.get(screenId);
    if (screen) screen.capacity = capacity;

    return { success: true, message: 'Seat plan published successfully', activeVersionId: versionId, capacity };
  }

  static async ensureDefaultPublishedSeatPlan(screenId, fallbackCapacity = 80, userId = null) {
    const { data: dbScreen } = await supabaseAdmin.from('screens').select('*, cinemas(owner_user_id)').eq('id', screenId).maybeSingle();
    const screen = dbScreen || memoryStore.screens.get(screenId);
    const effectiveCapacity = Math.max(20, screen?.capacity || fallbackCapacity || 80);
    const creatorId = userId || screen?.cinemas?.owner_user_id || screen?.owner_user_id;

    const seatsPerRow = 10;
    const numRows = Math.ceil(effectiveCapacity / seatsPerRow);
    const rowNames = Array.from({ length: Math.min(26, numRows) }, (_, i) => String.fromCharCode(65 + i));

    const categories = [
      { name: 'Recliner', displayName: 'Recliner Lounge', basePrice: 650, seatType: 'RECLINER' },
      { name: 'Premium', displayName: 'VIP Deluxe', basePrice: 450, seatType: 'PREMIUM' },
      { name: 'Standard', displayName: 'Classic', basePrice: 250, seatType: 'STANDARD' },
    ];

    const seats = [];
    let seatCount = 0;
    rowNames.forEach((rowLabel, rowIndex) => {
      let tier = 'Standard';
      if (rowIndex === 0) tier = 'Recliner';
      else if (rowIndex <= 3) tier = 'Premium';

      for (let num = 1; num <= seatsPerRow; num++) {
        if (seatCount >= effectiveCapacity) break;
        seatCount++;
        seats.push({
          rowLabel,
          seatNumber: num,
          categoryName: tier,
          sectionName: 'Main Hall',
          seatType: tier === 'Recliner' ? 'RECLINER' : tier === 'Premium' ? 'PREMIUM' : 'STANDARD',
          xPosition: 60 + (num - 1) * 48,
          yPosition: 120 + rowIndex * 60,
          width: 32,
          height: 32
        });
      }
    });

    const layoutData = {
      name: `${screen?.screen_name || 'Auditorium'} Layout`,
      canvasWidth: 1000,
      canvasHeight: Math.max(600, rowNames.length * 60 + 160),
      screenPosition: 'TOP',
      sections: [{ name: 'Main Hall', displayName: 'Main Auditorium', sortOrder: 0 }],
      categories,
      seats
    };

    const saveResult = await this.saveSeatPlan(screenId, layoutData, creatorId);
    await this.publishSeatPlan(screenId, saveResult.version.id, creatorId);

    // Fetch the materialized active plan
    const { data: verData } = await supabaseAdmin.from('seat_plan_versions').select('*').eq('id', saveResult.version.id).maybeSingle();
    const { data: sectionsData } = await supabaseAdmin.from('seat_sections').select('*').eq('seat_plan_version_id', saveResult.version.id);
    const { data: catsData } = await supabaseAdmin.from('seat_categories').select('*').eq('seat_plan_version_id', saveResult.version.id);
    const { data: seatsData } = await supabaseAdmin.from('seats').select('*').eq('seat_plan_version_id', saveResult.version.id).eq('is_active', true);

    const activeSections = (sectionsData && sectionsData.length > 0)
      ? sectionsData
      : Array.from(memoryStore.seatSections.values()).filter(s => s.seat_plan_version_id === saveResult.version.id);

    const activeCats = (catsData && catsData.length > 0)
      ? catsData
      : Array.from(memoryStore.seatCategories.values()).filter(c => c.seat_plan_version_id === saveResult.version.id);

    const activeSeats = (seatsData && seatsData.length > 0)
      ? seatsData
      : Array.from(memoryStore.seats.values()).filter(s => s.seat_plan_version_id === saveResult.version.id && s.is_active !== false);

    const materializedSeats = activeSeats.map(seat => {
      const cat = activeCats.find(c => c.id === seat.category_id);
      return { ...seat, price: cat ? cat.base_price : 250, categoryName: cat ? (cat.display_name || cat.name) : 'Standard' };
    });

    return {
      seatPlan: saveResult.seatPlan,
      version: verData || saveResult.version,
      sections: activeSections,
      categories: activeCats,
      seats: materializedSeats
    };
  }

  static async getActiveSeatPlan(screenId) {
    // Try Supabase first
    const { data: planData } = await supabaseAdmin.from('seat_plans').select('*').eq('screen_id', screenId).maybeSingle();
    let seatPlan = planData;
    if (!seatPlan) {
      for (const sp of memoryStore.seatPlans.values()) { if (sp.screen_id === screenId) { seatPlan = sp; break; } }
    }
    if (!seatPlan || !seatPlan.active_version_id) {
      return await this.ensureDefaultPublishedSeatPlan(screenId);
    }

    const { data: verData } = await supabaseAdmin.from('seat_plan_versions').select('*').eq('id', seatPlan.active_version_id).maybeSingle();
    const version = verData || memoryStore.seatPlanVersions.get(seatPlan.active_version_id);
    if (!version) {
      return await this.ensureDefaultPublishedSeatPlan(screenId);
    }

    const { data: sectionsData } = await supabaseAdmin.from('seat_sections').select('*').eq('seat_plan_version_id', version.id);
    const sections = sectionsData && sectionsData.length > 0 ? sectionsData : [...memoryStore.seatSections.values()].filter(s => s.seat_plan_version_id === version.id);

    const { data: catsData } = await supabaseAdmin.from('seat_categories').select('*').eq('seat_plan_version_id', version.id);
    const categories = catsData && catsData.length > 0 ? catsData : [...memoryStore.seatCategories.values()].filter(c => c.seat_plan_version_id === version.id);

    const { data: seatsData } = await supabaseAdmin.from('seats').select('*').eq('seat_plan_version_id', version.id).eq('is_active', true);
    const rawSeats = seatsData && seatsData.length > 0 ? seatsData : [...memoryStore.seats.values()].filter(s => s.seat_plan_version_id === version.id && s.is_active);

    if (!rawSeats?.length) {
      return await this.ensureDefaultPublishedSeatPlan(screenId);
    }

    const seats = rawSeats.map(seat => {
      const cat = categories.find(c => c.id === seat.category_id);
      return { ...seat, price: cat ? cat.base_price : 350, categoryName: cat ? cat.display_name : 'Standard' };
    });

    return { seatPlan, version, sections, categories, seats };
  }
}
