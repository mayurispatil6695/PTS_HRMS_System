// src/components/employee/projects/useMention.ts
import { useState, useRef, useEffect } from 'react';

interface UseMentionOptions {
  employeesList: { id: string; name: string }[];
}

export const useMention = (options: UseMentionOptions) => {
  const { employeesList } = options;
  const [showMention, setShowMention] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
  const quillRef = useRef<any>(null);
  const mentionDropdownRef = useRef<HTMLDivElement>(null);

  const filteredEmployees = employeesList.filter(emp =>
    emp.name.toLowerCase().includes(mentionFilter.toLowerCase())
  );

  const insertMention = (employeeName: string) => {
    if (!quillRef.current) return;
    const editor = quillRef.current.getEditor();
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

  const handleEditorChange = (content: string, delta: any, source: string, editor: any) => {
    if (source !== 'user') return;
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
        setMentionPosition({
          top: bounds.top - editorRect.top + bounds.height + 5,
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
    quillRef,
    mentionDropdownRef,
    showMention,
    mentionPosition,
    filteredEmployees,
    insertMention,
    handleEditorChange,
  };
};