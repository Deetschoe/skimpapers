'use client';

import type { Collection } from '@/lib/api';

interface CollectionCardProps {
  collection: Collection;
  onClick: (collection: Collection) => void;
}

export default function CollectionCard({ collection, onClick }: CollectionCardProps) {
  return (
    <button
      onClick={() => onClick(collection)}
      style={{
        all: 'unset',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px',
        padding: '32px 20px',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--corner-radius)',
        boxShadow: 'var(--shadow-sm)',
        transition: 'box-shadow 200ms ease, transform 200ms ease',
        textAlign: 'center',
        boxSizing: 'border-box',
        width: '100%',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = 'var(--shadow-md)';
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      {/* Folder icon */}
      <span
        style={{
          fontSize: '2rem',
          lineHeight: 1,
        }}
      >
        {collection.icon || '\uD83D\uDCC1'}
      </span>

      {/* Collection name */}
      <span
        style={{
          fontWeight: 600,
          fontSize: '15px',
          color: 'var(--text-primary)',
          lineHeight: 1.3,
          wordBreak: 'break-word',
        }}
      >
        {collection.name}
      </span>

      {/* Paper count */}
      <span
        style={{
          fontSize: '13px',
          color: 'var(--text-secondary)',
          fontWeight: 400,
        }}
      >
        {collection.paperCount} {collection.paperCount === 1 ? 'paper' : 'papers'}
      </span>
    </button>
  );
}
