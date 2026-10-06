"use client";

import { useId } from "react";
import { Check, Loader2 } from "lucide-react";
import { useLanguage } from "../../components/LanguageProvider";

type Props = {
  task: { task_text: string; completed: boolean };
  pending: boolean;
  disabled: boolean;
  error: boolean;
  onToggle: () => void;
};

export function TaskCompletionControl({ task, pending, disabled, error, onToggle }: Props) {
  const { language } = useLanguage();
  const id = useId();
  const action = pending
    ? language === "tr" ? "Kaydediliyor" : "Saving"
    : task.completed
      ? language === "tr" ? "Tamamlandı" : "Completed"
      : language === "tr" ? "Tamamla" : "Mark complete";

  return (
    <div data-i18n-ignore>
      <div className="flex min-w-0 items-start justify-between gap-3 sm:gap-4">
        <p id={`${id}-task`} className={`min-w-0 flex-1 break-words pt-3 font-semibold [overflow-wrap:anywhere] ${task.completed ? "text-slate-500 line-through" : "text-slate-900"}`}>
          {task.task_text}
        </p>
        <div className="flex w-16 shrink-0 flex-col items-end gap-1.5">
          <button
            type="button"
            role="checkbox"
            aria-checked={task.completed}
            aria-labelledby={`${id}-action ${id}-task`}
            aria-describedby={error ? `${id}-error` : undefined}
            aria-busy={pending}
            disabled={disabled || pending}
            onClick={onToggle}
            className={`group flex h-12 w-12 items-center justify-center rounded-xl border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-4 disabled:cursor-default disabled:opacity-70 ${task.completed ? "border-emerald-600 bg-emerald-600 text-white enabled:hover:bg-emerald-700" : "border-cyan-600 bg-white text-cyan-700 enabled:hover:bg-cyan-50"}`}
          >
            {pending ? <Loader2 aria-hidden className="h-6 w-6 animate-spin" /> : <Check aria-hidden strokeWidth={3} className={`h-6 w-6 ${task.completed ? "" : "opacity-30 group-hover:opacity-70"}`} />}
          </button>
          <span id={`${id}-action`} aria-live="polite" className={`w-full text-right text-[11px] font-semibold leading-4 ${task.completed ? "text-emerald-700" : "text-cyan-800"}`}>
            {action}
          </span>
        </div>
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-3 text-sm font-medium text-red-700">
          {language === "tr" ? "Kaydedilemedi. Tekrar denemek için kutuya basın." : "Couldn’t save. Select the checkbox to try again."}
        </p>
      )}
    </div>
  );
}
