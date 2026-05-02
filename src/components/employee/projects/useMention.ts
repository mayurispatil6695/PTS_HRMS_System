// src/components/employee/projects/useMention.ts
import { useState, useRef, useEffect } from 'react';
import type { UnprivilegedEditor } from 'react-quill';

interface UseMentionOptions {
  employeesList: { id: string; name: string }[];
}

// Minimal Quill instance interface (the full editor from getEditor())
interface QuillInstance {
  getSelection(): { index: number; length: number } | null;
  getText(index: number, length: number): string;
  deleteText(index: number, length: number): void;
  insertText(index: number, text: string): void;
  setSelection(index: number): void;
  getBounds(index: number, length: number): { top: number; left: number; bottom: number; right: number };
  root: HTMLElement;
}

export const useMention = (options: UseMentionOptions) => {
  const { employeesList } = options;
  const [showMention, setShowMention] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
  const mentionDropdownRef = useRef<HTMLDivElement>(null);

  const filteredEmployees = employeesList.filter(emp =>
    emp.name.toLowerCase().includes(mentionFilter.toLowerCase())
  );

  // This function uses the full Quill instance (from ref) to insert mention
  const insertMention = (editor: QuillInstance, employeeName: string) => {
    const selection = editor.getSelection();
    if (!selection) return;

    const cursorPos = selection.index;
    const textBeforeCursor = editor.getText(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    if (lastAtIndex !== -1) {
      editor.deleteText(lastAtIndex, cursorPos - lastAtIndex);
      editor.insertText(lastAtIndex, `@${employeeName} `);
      editor.setSelection(lastAtIndex + employeeName.length + 2);
    }
    setShowMention(false);
    setMentionFilter('');
  };

  // This function uses the UnprivilegedEditor from ReactQuill's onChange
  const handleEditorChange = (editor: UnprivilegedEditor) => {
    const selection = editor.getSelection();
    if (!selection) {
      setShowMention(false);
      return;
    }
    const cursorPos = selection.index;
    const textBeforeCursor = editor.getText(0, cursorPos);
    const match = textBeforeCursor.match(/@([\w\s]*)$/);
    if (match) {
      const filter = match[1];
      setMentionFilter(filter);
      setShowMention(true);
      const bounds = editor.getBounds(cursorPos - filter.length - 1, 1);
      const editorElement = document.querySelector('.ql-editor');
      if (editorElement) {
        const editorRect = editorElement.getBoundingClientRect();
        const height = bounds.bottom - bounds.top;
        setMentionPosition({
          top: bounds.top - editorRect.top + height + 5,
          left: bounds.left - editorRect.left,
        });
      }
    } else {
      setShowMention(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (mentionDropdownRef.current && !mentionDropdownRef.current.contains(e.target as Node)) {
        setShowMention(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return {
    mentionDropdownRef,
    showMention,
    mentionPosition,
    filteredEmployees,
    insertMention,
    handleEditorChange,
  };
};