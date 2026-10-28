import type { VerificationStatus } from '@/utils/types';

// Student verification: labels and styles shared by /profile and /admin/verification.

export const verificationLabels: Record<VerificationStatus, string> = {
  unsubmitted: 'Not submitted',
  pending: 'Pending review',
  verified: 'Verified',
  rejected: 'Rejected',
};

export const verificationStyles: Record<VerificationStatus, string> = {
  unsubmitted: 'bg-stone-100 text-stone-700 border-stone-300',
  pending: 'bg-amber-50 text-amber-800 border-amber-300',
  verified: 'bg-blue-50 text-blue-700 border-blue-300',
  rejected: 'bg-red-50 text-red-700 border-red-300',
};

// Suggestions for the School field (players can still type any school).
// Add the other SLEC schools here so everyone spells them the same way.
export const SCHOOL_SUGGESTIONS = [
  'University of Perpetual Help System DALTA – Molino',
];
