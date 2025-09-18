import React from 'react';

interface AdCardProps {
  onDismiss?: () => void;
  className?: string;
  label?: string;
  // Optionally pass an image or html snippet; keep MVP simple.
}

export default function AdCard({ onDismiss, className = '', label = 'Sponsored' }: AdCardProps) {
  return (
    <div className={`swipe-card overflow-hidden rounded-2xl shadow-xl bg-white border border-gray-200 ${className}`} role="region" aria-label="Sponsored">
      <div className="relative p-4 sm:p-6">
        <span className="absolute top-3 right-3 text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{label}</span>
        <div className="h-40 sm:h-48 w-full bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl mb-4 flex items-center justify-center text-white text-xl font-bold">
          Ad Space
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Reach active locals</h3>
        <p className="text-sm text-gray-600 mb-4">Promote your event, venue, or service to people looking for things to do nearby.</p>
        <div className="flex items-center gap-3">
          <a href="/sponsor" className="inline-flex items-center justify-center rounded-full bg-indigo-600 text-white px-4 py-2 text-sm font-medium hover:bg-indigo-700 transition-colors">Promote</a>
          <button type="button" onClick={onDismiss} className="text-sm text-gray-500 hover:text-gray-700">Skip</button>
        </div>
      </div>
    </div>
  );
}
