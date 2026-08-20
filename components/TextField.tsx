"use client";

import { useEffect, useRef, useState } from "react";

export interface TextFieldProps {
  label: string;
  value: string;
  placeholder?: string;
  /** Called once the edit is finished, not on every keystroke. */
  onCommit: (value: string) => void;
  /**
   * When true, an empty value is rejected and the field snaps back. A node has
   * to be called something; its detail line does not.
   */
  required?: boolean;
  className?: string;
  inputClassName?: string;
}

/**
 * A text input that commits on blur or Enter rather than on every keystroke.
 *
 * Two reasons it cannot be a plain controlled input over the document. Undo is
 * a stack of whole documents, so committing per keystroke would make ten
 * characters ten undo steps. And the document rejects an empty label, so a
 * controlled input would refuse the intermediate empty state and you could
 * never clear the field to retype it.
 */
export function TextField({
  label,
  value,
  placeholder,
  onCommit,
  required = false,
  className,
  inputClassName,
}: TextFieldProps) {
  const [draft, setDraft] = useState(value);
  const committed = useRef(value);

  // Follow the document when it changes underneath us - a different node
  // selected, an undo, a re-extraction.
  useEffect(() => {
    committed.current = value;
    setDraft(value);
  }, [value]);

  const commit = () => {
    const next = draft.trim();
    if (required && !next) {
      setDraft(committed.current);
      return;
    }
    if (next === committed.current.trim()) return;
    committed.current = next;
    onCommit(next);
  };

  return (
    <label className={className}>
      {label}
      <input
        className={inputClassName}
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
          if (e.key === "Escape") {
            setDraft(committed.current);
            e.currentTarget.blur();
          }
        }}
      />
    </label>
  );
}
