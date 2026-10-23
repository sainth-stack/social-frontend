"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Checkbox,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
} from "@mui/material";

import EmptyState from "@/components/ui/EmptyState";
import LoadingState from "@/components/ui/LoadingState";
import SectionTitle from "@/components/ui/SectionTitle";
import TableRowActions from "@/components/ui/TableRowActions";
import { colors, layoutTokens, tableCellPadding, tableSurfaceSx } from "@/lib/theme";

export type DataTableColumn<T> = {
  id: string;
  label: string;
  width?: string | number;
  align?: "left" | "right" | "center";
  /** Primary = dark semibold; secondary = muted gray */
  emphasis?: "primary" | "secondary";
  render: (row: T) => ReactNode;
};

type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  title?: string;
  subtitle?: string;
  toolbar?: ReactNode;
  filterSlot?: ReactNode;
  emptyMessage?: string;
  emptyDescription?: string;
  loading?: boolean;
  pagination?: boolean;
  defaultPageSize?: number;
  pageSizeOptions?: number[];
  serverPagination?: boolean;
  totalCount?: number;
  page?: number;
  rowsPerPage?: number;
  onPageChange?: (page: number) => void;
  onRowsPerPageChange?: (rowsPerPage: number) => void;
  selectable?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  rowHref?: (row: T) => string | undefined;
  /** Row click when `rowHref` is not set — e.g. open a detail drawer. */
  onRowClick?: (row: T) => void;
  /** Optional trailing actions column (edit/delete menus). */
  rowActions?: (row: T) => import("@/components/ui/TableRowActions").TableRowAction[];
};

const headCellSx = {
  fontWeight: 500,
  fontSize: "0.8125rem",
  color: colors.textSecondary,
  bgcolor: layoutTokens.tableHeaderBg,
  borderBottom: `1px solid ${colors.border}`,
  whiteSpace: "nowrap" as const,
  ...tableCellPadding.head,
};

const bodyCellSx = {
  fontSize: "0.875rem",
  color: colors.textPrimary,
  borderBottom: `1px solid ${colors.border}`,
  verticalAlign: "middle" as const,
  ...tableCellPadding.body,
};

export function TablePrimaryText({ children }: { children: ReactNode }) {
  return (
    <Box
      component="span"
      sx={{
        display: "block",
        fontWeight: 500,
        fontSize: "0.875rem",
        color: colors.textPrimary,
        lineHeight: 1.4,
      }}
    >
      {children}
    </Box>
  );
}

export function TableSecondaryText({ children }: { children: ReactNode }) {
  return (
    <Box
      component="span"
      sx={{
        display: "block",
        fontSize: "0.875rem",
        color: colors.textSecondary,
        lineHeight: 1.4,
      }}
    >
      {children}
    </Box>
  );
}

function cellContent<T>(column: DataTableColumn<T>, row: T): ReactNode {
  const content = column.render(row);
  if (column.emphasis === "primary") {
    return <TablePrimaryText>{content}</TablePrimaryText>;
  }
  if (column.emphasis === "secondary") {
    return <TableSecondaryText>{content}</TableSecondaryText>;
  }
  return content;
}

