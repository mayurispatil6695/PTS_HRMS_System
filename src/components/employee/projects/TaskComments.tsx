// src/components/employee/projects/TaskComments.tsx
import React, { useState } from 'react';
import ReactQuill from 'react-quill';
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
  comments: Comment[]; // now expects an array
  employeesList: { id: string; name: string }[];
  onAddComment: (text: string, mentions: string[]) => Promise<void>;
}

const TaskComments: React.FC<TaskCommentsProps> = ({ comments = [], employeesList, onAddComment }) => {
  const [commentText, setCommentText] = useState('');
  const {
    quillRef,
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
            onChange={(val, delta, source, editor) => {
              setCommentText(val);
              handleEditorChange(val, delta, source, editor);
            }}
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
                    onClick={() => insertMention(emp.name)}
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