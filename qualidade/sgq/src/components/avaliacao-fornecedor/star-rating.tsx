"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/utils";
import { NOTA_MAX } from "@/lib/avaliacao-fornecedor/criterios";

const SIZES = {
  sm: { star: "size-5", gap: "gap-0.5", text: "text-xs" },
  md: { star: "size-8", gap: "gap-1", text: "text-sm" },
  lg: { star: "size-10", gap: "gap-1.5", text: "text-base" },
} as const;

type StarSize = keyof typeof SIZES;

interface StarRatingProps {
  value: number | "";
  onChange?: (value: number) => void;
  readonly?: boolean;
  disabled?: boolean;
  size?: StarSize;
  id?: string;
  "aria-label"?: string;
  showValue?: boolean;
}

function StarIcon({
  filled,
  highlighted,
  size,
  gradientId,
}: {
  filled: boolean;
  highlighted: boolean;
  size: StarSize;
  gradientId: string;
}) {
  const sizeClass = SIZES[size].star;
  const fillGradientId = `${gradientId}-fill`;
  const hoverGradientId = `${gradientId}-hover`;

  const fill = filled
    ? highlighted
      ? `url(#${hoverGradientId})`
      : `url(#${fillGradientId})`
    : "var(--star-empty-fill, #f3ead8)";

  const stroke = filled
    ? highlighted
      ? "#e8940a"
      : "#d4880a"
    : "var(--star-empty-stroke, #dcc9a3)";

  return (
    <svg
      viewBox="0 0 24 24"
      className={cn(
        sizeClass,
        "star-icon transition-all duration-200 ease-out",
        highlighted && "scale-110",
        filled ? "star-icon--filled" : "star-icon--empty"
      )}
      aria-hidden
    >
      <defs>
        <linearGradient id={fillGradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffd56a" />
          <stop offset="45%" stopColor="#fbb03b" />
          <stop offset="100%" stopColor="#e8940a" />
        </linearGradient>
        <linearGradient id={hoverGradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffe08a" />
          <stop offset="100%" stopColor="#fbb03b" />
        </linearGradient>
      </defs>
      <path
        d="M12 2.5l2.82 5.71 6.3.92-4.56 4.44 1.08 6.27L12 17.77l-5.64 2.07 1.08-6.27L2.88 9.13l6.3-.92L12 2.5z"
        fill={fill}
        stroke={stroke}
        strokeWidth="1.25"
        strokeLinejoin="round"
        className="transition-all duration-200"
      />
    </svg>
  );
}

function StarRatingInner({
  value,
  onChange,
  readonly: isReadonly = false,
  disabled = false,
  size = "md",
  id,
  "aria-label": ariaLabel,
  showValue = false,
  displayValue,
  hoverValue,
  setHoverValue,
}: StarRatingProps & {
  displayValue: number;
  hoverValue: number | null;
  setHoverValue: (v: number | null) => void;
}) {
  const gradientId = useId().replace(/:/g, "");
  const stars = Array.from({ length: NOTA_MAX }, (_, index) => index + 1);
  const numericValue = value === "" ? 0 : value;

  return (
    <div className="star-rating inline-flex flex-col gap-1">
      <div
        id={id}
        role={isReadonly ? "img" : "radiogroup"}
        aria-label={
          ariaLabel ??
          (isReadonly
            ? `Classificação: ${numericValue} de ${NOTA_MAX} estrelas`
            : "Classificação por estrelas")
        }
        className={cn("inline-flex items-center", SIZES[size].gap)}
        onMouseLeave={() => !isReadonly && !disabled && setHoverValue(null)}
      >
        {stars.map((star) => {
          const filled = star <= displayValue;
          const highlighted = hoverValue !== null && star <= hoverValue;

          if (isReadonly) {
            return (
              <span key={star} className="inline-flex">
                <StarIcon
                  filled={filled}
                  highlighted={false}
                  size={size}
                  gradientId={gradientId}
                />
              </span>
            );
          }

          return (
            <button
              key={star}
              type="button"
              role="radio"
              aria-checked={value === star}
              aria-label={`${star} ${star === 1 ? "estrela" : "estrelas"}`}
              disabled={disabled}
              className={cn(
                "inline-flex rounded-md p-0.5 transition-transform duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2",
                disabled
                  ? "cursor-not-allowed opacity-50"
                  : "hover:scale-105 active:scale-95"
              )}
              onClick={() => onChange?.(star)}
              onMouseEnter={() => !disabled && setHoverValue(star)}
            >
              <StarIcon
                filled={filled}
                highlighted={highlighted}
                size={size}
                gradientId={gradientId}
              />
            </button>
          );
        })}
      </div>

      {showValue && numericValue > 0 ? (
        <span
          className={cn(
            "font-medium tabular-nums text-muted-foreground",
            SIZES[size].text
          )}
        >
          {numericValue}/{NOTA_MAX}
        </span>
      ) : null}
    </div>
  );
}

export function StarRating(props: StarRatingProps) {
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const numericValue = props.value === "" ? 0 : props.value;
  const displayValue = hoverValue ?? numericValue;

  return (
    <StarRatingInner
      {...props}
      displayValue={displayValue}
      hoverValue={hoverValue}
      setHoverValue={setHoverValue}
    />
  );
}

export function StarRatingDisplay({
  value,
  size = "sm",
  showValue = true,
}: {
  value: number;
  size?: StarSize;
  showValue?: boolean;
}) {
  return (
    <StarRatingInner
      value={value}
      readonly
      size={size}
      showValue={showValue}
      displayValue={value}
      hoverValue={null}
      setHoverValue={() => {}}
    />
  );
}
