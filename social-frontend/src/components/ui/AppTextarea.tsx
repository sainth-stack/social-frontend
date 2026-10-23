import { forwardRef, useId } from "react";
import type { TextFieldProps } from "@mui/material";
import { TextField } from "@mui/material";

import { AppFieldWrapper, outlinedInputSx } from "@/components/ui/AppField";

export type AppTextareaProps = Omit<TextFieldProps, "multiline" | "variant"> & {
  minRows?: number;
  maxRows?: number;
  hideLabel?: boolean;
};

const AppTextarea = forwardRef<HTMLInputElement, AppTextareaProps>(function AppTextarea(
  {
    label,
    minRows = 4,
    maxRows = 12,
    fullWidth = true,
    helperText,
    error,
    required,
    hideLabel,
    id,
    sx,
    slotProps,
    ...props
  },
  ref,
) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;

  return (
    <AppFieldWrapper
      label={label}
      helperText={helperText}
      error={error}
      required={required}
      hideLabel={hideLabel}
      htmlFor={fieldId}
      fullWidth={fullWidth}
    >
      <TextField
        id={fieldId}
        inputRef={ref}
        multiline
        minRows={minRows}
        maxRows={maxRows}
        variant="outlined"
        fullWidth={fullWidth}
        error={error}
        required={required}
        sx={{
          "& .MuiOutlinedInput-root": outlinedInputSx(false, true),
          ...sx,
        }}
        slotProps={slotProps}
        {...props}
      />
    </AppFieldWrapper>
  );
});

export default AppTextarea;
