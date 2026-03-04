import React, { useState, useMemo, useEffect, useRef } from 'react';
import { RegistryValueType } from '../../registry/types';
import {
  validateRegistryValue,
  sanitizeRegistryValue,
  getTypeDescription,
  ValidationResult,
} from '../../registry/validation';

export interface EditValueData {
  name: string;
  type: RegistryValueType;
  data: string;
  isNew: boolean;
}

interface EditValueDialogProps {
  data: EditValueData;
  onSave: (data: EditValueData) => void;
  onCancel: () => void;
}

export const EditValueDialog: React.FC<EditValueDialogProps> = ({
  data,
  onSave,
  onCancel,
}) => {
  const [value, setValue] = useState(data.data);

  // Real-time validation (gates the OK button)
  const validation = useMemo(
    () => validateRegistryValue(data.type, value),
    [data.type, value],
  );

  // Debounced validation (drives visible error/warning messages)
  const [displayValidation, setDisplayValidation] = useState<ValidationResult>(validation);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDisplayValidation(validation), 500);
    return () => clearTimeout(debounceRef.current);
  }, [validation]);

  const title =
    data.type === 'REG_SZ' || data.type === 'REG_EXPAND_SZ'
      ? 'Edit String'
      : data.type === 'REG_DWORD'
        ? 'Edit DWORD (32-bit) Value'
        : data.type === 'REG_QWORD'
          ? 'Edit QWORD (64-bit) Value'
          : data.type === 'REG_MULTI_SZ'
            ? 'Edit Multi-String'
            : data.type === 'REG_BINARY'
              ? 'Edit Binary Value'
              : 'Edit Value';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validation.valid) return;
    const finalValue = sanitizeRegistryValue(data.type, value);
    onSave({ ...data, data: finalValue });
  };

  const isMulti = data.type === 'REG_MULTI_SZ';
  const isDword = data.type === 'REG_DWORD' || data.type === 'REG_QWORD';
  const inputClassName =
    !displayValidation.valid ? 'input-error' : displayValidation.warning ? 'input-warning' : '';

  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <form
        className="dialog"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="dialog-title">{title}</div>

        <div className="dialog-field">
          <label>Value name:</label>
          <input type="text" value={data.name || '(Default)'} disabled />
        </div>

        <div className="dialog-field">
          <label>{isDword ? 'Value data (hex):' : 'Value data:'}</label>
          {isMulti ? (
            <textarea
              className={inputClassName}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoFocus
              rows={6}
              placeholder="Enter each string on a new line"
            />
          ) : (
            <input
              type="text"
              className={inputClassName}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoFocus
              placeholder={isDword ? '0' : ''}
            />
          )}
          {displayValidation.error && (
            <div className="validation-error">{displayValidation.error}</div>
          )}
          {displayValidation.warning && !displayValidation.error && (
            <div className="validation-warning">{displayValidation.warning}</div>
          )}
        </div>

        {isDword && (
          <div className="dialog-field">
            <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              Base: Hexadecimal
            </label>
          </div>
        )}

        <div className="dialog-hint">{getTypeDescription(data.type)}</div>

        <div className="dialog-buttons">
          <button
            type="submit"
            className="primary"
            disabled={!validation.valid}
          >
            OK
          </button>
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};
