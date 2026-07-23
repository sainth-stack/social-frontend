import { forwardRef, useId } from "react";
import type { TextFieldProps } from "@mui/material";
import { MenuItem, TextField } from "@mui/material";

import { AppFieldWrapper, outlinedInputSx } from "@/components/ui/AppField";
import { colors, shadows } from "@/lib/theme";

export type AppSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export type AppSelectProps = Omit<TextFieldProps, "select" | "variant"> & {
  options: AppSelectOption[];
  placeholder?: string;
};

const AppSelect = forwardRef<HTMLInputElement, AppSelectProps>(function AppSelect(
  {
    label,
    options,
    placeholder,
    fullWidth = true,
    helperText,
    error,
    required,
    id,
    sx,
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
    >
      <TextField
        id={fieldId}
        inputRef={ref}
        select
        variant="outlined"
        fullWidth={fullWidth}
        error={error}
        required={required}
        sx={{
          "& .MuiOutlinedInput-root": outlinedInputSx(false),
          ...sx,
        }}
        slotProps={{
          select: {
            MenuProps: {
              slotProps: {
                paper: {
                  sx: {
                    mt: 0.75,
                    borderRadius: "10px",
                    border: `1px solid ${colors.border}`,
                    boxShadow: shadows.md,
                    "& .MuiMenuItem-root": {
                      fontSize: "0.875rem",
                      py: 1,
                      mx: 0.75,
                      borderRadius: "6px",
                      "&.Mui-selected": {
                        bgcolor: colors.primaryLight,
                        color: colors.primary,
                        fontWeight: 500,
                      },
                    },
                  },
                },
              },
            },
          },
        }}
        {...props}
      >
        {placeholder ? (
          <MenuItem value="" disabled>
            {placeholder}
          </MenuItem>
        ) : null}
        {options.map((option) => (
          <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </MenuItem>
        ))}
      </TextField>
    </AppFieldWrapper>
  );
});

export default AppSelect;
