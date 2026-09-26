import React from 'react';

// In-app avatar: uses the member's profile photo when one is set,
// otherwise falls back to initials on a gold plate. Never renders
// a third-party account widget.
export function Avatar({
  src,
  alt,
  initials,
  className = '',
}: {
  src?: string | null;
  alt?: string;
  initials: string;
  className?: string;
}) {
  const [failed, setFailed] = React.useState(false);
  const showImage = src && src.trim() && !failed;

  return (
    <div className={`relative w-full h-full overflow-hidden bg-blue-600 flex items-center justify-center ${className}`}>
      {showImage ? (
        <img
          src={src!}
          alt={alt || 'Profile'}
          onError={() => setFailed(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <span className="text-ink-950 font-bold tracking-tight leading-none select-none text-[1.1em]">
          {initials || '?'}
        </span>
      )}
    </div>
  );
}

export default Avatar;
