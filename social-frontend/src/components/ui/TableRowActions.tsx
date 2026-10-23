"use client";

import { useState, type MouseEvent, type ReactNode } from "react";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import OpenInNewOutlinedIcon from "@mui/icons-material/OpenInNewOutlined";
import { IconButton, ListItemIcon, ListItemText, Menu, MenuItem } from "@mui/material";

export type TableRowAction = {
  id: string;
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
};

const defaultIcons: Record<string, ReactNode> = {
  view: <OpenInNewOutlinedIcon sx={{ fontSize: 18 }} />,
  edit: <EditOutlinedIcon sx={{ fontSize: 18 }} />,
  delete: <DeleteOutlinedIcon sx={{ fontSize: 18 }} />,
};

type TableRowActionsProps = {
  actions: TableRowAction[];
  ariaLabel?: string;
};

export default function TableRowActions({ actions, ariaLabel = "Row actions" }: TableRowActionsProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);

  const handleOpen = (event: MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleSelect = (action: TableRowAction) => {
    handleClose();
    action.onClick();
  };

  if (actions.length === 0) return null;

  return (
    <>
      <IconButton
        size="small"
        aria-label={ariaLabel}
        onClick={handleOpen}
        sx={{ color: "text.secondary" }}
      >
        <MoreHorizIcon sx={{ fontSize: 20 }} />
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        onClick={(event) => event.stopPropagation()}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          paper: {
            sx: { minWidth: 168, mt: 0.5 },
          },
        }}
      >
        {actions.map((action) => (
          <MenuItem
            key={action.id}
            disabled={action.disabled}
            onClick={() => handleSelect(action)}
            sx={action.danger ? { color: "error.main" } : undefined}
          >
            <ListItemIcon sx={{ color: action.danger ? "error.main" : "inherit", minWidth: 32 }}>
              {action.icon ?? defaultIcons[action.id] ?? null}
            </ListItemIcon>
            <ListItemText primary={action.label} />
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
