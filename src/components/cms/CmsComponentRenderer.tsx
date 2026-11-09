'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ShieldCheck,
  Award,
  Users,
  Video,
  BookOpen,
  Clock,
  ArrowRight,
  CheckCircle2,
  Calendar,
  FileSpreadsheet,
  ChevronDown,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { CmsPageNode, CmsResponsiveStyles } from '@/types/cms';
import { sanitizeUrl, sanitizeHtml } from '@/lib/cms/sanitizer';

interface CmsComponentRendererProps {
  node: CmsPageNode;
  isEditorMode?: boolean;
  selectedNodeId?: string | null;
  onSelectNode?: (nodeId: string) => void;
  previewViewport?: 'desktop' | 'tablet' | 'mobile';
  allNodesMap?: Map<string, CmsPageNode>;
}

export function CmsComponentRenderer({
  node,
  isEditorMode = false,
  selectedNodeId = null,
  onSelectNode,
  previewViewport = 'desktop',
  allNodesMap,
}: CmsComponentRendererProps) {
  const isSelected = isEditorMode && selectedNodeId === node.id;
  const [activeTabIndex, setActiveTabIndex] = useState<number>(node.props?.activeTab || 0);
  const [openAccordionIds, setOpenAccordionIds] = useState<Record<string, boolean>>(node.props?.defaultOpenIds || {});

  const handleClick = (e: React.MouseEvent) => {
    if (isEditorMode && onSelectNode) {
      e.stopPropagation();
      onSelectNode(node.id);
    }
  };

  // Derive responsive styles based on active viewport
  const viewportStyles = node.responsiveStyles?.[previewViewport] || {};
  const mergedStyles: React.CSSProperties = {
    backgroundColor: viewportStyles.backgroundColor || node.styles?.backgroundColor,
    color: viewportStyles.textColor || node.styles?.textColor,
    padding: viewportStyles.padding || node.styles?.padding,
    margin: viewportStyles.margin || node.styles?.margin,
    borderRadius: viewportStyles.borderRadius || node.styles?.borderRadius,
    border: viewportStyles.border || node.styles?.border,
    boxShadow: viewportStyles.boxShadow || node.styles?.boxShadow,
    textAlign: (viewportStyles.textAlign || node.styles?.textAlign || 'left') as any,
  };

  const editorOverlayClasses = isEditorMode
    ? `relative transition-all duration-150 cursor-pointer ${
        isSelected
          ? 'ring-2 ring-[#4f8c4c] ring-offset-2 z-20'
          : 'hover:ring-1 hover:ring-emerald-400/60'
      }`
    : '';

  // Render children recursively
  const renderChildren = () => {
    if (!node.children || node.children.length === 0) return null;
    return node.children.map((child) => (
      <CmsComponentRenderer
        key={child.id}
        node={child}
        isEditorMode={isEditorMode}
        selectedNodeId={selectedNodeId}
        onSelectNode={onSelectNode}
        previewViewport={previewViewport}
        allNodesMap={allNodesMap}
      />
    ));
  };

  // --------------------------------------------------------------------------
  // 1. SECTION
  // --------------------------------------------------------------------------
  if (node.componentType === 'section') {
    return (
      <section
        id={node.props?.anchorId || undefined}
        onClick={handleClick}
        style={mergedStyles}
        className={`w-full overflow-hidden ${editorOverlayClasses}`}
      >
        {isEditorMode && isSelected && (
          <div className="absolute top-1 left-2 bg-[#4f8c4c] text-white text-[10px] font-bold px-2 py-0.5 rounded-sm shadow-xs uppercase tracking-wider pointer-events-none z-30">
            Section: {node.props?.anchorId || node.id.substring(0, 8)}
          </div>
        )}
        {renderChildren()}
      </section>
    );
  }

  // --------------------------------------------------------------------------
  // 2. CONTAINER
  // --------------------------------------------------------------------------
  if (node.componentType === 'container') {
    const maxWidth = node.props?.fluid ? '100%' : node.props?.maxWidth || '1280px';
    return (
      <div
        onClick={handleClick}
        style={{ ...mergedStyles, maxWidth }}
        className={`mx-auto w-full ${editorOverlayClasses}`}
      >
        {isEditorMode && isSelected && (
          <div className="absolute top-1 left-2 bg-emerald-700 text-white text-[10px] font-bold px-2 py-0.5 rounded-sm shadow-xs uppercase tracking-wider pointer-events-none z-30">
            Container
          </div>
        )}
        {renderChildren()}
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // 3. ROW
  // --------------------------------------------------------------------------
  if (node.componentType === 'row') {
    return (
      <div
        onClick={handleClick}
        style={{
          ...mergedStyles,
          display: 'flex',
          flexWrap: node.props?.wrap !== false ? 'wrap' : 'nowrap',
          justifyContent: node.props?.justify || 'start',
          alignItems: node.props?.align || 'stretch',
          gap: node.props?.gap || '1.5rem',
        }}
        className={`w-full ${editorOverlayClasses}`}
      >
        {renderChildren()}
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // 4. COLUMN (wj-page-builder column-content encapsulation)
  // --------------------------------------------------------------------------
  if (node.componentType === 'column') {
    const colSpan = viewportStyles.colSpan || node.props?.colSpan || 12;
    // Calculate width percentage based on 12-column grid
    const widthPercent = (colSpan / 12) * 100;

    return (
      <div
        onClick={handleClick}
        style={{
          width: `${widthPercent}%`,
          maxWidth: `${widthPercent}%`,
          flex: `0 0 ${widthPercent}%`,
        }}
        className={`min-w-0 ${editorOverlayClasses}`}
      >
        {/* Protected column-content wrapper to insulate leaf contents from grid resizing */}
        <div className="column-content w-full h-full" style={mergedStyles}>
          {renderChildren()}
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // 5. CONTENT REGION
  // --------------------------------------------------------------------------
  if (node.componentType === 'content_region') {
    return (
      <div onClick={handleClick} style={mergedStyles} className={`w-full ${editorOverlayClasses}`}>
        {renderChildren()}
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // 6. HEADING
  // --------------------------------------------------------------------------
  if (node.componentType === 'heading') {
    const text = node.props?.text || 'Heading Text';
    const level = node.props?.level || 'h2';
    const baseClass = 'font-black tracking-tight leading-tight';

    let HeadingTag: any = 'h2';
    let sizeClass = 'text-2xl sm:text-3xl text-slate-900';

    if (level === 'h1') {
      HeadingTag = 'h1';
      sizeClass = 'text-3xl sm:text-4xl lg:text-5xl text-slate-900';
    } else if (level === 'h3') {
      HeadingTag = 'h3';
      sizeClass = 'text-xl sm:text-2xl text-slate-800';
    } else if (level === 'h4') {
      HeadingTag = 'h4';
      sizeClass = 'text-lg sm:text-xl text-slate-800';
    }

    return (
      <HeadingTag
        onClick={handleClick}
        style={mergedStyles}
        className={`${baseClass} ${sizeClass} ${editorOverlayClasses}`}
      >
        {text}
      </HeadingTag>
    );
  }

  // --------------------------------------------------------------------------
  // 7. PARAGRAPH
  // --------------------------------------------------------------------------
  if (node.componentType === 'paragraph') {
    const text = node.props?.text || '';
    const isLead = Boolean(node.props?.lead);
    const sizeClass = isLead ? 'text-lg sm:text-xl text-slate-600 font-medium' : 'text-base text-slate-600';

    return (
      <p
        onClick={handleClick}
        style={mergedStyles}
        className={`${sizeClass} leading-relaxed ${editorOverlayClasses}`}
      >
        {text}
      </p>
    );
  }

  // --------------------------------------------------------------------------
  // 8. RICH TEXT (Server-Sanitized)
  // --------------------------------------------------------------------------
  if (node.componentType === 'rich_text') {
    const rawHtml = node.props?.html || '';
    const safeHtml = sanitizeHtml(rawHtml);

    return (
      <div
        onClick={handleClick}
        style={mergedStyles}
        className={`prose prose-slate max-w-none ${editorOverlayClasses}`}
        dangerouslySetInnerHTML={{ __html: safeHtml }}
      />
    );
  }

  // --------------------------------------------------------------------------
  // 9. BUTTON
  // --------------------------------------------------------------------------
  if (node.componentType === 'button') {
    const label = node.props?.label || 'Learn More';
    const safeHref = sanitizeUrl(node.props?.href);
    const variant = node.props?.variant || 'primary';

    let btnStyle = 'btn-primary';
    if (variant === 'secondary') btnStyle = 'btn-secondary';
    else if (variant === 'outline') btnStyle = 'border-2 border-[#4f8c4c] text-[#3a7536] hover:bg-[#e8f3e7]';

    return (
      <div onClick={handleClick} className={`inline-block ${editorOverlayClasses}`}>
        {isEditorMode ? (
          <span className={`${btnStyle} px-6 py-2.5 rounded-lg font-bold text-sm shadow-sm inline-flex items-center gap-2`}>
            <span>{label}</span>
            <ArrowRight className="w-4 h-4" />
          </span>
        ) : (
          <Link
            href={safeHref}
            style={mergedStyles}
            className={`${btnStyle} px-6 py-2.5 rounded-lg font-bold text-sm shadow-sm inline-flex items-center gap-2`}
          >
            <span>{label}</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        )}
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // 10. IMAGE
  // --------------------------------------------------------------------------
  if (node.componentType === 'image') {
    const url = node.props?.url || '/logo.png';
    const alt = node.props?.alt || 'Zealosh Image';

    return (
      <div onClick={handleClick} style={mergedStyles} className={`overflow-hidden ${editorOverlayClasses}`}>
        <img
          src={url}
          alt={alt}
          className="w-full h-auto object-cover rounded-md shadow-xs"
        />
        {node.props?.caption && (
          <p className="text-xs text-slate-500 mt-1.5 italic text-center">{node.props.caption}</p>
        )}
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // 11. BLOCKQUOTE
  // --------------------------------------------------------------------------
  if (node.componentType === 'quote') {
    return (
      <div
        onClick={handleClick}
        style={mergedStyles}
        className={`border-l-4 border-[#4f8c4c] bg-slate-50 p-4 rounded-r-lg ${editorOverlayClasses}`}
      >
        <p className="text-base italic text-slate-700">"{node.props?.quote}"</p>
        <div className="mt-2 text-sm font-bold text-slate-900">
          {node.props?.author}
          {node.props?.role && <span className="font-normal text-slate-500"> — {node.props.role}</span>}
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // 12. FEATURE LIST
  // --------------------------------------------------------------------------
  if (node.componentType === 'list') {
    const items: string[] = node.props?.items || [];
    return (
      <ul onClick={handleClick} style={mergedStyles} className={`space-y-2.5 ${editorOverlayClasses}`}>
        {items.map((item, idx) => (
          <li key={idx} className="flex items-start gap-2.5 text-sm text-slate-700">
            <CheckCircle2 className="w-4 h-4 text-[#4f8c4c] shrink-0 mt-0.5" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    );
  }

  // --------------------------------------------------------------------------
  // 13. HERO BANNER
  // --------------------------------------------------------------------------
  if (node.componentType === 'hero') {
    return (
      <div onClick={handleClick} style={mergedStyles} className={`w-full py-4 text-center sm:text-left ${editorOverlayClasses}`}>
        <div className="inline-flex items-center gap-2 bg-[#e8f3e7] border border-emerald-300 text-[#245921] text-xs font-bold px-3 py-1.5 rounded-full mb-4">
          <ShieldCheck className="w-4 h-4 text-[#4f8c4c]" />
          <span>{node.props?.badge || 'OFFICIAL ZEALOSH HSE CERTIFICATION ACADEMY'}</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight max-w-4xl mb-4">
          {node.props?.headline || 'Master Your HSE Certification Examinations'}
        </h1>

        <p className="text-base sm:text-lg text-slate-600 max-w-3xl leading-relaxed mb-6">
          {node.props?.subtitle || 'Accelerate your occupational safety career with elite mentorship.'}
        </p>

        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <Link
            href={sanitizeUrl(node.props?.primaryCtaHref || '/courses')}
            className="btn-primary w-full sm:w-auto px-6 py-3 justify-center shadow-md hover:shadow-lg"
          >
            <span>{node.props?.primaryCtaText || 'View Upcoming Batches'}</span>
            <ArrowRight className="w-4 h-4" />
          </Link>

          <Link
            href={sanitizeUrl(node.props?.secondaryCtaHref || '/exams')}
            className="btn-secondary w-full sm:w-auto px-6 py-3 justify-center shadow-xs"
          >
            <span>{node.props?.secondaryCtaText || 'Launch Mock Exam Engine'}</span>
          </Link>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // 14. STATS COUNTER
  // --------------------------------------------------------------------------
  if (node.componentType === 'stats_counter') {
    const stats: Array<{ value: string; label: string }> = node.props?.stats || [];
    return (
      <div
        onClick={handleClick}
        style={mergedStyles}
        className={`grid grid-cols-1 sm:grid-cols-3 gap-4 w-full ${editorOverlayClasses}`}
      >
        {stats.map((s, idx) => (
          <div key={idx} className="glass-card-subtle p-4 text-center rounded-xl border border-emerald-100 shadow-xs">
            <div className="text-3xl font-black text-slate-900">{s.value}</div>
            <div className="text-xs font-semibold text-slate-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // 15. COURSE CARDS GRID
  // --------------------------------------------------------------------------
  if (node.componentType === 'course_cards') {
    // Standard accredited courses showcase
    const defaultCourses = [
      {
        slug: 'asp-examination-preparation',
        title: 'Associate Safety Professional (ASP®)',
        badge: 'BCSP® Accredited',
        headline: 'Comprehensive preparation with 1,200+ high-yield calculation questions.',
        duration: '8 Weeks (Live)',
      },
      {
        slug: 'csp-examination-preparation',
        title: 'Certified Safety Professional (CSP®)',
        badge: 'Gold Standard HSE',
        headline: 'Master advanced hazard control, ergonomics, industrial hygiene, and risk management.',
        duration: '10 Weeks (Live)',
      },
      {
        slug: 'crsp-examination-preparation',
        title: 'Canadian Registered Safety Professional (CRSP®)',
        badge: 'BCRSP® Certified',
        headline: 'Authoritative Canadian safety regulations, occupational hygiene, and environmental stewardship.',
        duration: '8 Weeks (Live)',
      },
    ];

    return (
      <div onClick={handleClick} style={mergedStyles} className={`w-full ${editorOverlayClasses}`}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {defaultCourses.map((c, idx) => (
            <div
              key={idx}
              className="bg-white border border-[#e2efe1] hover:border-[#4f8c4c] rounded-xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <span className="badge-green text-[10px] font-bold uppercase">{c.badge}</span>
                <h3 className="text-lg font-black text-slate-900 mt-3 mb-2">{c.title}</h3>
                <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">{c.headline}</p>
              </div>
              <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-semibold">{c.duration}</span>
                <Link
                  href={`/courses/${c.slug}`}
                  className="text-[#3a7536] hover:text-[#4f8c4c] font-bold flex items-center gap-1"
                >
                  <span>Explore</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // 16. INTERACTIVE TABS (wj-page-builder interactive references)
  // --------------------------------------------------------------------------
  if (node.componentType === 'tabs') {
    const tabs: Array<{ id: string; title: string; content: string }> = node.props?.tabs || [];
    const activeTab = tabs[activeTabIndex] || tabs[0];

    return (
      <div onClick={handleClick} style={mergedStyles} className={`w-full ${editorOverlayClasses}`}>
        {/* Tab Navigation */}
        <div role="tablist" aria-label="Content Tabs" className="flex border-b border-slate-200 gap-2 mb-4 overflow-x-auto">
          {tabs.map((tab, idx) => {
            const isTabActive = idx === activeTabIndex;
            return (
              <button
                key={tab.id || idx}
                type="button"
                role="tab"
                aria-selected={isTabActive}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveTabIndex(idx);
                }}
                className={`py-2 px-4 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${
                  isTabActive
                    ? 'border-[#4f8c4c] text-[#3a7536] bg-emerald-50/50'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                {tab.title}
              </button>
            );
          })}
        </div>

        {/* Active Pane */}
        {activeTab && (
          <div role="tabpanel" className="p-4 bg-slate-50 rounded-lg border border-slate-200/80 text-sm text-slate-700 leading-relaxed">
            {activeTab.content}
          </div>
        )}
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // 17. ACCORDION / FAQ (wj-page-builder interactive references)
  // --------------------------------------------------------------------------
  if (node.componentType === 'accordion') {
    const items: Array<{ id: string; title: string; content: string }> = node.props?.items || [];

    const toggleItem = (itemId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setOpenAccordionIds((prev) => ({
        ...prev,
        [itemId]: !prev[itemId],
      }));
    };

    return (
      <div onClick={handleClick} style={mergedStyles} className={`w-full space-y-3 ${editorOverlayClasses}`}>
        {items.map((item, idx) => {
          const isOpen = Boolean(openAccordionIds[item.id]);
          return (
            <div
              key={item.id || idx}
              className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-xs transition-all"
            >
              <button
                type="button"
                onClick={(e) => toggleItem(item.id, e)}
                aria-expanded={isOpen}
                className="w-full py-3.5 px-4 text-left font-bold text-sm text-slate-800 hover:bg-slate-50 flex items-center justify-between gap-4 transition-colors"
              >
                <span>{item.title}</span>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                    isOpen ? 'rotate-180 text-[#4f8c4c]' : ''
                  }`}
                />
              </button>
              {isOpen && (
                <div className="py-3 px-4 text-xs sm:text-sm text-slate-600 bg-slate-50/70 border-t border-slate-100 leading-relaxed">
                  {item.content}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // Fallback for unknown node types
  return (
    <div onClick={handleClick} style={mergedStyles} className={`p-4 border border-dashed border-slate-300 rounded-md text-xs text-slate-400 ${editorOverlayClasses}`}>
      <span>Component: {node.componentType}</span>
      {renderChildren()}
    </div>
  );
}

