'use client';

import { Star } from 'lucide-react';

// 1-5 stars. With onChange it is a clickable input; without, it only displays the rating.
export default function StarRating({
  value,
  onChange,
  size = 'lg',
}: {
  value: number;
  onChange?: (rating: number) => void;
  size?: 'sm' | 'lg';
}) {
  const iconSize = size === 'lg' ? 'h-8 w-8' : 'h-4 w-4';

  if (!onChange) {
    return (
      <span className="inline-flex gap-0.5 text-yellow-400" role="img" aria-label={`${value} out of 5 stars`}>
        {Array.from({ length: 5 }, (_, i) => (
          <Star key={i} className={`${iconSize} ${i < value ? 'fill-current' : 'text-gray-600'}`} />
        ))}
      </span>
    );
  }

  return (
    <div role="radiogroup" aria-label="Rating" className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} star${star > 1 ? 's' : ''}`}
          onClick={() => onChange(star)}
          className={`leading-none transition ${star <= value ? 'text-yellow-400' : 'text-gray-600 hover:text-yellow-200'}`}
        >
          <Star className={`${iconSize} ${star <= value ? 'fill-current' : ''}`} />
        </button>
      ))}
    </div>
  );
}