export default function DataTable<T>({
  columns,
  rows,
  getRowId,
  title,
  subtitle,
  toolbar,
  filterSlot,
  emptyMessage = "No data yet",
  emptyDescription,
  loading = false,
  pagination = true,
  defaultPageSize = 10,
  pageSizeOptions = [5, 10, 25],
  serverPagination = false,
  totalCount,
  page: controlledPage,
  rowsPerPage: controlledRowsPerPage,
  onPageChange,
  onRowsPerPageChange,
  selectable = false,
  selectedIds,
  onSelectionChange,
  rowHref,
  onRowClick,
  rowActions,
}: DataTableProps<T>) {
  const router = useRouter();
  const [internalPage, setInternalPage] = useState(0);
  const [internalRowsPerPage, setInternalRowsPerPage] = useState(defaultPageSize);
  const [internalSelected, setInternalSelected] = useState<string[]>([]);

  const page = serverPagination ? (controlledPage ?? 0) : internalPage;
  const rowsPerPage = serverPagination ? (controlledRowsPerPage ?? defaultPageSize) : internalRowsPerPage;
  const setPage = serverPagination ? (onPageChange ?? (() => undefined)) : setInternalPage;
  const setRowsPerPage = serverPagination
    ? (onRowsPerPageChange ?? (() => undefined))
    : setInternalRowsPerPage;

  const selected = selectedIds ?? internalSelected;
  const setSelected = onSelectionChange ?? setInternalSelected;

  useEffect(() => {
    if (!serverPagination) {
      setInternalPage(0);
    }
  }, [rows, serverPagination]);

  const hasHeader = Boolean(title || subtitle || toolbar || filterSlot);

  const paginatedRows = useMemo(() => {
    if (!pagination || serverPagination) return rows;
    const start = page * rowsPerPage;
    return rows.slice(start, start + rowsPerPage);
  }, [pagination, page, rows, rowsPerPage, serverPagination]);

  const paginationCount = serverPagination ? (totalCount ?? rows.length) : rows.length;

  const pageIds = paginatedRows.map(getRowId);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.includes(id));
  const somePageSelected = pageIds.some((id) => selected.includes(id)) && !allPageSelected;

  const toggleAll = () => {
    if (allPageSelected) {
      setSelected(selected.filter((id) => !pageIds.includes(id)));
      return;
    }
    setSelected([...new Set([...selected, ...pageIds])]);
  };

  const toggleRow = (id: string) => {
    setSelected(
      selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id],
    );
  };

  if (loading) {
    return <LoadingState variant="table" rows={defaultPageSize} columns={columns.length || 4} />;
  }

  return (
    <Paper variant="outlined" sx={{ ...tableSurfaceSx, overflow: "hidden" }}>
      {hasHeader ? (
        <Box
          sx={{
            px: 2.5,
            py: 2,
            display: "flex",
            flexDirection: "column",
            gap: 1.5,
            borderBottom: rows.length > 0 ? `1px solid ${colors.border}` : "none",
            bgcolor: colors.paper,
          }}
        >
          {title || subtitle ? (
            <SectionTitle
              title={title ?? ""}
              subtitle={subtitle}
              action={toolbar}
              spacing="none"
            />
          ) : toolbar ? (
            <Box sx={{ display: "flex", justifyContent: "flex-end" }}>{toolbar}</Box>
          ) : null}
          {filterSlot}
        </Box>
      ) : null}

      {rows.length === 0 ? (
        <EmptyState title={emptyMessage} description={emptyDescription} />
      ) : (
        <>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow
                  sx={{
                    "& th": { borderBottom: `1px solid ${colors.border}` },
                  }}
                >
                  {selectable ? (
                    <TableCell padding="checkbox" sx={{ ...headCellSx, width: 48, px: 1.5 }}>
                      <Checkbox
                        size="small"
                        checked={allPageSelected}
                        indeterminate={somePageSelected}
                        onChange={toggleAll}
                        sx={{ p: 0.5 }}
                      />
                    </TableCell>
                  ) : null}
                  {columns.map((column) => (
                    <TableCell
                      key={column.id}
                      align={column.align ?? "left"}
                      sx={{ ...headCellSx, width: column.width }}
                    >
                      {column.label}
                    </TableCell>
                  ))}
                  {rowActions ? (
                    <TableCell align="right" sx={{ ...headCellSx, width: 56, px: 1 }}>
                      Actions
                    </TableCell>
                  ) : null}
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedRows.map((row) => {
                  const rowId = getRowId(row);
                  const isSelected = selected.includes(rowId);
                  const href = rowHref?.(row);
                  const isClickable = Boolean(href || onRowClick);

                  return (
                    <TableRow
                      key={rowId}
                      hover
                      selected={isSelected}
                      onClick={
                        isClickable
                          ? (event) => {
                              const target = event.target as HTMLElement;
                              if (target.closest("a, button, input, label")) return;
                              if (href) {
                                router.push(href);
                                return;
                              }
                              onRowClick?.(row);
                            }
                          : undefined
                      }
                      sx={{
                        bgcolor: colors.paper,
                        cursor: isClickable ? "pointer" : "default",
                        "&:last-child td": { borderBottom: 0 },
                        "&:hover": { bgcolor: colors.background },
                        "&.Mui-selected": { bgcolor: colors.tableHeader },
                        "&.Mui-selected:hover": { bgcolor: colors.muted },
                      }}
                    >
                      {selectable ? (
                        <TableCell padding="checkbox" sx={{ ...bodyCellSx, width: 48, px: 1.5 }}>
                          <Checkbox
                            size="small"
                            checked={isSelected}
                            onChange={() => toggleRow(rowId)}
                            sx={{ p: 0.5 }}
                          />
                        </TableCell>
                      ) : null}
                      {columns.map((column) => (
                    <TableCell
                      key={column.id}
                      align={column.align ?? "left"}
                      sx={{ ...bodyCellSx, width: column.width }}
                    >
                      {cellContent(column, row)}
                    </TableCell>
                  ))}
                  {rowActions ? (
                    <TableCell align="right" sx={{ ...bodyCellSx, width: 56, px: 1 }}>
                      <TableRowActions actions={rowActions(row)} />
                    </TableCell>
                  ) : null}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>

          {pagination && paginationCount > 0 ? (
            <TablePagination
              component="div"
              count={paginationCount}
              page={page}
              onPageChange={(_, newPage) => setPage(newPage)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(event) => {
                const nextRowsPerPage = parseInt(event.target.value, 10);
                if (serverPagination) {
                  onRowsPerPageChange?.(nextRowsPerPage);
                  return;
                }
                setInternalRowsPerPage(nextRowsPerPage);
                setInternalPage(0);
              }}
              rowsPerPageOptions={pageSizeOptions}
              sx={{
                borderTop: `1px solid ${colors.border}`,
                bgcolor: colors.paper,
                "& .MuiTablePagination-selectLabel": {
                  display: { xs: "none", sm: "block" },
                  fontSize: "0.8125rem",
                  color: colors.textSecondary,
                },
                "& .MuiTablePagination-displayedRows": {
                  fontSize: "0.8125rem",
                  color: colors.textSecondary,
                },
                "& .MuiTablePagination-select": {
                  fontSize: "0.8125rem",
                },
              }}
            />
          ) : null}
        </>
      )}
    </Paper>
  );
}
