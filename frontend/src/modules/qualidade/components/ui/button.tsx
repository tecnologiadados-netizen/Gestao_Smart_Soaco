"use client"

import * as React from "react"
import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { Loader2 } from "lucide-react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@qualidade/lib/utils"

const PRESS_MIN_MS = 140

const buttonVariants = cva(
  "sgq-btn-action group/button relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap outline-none select-none touch-manipulation transition-[transform,box-shadow,filter,background-color,color] duration-200 ease-out focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/80",
        outline:
          "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function getPressStyle(
  variant: VariantProps<typeof buttonVariants>["variant"]
): React.CSSProperties {
  if (variant === "link") {
    return {}
  }

  if (variant === "destructive") {
    return {
      transform: "scale(0.94)",
      filter: "brightness(0.86)",
      boxShadow: "inset 0 2px 8px rgba(220, 38, 38, 0.28)",
    }
  }

  return {
    transform: "scale(0.94)",
    filter: "brightness(0.9)",
    boxShadow: "inset 0 2px 8px rgba(4, 30, 66, 0.2)",
  }
}

function Button({
  className,
  variant = "default",
  size = "default",
  disabled,
  loading = false,
  style,
  children,
  ref,
  onPointerDown,
  onPointerUp,
  onPointerLeave,
  onPointerCancel,
  onKeyDown,
  onKeyUp,
  ...props
}: ButtonPrimitive.Props &
  VariantProps<typeof buttonVariants> & {
    loading?: boolean
    ref?: React.Ref<HTMLButtonElement>
  }) {
  const [pressed, setPressed] = React.useState(false)
  const pressStartedAtRef = React.useRef(0)
  const releaseTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  )

  const isDisabled = Boolean(disabled || loading)
  const showPressFeedback = pressed && variant !== "link"

  React.useEffect(() => {
    return () => {
      if (releaseTimerRef.current) {
        clearTimeout(releaseTimerRef.current)
      }
    }
  }, [])

  function press() {
    if (releaseTimerRef.current) {
      clearTimeout(releaseTimerRef.current)
      releaseTimerRef.current = null
    }
    pressStartedAtRef.current = Date.now()
    setPressed(true)
  }

  function releasePress() {
    const elapsed = Date.now() - pressStartedAtRef.current
    const remaining = Math.max(0, PRESS_MIN_MS - elapsed)

    releaseTimerRef.current = setTimeout(() => {
      setPressed(false)
      releaseTimerRef.current = null
    }, remaining)
  }

  return (
    <ButtonPrimitive
      ref={ref}
      data-slot="button"
      data-variant={variant ?? "default"}
      data-pressed={showPressFeedback ? "true" : undefined}
      data-loading={loading ? "true" : undefined}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={cn(buttonVariants({ variant, size }), className)}
      style={{
        ...style,
        ...(showPressFeedback ? getPressStyle(variant) : null),
      }}
      onPointerDown={(event) => {
        if (!isDisabled && event.button === 0) {
          press()
        }
        onPointerDown?.(event)
      }}
      onPointerUp={(event) => {
        if (pressed) {
          releasePress()
        }
        onPointerUp?.(event)
      }}
      onPointerLeave={(event) => {
        if (pressed) {
          releasePress()
        }
        onPointerLeave?.(event)
      }}
      onPointerCancel={(event) => {
        if (pressed) {
          releasePress()
        }
        onPointerCancel?.(event)
      }}
      onKeyDown={(event) => {
        if (!isDisabled && (event.key === "Enter" || event.key === " ")) {
          press()
        }
        onKeyDown?.(event)
      }}
      onKeyUp={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          releasePress()
        }
        onKeyUp?.(event)
      }}
      {...props}
    >
      {variant !== "link" ? (
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-0 rounded-[inherit] transition-opacity duration-150",
            showPressFeedback ? "opacity-100" : "opacity-0",
            variant === "destructive" ? "bg-red-500/15" : "bg-[#041e42]/12"
          )}
        />
      ) : null}
      <span className="relative z-[1] inline-flex items-center justify-center gap-[inherit]">
        {loading ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : null}
        {children}
      </span>
    </ButtonPrimitive>
  )
}

export { Button, buttonVariants }
