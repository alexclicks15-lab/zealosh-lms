// Zealosh LMS — Admissions CRM & Public Lead Service
// Captures inquiries, tracks outreach, and converts leads to admission applications
// File: src/lib/admissions/lead-service.ts

import { Lead, LeadStatus } from '@/types';
import { supabaseAdapter } from '@/lib/store/supabase-adapter';
import { db } from '@/lib/store/db';

const inMemoryLeads = new Map<string, Lead>();

// Seed a realistic initial lead for baseline demonstration
if (inMemoryLeads.size === 0) {
  const seedLead: Lead = {
    id: 'lead-seed-01',
    fullName: 'Arjun Menon',
    email: 'arjun.menon@petrocon.ae',
    phone: '+971 50 123 4567',
    courseInterest: 'crs-asp-001',
    offeringInterest: 'offering-asp-complete',
    source: 'WEBSITE',
    campaign: 'linkedin_safety_mena_q4',
    status: 'NEW',
    notes: 'Safety officer at Abu Dhabi offshore refinery. Seeking BCSP ASP certification preparation.',
    createdAt: '2026-11-01T08:30:00.000Z',
    updatedAt: '2026-11-01T08:30:00.000Z',
  };
  inMemoryLeads.set(seedLead.id, seedLead);
}

export class LeadService {
  public static resetForTesting() {
    inMemoryLeads.clear();
  }

  public static async createLead(params: {
    fullName: string;
    email: string;
    phone?: string;
    courseInterest?: string;
    offeringInterest?: string;
    source?: string;
    campaign?: string;
    notes?: string;
  }): Promise<Lead> {
    if (!params.fullName || !params.email) {
      throw new Error('Full name and email are required');
    }

    const email = params.email.trim().toLowerCase();
    const now = new Date().toISOString();
    const id = `lead-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

    const lead: Lead = {
      id,
      fullName: params.fullName.trim(),
      email,
      phone: params.phone?.trim(),
      courseInterest: params.courseInterest,
      offeringInterest: params.offeringInterest,
      source: params.source || 'WEBSITE',
      campaign: params.campaign,
      status: 'NEW',
      notes: params.notes,
      createdAt: now,
      updatedAt: now,
    };

    inMemoryLeads.set(id, lead);

    const client = supabaseAdapter.getClient();
    if (client) {
      try {
        await client.from('leads').insert({
          id: lead.id,
          full_name: lead.fullName,
          email: lead.email,
          phone: lead.phone,
          course_interest: lead.courseInterest,
          offering_interest: lead.offeringInterest,
          source: lead.source,
          campaign: lead.campaign,
          status: lead.status,
          notes: lead.notes,
          created_at: lead.createdAt,
          updated_at: lead.updatedAt,
        });
      } catch {
        // Fallback
      }
    }

    return lead;
  }

  public static async getLeads(filter?: {
    status?: LeadStatus;
    search?: string;
    courseInterest?: string;
  }): Promise<Lead[]> {
    const client = supabaseAdapter.getClient();
    if (client) {
      try {
        let query = client.from('leads').select('*');
        if (filter?.status) query = query.eq('status', filter.status);
        if (filter?.courseInterest) query = query.eq('course_interest', filter.courseInterest);
        const { data, error } = await query;
        if (!error && data && data.length > 0) {
          let list = data.map((d: any) => ({
            id: d.id,
            fullName: d.full_name,
            email: d.email,
            phone: d.phone,
            courseInterest: d.course_interest,
            offeringInterest: d.offering_interest,
            source: d.source,
            campaign: d.campaign,
            status: d.status,
            assignedTo: d.assigned_to,
            notes: d.notes,
            convertedApplicationId: d.converted_application_id,
            createdAt: d.created_at,
            updatedAt: d.updated_at,
          }));
          if (filter?.search) {
            const q = filter.search.toLowerCase();
            list = list.filter(
              (l: Lead) =>
                l.fullName.toLowerCase().includes(q) ||
                l.email.toLowerCase().includes(q) ||
                (l.phone && l.phone.includes(q))
            );
          }
          return list.sort(
            (a: Lead, b: Lead) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        }
      } catch {
        // Fallback
      }
    }

    let list = Array.from(inMemoryLeads.values());
    if (filter?.status) {
      list = list.filter((l) => l.status === filter.status);
    }
    if (filter?.courseInterest) {
      list = list.filter((l) => l.courseInterest === filter.courseInterest);
    }
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      list = list.filter(
        (l) =>
          l.fullName.toLowerCase().includes(q) ||
          l.email.toLowerCase().includes(q) ||
          (l.phone && l.phone.includes(q))
      );
    }
    return list.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public static async getLeadById(id: string): Promise<Lead | null> {
    const client = supabaseAdapter.getClient();
    if (client) {
      try {
        const { data, error } = await client.from('leads').select('*').eq('id', id).maybeSingle();
        if (!error && data) {
          return {
            id: data.id,
            fullName: data.full_name,
            email: data.email,
            phone: data.phone,
            courseInterest: data.course_interest,
            offeringInterest: data.offering_interest,
            source: data.source,
            campaign: data.campaign,
            status: data.status,
            assignedTo: data.assigned_to,
            notes: data.notes,
            convertedApplicationId: data.converted_application_id,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
          };
        }
      } catch {
        // Fallback
      }
    }

    return inMemoryLeads.get(id) || null;
  }

  public static async updateLead(
    id: string,
    updates: Partial<Omit<Lead, 'id' | 'createdAt'>>
  ): Promise<Lead> {
    const lead = inMemoryLeads.get(id);
    if (!lead) {
      throw new Error(`Lead ${id} not found`);
    }

    const updated: Lead = {
      ...lead,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    inMemoryLeads.set(id, updated);

    const client = supabaseAdapter.getClient();
    if (client) {
      try {
        await client
          .from('leads')
          .update({
            full_name: updated.fullName,
            email: updated.email,
            phone: updated.phone,
            status: updated.status,
            assigned_to: updated.assignedTo,
            notes: updated.notes,
            converted_application_id: updated.convertedApplicationId,
            updated_at: updated.updatedAt,
          })
          .eq('id', id);
      } catch {
        // Fallback
      }
    }

    return updated;
  }

  /**
   * Convert an existing lead to a formal admission application
   */
  public static async convertLeadToApplication(
    leadId: string,
    params?: {
      preferredBatchId?: string;
      statementOfPurpose?: string;
    }
  ): Promise<{ lead: Lead; application: any }> {
    const lead = await this.getLeadById(leadId);
    if (!lead) {
      throw new Error(`Lead ${leadId} not found`);
    }

    const courseId = lead.courseInterest || 'crs-asp-001';

    // Create formal application via db
    const application = await db.createAdmissionApplication({
      applicantName: lead.fullName,
      applicantEmail: lead.email,
      applicantPhone: lead.phone,
      courseId,
      preferredBatchId: params?.preferredBatchId,
      statementOfPurpose:
        params?.statementOfPurpose ||
        `Converted from lead inquiry (${lead.source || 'Website'}: ${lead.notes || 'Inquiry'})`,
    });

    const updatedLead = await this.updateLead(leadId, {
      status: 'CONVERTED',
      convertedApplicationId: application.id,
      notes: `${lead.notes || ''}\n[Converted to Admission Application ${application.applicationNumber} on ${new Date().toISOString()}]`.trim(),
    });

    return { lead: updatedLead, application };
  }
}

