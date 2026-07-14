import * as React from "react";

import { cn } from "@rh/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground shadow-level-1 ring-offset-background placeholder:text-muted-foreground hover:border-primary/35 focus-visible:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 read-only:cursor-default read-only:bg-muted read-only:text-foreground read-only:opacity-100 disabled:cursor-not-allowed disabled:bg-muted disabled:text-foreground disabled:opacity-100",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
