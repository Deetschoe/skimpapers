'use client';

import { Paper } from '@/lib/api';

interface PaperCardProps {
  paper: Paper;
  onClick: (paper: Paper) => void;
  onDelete?: (paperId: string) => void;
}

const colors = {
  background: '#FAF9F5',
  surface: '#FFFFFF',
  surfaceElevated: '#F5F3EE',
  accent: '#C75B38',
  accentSecondary: '#4D8570',
  textPrimary: '#1A1A1A',
  textSecondary: '#666666',
  textTertiary: '#9E9E99',
  destructive: '#D94032',
  border: '#E0DFDA',
  cornerRadius: '14px',
  cornerRadiusSm: '8px',
};

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export default function PaperCard({ paper, onClick, onDelete }: PaperCardProps) {
  return (
    <div
      onClick={() => onClick(paper)}
      style={{
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderLeft: !paper.isRead ? `4px solid ${colors.accent}` : `1px solid ${colors.border}`,
        borderRadius: colors.cornerRadius,
        padding: '20px',
        cursor: 'pointer',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.08)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {/* Delete button */}
      {onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(paper.id);
          }}
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: colors.textTertiary,
            fontSize: '18px',
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.15s ease, color 0.15s ease',
            padding: 0,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(217,64,50,0.1)';
            e.currentTarget.style.color = colors.destructive;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'none';
            e.currentTarget.style.color = colors.textTertiary;
          }}
          title="Delete paper"
        >
          &times;
        </button>
      )}

      {/* Title */}
      <h3
        style={{
          margin: 0,
          fontSize: '16px',
          fontWeight: 600,
          color: colors.textPrimary,
          lineHeight: 1.4,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          paddingRight: onDelete ? '24px' : 0,
        }}
      >
        {paper.title}
      </h3>

      {/* Authors */}
      <p
        style={{
          margin: 0,
          fontSize: '13px',
          color: colors.textSecondary,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {paper.authors.join(', ')}
      </p>

      {/* Category badge */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
        <span
          style={{
            display: 'inline-block',
            padding: '3px 10px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: 500,
            background: colors.surfaceElevated,
            color: colors.textSecondary,
          }}
        >
          {paper.category}
        </span>
      </div>

      {/* Summary preview */}
      <p
        style={{
          margin: 0,
          fontSize: '13px',
          color: colors.textTertiary,
          lineHeight: 1.5,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {paper.summary}
      </p>

      {/* Tags */}
      {paper.tags && paper.tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {paper.tags.map((tag) => (
            <span
              key={tag}
              style={{
                display: 'inline-block',
                padding: '2px 10px',
                borderRadius: '20px',
                fontSize: '11px',
                fontWeight: 500,
                background: 'rgba(199,91,56,0.1)',
                color: colors.accent,
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Date */}
      <p
        style={{
          margin: 0,
          fontSize: '12px',
          color: colors.textTertiary,
          marginTop: 'auto',
        }}
      >
        {formatDate(paper.addedDate)}
      </p>
    </div>
  );
}
