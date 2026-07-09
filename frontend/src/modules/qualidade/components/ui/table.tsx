"use client"

import * as React from "react"

import { cn } from "@qualidade/lib/utils"

function Table({
  className,
  surface = false,
  bare = false,
  ...props
}: React.ComponentProps<"table"> & { surface?: boolean; bare?: boolean }) {
  const table = (
    <table
      data-slot="table"
      className={cn("sgq-table w-full caption-bottom text-sm", className)}
      {...props}
    />
  )

  if (bare) {
    return table
  }

  if (!surface) {
    return (
      <div
        data-slot="table-container"
        className="relative w-full overflow-x-auto"
      >
        {table}
      </div>
    )
  }

  return (
    <div
      data-slot="table-container"
      data-surface="true"
      className="sgq-table-surface relative w-full overflow-hidden rounded-xl border border-border bg-card shadow-sm ring-1 ring-foreground/6"
    >
      <div className="overflow-x-auto">{table}</div>
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-0", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b border-border/50 bg-transparent transition-colors hover:bg-muted/45 has-aria-expanded:bg-muted/45 data-[state=selected]:bg-muted/55",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-11 bg-table-header px-4 text-left align-middle text-xs font-semibold tracking-wide whitespace-nowrap text-table-header-foreground first:pl-5 last:pr-5 [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "px-4 py-3.5 align-middle whitespace-nowrap first:pl-5 last:pr-5 [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
