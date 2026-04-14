// src/components/employee/TaskAttachments.tsx
import React, { useState } from 'react';
import { Button } from '../../ui/button';
import { Paperclip, Download, Trash2, Image, File } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../../../firebase';
import { useAuth } from '../../../hooks/useAuth';

interface Attachment {
  id: string;
  name: string;
  url: string;
  size: number;
  type: string;
  uploadedBy: string;
  uploadedById: string;
}

interface TaskAttachmentsProps {
  projectId: string;
  taskId: string;
  attachments: Attachment[];
  canUpload: boolean;
  onUploadComplete: (attachment: Attachment) => void;
  onDeleteComplete: (attachmentId: string) => void;
}

const TaskAttachments: React.FC<TaskAttachmentsProps> = ({
  projectId,
  taskId,
  attachments,
  canUpload,
  onUploadComplete,
  onDeleteComplete,
}) => {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;
    setUploading(true);
    try {
      const storagePath = `tasks/${projectId}/${taskId}/${Date.now()}_${file.name}`;
      const fileRef = ref(storage, storagePath);
      const uploadTask = uploadBytesResumable(fileRef, file);
      await new Promise((resolve, reject) => {
        uploadTask.on('state_changed', null, reject, async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(downloadURL);
        });
      });
      const downloadURL = await getDownloadURL(fileRef);
      const attachment: Attachment = {
        id: Date.now().toString(),
        name: file.name,
        url: downloadURL,
        size: file.size,
        type: file.type,
        uploadedBy: user.name || 'Employee',
        uploadedById: user.id,
      };
      onUploadComplete(attachment);
      toast.success(`File "${file.name}" uploaded`);
    } catch (error) {
      console.error(error);
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (att: Attachment) => {
    try {
      const fileRef = ref(storage, att.url);
      await deleteObject(fileRef);
      onDeleteComplete(att.id);
      toast.success('Attachment deleted');
    } catch (error) {
      console.error(error);
      toast.error('Delete failed');
    }
  };

  return (
    <div className="border-t pt-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-medium">Attachments</h4>
        {canUpload && (
          <label className="cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium border px-3 py-1 hover:bg-gray-100">
            <Paperclip className="h-4 w-4 mr-1" />
            Upload
            <input type="file" className="hidden" onChange={handleFileSelect} disabled={uploading} />
          </label>
        )}
      </div>
      {attachments.length === 0 ? (
        <p className="text-xs text-gray-400">No attachments yet</p>
      ) : (
        <div className="space-y-2">
          {attachments.map((att) => (
            <div key={att.id} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {att.type.startsWith('image/') ? (
                  <Image className="h-4 w-4 text-blue-500 flex-shrink-0" />
                ) : (
                  <File className="h-4 w-4 text-gray-500 flex-shrink-0" />
                )}
                <span className="truncate">{att.name}</span>
                <span className="text-xs text-gray-400">({formatFileSize(att.size)})</span>
                <span className="text-xs text-gray-400">by {att.uploadedBy}</span>
              </div>
              <div className="flex items-center gap-1">
                <a href={att.url} target="_blank" rel="noopener noreferrer" className="p-1 hover:bg-gray-200 rounded">
                  <Download className="h-4 w-4 text-gray-600" />
                </a>
                {canUpload && (
                  <button onClick={() => handleDelete(att)} className="p-1 hover:bg-red-100 rounded">
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {uploading && <div className="mt-2 text-xs text-blue-500">Uploading...</div>}
    </div>
  );
};

export default TaskAttachments;