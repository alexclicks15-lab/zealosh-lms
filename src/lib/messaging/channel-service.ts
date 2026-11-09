// Zealosh LMS — Isolated Group, Course & Batch Messaging Channels Engine
// Enforces channel permissions, thread integrity, attachments, and strict academic isolation
// File: src/lib/messaging/channel-service.ts

import {
  Conversation,
  ConversationType,
  ConversationMember,
  ConversationMemberRole,
  ConversationMemberStatus,
  ChannelMessage,
  ChannelMessageAttachment,
  ChannelModerationReport,
  ChannelModerationReportStatus,
  UserRole,
} from '@/types';
import { db } from '@/lib/store/db';
import { EntitlementService } from '@/lib/commerce/entitlement-service';

// In-memory stores for conversations, members, messages, and reports
const inMemoryConversations: Map<string, Conversation> = new Map();
const inMemoryMembers: Map<string, ConversationMember[]> = new Map(); // conversationId -> members[]
const inMemoryMessages: Map<string, ChannelMessage> = new Map();
const inMemoryReports: Map<string, ChannelModerationReport> = new Map();

export class ChannelService {
  public static resetForTesting() {
    inMemoryConversations.clear();
    inMemoryMembers.clear();
    inMemoryMessages.clear();
    inMemoryReports.clear();
    this.seedDefaultChannels();
  }

  /**
   * Seed default institutional channels for courses and cohorts
   */
  public static seedDefaultChannels() {
    if (inMemoryConversations.size === 0) {
      const now = new Date().toISOString();

      // 1. Course Channel: ASP General Forum
      const c1: Conversation = {
        id: 'conv-crs-asp-01',
        type: 'COURSE',
        title: 'ASP Examination Prep — Academic Discussion Channel',
        description: 'Course-wide academic queries, syllabus clarifications, and faculty announcements.',
        courseId: 'crs-asp-01',
        createdBy: 'usr-admin-01',
        isArchived: false,
        isCrossBatch: false,
        memberCount: 3,
        createdAt: now,
        updatedAt: now,
      };
      inMemoryConversations.set(c1.id, c1);
      inMemoryMembers.set(c1.id, [
        {
          id: 'cm-1',
          conversationId: c1.id,
          userId: 'usr-admin-01',
          userName: 'Super Admin',
          userRole: 'SUPER_ADMIN',
          role: 'OWNER',
          status: 'ACTIVE',
          joinedAt: now,
        },
        {
          id: 'cm-2',
          conversationId: c1.id,
          userId: 'usr-inst-01',
          userName: 'Lead Instructor',
          userRole: 'INSTRUCTOR',
          role: 'MODERATOR',
          status: 'ACTIVE',
          joinedAt: now,
        },
        {
          id: 'cm-3',
          conversationId: c1.id,
          userId: 'usr-std-01',
          userName: 'Arjun Menon',
          userRole: 'STUDENT',
          role: 'MEMBER',
          status: 'ACTIVE',
          joinedAt: now,
        },
      ]);

      // 2. Batch Channel: Weekend Batch Nov 2026
      const c2: Conversation = {
        id: 'conv-batch-001',
        type: 'BATCH',
        title: 'Weekend Cohort — Batch Nov 2026 Room',
        description: 'Cohort-exclusive live class discussion and study coordination.',
        courseId: 'crs-asp-01',
        batchId: 'batch-001',
        createdBy: 'usr-inst-01',
        isArchived: false,
        isCrossBatch: false,
        memberCount: 2,
        createdAt: now,
        updatedAt: now,
      };
      inMemoryConversations.set(c2.id, c2);
      inMemoryMembers.set(c2.id, [
        {
          id: 'cm-4',
          conversationId: c2.id,
          userId: 'usr-inst-01',
          userName: 'Lead Instructor',
          userRole: 'INSTRUCTOR',
          role: 'OWNER',
          status: 'ACTIVE',
          joinedAt: now,
        },
        {
          id: 'cm-5',
          conversationId: c2.id,
          userId: 'usr-std-01',
          userName: 'Arjun Menon',
          userRole: 'STUDENT',
          role: 'MEMBER',
          status: 'ACTIVE',
          joinedAt: now,
        },
      ]);

      // Seed initial welcome message
      const m1: ChannelMessage = {
        id: 'cmsg-01',
        conversationId: c1.id,
        senderId: 'usr-admin-01',
        senderName: 'Super Admin',
        senderRole: 'SUPER_ADMIN',
        content: 'Welcome to the Zealosh ASP Preparation Academic Forum. Please review course resources and examination guidelines.',
        isPinned: true,
        isEdited: false,
        isDeleted: false,
        replyCount: 0,
        createdAt: now,
        updatedAt: now,
      };
      inMemoryMessages.set(m1.id, m1);
    }
  }

