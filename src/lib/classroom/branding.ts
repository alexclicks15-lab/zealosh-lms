// Zealosh LMS — Classroom Branding Configuration
// Central configuration decoupling internal repository identifiers from customer-facing product names and visual assets.

export interface ClassroomBrandingTheme {
  primaryColor: string;
  secondaryColor: string;
  greyColor: string;
  headerColor: string;
  accentColor: string;
  surfaceColor: string;
  backgroundColor: string;
  borderColor: string;
}

export interface ClassroomBrandingConfig {
  /**
   * Internal repository and architecture identifier
   */
  readonly internalIdentifier: string;

  /**
   * Customer-facing platform name displayed in navigation, title bars, and modals
   */
  customerFacingName: string;

  /**
   * Convenient alias for customerFacingName
   */
  brandName: string;

  /**
   * Path or URL to customer-facing logo
   */
  logoUrl: string;

  /**
   * Path or URL to favicon
   */
  faviconUrl: string;

  /**
   * Theme palette calibrated to Zealosh visual identity
   */
  theme: ClassroomBrandingTheme;

  // Direct color convenience accessors
  primaryColor: string;
  secondaryColor: string;
  greyColor: string;
  headerColor: string;

  /**
   * Support URL and email
   */
  supportUrl?: string;
  supportEmail?: string;

  /**
   * Legal attribution line displayed in platform footer (maintains license compliance)
   */
  legalAttribution?: string;
}

/**
 * Authoritative Default Branding Configuration for Zealosh Virtual Classroom
 * Note: The final customer-facing brand name remains undecided.
 * 'zealosh-classroom' is used strictly as an internal repository and infrastructure identifier.
 */
export const defaultClassroomBranding: ClassroomBrandingConfig = {
  internalIdentifier: 'zealosh-classroom',
  customerFacingName: process.env.NEXT_PUBLIC_CLASSROOM_BRAND_NAME || 'Zealosh Live Classroom',
  brandName: process.env.NEXT_PUBLIC_CLASSROOM_BRAND_NAME || 'Zealosh Live Classroom',
  logoUrl: '/logo.png',
  faviconUrl: '/favicon.ico',
  theme: {
    primaryColor: '#4E8C4A',     // Official Zealosh Primary Green
    secondaryColor: '#8CBF4D',   // Official Zealosh Secondary Green
    greyColor: '#ACACAC',        // Official Zealosh Grey
    headerColor: '#3a7536',      // Zealosh Forest Header
    accentColor: '#8CBF4D',      // Zealosh Accent
    surfaceColor: '#ffffff',     // Clean Surface
    backgroundColor: '#ffffff',  // Page Background
    borderColor: '#e2efe1',      // Subtle Green-Tinted Border
  },
  primaryColor: '#4E8C4A',
  secondaryColor: '#8CBF4D',
  greyColor: '#ACACAC',
  headerColor: '#3a7536',
  supportUrl: 'https://zealosh.com/support',
  supportEmail: 'support@zealosh.com',
  legalAttribution: 'Powered by Zealosh Learning Infrastructure',
};

export function getClassroomBranding(): ClassroomBrandingConfig {
  const customerFacingName =
    process.env.NEXT_PUBLIC_CLASSROOM_BRAND_NAME || defaultClassroomBranding.customerFacingName;
  return {
    ...defaultClassroomBranding,
    customerFacingName,
    brandName: customerFacingName,
  };
}

export function formatClassroomTitle(sessionTitle: string): string {
  const branding = getClassroomBranding();
  return `${branding.customerFacingName} — ${sessionTitle}`;
}

export function getBrandedWelcomeMessage(sessionTitle: string): string {
  const branding = getClassroomBranding();
  return `<b>Welcome to ${branding.customerFacingName}!</b><br>Session: ${sessionTitle}<br>For live assistance or technical inquiries, contact ${branding.supportEmail || 'support@zealosh.com'}.`;
}
