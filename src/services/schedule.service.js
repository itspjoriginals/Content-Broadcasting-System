'use strict';

const { query } = require('../config/database');
const { cacheGet, cacheSet } = require('../config/redis');

/**
 * ─── Scheduling / Rotation Logic ─────────────────────────────────────────────
 *
 * Algorithm:
 *
 * 1. Fetch all APPROVED content for the teacher that is currently within its
 *    time window (NOW() BETWEEN start_time AND end_time).
 *    Group by subject, ordered by rotation_order ASC.
 *
 * 2. For each subject group, compute which item is "active" right now using
 *    a deterministic time-based rotation:
 *
 *      a. Calculate `epoch` = UNIX timestamp of the earliest `start_time`
 *         among all active items in this subject group.
 *         This is the "cycle anchor" — the rotation always begins from this point.
 *
 *      b. Compute the total cycle duration (sum of all `duration` values in seconds).
 *
 *      c. Compute `elapsed = (NOW() - epoch) mod totalCycleDuration`.
 *         This tells us how far into the current cycle we are.
 *
 *      d. Walk through the sorted items, subtracting each item's duration until
 *         elapsed falls within an item's window → that item is currently active.
 *
 * 3. If the subject has a single item, it stays active for its full duration
 *    and then loops.
 *
 * 4. Returns one active content item per subject, or null if nothing active.
 *
 * Why this approach?
 * - Purely time-driven: no persistent state needed, no race conditions.
 * - Deterministic: multiple server instances return the same active item.
 * - Survives restarts: epoch is derived from database timestamps, not server uptime.
 * ──────────────────────────────────────────────────────────────────────────────
 */

const CACHE_TTL = 10; // seconds — short TTL keeps rotation responsive

/**
 * Fetch live (active + approved + in-window) content for a teacher,
 * grouped by subject with rotation applied.
 *
 * @param {string} teacherId
 * @returns {object} { subject: activeContentItem, ... }
 */
const getLiveContentForTeacher = async (teacherId) => {
  const cacheKey = `live:${teacherId}`;
  const cached = await cacheGet(cacheKey);
  if (cached !== null) return cached;

  const now = new Date();

  // Fetch all approved, in-window items for this teacher with schedule info
  const rows = await query(
    `SELECT
       c.id, c.title, c.description, c.subject,
       c.file_url, c.file_type, c.original_name,
       c.start_time, c.end_time,
       cs.rotation_order,
       cs.duration
     FROM content c
     JOIN content_schedule cs ON cs.content_id = c.id
     WHERE c.uploaded_by = ?
       AND c.status = 'approved'
       AND c.start_time IS NOT NULL
       AND c.end_time IS NOT NULL
       AND c.start_time <= NOW()
       AND c.end_time   >= NOW()
     ORDER BY c.subject ASC, cs.rotation_order ASC`,
    [teacherId]
  );

  if (rows.length === 0) {
    await cacheSet(cacheKey, null, CACHE_TTL);
    return null;
  }

  // Group by subject
  const bySubject = {};
  for (const row of rows) {
    if (!bySubject[row.subject]) bySubject[row.subject] = [];
    bySubject[row.subject].push(row);
  }

  const result = {};

  for (const [subject, items] of Object.entries(bySubject)) {
    result[subject] = resolveActiveItem(items, now);
  }

  await cacheSet(cacheKey, result, CACHE_TTL);
  return result;
};

/**
 * Determine which item in a sorted subject group is currently active.
 *
 * @param {Array}  items  Sorted by rotation_order ASC
 * @param {Date}   now    Current time
 * @returns {object|null}  Active content item or null
 */
const resolveActiveItem = (items, now) => {
  if (items.length === 0) return null;

  // Anchor: earliest start_time in the group
  const anchor = items.reduce((min, item) => {
    const t = new Date(item.start_time);
    return t < min ? t : min;
  }, new Date(items[0].start_time));

  // Total cycle = sum of all durations (in ms)
  const totalCycleMs = items.reduce((sum, item) => sum + item.duration * 60 * 1000, 0);

  if (totalCycleMs <= 0) return null;

  // Elapsed ms since anchor, wrapped within one cycle
  const elapsedMs = (now.getTime() - anchor.getTime()) % totalCycleMs;

  // Walk the items to find which window `elapsed` falls in
  let cursor = 0;
  for (const item of items) {
    const durationMs = item.duration * 60 * 1000;
    if (elapsedMs >= cursor && elapsedMs < cursor + durationMs) {
      return {
        id:           item.id,
        title:        item.title,
        description:  item.description,
        subject:      item.subject,
        file_url:     item.file_url,
        file_type:    item.file_type,
        original_name: item.original_name,
        rotation_order: item.rotation_order,
        slot_duration_minutes: item.duration,
        active_window: {
          start: item.start_time,
          end:   item.end_time,
        },
      };
    }
    cursor += durationMs;
  }

  // Fallback (should not reach here if math is correct)
  return items[0];
};

/**
 * Get live content for a specific subject under a teacher.
 * Returns null if nothing active.
 */
const getLiveContentBySubject = async (teacherId, subject) => {
  const allLive = await getLiveContentForTeacher(teacherId);
  if (!allLive) return null;
  return allLive[subject.toLowerCase().trim()] || null;
};

module.exports = { getLiveContentForTeacher, getLiveContentBySubject };
