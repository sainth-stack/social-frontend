import { forwardRef } from "react";
import type { CheckboxProps } from "@mui/material";
import {
  Checkbox,
  FormControl,
  FormControlLabel,
  FormHelperText,
} from "@mui/material";

export type AppCheckboxProps = Omit<CheckboxProps, "color"> & {
  label?: string;
  error?: boolean;
  helperText?: string;
};

const AppCheckbox = forwardRef<HTMLButtonElement, AppCheckboxProps>(function AppCheckbox(
  { label, error, helperText, sx, ...props },
  ref,
) {
  return (
    <FormControl error={error} sx={sx}>
      <FormControlLabel
        control={<Checkbox ref={ref} color="primary" {...props} />}
        label={label}
        sx={{
          "& .MuiFormControlLabel-label": {
            fontSize: "0.875rem",
            color: "text.primary",
          },
        }}
      />
      {helperText ? <FormHelperText>{helperText}</FormHelperText> : null}
    </FormControl>
  );
});

export default AppCheckbox;
