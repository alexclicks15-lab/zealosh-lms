-- ============================================================================
-- ZEALOSH LMS — ATOMIC ENROLLMENT & SEAT CAPACITY ENFORCEMENT PROCEDURE
-- Migration: 20261023000002_zealosh_atomic_enrollment.sql
-- Architecture: ADR-002 (Transaction-Safe Concurrency & Authoritative Invariants)
-- Standards: Row-level locking (FOR UPDATE), Idempotency, Zero Overselling
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.enroll_learner_atomic(
  p_user_id TEXT,
  p_batch_id TEXT,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batch public.batches%ROWTYPE;
  v_existing_enrollment public.enrollments%ROWTYPE;
  v_new_enrollment public.enrollments%ROWTYPE;
  v_enrollment_id TEXT;
  v_now TIMESTAMPTZ := NOW();
  v_expires_at TIMESTAMPTZ := v_now + INTERVAL '365 days';
  v_actor_email TEXT;
BEGIN
  -- 1. Check idempotency key first if provided
  IF p_idempotency_key IS NOT NULL AND p_idempotency_key <> '' THEN
    SELECT * INTO v_existing_enrollment
    FROM public.enrollments
    WHERE idempotency_key = p_idempotency_key;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', true,
        'isNew', false,
        'enrollment', jsonb_build_object(
          'id', v_existing_enrollment.id,
          'userId', v_existing_enrollment.user_id,
          'courseId', v_existing_enrollment.course_id,
          'batchId', v_existing_enrollment.batch_id,
          'status', v_existing_enrollment.status,
          'enrolledAt', to_char(v_existing_enrollment.enrolled_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
          'expiresAt', to_char(v_existing_enrollment.expires_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
          'progressPercent', v_existing_enrollment.progress_percent,
          'completedLessonIds', to_jsonb(v_existing_enrollment.completed_lesson_ids),
          'idempotencyKey', v_existing_enrollment.idempotency_key
        )
      );
    END IF;
  END IF;

  -- 2. Lock the target batch row atomically for concurrency control
  SELECT * INTO v_batch
  FROM public.batches
  WHERE id = p_batch_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'BATCH_NOT_FOUND: Batch % does not exist', p_batch_id;
  END IF;

  -- 3. Validate batch status
  IF v_batch.status NOT IN ('UPCOMING', 'ACTIVE') THEN
    RAISE EXCEPTION 'BATCH_NOT_ACCEPTING_ENROLLMENTS: Batch status is %', v_batch.status;
  END IF;

  -- 4. Check for duplicate active enrollment for this user in this batch
  SELECT * INTO v_existing_enrollment
  FROM public.enrollments
  WHERE user_id = p_user_id AND batch_id = p_batch_id AND status = 'ACTIVE';

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'isNew', false,
      'enrollment', jsonb_build_object(
        'id', v_existing_enrollment.id,
        'userId', v_existing_enrollment.user_id,
        'courseId', v_existing_enrollment.course_id,
        'batchId', v_existing_enrollment.batch_id,
        'status', v_existing_enrollment.status,
        'enrolledAt', to_char(v_existing_enrollment.enrolled_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'expiresAt', to_char(v_existing_enrollment.expires_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'progressPercent', v_existing_enrollment.progress_percent,
        'completedLessonIds', to_jsonb(v_existing_enrollment.completed_lesson_ids),
        'idempotencyKey', v_existing_enrollment.idempotency_key
      )
    );
  END IF;

  -- 5. Enforce seat capacity under strict concurrency
  IF v_batch.enrolled_count >= v_batch.capacity THEN
    RAISE EXCEPTION 'BATCH_CAPACITY_EXCEEDED: Batch is at full capacity (%/%)', v_batch.enrolled_count, v_batch.capacity;
  END IF;

  -- 6. Generate enrollment ID
  v_enrollment_id := 'enr-' || floor(extract(epoch from v_now) * 1000)::text || '-' || substr(md5(random()::text), 1, 6);

  -- 7. Insert the enrollment record
  INSERT INTO public.enrollments (
    id,
    user_id,
    course_id,
    batch_id,
    status,
    enrolled_at,
    expires_at,
    progress_percent,
    completed_lesson_ids,
    idempotency_key
  ) VALUES (
    v_enrollment_id,
    p_user_id,
    v_batch.course_id,
    p_batch_id,
    'ACTIVE',
    v_now,
    v_expires_at,
    0,
    ARRAY[]::TEXT[],
    COALESCE(NULLIF(p_idempotency_key, ''), 'enrol_' || p_batch_id || '_' || p_user_id)
  )
  RETURNING * INTO v_new_enrollment;

  -- 8. Increment the batch enrolled_count
  UPDATE public.batches
  SET enrolled_count = enrolled_count + 1,
      updated_at = v_now
  WHERE id = p_batch_id;

  -- 9. Record audit trail
  SELECT email INTO v_actor_email FROM public.users WHERE id = p_user_id;

  INSERT INTO public.audit_logs (
    id,
    actor_user_id,
    actor_email,
    actor_role,
    action,
    entity_type,
    entity_id,
    details
  ) VALUES (
    'aud-' || floor(extract(epoch from v_now) * 1000)::text || '-' || substr(md5(random()::text), 1, 6),
    p_user_id,
    COALESCE(v_actor_email, 'student@zealosh.com'),
    'STUDENT',
    'COURSE_ENROLLMENT_COMPLETED',
    'ENROLLMENT',
    v_enrollment_id,
    jsonb_build_object(
      'batchId', p_batch_id,
      'courseId', v_batch.course_id,
      'remainingSeats', (v_batch.capacity - (v_batch.enrolled_count + 1))
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'isNew', true,
    'enrollment', jsonb_build_object(
      'id', v_new_enrollment.id,
      'userId', v_new_enrollment.user_id,
      'courseId', v_new_enrollment.course_id,
      'batchId', v_new_enrollment.batch_id,
      'status', v_new_enrollment.status,
      'enrolledAt', to_char(v_new_enrollment.enrolled_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'expiresAt', to_char(v_new_enrollment.expires_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'progressPercent', v_new_enrollment.progress_percent,
      'completedLessonIds', to_jsonb(v_new_enrollment.completed_lesson_ids),
      'idempotencyKey', v_new_enrollment.idempotency_key
    )
  );
END;
$$;

-- Grant execution permission
REVOKE EXECUTE ON FUNCTION public.enroll_learner_atomic(TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enroll_learner_atomic(TEXT, TEXT, TEXT) TO authenticated, service_role;

COMMIT;
