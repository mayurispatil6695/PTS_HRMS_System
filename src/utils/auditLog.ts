// src/utils/auditLog.ts
import { ref, push, set } from 'firebase/database';
import { database } from '../firebase';

export interface AuditLogEntry {
  action: string;               // e.g., 'leave_approved', 'employee_added', 'project_deleted', 'settings_company_updated'
  performedBy: string;          // user id (Firebase UID)
  performedByName?: string;     // user’s display name
  targetId?: string;            // optional – id of the affected entity (leave request id, employee id, project id)
  details?: Record<string, unknown>; // additional structured data
  timestamp: number;
}

/**
 * Write an audit log entry to Firebase Realtime Database.
 * The log is stored under `/auditLogs` with an auto‑generated key.
 */
export const addAuditLog = async (entry: Omit<AuditLogEntry, 'timestamp'>): Promise<void> => {
  try {
    const logRef = push(ref(database, 'auditLogs'));
    await set(logRef, {
      ...entry,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('Failed to write audit log:', error);
    // Do not throw – audit logging should never break the main flow
  }
};