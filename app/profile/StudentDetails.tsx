'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { getErrorMessage } from '@/utils/errors';
import type { Profile } from '@/utils/types';
import { SCHOOL_SUGGESTIONS, verificationLabels, verificationStyles } from '@/utils/verification';

const inputClass =
  'w-full rounded-lg border border-[#00d2ff]/40 bg-[#0a0a0c] px-4 py-3 text-white placeholder-gray-500 outline-none focus:border-[#00d2ff]';

interface Props {
  profile: Profile;
  // Called after saving, so the page reloads the profile (the status changes to pending)
  onSaved: () => void;
}

// Student details for verification (players only). Saving sends them to admin/staff for
// review; the database sets the status, and changing details later means a new review.
export default function StudentDetails({ profile, onSaved }: Props) {
  const supabase = createClient();
  const [studentId, setStudentId] = useState(profile.student_id || '');
  const [school, setSchool] = useState(profile.school || '');
  const [courseYear, setCourseYear] = useState(profile.course_year || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const status = profile.verification_status;
  const changed =
    studentId.trim() !== (profile.student_id || '') ||
    school.trim() !== (profile.school || '') ||
    courseYear.trim() !== (profile.course_year || '');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === 'verified' && !confirm('Changing your details removes your verification until an organizer checks them again. Continue?')) {
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const { data, error: saveError } = await supabase
        .from('profiles')
        .update({ student_id: studentId.trim(), school: school.trim(), course_year: courseYear.trim() })
        .eq('id', profile.id)
        .select('id');
      if (saveError) throw saveError;
      if (!data || data.length === 0) throw new Error('Your details could not be saved.');
      setMessage('Saved. An organizer will review your details.');
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save your student details'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="bg-[#1a1a2e] border border-[#00d2ff] rounded-xl p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold">Student details</h2>
        <span className={`px-3 py-1 rounded-full border text-xs font-bold uppercase ${verificationStyles[status]}`}>
          {status === 'verified' ? '✓ ' : ''}{verificationLabels[status]}
        </span>
      </div>
      <p className="text-sm text-gray-400">
        School tournaments only accept verified students. Organizers check these details against school records.
        Only you and the organizers can see them.
      </p>

      {status === 'rejected' && profile.verification_note && (
        <div className="bg-red-500/10 border border-red-500 text-red-300 px-4 py-3 rounded-lg text-sm">
          Not accepted: {profile.verification_note} Fix your details and save them to be reviewed again.
        </div>
      )}
      {error && <div className="bg-red-500/10 border border-red-500 text-red-300 px-4 py-3 rounded-lg">{error}</div>}
      {message && <div className="bg-green-500/10 border border-green-500 text-green-300 px-4 py-3 rounded-lg">{message}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <label className="block text-sm font-semibold text-gray-300">
          Student ID
          <input value={studentId} onChange={(e) => setStudentId(e.target.value)} maxLength={30}
            placeholder="e.g. 23-0123-456" className={`${inputClass} mt-2`} required />
        </label>
        <label className="block text-sm font-semibold text-gray-300">
          School
          <input value={school} onChange={(e) => setSchool(e.target.value)} maxLength={120} list="school-suggestions"
            placeholder="Your school" className={`${inputClass} mt-2`} required />
          <datalist id="school-suggestions">
            {SCHOOL_SUGGESTIONS.map((s) => <option key={s} value={s} />)}
          </datalist>
        </label>
        <label className="block text-sm font-semibold text-gray-300">
          Course / Year
          <input value={courseYear} onChange={(e) => setCourseYear(e.target.value)} maxLength={60}
            placeholder="e.g. BSIT 3" className={`${inputClass} mt-2`} required />
        </label>
      </div>

      <button
        type="submit"
        disabled={saving || !changed}
        className="bg-[#00d2ff] text-black px-6 py-2 rounded-lg font-bold hover:bg-[#00b8e6] transition disabled:opacity-50"
      >
        {saving ? 'Saving...' : status === 'unsubmitted' ? 'Submit for verification' : 'Save changes'}
      </button>
    </form>
  );
}
