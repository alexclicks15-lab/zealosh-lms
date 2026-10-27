---
name: backlink-and-offpage-seo
description: >-
  Backlink analysis, off-page SEO strategy, link auditing, competitor backlink profiling, anchor text optimization,
  and toxic link remediation. Use this skill when analyzing backlink profiles, conducting link gap analysis,
  evaluating referring domain authority, planning outreach, or resolving spam/penalty risks.
---

# Backlink Analysis & Off-Page SEO Runbook

This skill provides comprehensive methodologies and analytical frameworks for evaluating backlink profiles, discovering link acquisition opportunities, auditing anchor text distribution, and safeguarding domain authority.

---

## 1. Backlink Profile Health Metrics

When evaluating the link equity and authority of a domain, analyze the following core dimensions:

1. **Referring Domains (RD) vs. Total Backlinks**:
   - High ratio of RD to backlinks indicates natural distribution.
   - Massive spikes in backlinks from a single domain without editorial justification suggest sitewide links, footer links, or spam.
2. **Domain Rating (DR) / Domain Authority (DA) Distribution**:
   - Tier 1 (DR 70+): High-authority editorial publications, major industry media, university/government resources (.edu/.gov).
   - Tier 2 (DR 40–69): Niche industry blogs, reputable SaaS blogs, established local business directories.
   - Tier 3 (DR 15–39): Emerging industry websites, niche communities, contextual forum references.
   - Tier 4 (DR < 15 / Spam): PBNs, automated link farms, comment spam, scraper portals.
3. **Follow vs. NoFollow / UGC / Sponsored Ratio**:
   - Healthy natural distribution typically exhibits 65–85% `dofollow` and 15–35% `nofollow`/`ugc`/`sponsored`.
   - 100% `dofollow` profiles with commercial anchors often trigger search engine algorithmic scrutiny.
4. **Topical Relevance Score**:
   - Links from contextually and topically relevant domains in the same or adjacent niches deliver significantly higher ranking value than unrelated high-DA links.

---

## 2. Anchor Text Distribution Matrix

Audit anchor text composition to prevent over-optimization penalties:

| Anchor Text Category | Target Healthy Ratio | Example Pattern |
| :--- | :--- | :--- |
| **Branded** | 40% – 60% | `"BrandName"`, `"BrandName Tech"`, `"brandname.com"` |
| **Naked URL** | 15% – 25% | `https://example.com/`, `example.com/product` |
| **Generic / Neutral** | 10% – 15% | `"visit website"`, `"source"`, `"learn more"`, `"click here"` |
| **Topic / Partial Match** | 10% – 20% | `"best headless ecommerce guide by BrandName"`, `"fast database tools"` |
| **Exact Match (Commercial)** | < 5% | `"buy wedding cakes online"`, `"best crm software"` |

> **Warning:** Exceeding 10% exact-match commercial anchor text on external backlinks creates severe algorithmic risk (Google Penguin / SpamBrain).

---

## 3. Competitor Backlink Gap Analysis

Follow this structured workflow to discover high-yield link acquisition targets:

```
Step 1: Competitor Matrix
  └── Identify 3-5 top organic competitors ranking for core commercial/informational search queries.

Step 2: Intersection Analysis (Link Intersect)
  └── Query domains linking to 2 or more competitors, but NOT linking to the target website.
  └── These domains have a proven propensity to cover the niche.

Step 3: Content Asset Evaluation
  └── Identify competitor URLs with the highest referring domain counts ("Link Magnets").
  └── Categorize linkable asset types: Original research, free tools/calculators, benchmarks, data studies, ultimate guides.

Step 4: Value Proposition & Outreach Hook
  └── Create 10x superior content, updated data, or a free interactive tool.
  └── Reach out with specific editorial value, broken link replacements, or expert commentary.
```

---

## 4. Toxic Link Auditing & Google Disavow Protocol

### Identification Criteria for Toxic Links:
- Automated scraper networks and scraper directories.
- Russian/Chinese link farms with unrelated foreign anchor text on an English/domestic website.
- Sites with high Moz Spam Score (> 30%) or manual action penalties.
- Hidden text links, hacked site injections, or sitewide footer links with commercial anchors.
- Low-quality article directories and syndication farms.

### Google Disavow File Format (`disavow.txt`):
```text
# Disavow file generated on YYYY-MM-DD
# Contacted webmasters with zero response for removal

# Domain-level disavows (Recommended for spam networks)
domain:spammydirectoryfarm.com
domain:pbn-network-node14.net
domain:lowqualitylinkmarket.info

# Specific page-level disavows
http://unrelatedsite.com/hacked-page-with-injected-link.html
```

---

## 5. Off-Page Link Building Strategies

1. **Digital PR & Original Industry Data**:
   - Conduct original surveys, publish state-of-the-industry reports, or analyze anonymized platform data to earn organic press citations.
2. **Resource Page & Broken Link Building**:
   - Find authoritative curated resource lists with 404 dead links using crawlers. Offer your working, superior guide as an updated replacement.
3. **Unlinked Brand Mentions**:
   - Monitor web citations of your brand name, founders, or proprietary tools. Reach out politely to request converting plain text mentions to contextual links.
4. **Strategic Ecosystem & Integration Partnerships**:
   - Partner with technology vendors, open-source libraries, integration directories, and complementary service providers for reciprocal directory listings.
5. **Thought Leadership & Expert Roundups**:
   - Contribute high-signal technical case studies, podcast interviews, and conference presentations with authoritative citations.

---

## 6. Comprehensive Off-Page SEO Audit Checklist

- [ ] Total Referring Domains vs. Total Backlinks ratio evaluated.
- [ ] New vs. Lost referring domain trend monitored for unnatural drops or spam velocity.
- [ ] Anchor text distribution classified and verified within safe thresholds (< 5% exact match).
- [ ] Top linked pages evaluated (homepage vs. deep content vs. commercial landing pages).
- [ ] Geographic and TLD distribution inspected (unusual TLD spikes flagged).
- [ ] Competitor link gaps mapped to content creation roadmap.
- [ ] Toxic/malicious link audit performed and disavow document maintained if necessary.
