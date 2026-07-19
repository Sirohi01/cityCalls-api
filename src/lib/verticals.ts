import { MasterModel } from '../modules/config/master.model';
import { ServiceModel } from '../modules/catalog/catalog.model';

// A "vertical" groups several SERVICE_CATEGORY masters together (e.g.
// Beauty & Salon = SALON_FOR_WOMEN + SALON_FOR_MEN + SPA_MASSAGE, three real
// pre-existing categories, not one) via each category's free-form `meta`
// field (meta.vertical) — no schema change, and it generalizes to any future
// vertical without touching this file. Reused by every list endpoint that
// needs to filter down to "this vertical's data" (catalog, service requests,
// customers) so the category->service join logic lives in exactly one place.
export async function resolveVerticalCategoryIds(vertical: string) {
  const categories = await MasterModel.find({ masterType: 'SERVICE_CATEGORY', 'meta.vertical': vertical }).select('_id');
  return categories.map((c) => c._id);
}

export async function resolveVerticalServiceIds(vertical: string) {
  const categoryIds = await resolveVerticalCategoryIds(vertical);
  if (categoryIds.length === 0) return [];

  const services = await ServiceModel.find({ categoryId: { $in: categoryIds } }).select('_id');
  return services.map((s) => s._id);
}
