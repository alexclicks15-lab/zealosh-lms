// Zealosh LMS — Isolated Group, Course & Batch Messaging Test Suite
// File: tests/isolated-group-messaging.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { ChannelService } from '../src/lib/messaging/channel-service';
import { db } from '../src/lib/store/db';

describe('Zealosh LMS — Isolated Group, Course & Batch Messaging (ZM-IMPL-08D)', () => {
  beforeEach(() => {
    ChannelService.resetForTesting();
  });

  it('initializes default course and batch channels with active memberships', async () => {
    const adminConvs = await ChannelService.getConversationsForUser('usr-admin-01', 'SUPER_ADMIN');
    expect(adminConvs.length).toBeGreaterThanOrEqual(2);

    const aspChannel = adminConvs.find((c) => c.courseId === 'crs-asp-01' && c.type === 'COURSE');
    expect(aspChannel).toBeDefined();
    expect(aspChannel?.title).toContain('ASP Examination Prep');

    const batchChannel = adminConvs.find((c) => c.batchId === 'batch-001' && c.type === 'BATCH');
    expect(batchChannel).toBeDefined();

    // Verify member list
    const members = await ChannelService.getConversationMembers(aspChannel!.id, 'usr-admin-01', 'SUPER_ADMIN');
    expect(members.length).toBe(3);
    expect(members.some((m) => m.userId === 'usr-std-01')).toBe(true);
  });

  it('permits staff to create cross-batch channels, but rejects student self-creation with CROSS_BATCH_UNAUTHORIZED', async () => {
    // 1. Staff creates cross-batch discussion room
    const staffChannel = await ChannelService.createConversation({
      type: 'GROUP',
      title: 'ASP & CSP Cross-Cohort Safety Study Circle',
      description: 'Authorized inter-cohort safety engineering review',
      creatorUserId: 'usr-admin-01',
      creatorRole: 'SUPER_ADMIN',
      isCrossBatch: true,
      initialMemberIds: ['usr-std-01'],
    });

    expect(staffChannel.id).toBeDefined();
    expect(staffChannel.isCrossBatch).toBe(true);
    expect(staffChannel.crossBatchApprovedBy).toBe('usr-admin-01');

    // 2. Student attempts to create an unapproved cross-batch channel
    await expect(
      ChannelService.createConversation({
        type: 'GROUP',
        title: 'Unsanctioned Student Cross-Batch Chat',
        creatorUserId: 'usr-std-01',
        creatorRole: 'STUDENT',
        isCrossBatch: true,
      })
    ).rejects.toThrow(/CROSS_BATCH_UNAUTHORIZED/);
  });

  it('enforces membership access control: non-members cannot read conversation or post messages', async () => {
    // Create private instructor staff channel
    const staffRoom = await ChannelService.createConversation({
      type: 'STAFF',
      title: 'Faculty Exam Moderation Council',
      creatorUserId: 'usr-admin-01',
      creatorRole: 'SUPER_ADMIN',
      initialMemberIds: ['usr-inst-01'],
    });

    // Student (not a member) attempts to read conversation details
    await expect(
      ChannelService.getConversationById(staffRoom.id, 'usr-std-01', 'STUDENT')
    ).rejects.toThrow(/ACCESS_DENIED/);

    // Student attempts to read messages
    await expect(
      ChannelService.getChannelMessages({
        conversationId: staffRoom.id,
        userId: 'usr-std-01',
        userRole: 'STUDENT',
      })
    ).rejects.toThrow(/ACCESS_DENIED/);

    // Student attempts to send a message
    await expect(
      ChannelService.sendChannelMessage({
        conversationId: staffRoom.id,
        senderId: 'usr-std-01',
        senderName: 'Intruder Student',
        senderRole: 'STUDENT',
        content: 'Hello faculty, can I join this room?',
      })
    ).rejects.toThrow(/ACCESS_DENIED/);
  });

  it('manages membership lifecycle: adding members, self-leave, and removal', async () => {
    const channel = await ChannelService.createConversation({
      type: 'GROUP',
      title: 'HSE Risk Assessment Project Team 4',
      creatorUserId: 'usr-admin-01',
      creatorRole: 'SUPER_ADMIN',
    });

    // Add instructor as moderator
    const newMember = await ChannelService.addMember({
      conversationId: channel.id,
      targetUserId: 'usr-inst-01',
      actorUserId: 'usr-admin-01',
      actorRole: 'SUPER_ADMIN',
      memberRole: 'MODERATOR',
    });
    expect(newMember.userId).toBe('usr-inst-01');
    expect(newMember.role).toBe('MODERATOR');

    // Add student
    await ChannelService.addMember({
      conversationId: channel.id,
      targetUserId: 'usr-std-01',
      actorUserId: 'usr-admin-01',
      actorRole: 'SUPER_ADMIN',
      memberRole: 'MEMBER',
    });

    let members = await ChannelService.getConversationMembers(channel.id, 'usr-admin-01', 'SUPER_ADMIN');
    expect(members.length).toBe(3);

    // Student leaves voluntarily
    const removed = await ChannelService.removeMember({
      conversationId: channel.id,
      targetUserId: 'usr-std-01',
      actorUserId: 'usr-std-01',
      actorRole: 'STUDENT',
    });
    expect(removed).toBe(true);

    members = await ChannelService.getConversationMembers(channel.id, 'usr-admin-01', 'SUPER_ADMIN');
    expect(members.length).toBe(2);
    expect(members.some((m) => m.userId === 'usr-std-01')).toBe(false);

    // Now former student cannot access
    await expect(
      ChannelService.getConversationById(channel.id, 'usr-std-01', 'STUDENT')
    ).rejects.toThrow(/ACCESS_DENIED/);
  });

  it('supports threaded replies with parent validation, reply counts, and client deduplication', async () => {
    // 1. Post top-level question in ASP general channel
    const topMsg = await ChannelService.sendChannelMessage({
      conversationId: 'conv-crs-asp-01',
      senderId: 'usr-std-01',
      senderName: 'Arjun Menon',
      senderRole: 'STUDENT',
      content: 'Could someone clarify the difference between HAZOP and FMEA calculation matrices?',
      clientMessageId: 'cli-msg-001',
    });

    expect(topMsg.id).toBeDefined();
    expect(topMsg.replyCount).toBe(0);

    // 2. Test idempotent deduplication with identical clientMessageId
    const dupMsg = await ChannelService.sendChannelMessage({
      conversationId: 'conv-crs-asp-01',
      senderId: 'usr-std-01',
      senderName: 'Arjun Menon',
      senderRole: 'STUDENT',
      content: 'Could someone clarify the difference between HAZOP and FMEA calculation matrices?',
      clientMessageId: 'cli-msg-001',
    });
    expect(dupMsg.id).toBe(topMsg.id);

    // 3. Post reply in thread
    const replyMsg = await ChannelService.sendChannelMessage({
      conversationId: 'conv-crs-asp-01',
      senderId: 'usr-inst-01',
      senderName: 'Lead Instructor',
      senderRole: 'INSTRUCTOR',
      content: 'HAZOP uses guide words to discover deviations; FMEA ranks failure modes by RPN (Risk Priority Number).',
      parentMessageId: topMsg.id,
    });

    expect(replyMsg.parentMessageId).toBe(topMsg.id);

    // 4. Fetch top-level vs thread replies
    const topLevelList = await ChannelService.getChannelMessages({
      conversationId: 'conv-crs-asp-01',
      userId: 'usr-std-01',
      userRole: 'STUDENT',
    });
    expect(topLevelList.some((m) => m.id === topMsg.id)).toBe(true);
    expect(topLevelList.some((m) => m.id === replyMsg.id)).toBe(false);

    const threadReplies = await ChannelService.getChannelMessages({
      conversationId: 'conv-crs-asp-01',
      userId: 'usr-std-01',
      userRole: 'STUDENT',
      parentMessageId: topMsg.id,
    });
    expect(threadReplies.length).toBe(1);
    expect(threadReplies[0].id).toBe(replyMsg.id);
  });

  it('manages moderation reports, pending reviews, notes, and message deletion', async () => {
    // Send a message that breaches conduct
    const badMsg = await ChannelService.sendChannelMessage({
      conversationId: 'conv-crs-asp-01',
      senderId: 'usr-std-01',
      senderName: 'Arjun Menon',
      senderRole: 'STUDENT',
      content: 'Commercial spam offering leaked test answer keys: contact test@example.com',
    });

    // Report message
    const report = await ChannelService.reportMessage({
      conversationId: 'conv-crs-asp-01',
      messageId: badMsg.id,
      reportedBy: 'usr-inst-01',
      reason: 'Academic integrity breach - commercial spam and leaked keys solicitation',
    });

    expect(report.id).toBeDefined();
    expect(report.status).toBe('PENDING');

    // List reports for admin
    const pendingReports = await ChannelService.getModerationReports('conv-crs-asp-01');
    expect(pendingReports.some((r) => r.id === report.id)).toBe(true);

    // Resolve report with message deletion
    const resolved = await ChannelService.resolveModerationReport({
      reportId: report.id,
      moderatorUserId: 'usr-admin-01',
      actionTaken: 'MESSAGE_DELETED',
      moderatorNotes: 'Confirmed violation of student code of conduct. Message censored.',
    });

    expect(resolved.status).toBe('RESOLVED');
    expect(resolved.actionTaken).toBe('MESSAGE_DELETED');

    // Verify message has been removed/redacted
    const msgs = await ChannelService.getChannelMessages({
      conversationId: 'conv-crs-asp-01',
      userId: 'usr-admin-01',
      userRole: 'SUPER_ADMIN',
    });
    const foundBad = msgs.find((m) => m.id === badMsg.id);
    expect(foundBad).toBeUndefined(); // deleted messages are filtered out
  });

  it('strictly verifies Academic Isolation Invariant (BDR-13): channel membership never confers enrollment or entitlements', async () => {
    // Check an un-enrolled user who might be added to a public course orientation chat or group
    // In db, let's verify usr-std-01's isolation status for crs-csp-01 (CSP course)
    const nonEnrolledCourse = 'crs-csp-01';

    // usr-std-01 does NOT have an enrollment in CSP
    const isolation = await ChannelService.verifyAcademicIsolation('usr-std-01', nonEnrolledCourse);

    expect(isolation.hasAcademicEnrollment).toBe(false);
    expect(isolation.hasEntitlement).toBe(false);

    // Even if added to a discussion channel for CSP:
    const cspChannel = await ChannelService.createConversation({
      type: 'COURSE',
      title: 'CSP General Interest Channel',
      courseId: nonEnrolledCourse,
      creatorUserId: 'usr-admin-01',
      creatorRole: 'SUPER_ADMIN',
      initialMemberIds: ['usr-std-01'],
    });

    const isolationAfter = await ChannelService.verifyAcademicIsolation('usr-std-01', nonEnrolledCourse);
    expect(isolationAfter.hasChannelMembership).toBe(true);
    // CRITICAL INVARIANT: hasAcademicEnrollment and hasEntitlement MUST STILL BE FALSE!
    expect(isolationAfter.hasAcademicEnrollment).toBe(false);
    expect(isolationAfter.hasEntitlement).toBe(false);
    expect(isolationAfter.isIsolated).toBe(true);
  });
});
