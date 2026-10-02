import { useEffect, useRef } from "react";

export default function SwitchConfirmation({ change, hasDraft, loading, onCancel, onConfirm }) {
  const dialogRef = useRef(null);
  const cancelRef = useRef(null);
  const confirmRef = useRef(null);

  useEffect(() => {
    const previous = document.activeElement;
    const dialog = dialogRef.current;
    dialog.showModal();
    cancelRef.current.focus();
    return () => {
      dialog.close();
      if (previous?.isConnected && previous !== document.body) previous.focus();
      else document.querySelector(".shift-trigger, .mode-switch")?.focus();
    };
  }, []);

  return (
    <dialog ref={dialogRef} className="switch-confirmation" aria-labelledby="switch-title"
      aria-describedby="switch-description" onCancel={(event) => { event.preventDefault(); onCancel(); }}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key !== "Tab") return;
        if (event.shiftKey && document.activeElement === cancelRef.current) {
          event.preventDefault();
          confirmRef.current.focus();
        } else if (!event.shiftKey && document.activeElement === confirmRef.current) {
          event.preventDefault();
          cancelRef.current.focus();
        }
      }}>
      <h2 id="switch-title">{change.title}</h2>
      <p id="switch-description">
        {change.id ? "Your current chat stays in History." : "A fresh chat will open. This conversation stays in History."}
        {hasDraft && " Unsent text and attachments will be discarded."}
        {loading && " The current reply will stop."}
      </p>
      <div className="switch-confirmation-actions">
        <button ref={cancelRef} onClick={onCancel}>Cancel</button>
        <button ref={confirmRef} className="switch-confirm" onClick={onConfirm}>{change.id ? "Open chat" : "Switch"}</button>
      </div>
    </dialog>
  );
}
