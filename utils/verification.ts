import type { VerificationStatus } from '@/utils/types';

// Student verification: labels and styles shared by /profile and /admin/verification.

export const verificationLabels: Record<VerificationStatus, string> = {
  unsubmitted: 'Not submitted',
  pending: 'Pending review',
  verified: 'Verified',
  rejected: 'Rejected',
};

export const verificationStyles: Record<VerificationStatus, string> = {
  unsubmitted: 'bg-gray-500/15 text-gray-300 border-gray-500/50',
  pending: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/50',
  verified: 'bg-[#3987e5]/15 text-[#8fbcf2] border-[#3987e5]/60',
  rejected: 'bg-red-500/15 text-red-300 border-red-500/50',
};

// Suggestions for the School field (players can still type any school).
// Add the other SLEC schools here so everyone spells them the same way.
export const SCHOOL_SUGGESTIONS = [
  'University of Perpetual Help System DALTA – Molino',
];
