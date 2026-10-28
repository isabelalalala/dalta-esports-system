'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { getErrorMessage } from '@/utils/errors';
import type { Profile } from '@/utils/types';
import { SCHOOL_SUGGESTIONS, verificationLabels, verificationStyles } from '@/utils/verification';
import { BadgeCheck, GraduationCap, ShieldCheck } from 'lucide-react';

const inputClass =
  'w-full p-3.5 rounded-xl bg-white text-stone-950 border border-stone-300 placeholder:text-stone-400 uppercase tracking-wide focus:border-[#FFCC37] focus:ring-2 focus:ring-[#FFCC37]/25 shadow-xs outline-none transition-all font-medium text-xs sm:text-sm';

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
    <form onSubmit={handleSave} className="bg-white border border-stone-200/90 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6 uppercase">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-stone-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#5B271E]/10 border border-[#5B271E]/20 text-[#5B271E] grid place-items-center shadow-2xs">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-black text-stone-950 tracking-wider">Student Verification</h2>
            <p className="text-xs text-stone-500 font-medium tracking-wide mt-0.5">
              School tournaments only accept verified Perpetualite students.
            </p>
          </div>
        </div>
        <span className={`px-3.5 py-1.5 rounded-full border text-xs font-black tracking-wider uppercase inline-flex items-center gap-1.5 shadow-2xs ${verificationStyles[status]}`}>
          {status === 'verified' ? <BadgeCheck className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
          {verificationLabels[status]}
        </span>
      </div>

      {status === 'rejected' && profile.verification_note && (
        <div role="alert" className="bg-red-50 border border-red-200 rounded-2xl text-red-800 p-4 sm:p-5 text-xs font-bold tracking-wider space-y-1 shadow-2xs">
          <p className="font-black text-red-900">Verification not accepted:</p>
          <p>{profile.verification_note}</p>
          <p className="text-[11px] text-red-700 font-medium pt-1">Fix your details and save them to be reviewed again.</p>
        </div>
      )}

      {error && (
        <div role="alert" className="bg-red-50 border border-red-200 rounded-2xl text-red-800 p-4 text-xs font-bold tracking-wider shadow-2xs">
          {error}
        </div>
      )}

      {message && (
        <div role="status" className="bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 p-4 text-xs font-bold tracking-wider shadow-2xs">
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
        <div className="space-y-1.5">
          <label htmlFor="student-id" className="block text-xs font-black text-stone-700 tracking-wider">
            Student ID
          </label>
          <input
            id="student-id"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            maxLength={30}
            placeholder="e.g. 23-0123-456"
            className={inputClass}
            required
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="school" className="block text-xs font-black text-stone-700 tracking-wider">
            School Campus
          </label>
          <input
            id="school"
            value={school}
            onChange={(e) => setSchool(e.target.value)}
            maxLength={120}
            list="school-suggestions"
            placeholder="Your school"
            className={inputClass}
            required
          />
          <datalist id="school-suggestions">
            {SCHOOL_SUGGESTIONS.map((s) => <option key={s} value={s} />)}
          </datalist>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="course-year" className="block text-xs font-black text-stone-700 tracking-wider">
            Course & Year
          </label>
          <input
            id="course-year"
            value={courseYear}
            onChange={(e) => setCourseYear(e.target.value)}
            maxLength={60}
            placeholder="e.g. BSIT 3"
            className={inputClass}
            required
          />
        </div>
      </div>

      <div className="pt-2">
        <button
          type="submit"
          disabled={saving || !changed}
          className="rounded-xl bg-gold hover:bg-golddark text-stone-950 font-black px-6 py-3 text-xs tracking-widest shadow-xs hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {saving ? 'Saving...' : status === 'unsubmitted' ? 'Submit for verification' : 'Save changes'}
        </button>
      </div>
    </form>
  );
}