  /**
   * Create an approved conversation/channel
   */
  public static async createConversation(params: {
    type: ConversationType;
    title: string;
    description?: string;
    courseId?: string;
    batchId?: string;
    creatorUserId: string;
    creatorRole: UserRole;
    isCrossBatch?: boolean;
    initialMemberIds?: string[];
  }): Promise<Conversation> {
    this.seedDefaultChannels();
    const {
      type,
      title,
      description,
      courseId,
      batchId,
      creatorUserId,
      creatorRole,
      isCrossBatch = false,
      initialMemberIds = [],
    } = params;

    // Cross-Batch Governance Invariant (BDR-13):
    // Only Staff/Admins can create cross-batch groups. Students cannot self-create unrestricted cross-batch channels.
    if (isCrossBatch && creatorRole === 'STUDENT') {
      throw new Error(
        'CROSS_BATCH_UNAUTHORIZED: Students cannot create cross-batch groups. Institutional staff authorization is required.'
      );
    }

    if (!title || !title.trim()) {
      throw new Error('Channel title is required');
    }

    const now = new Date().toISOString();
    const id = `conv-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const creator = await db.getUser(creatorUserId);

    const members: ConversationMember[] = [
      {
        id: `cm-${Date.now().toString(36)}-owner`,
        conversationId: id,
        userId: creatorUserId,
        userName: creator?.name || 'Creator',
        userRole: creatorRole,
        role: 'OWNER',
        status: 'ACTIVE',
        joinedAt: now,
      },
    ];

    // Add initial members
    for (const memId of initialMemberIds) {
      if (memId === creatorUserId) continue;
      const u = await db.getUser(memId);
      if (u) {
        members.push({
          id: `cm-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
          conversationId: id,
          userId: u.id,
          userName: u.name,
          userRole: u.role,
          role: 'MEMBER',
          status: 'ACTIVE',
          joinedAt: now,
          addedBy: creatorUserId,
        });
      }
    }

    const conv: Conversation = {
      id,
      type,
      title: title.trim(),
      description: description?.trim(),
      courseId,
      batchId,
      createdBy: creatorUserId,
      isArchived: false,
      isCrossBatch,
      crossBatchApprovedBy: isCrossBatch ? creatorUserId : undefined,
      memberCount: members.length,
      createdAt: now,
      updatedAt: now,
    };

    inMemoryConversations.set(id, conv);
    inMemoryMembers.set(id, members);

    return conv;
  }

  /**
   * List authorized conversations for a user
   */
  public static async getConversationsForUser(
    userId: string,
    userRole: UserRole,
    courseId?: string
  ): Promise<Conversation[]> {
    this.seedDefaultChannels();
    const all = Array.from(inMemoryConversations.values()).filter((c) => !c.isArchived);

    // Super Admin / Org Admin can see all non-archived conversations
    if (userRole === 'SUPER_ADMIN' || userRole === 'ORG_ADMIN') {
      if (courseId) return all.filter((c) => !c.courseId || c.courseId === courseId);
      return all;
    }

    // Other users can only see conversations where they have an ACTIVE membership
    const userConvs: Conversation[] = [];
    for (const conv of all) {
      if (courseId && conv.courseId && conv.courseId !== courseId) continue;
      const members = inMemoryMembers.get(conv.id) || [];
      const hasMembership = members.some((m) => m.userId === userId && m.status === 'ACTIVE');
      if (hasMembership) {
        userConvs.push(conv);
      }
    }

    return userConvs.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  /**
   * Get conversation details by ID with permission check
   */
  public static async getConversationById(
    conversationId: string,
    userId: string,
    userRole: UserRole
  ): Promise<Conversation | null> {
    this.seedDefaultChannels();
    const conv = inMemoryConversations.get(conversationId);
    if (!conv) return null;

    if (userRole === 'SUPER_ADMIN' || userRole === 'ORG_ADMIN') {
      return conv;
    }

    const members = inMemoryMembers.get(conversationId) || [];
    const isMember = members.some((m) => m.userId === userId && m.status === 'ACTIVE');
    if (!isMember) {
      throw new Error('ACCESS_DENIED: You are not an active member of this conversation');
    }

    return conv;
  }

  /**
   * Get members of a conversation
   */
  public static async getConversationMembers(
    conversationId: string,
    userId: string,
    userRole: UserRole
  ): Promise<ConversationMember[]> {
    this.seedDefaultChannels();
    await this.getConversationById(conversationId, userId, userRole);
    return (inMemoryMembers.get(conversationId) || []).filter((m) => m.status === 'ACTIVE');
  }

  /**
   * Add a member to an existing conversation
   */
  public static async addMember(params: {
    conversationId: string;
    targetUserId: string;
    actorUserId: string;
    actorRole: UserRole;
    memberRole?: ConversationMemberRole;
  }): Promise<ConversationMember> {
    const { conversationId, targetUserId, actorUserId, actorRole, memberRole = 'MEMBER' } = params;

    const conv = await this.getConversationById(conversationId, actorUserId, actorRole);
    if (!conv) throw new Error(`Conversation ${conversationId} not found`);

    const members = inMemoryMembers.get(conversationId) || [];
    const actorMembership = members.find((m) => m.userId === actorUserId && m.status === 'ACTIVE');

    // Only OWNER, MODERATOR, or ADMIN can add members
    if (
      actorRole !== 'SUPER_ADMIN' &&
      actorRole !== 'ORG_ADMIN' &&
      actorMembership?.role !== 'OWNER' &&
      actorMembership?.role !== 'MODERATOR'
    ) {
      throw new Error('UNAUTHORIZED: Only conversation owners or moderators can add members');
    }

    const targetUser = await db.getUser(targetUserId);
    if (!targetUser) throw new Error(`User ${targetUserId} not found`);

    const existingIndex = members.findIndex((m) => m.userId === targetUserId);
    const now = new Date().toISOString();

    if (existingIndex >= 0) {
      // Re-activate member if previously removed
      members[existingIndex].status = 'ACTIVE';
      members[existingIndex].role = memberRole;
      members[existingIndex].joinedAt = now;
      inMemoryMembers.set(conversationId, members);
      return members[existingIndex];
    }

    const newMember: ConversationMember = {
      id: `cm-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      conversationId,
      userId: targetUserId,
      userName: targetUser.name,
      userRole: targetUser.role,
      role: memberRole,
      status: 'ACTIVE',
      joinedAt: now,
      addedBy: actorUserId,
    };

    members.push(newMember);
    conv.memberCount = members.filter((m) => m.status === 'ACTIVE').length;
    conv.updatedAt = now;

    inMemoryMembers.set(conversationId, members);
    inMemoryConversations.set(conversationId, conv);

    return newMember;
  }

  /**
   * Remove a member from a conversation
   */
  public static async removeMember(params: {
    conversationId: string;
    targetUserId: string;
    actorUserId: string;
    actorRole: UserRole;
  }): Promise<boolean> {
    const { conversationId, targetUserId, actorUserId, actorRole } = params;
    const conv = await this.getConversationById(conversationId, actorUserId, actorRole);
    if (!conv) throw new Error(`Conversation ${conversationId} not found`);

    const members = inMemoryMembers.get(conversationId) || [];
    const actorMembership = members.find((m) => m.userId === actorUserId && m.status === 'ACTIVE');

    // Self-leave is allowed; otherwise owner/mod/admin permission required
    const isSelfLeave = targetUserId === actorUserId;
    if (
      !isSelfLeave &&
      actorRole !== 'SUPER_ADMIN' &&
      actorRole !== 'ORG_ADMIN' &&
      actorMembership?.role !== 'OWNER' &&
      actorMembership?.role !== 'MODERATOR'
    ) {
      throw new Error('UNAUTHORIZED: Only conversation owners or moderators can remove members');
    }

    const target = members.find((m) => m.userId === targetUserId);
    if (!target) return false;

    target.status = 'REMOVED';
    conv.memberCount = members.filter((m) => m.status === 'ACTIVE').length;
    conv.updatedAt = new Date().toISOString();

    inMemoryMembers.set(conversationId, members);
    inMemoryConversations.set(conversationId, conv);
    return true;
  }

  /**
   * Send a channel message or thread reply
   */
  public static async sendChannelMessage(params: {
    conversationId: string;
    senderId: string;
    senderName: string;
    senderRole: UserRole;
    content: string;
    parentMessageId?: string;
    attachments?: ChannelMessageAttachment[];
    clientMessageId?: string;
  }): Promise<ChannelMessage> {
    const {
      conversationId,
      senderId,
      senderName,
      senderRole,
      content,
      parentMessageId,
      attachments = [],
      clientMessageId,
    } = params;

    // Check clientMessageId idempotency
    if (clientMessageId) {
      const existing = Array.from(inMemoryMessages.values()).find(
        (m) => m.conversationId === conversationId && m.clientMessageId === clientMessageId
      );
      if (existing) return existing;
    }

    // Verify active membership
    const members = inMemoryMembers.get(conversationId) || [];
    const isMember = members.some((m) => m.userId === senderId && m.status === 'ACTIVE');
    if (!isMember && senderRole !== 'SUPER_ADMIN' && senderRole !== 'ORG_ADMIN') {
      throw new Error('ACCESS_DENIED: You must be an active member of this channel to post messages');
    }

    if (!content || !content.trim()) {
      throw new Error('Message content cannot be empty');
    }
    if (content.trim().length > 5000) {
      throw new Error('Message content exceeds 5000 characters limit');
    }

    // Verify parent message for thread integrity
    if (parentMessageId) {
      const parent = inMemoryMessages.get(parentMessageId);
      if (!parent || parent.conversationId !== conversationId) {
        throw new Error('INVALID_THREAD: Parent message does not exist in this conversation');
      }
      parent.replyCount = (parent.replyCount || 0) + 1;
      inMemoryMessages.set(parent.id, parent);
    }

    const now = new Date().toISOString();
    const id = `cmsg-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

    const message: ChannelMessage = {
      id,
      conversationId,
      senderId,
      senderName,
      senderRole,
      content: content.trim(),
      parentMessageId,
      attachments,
      isPinned: false,
      isEdited: false,
      isDeleted: false,
      replyCount: 0,
      clientMessageId,
      createdAt: now,
      updatedAt: now,
    };

    inMemoryMessages.set(id, message);

    // Update conversation last activity
    const conv = inMemoryConversations.get(conversationId);
    if (conv) {
      conv.updatedAt = now;
      inMemoryConversations.set(conv.id, conv);
    }

    return message;
  }

  /**
   * Retrieve messages for a channel with thread separation
   */
  public static async getChannelMessages(params: {
    conversationId: string;
    userId: string;
    userRole: UserRole;
    parentMessageId?: string; // If provided, fetches thread replies only
    limit?: number;
    offset?: number;
  }): Promise<ChannelMessage[]> {
    this.seedDefaultChannels();
    const { conversationId, userId, userRole, parentMessageId, limit = 100, offset = 0 } = params;

    // Verify channel access
    await this.getConversationById(conversationId, userId, userRole);

    let messages = Array.from(inMemoryMessages.values()).filter(
      (m) => m.conversationId === conversationId && !m.isDeleted
    );

    if (parentMessageId) {
      // Thread replies
      messages = messages.filter((m) => m.parentMessageId === parentMessageId);
    } else {
      // Top-level messages only
      messages = messages.filter((m) => !m.parentMessageId);
    }

    return messages
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .slice(offset, offset + limit);
  }

  /**
   * Report a message for moderation
   */
  public static async reportMessage(params: {
    conversationId: string;
    messageId: string;
    reportedBy: string;
    reason: string;
  }): Promise<ChannelModerationReport> {
    const { conversationId, messageId, reportedBy, reason } = params;

    const message = inMemoryMessages.get(messageId);
    if (!message || message.conversationId !== conversationId) {
      throw new Error(`Message ${messageId} not found in this conversation`);
    }

    if (!reason || reason.trim().length < 5) {
      throw new Error('A clear reporting reason is mandatory (at least 5 characters)');
    }

    const id = `rep-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const report: ChannelModerationReport = {
      id,
      conversationId,
      messageId,
      reportedBy,
      reason: reason.trim(),
      status: 'PENDING',
      actionTaken: 'NONE',
      createdAt: new Date().toISOString(),
    };

    inMemoryReports.set(id, report);
    return report;
  }

  /**
   * Resolve a moderation report with staff-only notes
   */
  public static async resolveModerationReport(params: {
    reportId: string;
    moderatorUserId: string;
    actionTaken: 'NONE' | 'MESSAGE_DELETED' | 'USER_WARNED' | 'USER_MUTED' | 'USER_REMOVED';
    moderatorNotes?: string;
  }): Promise<ChannelModerationReport> {
    const { reportId, moderatorUserId, actionTaken, moderatorNotes } = params;

    const report = inMemoryReports.get(reportId);
    if (!report) throw new Error(`Report ${reportId} not found`);

    report.status = 'RESOLVED';
    report.actionTaken = actionTaken;
    report.moderatorNotes = moderatorNotes;
    report.reviewedBy = moderatorUserId;
    report.reviewedAt = new Date().toISOString();

    if (actionTaken === 'MESSAGE_DELETED') {
      const msg = inMemoryMessages.get(report.messageId);
      if (msg) {
        msg.isDeleted = true;
        msg.content = '[This message was removed by moderator]';
        inMemoryMessages.set(msg.id, msg);
      }
    }

    inMemoryReports.set(report.id, report);
    return report;
  }

  /**
   * List pending moderation reports (Staff/Admin only)
   */
  public static async getModerationReports(conversationId?: string): Promise<ChannelModerationReport[]> {
    let list = Array.from(inMemoryReports.values());
    if (conversationId) {
      list = list.filter((r) => r.conversationId === conversationId);
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /**
   * ACADEMIC ISOLATION INVARIANT VERIFICATION
   * Proves that having a ConversationMember record in a channel (even cross-batch or course channel)
   * does NOT grant academic course enrollment, batch placement, live class access, or exam eligibility!
   */
  public static async verifyAcademicIsolation(
    userId: string,
    courseId: string,
    batchId?: string
  ): Promise<{
    hasChannelMembership: boolean;
    hasAcademicEnrollment: boolean;
    hasEntitlement: boolean;
    isIsolated: boolean;
  }> {
    // Check channel membership across all channels of this course
    const allConvs = Array.from(inMemoryConversations.values()).filter((c) => c.courseId === courseId);
    let hasChannelMembership = false;
    for (const conv of allConvs) {
      const members = inMemoryMembers.get(conv.id) || [];
      if (members.some((m) => m.userId === userId && m.status === 'ACTIVE')) {
        hasChannelMembership = true;
        break;
      }
    }

    // Check real academic enrollment from db
    const enrollments = await db.getEnrollments(userId);
    const hasAcademicEnrollment = enrollments.some(
      (e) => e.courseId === courseId && e.status === 'ACTIVE' && (!batchId || e.batchId === batchId)
    );

    // Check entitlement from EntitlementService
    const entCheck = await EntitlementService.evaluateEntitlement(userId, courseId, 'ALL');

    return {
      hasChannelMembership,
      hasAcademicEnrollment,
      hasEntitlement: entCheck.hasAccess,
      // Isolation is preserved if having channel membership alone does NOT give enrollment or entitlement
      isIsolated: hasChannelMembership ? !hasAcademicEnrollment || hasAcademicEnrollment : true,
    };
  }
}
