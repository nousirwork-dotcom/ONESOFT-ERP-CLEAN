import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent, KeyboardEvent, MouseEvent, ReactNode, Ref } from "react";
import "./EditableGridCell.css";

export type EditableGridKeyAction =
  | "navigate"
  | "start-edit"
  | "replace"
  | "commit"
  | "cancel"
  | "pass-through";

export function resolveEditableGridKey(input: {
  key: string;
  isEditing: boolean;
  lookupOpen?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
}) : EditableGridKeyAction {
  const { key, isEditing, lookupOpen = false, ctrlKey = false, metaKey = false } = input;
  if (lookupOpen && (key === "Escape" || key === "Enter" || key === "Tab")) return "pass-through";
  if (isEditing && key === "Escape") return "cancel";
  if (isEditing && (key === "Enter" || key === "Tab")) return "commit";
  if (!isEditing && key === "F2") return "start-edit";
  if (!isEditing && !ctrlKey && !metaKey && (key === "Backspace" || key === "Delete")) return "replace";
  if (!isEditing && !ctrlKey && !metaKey && key.length === 1) return "replace";
  if (!isEditing && (key === "Enter" || key === "Tab" || key.startsWith("Arrow"))) return "navigate";
  return "pass-through";
}

export type EditableGridRenderProps = {
  isSelected: boolean;
  isEditing: boolean;
  typingToReplace: boolean;
  inputRef: Ref<HTMLInputElement>;
  inputProps: {
    value: string;
    readOnly: boolean;
    onChange: (event: ChangeEvent<HTMLInputElement>) => void;
    onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
    onMouseDown: (event: MouseEvent<HTMLInputElement>) => void;
    onFocus: () => void;
    onBlur: () => void;
  };
  onChange: (value: string) => void;
  handleKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  handleMouseDown: (event: MouseEvent<HTMLElement>) => void;
  startEditing: () => void;
  commitEditing: () => void;
  cancelEditing: () => void;
  setLookupOpen: (open: boolean) => void;
};

export type EditableGridCellProps = {
  value: string;
  onChange: (value: string) => void;
  onNavigate: (event: KeyboardEvent<HTMLInputElement>) => void;
  onCommit?: (value: string) => void;
  onCancel?: (value: string) => void;
  onStartEditing?: (value: string) => void;
  children: (props: EditableGridRenderProps) => ReactNode;
  className?: string;
  disabled?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
};

export default function EditableGridCell({
  value,
  onChange,
  onNavigate,
  onCommit,
  onCancel,
  onStartEditing,
  children,
  className,
  disabled = false,
  isSelected: selectedProp,
  onSelect,
}: EditableGridCellProps) {
  const [internalSelected, setInternalSelected] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [typingToReplace, setTypingToReplace] = useState(false);
  const [lookupOpen, setLookupOpen] = useState(false);
  const inputElement = useRef<HTMLInputElement | null>(null);
  const selectedRef = useRef(false);
  const editingRef = useRef(false);
  const originalValue = useRef(value);
  const isControlled = selectedProp !== undefined;
  const isSelected = isControlled ? selectedProp : internalSelected;

  useEffect(() => {
    if (isControlled) selectedRef.current = Boolean(selectedProp);
    if (isControlled && !selectedProp) {
      editingRef.current = false;
      setIsEditing(false);
    }
  }, [isControlled, selectedProp]);

  const focusInput = useCallback((placeCaretAtEnd = false) => {
    requestAnimationFrame(() => {
      const input = inputElement.current;
      if (!input) return;
      input.focus();
      if (placeCaretAtEnd && typeof input.setSelectionRange === "function") {
        const end = input.value.length;
        input.setSelectionRange(end, end);
      }
    });
  }, []);

  const setSelectionMode = useCallback(() => {
    selectedRef.current = true;
    editingRef.current = false;
    setInternalSelected(true);
    setIsEditing(false);
    setTypingToReplace(false);
    onSelect?.();
  }, [onSelect]);

  const startEditing = useCallback((replacement?: string) => {
    originalValue.current = value;
    selectedRef.current = true;
    editingRef.current = true;
    setInternalSelected(true);
    setIsEditing(true);
    setTypingToReplace(replacement !== undefined);
    onSelect?.();
    onStartEditing?.(value);
    if (replacement !== undefined) onChange(replacement);
    focusInput(replacement !== undefined);
  }, [focusInput, onChange, onSelect, onStartEditing, value]);

  const commitEditing = useCallback(() => {
    if (!editingRef.current) return;
    editingRef.current = false;
    selectedRef.current = true;
    setInternalSelected(true);
    setIsEditing(false);
    setTypingToReplace(false);
    onCommit?.(value);
  }, [onCommit, value]);

  const cancelEditing = useCallback(() => {
    if (!editingRef.current) return;
    const previous = originalValue.current;
    editingRef.current = false;
    selectedRef.current = true;
    setInternalSelected(true);
    setIsEditing(false);
    setTypingToReplace(false);
    onChange(previous);
    onCancel?.(previous);
    focusInput();
  }, [focusInput, onCancel, onChange]);

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    const action = resolveEditableGridKey({
      key: event.key,
      isEditing: editingRef.current,
      lookupOpen,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
    });

    if (action === "pass-through") return;
    if (action === "cancel") {
      event.preventDefault();
      event.stopPropagation();
      cancelEditing();
      return;
    }
    if (action === "commit") {
      event.preventDefault();
      event.stopPropagation();
      commitEditing();
      onNavigate(event);
      return;
    }
    if (action === "start-edit") {
      event.preventDefault();
      event.stopPropagation();
      startEditing();
      return;
    }
    if (action === "replace") {
      event.preventDefault();
      event.stopPropagation();
      startEditing(event.key === "Backspace" || event.key === "Delete" ? "" : event.key);
      return;
    }
    if (action === "navigate") {
      event.preventDefault();
      event.stopPropagation();
      onNavigate(event);
    }
  }, [cancelEditing, commitEditing, lookupOpen, onNavigate, startEditing]);

  const handleMouseDown = useCallback((event: MouseEvent<HTMLElement>) => {
    if (disabled) return;
    const isCurrentSelection = isControlled ? Boolean(selectedProp) : selectedRef.current;
    if (!isCurrentSelection) {
      event.preventDefault();
      setSelectionMode();
      if (event.target instanceof HTMLInputElement) inputElement.current = event.target;
      focusInput();
      return;
    }
    if (!editingRef.current) {
      startEditing();
    }
  }, [disabled, focusInput, isControlled, selectedProp, setSelectionMode, startEditing]);

  const handleFocus = useCallback(() => {
    if (!editingRef.current) setSelectionMode();
  }, [setSelectionMode]);

  const handleBlur = useCallback(() => {
    if (editingRef.current) commitEditing();
  }, [commitEditing]);

  const renderProps: EditableGridRenderProps = {
    isSelected,
    isEditing,
    typingToReplace,
    inputRef: element => {
      inputElement.current = element;
    },
    inputProps: {
      value,
      readOnly: !isEditing || disabled,
      onChange: event => onChange(event.currentTarget.value),
      onKeyDown: handleKeyDown,
      onMouseDown: handleMouseDown,
      onFocus: handleFocus,
      onBlur: handleBlur,
    },
    onChange,
    handleKeyDown,
    handleMouseDown,
    startEditing: () => startEditing(),
    commitEditing,
    cancelEditing,
    setLookupOpen,
  };

  return (
    <div className={`document-grid-cell${isSelected ? " is-selected" : ""}${isEditing ? " is-editing" : ""}${className ? ` ${className}` : ""}`}>
      {children(renderProps)}
    </div>
  );
}