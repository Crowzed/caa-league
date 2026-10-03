'use client';

import React, { useState, useRef } from 'react';
import { Upload, X, Image as ImageIcon, Link as LinkIcon, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export interface ImageUploadProps {
  value: string;
  onChange: (url: string) => void;
  bucket: 'avatars' | 'guild-logos';
  label?: string;
  description?: string;
  shape?: 'circle' | 'square';
  className?: string;
  allowUrlToggle?: boolean;
}

export function ImageUpload({
  value,
  onChange,
  bucket,
  label = 'Upload Image',
  description = 'Supports PNG, JPG, WEBP, or GIF up to 5MB',
  shape = 'circle',
  className,
  allowUrlToggle = true,
}: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [manualUrl, setManualUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (file: File) => {
    setErrorMessage(null);

    // Validate type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      setErrorMessage('Unsupported format. Please select a JPG, PNG, WEBP, or GIF file.');
      return;
    }

    // Validate size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('Image exceeds 5MB size limit. Please choose a smaller image.');
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('bucket', bucket);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to upload image.');
      }

      if (data.url) {
        onChange(data.url);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed. Please try again.';
      setErrorMessage(msg);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setManualUrl('');
    setErrorMessage(null);
  };

  const handleApplyManualUrl = () => {
    if (manualUrl.trim()) {
      onChange(manualUrl.trim());
      setShowUrlInput(false);
      setErrorMessage(null);
    }
  };

  const isCircle = shape === 'circle';

  return (
    <div className={cn('space-y-2.5', className)}>
      {label && (
        <div className="flex justify-between items-center">
          <Label className="text-xs font-semibold text-zinc-200">{label}</Label>
          {allowUrlToggle && (
            <button
              type="button"
              onClick={() => setShowUrlInput(!showUrlInput)}
              className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
            >
              <LinkIcon className="w-3 h-3" />
              {showUrlInput ? 'Switch to file upload' : 'Paste image URL instead'}
            </button>
          )}
        </div>
      )}

      {showUrlInput ? (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              type="url"
              placeholder="https://example.com/image.png"
              value={manualUrl}
              onChange={(e) => setManualUrl(e.target.value)}
              className="bg-zinc-950 border-zinc-800 text-xs"
            />
            <Button
              type="button"
              size="sm"
              onClick={handleApplyManualUrl}
              disabled={!manualUrl.trim()}
              className="text-xs shrink-0"
            >
              Apply
            </Button>
          </div>
          <p className="text-[11px] text-zinc-500">Enter a direct public link to an image.</p>
        </div>
      ) : (
        <div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleInputChange}
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
          />

          <div
            onClick={() => !isUploading && fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={cn(
              'relative group cursor-pointer border-2 border-dashed rounded-xl transition-all p-4 flex flex-col sm:flex-row items-center gap-4 bg-zinc-950/60',
              isDragging
                ? 'border-blue-500 bg-blue-500/10'
                : 'border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/40',
              isUploading && 'pointer-events-none opacity-80'
            )}
          >
            {/* Image Preview / Avatar Area */}
            <div className="relative shrink-0">
              {value ? (
                <div
                  className={cn(
                    'relative overflow-hidden border-2 border-zinc-700 bg-zinc-900 shadow-md',
                    isCircle ? 'w-20 h-20 rounded-full' : 'w-20 h-20 rounded-xl'
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={value}
                    alt="Upload Preview"
                    className="w-full h-full object-cover"
                  />
                  {!isUploading && (
                    <button
                      type="button"
                      onClick={handleRemove}
                      title="Remove image"
                      className="absolute top-1 right-1 p-1 bg-red-600/90 hover:bg-red-600 text-white rounded-full transition-all shadow-sm z-10"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ) : (
                <div
                  className={cn(
                    'flex items-center justify-center border-2 border-dashed border-zinc-700 bg-zinc-900 text-zinc-500',
                    isCircle ? 'w-20 h-20 rounded-full' : 'w-20 h-20 rounded-xl'
                  )}
                >
                  <ImageIcon className="w-8 h-8 opacity-40" />
                </div>
              )}

              {isUploading && (
                <div
                  className={cn(
                    'absolute inset-0 bg-black/70 flex items-center justify-center backdrop-blur-xs',
                    isCircle ? 'rounded-full' : 'rounded-xl'
                  )}
                >
                  <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
                </div>
              )}
            </div>

            {/* Instruction / Actions Area */}
            <div className="flex-1 text-center sm:text-left space-y-1">
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isUploading}
                  className="text-xs h-7 gap-1.5 border-zinc-700 text-zinc-200 bg-zinc-900 hover:bg-zinc-800"
                >
                  <Upload className="w-3 h-3" />
                  {value ? 'Change Image' : 'Select File to Upload'}
                </Button>
                {value && (
                  <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-medium">
                    <CheckCircle2 className="w-3 h-3" />
                    Ready
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-400 pt-0.5">
                Drag and drop an image here or click to browse.
              </p>
              <p className="text-[10px] text-zinc-500">{description}</p>
            </div>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="flex items-center gap-1.5 text-xs text-red-400 bg-red-950/20 border border-red-500/20 p-2 rounded-lg">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
}

