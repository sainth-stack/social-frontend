import { forwardRef, useId } from "react";
import type { TextFieldProps } from "@mui/material";
import { TextField } from "@mui/material";

import { AppFieldWrapper, outlinedInputSx } from "@/components/ui/AppField";

export type AppInputProps = Omit<TextFieldProps, "variant"> & {
  compact?: boolean;
  hideLabel?: boolean;
};

const AppInput = forwardRef<HTMLInputElement, AppInputProps>(function AppInput(
  {
    label,
    compact = false,
    hideLabel = false,
    fullWidth = true,
    helperText,
    error,
    required,
    id,
    sx,
    slotProps,
    multiline = false,
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
      htmlFor={fieldId}
      fullWidth={fullWidth}
      hideLabel={hideLabel}
    >
      <TextField
        id={fieldId}
        inputRef={ref}
        variant="outlined"
        fullWidth={fullWidth}
        error={error}
        required={required}
        multiline={multiline}
        sx={{
          "& .MuiOutlinedInput-root": outlinedInputSx(compact, multiline),
          ...sx,
        }}
        slotProps={{
          ...slotProps,
          inputLabel: { shrink: false, ...slotProps?.inputLabel },
        }}
        {...props}
      />
    </AppFieldWrapper>
  );
});

export default AppInput;
