// Zealosh LMS — Enterprise Relational CMS & Visual PageBuilder Domain Types
// Standards: wj-page-builder separation of structure and content, strict typing

export type CmsPageType = 'HOMEPAGE' | 'STANDARD' | 'COURSE_LANDING' | 'ADMISSIONS' | 'CAMPAIGN';

export type CmsVersionStatus =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'PUBLISHED'
  | 'ARCHIVED';

export type CmsNodeType =
  | 'SECTION'
  | 'CONTAINER'
  | 'ROW'
  | 'COLUMN'
  | 'CONTENT_REGION'
  | 'COMPONENT';

export interface CmsSeoMetadata {
  title?: string;
  description?: string;
  canonicalUrl?: string;
  ogImage?: string;
  noIndex?: boolean;
  keywords?: string[];
  structuredData?: Record<string, any>;
}

export interface CmsPage {
  id: string;
  slug: string;
  title: string;
  pageType: CmsPageType;
  status: CmsVersionStatus;
  currentDraftVersionId?: string;
  publishedVersionId?: string;
  scheduledPublishAt?: string;
  scheduledVersionId?: string;
  seoMetadata: CmsSeoMetadata;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CmsPageVersion {
  id: string;
  pageId: string;
  versionNumber: number;
  status: CmsVersionStatus;
  changeSummary?: string;
  rejectionReason?: string;
  createdBy: string;
  approvedBy?: string;
  publishedAt?: string;
  scheduledPublishAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CmsDynamicBinding {
  source: 'course' | 'batch' | 'instructor' | 'platform_settings';
  entityId?: string;
  field: string;
  fallback?: string;
}

export interface CmsNodeStyles {
  backgroundColor?: string;
  textColor?: string;
  padding?: string;
  margin?: string;
  borderRadius?: string;
  border?: string;
  boxShadow?: string;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  customClass?: string;
}

export interface CmsResponsiveStyles {
  desktop?: Partial<CmsNodeStyles> & { colSpan?: number; hidden?: boolean };
  tablet?: Partial<CmsNodeStyles> & { colSpan?: number; hidden?: boolean };
  mobile?: Partial<CmsNodeStyles> & { colSpan?: number; hidden?: boolean };
}

export interface CmsPageNode {
  id: string;
  pageVersionId: string;
  parentId?: string | null;
  nodeType: CmsNodeType;
  componentType: string;
  position: number;
  props: Record<string, any>;
  styles: CmsNodeStyles;
  responsiveStyles: CmsResponsiveStyles;
  dynamicBinding?: CmsDynamicBinding | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  children?: CmsPageNode[];
}

export interface CmsTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  templateType: 'PAGE' | 'SECTION';
  previewImageUrl?: string;
  nodesSnapshot: CmsPageNode[];
  createdBy: string;
  createdAt: string;
}

export interface CmsReusableBlock {
  id: string;
  name: string;
  category: string;
  nodesSnapshot: CmsPageNode[];
  createdBy: string;
  createdAt: string;
}

export interface CmsPublicationRecord {
  id: string;
  pageId: string;
  versionId: string;
  publishedBy: string;
  publishedAt: string;
  snapshotChecksum: string;
}

export type CmsPublicationJobStatus = 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface CmsScheduledPublicationJob {
  id: string;
  pageId: string;
  versionId: string;
  scheduledAt: string;
  scheduledBy: string;
  status: CmsPublicationJobStatus;
  attemptCount: number;
  maxAttempts: number;
  lockedAt?: string;
  lockedBy?: string;
  completedAt?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ComponentDefinition {
  type: string;
  name: string;
  category: 'layout' | 'content' | 'media' | 'presentation' | 'academic' | 'interactive';
  description: string;
  iconName: string;
  nodeType: CmsNodeType;
  allowedParents: string[];
  allowedChildren: string[];
  isRootAllowed: boolean;
  isDuplicable: boolean;
  isDeletable: boolean;
  defaultProps: Record<string, any>;
  defaultStyles: CmsNodeStyles;
  defaultResponsiveStyles: CmsResponsiveStyles;
}

