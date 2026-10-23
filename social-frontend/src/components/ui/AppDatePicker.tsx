import { forwardRef } from "react";

import AppInput from "@/components/ui/AppInput";

export type AppDatePickerProps = {
  label?: string;
  value?: string;
  onChange?: (value: string) => void;
  error?: boolean;
  helperText?: string;
  fullWidth?: boolean;
  disabled?: boolean;
  min?: string;
  max?: string;
  name?: string;
};

/** Placeholder date input — swap for MUI X DatePicker later */
const AppDatePicker = forwardRef<HTMLInputElement, AppDatePickerProps>(function AppDatePicker(
  { label, value, onChange, error, helperText, fullWidth = true, disabled, min, max, name },
  ref,
) {
  return (
    <AppInput
      ref={ref}
      type="date"
      name={name}
      label={label}
      value={value ?? ""}
      onChange={(event) => onChange?.(event.target.value)}
      error={error}
      helperText={helperText}
      fullWidth={fullWidth}
      disabled={disabled}
      slotProps={{
        inputLabel: { shrink: true },
        htmlInput: { min, max },
      }}
    />
  );
});

export default AppDatePicker;
