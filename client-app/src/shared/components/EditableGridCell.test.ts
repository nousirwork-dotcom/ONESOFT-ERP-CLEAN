import { describe, expect, it } from "vitest";
import { resolveEditableGridKey } from "./EditableGridCell";

describe("EditableGridCell selection and editing policy", () => {
  it("starts editing with F2 without selecting the existing value", () => {
    expect(resolveEditableGridKey({ key: "F2", isEditing: false })).toBe("start-edit");
  });

  it("replaces a selected cell when typing starts", () => {
    expect(resolveEditableGridKey({ key: "5", isEditing: false })).toBe("replace");
    expect(resolveEditableGridKey({ key: "Backspace", isEditing: false })).toBe("replace");
  });

  it("navigates from selection with Enter, Tab, and arrows", () => {
    for (const key of ["Enter", "Tab", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]) {
      expect(resolveEditableGridKey({ key, isEditing: false })).toBe("navigate");
    }
  });

  it("commits editing with Enter or Tab", () => {
    expect(resolveEditableGridKey({ key: "Enter", isEditing: true })).toBe("commit");
    expect(resolveEditableGridKey({ key: "Tab", isEditing: true })).toBe("commit");
  });

  it("cancels editing with Escape but leaves an open lookup menu alone", () => {
    expect(resolveEditableGridKey({ key: "Escape", isEditing: true })).toBe("cancel");
    expect(resolveEditableGridKey({ key: "Escape", isEditing: true, lookupOpen: true })).toBe("pass-through");
  });

  it("does not capture Ctrl+A or arrow movement while editing", () => {
    expect(resolveEditableGridKey({ key: "a", isEditing: false, ctrlKey: true })).toBe("pass-through");
    expect(resolveEditableGridKey({ key: "ArrowLeft", isEditing: true })).toBe("pass-through");
  });
});