import React, { useState, useMemo, useEffect, useRef } from 'react';
import { RegistryValueType } from '../../registry/types';
import {
  validateRegistryValue,
  sanitizeRegistryValue,
  getTypeDescription,
  ValidationResult,
} from '../../registry/validation';

interface NewValueDialogProps {
  onSave: (name: string, type: RegistryValueType, data: string) => void;
  onCancel: () => void;
}

export const NewValueDialog: React.FC<NewValueDialogProps> = ({ onSave, onCancel }) => {
  const [name, setName] = useState('New Value #1');
  const [type, setType] = useState<RegistryValueType>('REG_SZ');
  const [data, setData] = useState('');

  // Real-time validation (gates the OK button)
  const validation = useMemo(
    () => validateRegistryValue(type, data),
    [type, data],
  );

  const nameError = useMemo(() => {
    if (name.trim().length === 0) return 'Value name cannot be empty.';
    return undefined;
  }, [name]);

  // Debounced validation (drives visible error/warning messages)
  const [displayValidation, setDisplayValidation] = useState<ValidationResult>(validation);
  const [displayNameError, setDisplayNameError] = useState<string | undefined>(nameError);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const nameDebounceRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDisplayValidation(validation), 500);
    return () => clearTimeout(debounceRef.current);
  }, [validation]);
  useEffect(() => {
    clearTimeout(nameDebounceRef.current);
    nameDebounceRef.current = setTimeout(() => setDisplayNameError(nameError), 500);
    return () => clearTimeout(nameDebounceRef.current);
  }, [nameError]);

  const isDword = type === 'REG_DWORD' || type === 'REG_QWORD';
  const inputClassName =
    !displayValidation.valid ? 'input-error' : displayValidation.warning ? 'input-warning' : '';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validation.valid || nameError) return;
    const finalData = sanitizeRegistryValue(type, data);
    onSave(name, type, finalData);
  };

  // Reset data when type changes to provide sensible defaults
  const handleTypeChange = (newType: RegistryValueType) => {
    setType(newType);
    switch (newType) {
      case 'REG_DWORD':
        setData('00000000');
        break;
      case 'REG_QWORD':
        setData('0000000000000000');
        break;
      default:
        setData('');
        break;
    }
  };

  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <form
        className="dialog"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="dialog-title">New Value</div>

        <div className="dialog-field">
          <label>Value name:</label>
          <input
            type="text"
            className={displayNameError ? 'input-error' : ''}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          {displayNameError && <div className="validation-error">{displayNameError}</div>}
        </div>

        <div className="dialog-field">
          <label>Type:</label>
          <select value={type} onChange={(e) => handleTypeChange(e.target.value as RegistryValueType)}>
            <option value="REG_SZ">REG_SZ (String)</option>
            <option value="REG_EXPAND_SZ">REG_EXPAND_SZ (Expandable String)</option>
            <option value="REG_DWORD">REG_DWORD (32-bit)</option>
            <option value="REG_QWORD">REG_QWORD (64-bit)</option>
            <option value="REG_BINARY">REG_BINARY (Binary)</option>
            <option value="REG_MULTI_SZ">REG_MULTI_SZ (Multi-String)</option>
            <option value="REG_NONE">REG_NONE (No type)</option>
          </select>
        </div>

        <div className="dialog-field">
          <label>{isDword ? 'Value data (hex):' : 'Value data:'}</label>
          {type === 'REG_MULTI_SZ' ? (
            <textarea
              className={inputClassName}
              value={data}
              onChange={(e) => setData(e.target.value)}
              rows={4}
              placeholder="Enter each string on a new line"
            />
          ) : (
            <input
              type="text"
              className={inputClassName}
              value={data}
              onChange={(e) => setData(e.target.value)}
              placeholder={
                type === 'REG_DWORD'
                  ? '00000000'
                  : type === 'REG_QWORD'
                    ? '0000000000000000'
                    : type === 'REG_BINARY'
                      ? 'e.g. 0A FF 3C'
                      : type === 'REG_EXPAND_SZ'
                        ? 'e.g. %SystemRoot%\\system32'
                        : ''
              }
            />
          )}
          {displayValidation.error && (
            <div className="validation-error">{displayValidation.error}</div>
          )}
          {displayValidation.warning && !displayValidation.error && (
            <div className="validation-warning">{displayValidation.warning}</div>
          )}
        </div>

        <div className="dialog-hint">{getTypeDescription(type)}</div>

        <div className="dialog-buttons">
          <button
            type="submit"
            className="primary"
            disabled={!validation.valid || !!nameError}
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
