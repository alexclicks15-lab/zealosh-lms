# Page-by-Page Extraction & Analysis Template

Use this exact structure for EVERY page discovered during a website audit.

```markdown
### Page [Number] — [Page Title / URL]

**PAGE:** [Page Name]
**URL:** [Full URL or Relative Path]
**HTTP STATUS:** [200 / 301 / 404 / 500]

#### PAGE SUMMARY
[2–5 sentence plain-language explanation of what this page does, why it exists, and what value it provides to the user and business.]

#### PAGE PURPOSE
[Primary business goal and user objective for this page.]

#### TARGET USER
[Who this page is intended for — first-time visitors, returning customers, wholesale buyers, admins, etc.]

#### PAGE TYPE
[Homepage | Landing Page | Category / Catalog | Product Detail | Cart | Checkout | Account / Profile | Dashboard | Content / Blog | Legal / Terms | Support / Help]

#### CONTENT STRUCTURE
1. **[Section 1 Name]** — [Brief description of content & intent]
2. **[Section 2 Name]** — [Brief description of content & intent]
3. **[Section 3 Name]** — [Brief description of content & intent]
4. ...

#### VISIBLE CONTENT
- **Headings:**
  - H1: "[Exact H1 text]"
  - H2: "[Exact H2 text]", "[Exact H2 text]"
  - H3: "[Exact H3 text]"
- **Body & Value Prop:** [Summary of main body copy, key claims, features]
- **Key Messages & Banners:** [Promotional banners, trust badges, alert notices]
- **Labels & Microcopy:** [Input placeholders, helper text, badges]

#### CALLS TO ACTION (CTAs)
- **Primary CTA:** "[Button text]" $\rightarrow$ `[Destination URL]` ([Visual emphasis / placement])
- **Secondary CTA:** "[Button text]" $\rightarrow$ `[Destination URL]`
- **Micro / Inline CTAs:** "[Text]" $\rightarrow$ `[Destination URL]`

#### USER JOURNEY & FLOW
- **Entry Points:** [How users land on this page]
- **What the Page Asks the User to Do:** [Next logical action]
- **Exit Paths:** [Where users navigate next upon completion or drop-off]

#### NAVIGATION & LINKS
- **Internal Links (In):** [Pages linking to this URL]
- **Internal Links (Out):** [Pages this URL links out to]
- **External Links:** [Outbound external links, social links]
- **Breadcrumbs:** [Breadcrumb path if present]

#### INTERACTIVE ELEMENTS
- **Forms:** [Form fields, required validations, submit triggers]
- **Buttons & Toggles:** [Filter pills, weight/variant selectors, quantity steppers]
- **Dynamic Widgets:** [Accordions, Carousels, Tabs, Modals, Search autocomplete]

#### IMAGES & MEDIA
- **Hero / Banner Media:** [Image / Video URL, description]
- **Alt Text Assessment:** [Present / Missing / Generic / Descriptive]
- **Interactive Visuals:** [Lottie animations, canvas interactives, 3D models]

#### SEO & TECHNICAL STRUCTURE
- **Title Tag:** `[Exact <title> tag]` ([Character count / Quality])
- **Meta Description:** `[Exact meta description]` ([Character count / Quality])
- **Heading Hierarchy:** [Valid single H1 / Nested correctly / Skipped levels]
- **Canonical Tag:** `[Canonical URL]`
- **Robots / Indexability:** `[index, follow / noindex]`
- **Structured Data (JSON-LD):** [Product / Organization / BreadcrumbList / None]
- **Open Graph Tags:** [og:title, og:image, og:description status]

#### UX ASSESSMENT
- **Strengths:** [What works well, intuitive layouts, crisp hierarchy]
- **Friction & Usability Gaps:** [Confusing layouts, cognitive overload, cluttered sections]
- **Missing Information:** [Unanswered user questions, missing specifications]

#### CONVERSION & PERSUASION
- **Conversion Drivers:** [Strong social proof, clear pricing, clear guarantee]
- **Conversion Blockers:** [Hidden pricing, ambiguous CTAs, missing trust badges]
- **Objection Handling:** [Addressed vs neglected user doubts]

#### TECHNICAL & ACCESSIBILITY QA
- **Broken Links / 404s:** [None / List of broken links]
- **Staging / Localhost References:** [None / Found occurrences]
- **Accessibility (a11y):** [Contrast, ARIA labels, keyboard focus, screen-reader readiness]
- **Console / JS Errors:** [Observed runtime warnings or errors]

#### PRIORITY & RECOMMENDATIONS
- **Priority Level:** `[🔴 CRITICAL | 🟡 HIGH | 🔵 MEDIUM | 🟢 LOW]`
- **Actionable Recommendations:**
  1. `[Actionable fix 1 with specific before -> after text or layout suggestion]`
  2. `[Actionable fix 2]`
  3. `[Actionable fix 3]`
```
