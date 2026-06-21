import React from 'react';
import { RegistryValueType } from '../../registry/types';

// Win11-style SVG icons for the registry editor

// ponytail: open variant dropped — single PNG for both states
export const FolderIcon: React.FC<{ open?: boolean; className?: string }> = ({
  className,
}) => (
  <img src="/folder.png" width="16" height="16" alt="" className={className} />
);

export const FolderAddIcon: React.FC<{ className?: string }> = ({ className }) => (
  <img src="/folder-new.png" width="16" height="16" alt="" className={className} />
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
    <img
      className={className}
      src={isString ? '/value-string.png' : '/value-number.png'}
      width={16}
      height={16}
      alt=""
    />
  );
};
