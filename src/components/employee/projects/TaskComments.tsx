// src/components/employee/projects/TaskComments.tsx
import React, { useState, useRef } from 'react';
import ReactQuill from 'react-quill';
import type { UnprivilegedEditor } from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { Button } from '../../ui/button';
import { MessageSquare } from 'lucide-react';
import { useMention } from './useMention';

interface Comment {
  id: string;
  text: string;
  createdAt: string;
  createdBy: string;
}

interface TaskCommentsProps {
  comments: Comment[];
  employeesList: { id: string; name: string }[];
  onAddComment: (text: string, mentions: string[]) => Promise<void>;
}

const TaskComments: React.FC<TaskCommentsProps> = ({ comments = [], employeesList, onAddComment }) => {
  const [commentText, setCommentText] = useState('');
  const quillRef = useRef<ReactQuill>(null);
  const {
    mentionDropdownRef,
    showMention,
    mentionPosition,
    filteredEmployees,
    insertMention,
    handleEditorChange,
  } = useMention({ employeesList });

  const handleSubmit = async () => {
    if (!commentText.trim()) return;
    const mentionRegex = /@([^@\s]+(?: [^@\s]+)*)/g;
    const matches = commentText.matchAll(mentionRegex);
    const mentionedNames = [...matches].map(m => m[1]);
    const mentionedUserIds = employeesList.filter(emp => mentionedNames.includes(emp.name)).map(emp => emp.id);
    await onAddComment(commentText, mentionedUserIds);
    setCommentText('');
  };

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleString();

  const handleEditorValueChange = (
    value: string,
    _delta: unknown,
    _source: string,
    editor: UnprivilegedEditor
  ) => {
    setCommentText(value);
    handleEditorChange(editor);
  };

  const handleMentionSelect = (employeeName: string) => {
    if (quillRef.current) {
      const editor = quillRef.current.getEditor();
      insertMention(editor, employeeName);
      // Get updated HTML content from the editor's root element
      const updatedHtml = editor.root.innerHTML;
      setCommentText(updatedHtml);
    }
  };

  return (
    <div className="border-t pt-3">
      <h4 className="text-sm font-medium mb-2">Comments ({comments.length})</h4>
      <div className="space-y-3">
        {comments.map((comment) => (
          <div key={comment.id} className="text-sm bg-gray-50 p-3 rounded-lg">
            <div dangerouslySetInnerHTML={{ __html: comment.text }} className="text-gray-700" />
            <p className="text-xs text-gray-500 mt-1">
              {comment.createdBy} • {formatDate(comment.createdAt)}
            </p>
          </div>
        ))}
        <div className="space-y-2 relative">
          <ReactQuill
            ref={quillRef}
            value={commentText}
            onChange={handleEditorValueChange}
            placeholder="Add a comment... (use @ to mention someone)"
            modules={{
              toolbar: [['bold', 'italic', 'underline'], [{ list: 'ordered' }, { list: 'bullet' }], ['link', 'clean']],
            }}
          />
          {showMention && (
            <div
              ref={mentionDropdownRef}
              className="fixed z-[9999] bg-white border rounded-lg shadow-xl max-h-60 overflow-y-auto min-w-[180px]"
              style={{
                top: `${mentionPosition.top + (document.querySelector('.ql-editor')?.getBoundingClientRect().top || 0)}px`,
                left: `${mentionPosition.left + (document.querySelector('.ql-editor')?.getBoundingClientRect().left || 0)}px`,
              }}
            >
              {filteredEmployees.length > 0 ? (
                filteredEmployees.map(emp => (
                  <div
                    key={emp.id}
                    className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm border-b last:border-b-0"
                    onClick={() => handleMentionSelect(emp.name)}
                  >
                    {emp.name}
                  </div>
                ))
              ) : (
                <div className="px-4 py-2 text-sm text-gray-500">No employees found</div>
              )}
            </div>
          )}
          <Button size="sm" onClick={handleSubmit}>
            <MessageSquare className="h-4 w-4 mr-1" /> Add Comment
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TaskComments;