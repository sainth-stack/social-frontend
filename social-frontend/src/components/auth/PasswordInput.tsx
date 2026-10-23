"use client";

import { forwardRef, useState } from "react";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import { IconButton, InputAdornment } from "@mui/material";

import AppInput, { type AppInputProps } from "@/components/ui/AppInput";

type PasswordInputProps = Omit<AppInputProps, "type">;

const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(function PasswordInput(
  { slotProps, ...props },
  ref,
) {
  const [visible, setVisible] = useState(false);

  return (
    <AppInput
      ref={ref}
      type={visible ? "text" : "password"}
      slotProps={{
        ...slotProps,
        input: {
          ...slotProps?.input,
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                type="button"
                aria-label={visible ? "Hide password" : "Show password"}
                onClick={() => setVisible((current) => !current)}
                edge="end"
                size="small"
                sx={{ color: "text.secondary" }}
              >
                {visible ? (
                  <VisibilityOffOutlinedIcon fontSize="small" />
                ) : (
                  <VisibilityOutlinedIcon fontSize="small" />
                )}
              </IconButton>
            </InputAdornment>
          ),
        },
      }}
      {...props}
    />
  );
});

export default PasswordInput;
