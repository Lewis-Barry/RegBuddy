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

type Base = 'hex' | 'dec';

/** Drop leading zeros for display (regedit shows "1", not "00000001"). */
function stripLeadingZeros(hex: string): string {
  const s = hex.replace(/^0+/, '');
  return s === '' ? '0' : s;
}

/**
 * Parse a DWORD/QWORD field in the chosen base into canonical padded hex.
 * Returns the hex (for saving) or an error message.
 */
function parseNumeric(
  value: string,
  base: Base,
  type: RegistryValueType,
): { hex: string | null; error?: string } {
  const bits = type === 'REG_QWORD' ? 64 : 32;
  const max = (1n << BigInt(bits)) - 1n;
  const trimmed = value.trim().replace(/^0x/i, '');

  if (trimmed === '') return { hex: null, error: 'Value is required.' };

  let num: bigint;
  if (base === 'hex') {
    if (!/^[0-9a-fA-F]+$/.test(trimmed)) {
      return { hex: null, error: 'Enter a valid hexadecimal number (0-9, A-F).' };
    }
    num = BigInt('0x' + trimmed);
  } else {
    if (!/^[0-9]+$/.test(trimmed)) {
      return { hex: null, error: 'Enter a valid decimal number (0-9).' };
    }
    num = BigInt(trimmed);
  }

  if (num > max) {
    return { hex: null, error: `Value exceeds the ${bits}-bit maximum.` };
  }
  return { hex: num.toString(16).padStart(bits / 4, '0') };
}

export const EditValueDialog: React.FC<EditValueDialogProps> = ({
  data,
  onSave,
  onCancel,
}) => {
  const isNumeric = data.type === 'REG_DWORD' || data.type === 'REG_QWORD';
  const isMulti = data.type === 'REG_MULTI_SZ';

  const [base, setBase] = useState<Base>('hex');
  const [value, setValue] = useState(() =>
    isNumeric ? stripLeadingZeros(data.data || '0') : data.data,
  );

  // Validation: numeric types parse against the current base; others use the
  // type validators directly.
  const numeric = useMemo(
    () => (isNumeric ? parseNumeric(value, base, data.type) : null),
    [isNumeric, value, base, data.type],
  );
  const validation: ValidationResult = useMemo(() => {
    if (isNumeric) {
      return numeric!.error ? { valid: false, error: numeric!.error } : { valid: true };
    }
    return validateRegistryValue(data.type, value);
  }, [isNumeric, numeric, data.type, value]);

  // Debounced validation drives the visible message (avoids flicker while typing).
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
    const finalValue = isNumeric
      ? numeric!.hex!
      : sanitizeRegistryValue(data.type, value);
    onSave({ ...data, data: finalValue });
  };

  // Switch base, converting the current value so it represents the same number.
  const switchBase = (next: Base) => {
    if (next === base) return;
    const parsed = parseNumeric(value, base, data.type);
    if (parsed.hex !== null) {
      const num = BigInt('0x' + parsed.hex);
      setValue(next === 'hex' ? num.toString(16) : num.toString(10));
    }
    setBase(next);
  };

  const inputClassName =
    !displayValidation.valid ? 'input-error' : displayValidation.warning ? 'input-warning' : '';

  const messages = (
    <>
      {displayValidation.error && (
        <div className="validation-error">{displayValidation.error}</div>
      )}
      {displayValidation.warning && !displayValidation.error && (
        <div className="validation-warning">{displayValidation.warning}</div>
      )}
    </>
  );

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

        {isNumeric ? (
          <div className="dialog-field dword-field">
            <div className="dword-main">
              <label>Value data:</label>
              <input
                type="text"
                className={inputClassName}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                autoFocus
                placeholder="0"
              />
              {messages}
            </div>
            <fieldset className="base-group">
              <legend>Base</legend>
              <label>
                <input
                  type="radio"
                  name="base"
                  checked={base === 'hex'}
                  onChange={() => switchBase('hex')}
                />
                Hexadecimal
              </label>
              <label>
                <input
                  type="radio"
                  name="base"
                  checked={base === 'dec'}
                  onChange={() => switchBase('dec')}
                />
                Decimal
              </label>
            </fieldset>
          </div>
        ) : (
          <div className="dialog-field">
            <label>Value data:</label>
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
              />
            )}
            {messages}
          </div>
        )}

        <div className="dialog-hint">{getTypeDescription(data.type)}</div>

        <div className="dialog-buttons">
          <button type="submit" className="primary" disabled={!validation.valid}>
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
