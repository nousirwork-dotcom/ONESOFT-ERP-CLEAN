import { z } from 'zod';
import { router, protectedProcedure, publicProcedure } from '../trpc.js';
import { db } from '../db.js';
import { organizations } from '../schema.js';
import { eq } from 'drizzle-orm';

export const DEFAULT_BRANDING = {
  primary_color:              '#406B93',
  secondary_color:            '#E4DFDA',
  accent_color:               '#EEF3F7',
  background_color:           '#ECE7DD',
  card_background_color:      '#FFFFFF',
  text_color:                 '#2F2F2F',
  button_color:               '#406B93',
  button_text_color:          '#FFFFFF',
  logo_url:                   null as string | null,
  login_background_type:      'gradient' as 'gradient' | 'solid' | 'image',
  login_background_value:     'linear-gradient(145deg, #E8E0D4 0%, #D4CCC0 40%, #C8C0B4 100%)',
  border_radius:              8,
  font_size:                  13,
  sidebar_color:              '#132238',
  sidebar_text_color:         '#E5E7EB',
  sidebar_active_color:       '#406B93',
  opening_transition:         'none'       as 'none' | 'fade' | 'slide' | 'zoom' | 'split_center',
  view_mode:                  'normal'     as 'normal' | 'compact' | 'wide',
  fullscreen_on_start:        false,
  remember_window_size:       true,
  remember_last_opened_tabs:  false,
  startup_page:               'dashboard'  as 'dashboard' | 'sales' | 'pos' | 'accounting' | 'last_opened',
};

export type BrandingSettings = typeof DEFAULT_BRANDING;

function canManageBranding(user: { role: string; extraPermissions?: Record<string, boolean> | null }): boolean {
  if (['admin', 'superadmin'].includes(user.role)) return true;
  return user.extraPermissions?.manage_branding === true;
}

const BrandingInputSchema = z.object({
  primary_color:              z.string().optional(),
  secondary_color:            z.string().optional(),
  accent_color:               z.string().optional(),
  background_color:           z.string().optional(),
  card_background_color:      z.string().optional(),
  text_color:                 z.string().optional(),
  button_color:               z.string().optional(),
  button_text_color:          z.string().optional(),
  logo_url:                   z.string().nullable().optional(),
  login_background_type:      z.enum(['gradient', 'solid', 'image']).optional(),
  login_background_value:     z.string().optional(),
  border_radius:              z.number().min(0).max(24).optional(),
  font_size:                  z.number().min(10).max(18).optional(),
  sidebar_color:              z.string().optional(),
  sidebar_text_color:         z.string().optional(),
  sidebar_active_color:       z.string().optional(),
  opening_transition:         z.enum(['none', 'fade', 'slide', 'zoom', 'split_center']).optional(),
  view_mode:                  z.enum(['normal', 'compact', 'wide']).optional(),
  fullscreen_on_start:        z.boolean().optional(),
  remember_window_size:       z.boolean().optional(),
  remember_last_opened_tabs:  z.boolean().optional(),
  startup_page:               z.enum(['dashboard', 'sales', 'pos', 'accounting', 'last_opened']).optional(),
}).passthrough();

async function fetchOrgBranding(orgId?: number): Promise<BrandingSettings> {
  try {
    const org = orgId
      ? await db.query.organizations.findFirst({ where: eq(organizations.id, orgId) })
      : await db.query.organizations.findFirst();
    if (!org) return DEFAULT_BRANDING;
    const stored = org.themeSettings as Partial<BrandingSettings> | null;
    return { ...DEFAULT_BRANDING, ...(stored ?? {}) };
  } catch {
    return DEFAULT_BRANDING;
  }
}

export const brandingRouter = router({

  getSettings: publicProcedure
    .query(async () => fetchOrgBranding()),

  getSettingsAuth: protectedProcedure
    .query(async ({ ctx }) => fetchOrgBranding(ctx.user.orgId)),

  saveSettings: protectedProcedure
    .input(BrandingInputSchema)
    .mutation(async ({ input, ctx }) => {
      const user = ctx.user;
      if (!canManageBranding({ role: user.role, extraPermissions: user.extraPermissions as Record<string, boolean> | null })) {
        throw new Error('هذه العملية تتطلب صلاحية "إدارة هوية النظام"');
      }
      const current = await fetchOrgBranding(user.orgId);
      const merged = { ...current, ...input };
      await db.update(organizations)
        .set({ themeSettings: merged, updatedAt: new Date() })
        .where(eq(organizations.id, user.orgId));
      return { success: true, settings: merged };
    }),

  resetSettings: protectedProcedure
    .mutation(async ({ ctx }) => {
      const user = ctx.user;
      if (!canManageBranding({ role: user.role, extraPermissions: user.extraPermissions as Record<string, boolean> | null })) {
        throw new Error('هذه العملية تتطلب صلاحية "إدارة هوية النظام"');
      }
      await db.update(organizations)
        .set({ themeSettings: null, updatedAt: new Date() })
        .where(eq(organizations.id, user.orgId));
      return { success: true, settings: DEFAULT_BRANDING };
    }),
});
