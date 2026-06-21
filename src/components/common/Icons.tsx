import React from 'react';
import { RegistryValueType } from '../../registry/types';

// Win11-style SVG icons for the registry editor

export const FolderIcon: React.FC<{ open?: boolean; className?: string }> = ({
  open,
  className,
}) => (
  <svg
    className={className}
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    {open ? (
      <>
        {/* Back panel of open folder */}
        <path
          d="M1.5 3.5C1.5 2.95 1.95 2.5 2.5 2.5H6L7.5 4.5H13.5C14.05 4.5 14.5 4.95 14.5 5.5V7H2.5V3.5Z"
          fill="#E5A200"
        />
        {/* Open folder front flap */}
        <path
          d="M1 7H13.5C14.05 7 14.5 7.3 14.35 7.85L12.5 13H1.5C1.22 13 1 12.78 1 12.5V7Z"
          fill="#FFC83D"
          stroke="#D4970A"
          strokeWidth="0.4"
        />
      </>
    ) : (
      <>
        <rect x="1.5" y="3" width="13" height="10" rx="1" fill="#FFB900" stroke="#D4970A" strokeWidth="0.5" />
        <path d="M1.5 4C1.5 3.44772 1.94772 3 2.5 3H6L7.5 5H13.5C14.0523 5 14.5 5.44772 14.5 6V12C14.5 12.5523 14.0523 13 13.5 13H2.5C1.94772 13 1.5 12.5523 1.5 12V4Z" fill="#FFC83D" />
      </>
    )}
  </svg>
);

export const FolderAddIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect x="1.5" y="3" width="13" height="10" rx="1" fill="#4CAF50" stroke="#388E3C" strokeWidth="0.5" />
    <path d="M1.5 4C1.5 3.44772 1.94772 3 2.5 3H6L7.5 5H13.5C14.0523 5 14.5 5.44772 14.5 6V12C14.5 12.5523 14.0523 13 13.5 13H2.5C1.94772 13 1.5 12.5523 1.5 12V4Z" fill="#66BB6A" />
    <path d="M8 7V11M6 9H10" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);

export const ComputerIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect x="1" y="2" width="14" height="9" rx="1" fill="#0078D4" />
    <rect x="2" y="3" width="12" height="7" rx="0.5" fill="#4FC3F7" />
    <rect x="5" y="12" width="6" height="1" rx="0.5" fill="#666" />
    <rect x="4" y="13" width="8" height="1" rx="0.5" fill="#888" />
  </svg>
);

export const ValueIcon: React.FC<{ type: RegistryValueType; className?: string }> = ({
  type,
  className,
}) => {
  const isString = type === 'REG_SZ' || type === 'REG_EXPAND_SZ' || type === 'REG_MULTI_SZ';
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="2" width="14" height="12" rx="1" fill="#fff" stroke="#ccc" strokeWidth="0.5" />
      {isString ? (
        <>
          <text x="2" y="11" fontSize="8" fontFamily="Consolas, monospace" fill="#cc0000" fontWeight="bold">ab</text>
          <line x1="11" y1="4" x2="11" y2="12" stroke="#cc0000" strokeWidth="1.2" />
        </>
      ) : (
        <text x="2" y="11" fontSize="7" fontFamily="Consolas, monospace" fill="#0000cc" fontWeight="bold">011</text>
      )}
    </svg>
  );
};
