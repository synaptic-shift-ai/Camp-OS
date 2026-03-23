"use client"

import { cn } from "@/lib/utils"
import { parseCancellationPolicyDisplayBlocks } from "@/lib/guest/guest-cancellation-policy"

type GuestCancellationPolicyTextProps = {
  text: string
  className?: string
}

export function GuestCancellationPolicyText({ text, className }: GuestCancellationPolicyTextProps) {
  const { intro, bullets, footer } = parseCancellationPolicyDisplayBlocks(text)

  return (
    <div className={cn("space-y-3 leading-relaxed", className)}>
      <p className="whitespace-pre-line leading-relaxed">{intro}</p>
      {bullets.length > 0 ? (
        <ul className="list-disc space-y-1.5 pl-5">
          {bullets.map((line, index) => (
            <li
              key={`${index}-${line.slice(0, 40)}`}
              className="whitespace-pre-line leading-relaxed"
            >
              {line}
            </li>
          ))}
        </ul>
      ) : null}
      {footer ? (
        <p className="whitespace-pre-line pt-1 leading-relaxed">{footer}</p>
      ) : null}
    </div>
  )
}
