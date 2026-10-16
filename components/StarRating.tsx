'use client';

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
  const textSize = size === 'lg' ? 'text-3xl' : 'text-base';

  if (!onChange) {
    return (
      <span className={`${textSize} text-yellow-400`} role="img" aria-label={`${value} out of 5 stars`}>
        {'★'.repeat(value)}
        <span className="text-gray-600">{'★'.repeat(5 - value)}</span>
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
          className={`${textSize} leading-none transition ${star <= value ? 'text-yellow-400' : 'text-gray-600 hover:text-yellow-200'}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}
